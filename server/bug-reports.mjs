const categories=new Map([
 ['combat','Combat'],['campaign','Campaign'],['army','Army Mode'],['training','Training and minigames'],
 ['cards','Packs and cards'],['economy','Coins and gems'],['account','Account and saves'],['utility','Utilities and display'],['other','Other']
]);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const minute=60_000;
const hour=60*minute;
const reportCooldown=24*hour;
const fail=(error,status=400)=>({body:{error},status});
const valid=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max&&!value.includes('\0');

function received(reportId,payload,createdAt){
 const {category,title,steps,actual,expected,page}=JSON.parse(payload);
 return {body:{reportId,receipt:{category,title,steps,actual,expected,page,createdAt}},status:202};
}

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

 function saveReport(discordId,reportId,payload,now){
  const previous=sqlite.prepare('SELECT discord_id,payload,created_at FROM game_bug_reports WHERE report_id=?').get(reportId);
  if(previous)return previous.discord_id===discordId?received(reportId,previous.payload,previous.created_at):
   fail('Reopen the report form and try again.',409);

  const cooldown=sqlite.prepare('SELECT blocked_until FROM game_bug_report_cooldowns WHERE discord_id=?').get(discordId);
  if(cooldown?.blocked_until>now)return fail('An error occured',429);
  const recent=sqlite.prepare(`SELECT MAX(created_at) AS last,COUNT(*) AS count
   FROM game_bug_reports WHERE discord_id=? AND created_at>?`).get(discordId,now-hour);
  if(recent.last>now-minute||recent.count>=3){
   sqlite.prepare(`INSERT INTO game_bug_report_cooldowns(discord_id,blocked_until) VALUES(?,?)
    ON CONFLICT(discord_id) DO UPDATE SET blocked_until=excluded.blocked_until`).run(discordId,now+reportCooldown);
   return fail('An error occured',429);
  }

  const pending=sqlite.prepare('SELECT COUNT(*) AS count FROM game_bug_reports WHERE sent_at IS NULL').get().count;
  if(pending>=500)return fail('Bug reports are temporarily unavailable.',503);
  sqlite.prepare(`INSERT INTO game_bug_reports(report_id,discord_id,payload,created_at,retry_at) VALUES(?,?,?,?,?)`)
   .run(reportId,discordId,payload,now,now);
  return received(reportId,payload,now);
 }

 return {
  submit(discordId,profile,{reportId,category,title,steps,actual,expected,page}){
   if(typeof reportId!=='string'||!uuid.test(reportId))return fail('Reload the report form and try again.');
   if(!categories.has(category))return fail('Choose a bug category.');
   if(!valid(title,8,100))return fail('Enter a summary with 8 to 100 characters.');
   if(!valid(steps,15,1200))return fail('Enter at least 15 characters about how to reproduce the bug.');
   if(!valid(actual,10,1200))return fail('Enter at least 10 characters about what happened.');
   if(!valid(expected,8,800))return fail('Enter at least 8 characters about what you expected.');
   const payload=JSON.stringify({name:profile?.name||'Discord account',category:categories.get(category),
    title:title.trim(),steps:steps.trim(),actual:actual.trim(),expected:expected.trim(),
    page:typeof page==='string'&&/^#[-a-z0-9/]{1,70}$/i.test(page)?page:'Game'});
   sqlite.exec('BEGIN IMMEDIATE');
   try{
    const result=saveReport(discordId,reportId,payload,Date.now());
    sqlite.exec('COMMIT');
    return result;
   }catch(error){
    sqlite.exec('ROLLBACK');
    throw error;
   }
  },
  deliver,
  start(){
   if(!canSend)return;
   void deliver();
   return setInterval(deliver,15_000).unref();
  }
 };
}
