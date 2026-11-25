const categories=new Map([
 ['combat','Combat'],['campaign','Campaign'],['army','Army Mode'],['training','Training and minigames'],
 ['cards','Packs and cards'],['economy','Coins and gems'],['account','Account and saves'],['utility','Utilities and display'],['other','Other']
]);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const minute=60_000;
const fail=(error,status=400)=>({body:{error},status});
const valid=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max&&!value.includes('\0');

export function createBugReports(sqlite,{apiKey,from,to},send=fetch){
 const canSend=Boolean(apiKey&&from&&to);
 let busy=false,lastAttempt=0;

 async function deliver(){
  const now=Date.now();
  if(!canSend||busy||now-lastAttempt<10_000)return;
  busy=true;
  try{
   const job=sqlite.prepare(`UPDATE game_bug_reports SET attempts=attempts+1,retry_at=?
    WHERE report_id=(SELECT report_id FROM game_bug_reports WHERE sent_at IS NULL AND retry_at<=?
      ORDER BY retry_at,created_at LIMIT 1) RETURNING report_id,payload,attempts,created_at`)
    .get(now+minute,now);
   if(!job)return;
   lastAttempt=now;
   const report=JSON.parse(job.payload);
   const subject=`[Geometry Dash Kingdom] ${report.category} bug · ${job.report_id.slice(0,8)}`;
   const text=[`Report ${job.report_id}`,`Submitted ${new Date(job.created_at).toISOString()}`,
    `Player: ${report.name}`,`Page: ${report.page}`,`Summary: ${report.title}`,
    `Steps to reproduce\n${report.steps}`,`What happened\n${report.actual}`,`Expected result\n${report.expected}`].join('\n\n');
   try{
    const response=await send('https://api.resend.com/emails',{
     method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
     headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':'gd-bug/'+job.report_id},
     body:JSON.stringify({from,to:[to],subject,text})
    });
    if(!response.ok)throw Error('HTTP '+response.status);
    sqlite.prepare('UPDATE game_bug_reports SET sent_at=? WHERE report_id=?').run(Date.now(),job.report_id);
   }catch(error){
    const delay=Math.min(60*minute,minute*2**Math.min(6,job.attempts-1));
    sqlite.prepare('UPDATE game_bug_reports SET retry_at=? WHERE report_id=?').run(Date.now()+delay,job.report_id);
    console.warn('Bug report delivery will retry:',error.message);
   }
  }catch(error){console.error('Bug report outbox failed:',error.message);}
  finally{busy=false;}
 }

 return {
  submit(discordId,profile,{reportId,category,title,steps,actual,expected,page}){
   if(typeof reportId!=='string'||!uuid.test(reportId))return fail('Reload the report form and try again.');
   if(!categories.has(category))return fail('Choose a bug category.');
   if(!valid(title,8,100))return fail('Enter a summary with 8 to 100 characters.');
   if(!valid(steps,15,1200))return fail('Enter at least 15 characters about how to reproduce the bug.');
   if(!valid(actual,10,1200))return fail('Enter at least 10 characters about what happened.');
   if(!valid(expected,8,800))return fail('Enter at least 8 characters about what you expected.');
   const now=Date.now();
   const previous=sqlite.prepare('SELECT discord_id FROM game_bug_reports WHERE report_id=?').get(reportId);
   const receipt={body:{reportId},status:202};
   if(previous)return previous.discord_id===discordId?receipt:fail('Reopen the report form and try again.',409);
   const payload=JSON.stringify({name:profile?.name||'Discord player',category:categories.get(category),
    title:title.trim(),steps:steps.trim(),actual:actual.trim(),expected:expected.trim(),
    page:typeof page==='string'&&/^#[-a-z0-9/]{1,70}$/i.test(page)?page:'Game'});
   const saved=sqlite.prepare(`INSERT INTO game_bug_reports(report_id,discord_id,payload,created_at,retry_at)
    SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM game_bug_reports WHERE discord_id=? AND created_at>?)
    AND (SELECT COUNT(*) FROM game_bug_reports WHERE discord_id=? AND created_at>?)<3
    AND (SELECT COUNT(*) FROM game_bug_reports WHERE sent_at IS NULL)<500`)
    .run(reportId,discordId,payload,now,now,discordId,now-minute,discordId,now-60*minute);
   if(!saved.changes)return fail('The report limit has been reached. Wait a few minutes and try again.',429);
   return receipt;
  },
  deliver,
  start(){
   if(!canSend)return;
   void deliver();
   return setInterval(deliver,15_000).unref();
  }
 };
}
