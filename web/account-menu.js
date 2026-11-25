const numberFormat = new Intl.NumberFormat(undefined, {maximumFractionDigits: 1});

export function renderPlayerMenu(signedIn, profile) {
 const menu = document.getElementById('playerMenu');
 if(!menu)return;
 menu.hidden = !signedIn;
 if(!signedIn){menu.open=false;return;}
 const name = profile?.name || 'Discord player';
 const handle = profile?.username;
 for(const node of document.querySelectorAll('[data-player-name]'))node.textContent=name;
 for(const node of document.querySelectorAll('[data-player-handle]'))node.textContent=handle?'@'+handle:'Discord';
 for(const node of document.querySelectorAll('[data-player-initial]'))node.textContent=Array.from(name)[0].toLocaleUpperCase();
 for(const img of document.querySelectorAll('[data-player-avatar]')){
  if(!profile?.avatarUrl){img.hidden=true;img.removeAttribute('src');}
  else if(img.getAttribute('src')!==profile.avatarUrl){img.hidden=true;img.src=profile.avatarUrl;}
 }
 document.getElementById('playerProfileRefresh').hidden=Boolean(handle);
}

export function setupPlayerMenu({loadStats, sendReport}) {
 const menu=document.getElementById('playerMenu');
 if(!menu)return;
 const summary=menu.querySelector('summary');
 const profile=document.getElementById('playerProfile');
 const stats=document.getElementById('playerStats');
 const statsStatus=document.getElementById('playerStatsStatus');
 const report=document.getElementById('bugReport');
 const form=document.getElementById('bugReportForm');
 const status=document.getElementById('bugReportStatus');
 const send=document.getElementById('sendBugReport');
 const fields=form.querySelector('fieldset');
 let reference,submitted=false,sending=false,statsRequest=0;

 for(const img of document.querySelectorAll('[data-player-avatar]')){
  img.addEventListener('load',()=>{img.hidden=false;});
  img.addEventListener('error',()=>{img.hidden=true;});
 }
 document.addEventListener('pointerdown',event=>{
  if(menu.open&&!menu.contains(event.target))menu.open=false;
 });
 menu.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&menu.open){menu.open=false;summary.focus();}
 });
 window.addEventListener('hashchange',()=>{menu.open=false;});
 for(const dialog of [profile,report]){
  for(const button of dialog.querySelectorAll('[data-close-player-dialog]')){
   button.addEventListener('click',()=>dialog.close());
  }
  dialog.addEventListener('close',()=>{if(!menu.hidden)summary.focus();});
 }

 document.getElementById('openPlayerProfile').addEventListener('click',async()=>{
  menu.open=false;
  stats.hidden=true;
  statsStatus.textContent='Loading your stats…';
  profile.showModal();
  const request=++statsRequest;
  try{
   const values=await loadStats();
   if(request!==statsRequest||!profile.open)return;
   for(const entry of stats.querySelectorAll('[data-player-stat]')){
    entry.textContent=numberFormat.format(values[entry.dataset.playerStat]||0);
   }
   stats.hidden=false;
   statsStatus.textContent='';
  }catch(error){if(request===statsRequest)statsStatus.textContent=error.message;}
 });

 document.getElementById('openBugReport').addEventListener('click',()=>{
  menu.open=false;
  if(submitted){form.reset();reference=undefined;status.textContent='';submitted=false;}
  send.disabled=sending;
  fields.disabled=sending;
  report.showModal();
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(sending||submitted)return;
  const input=Object.fromEntries(new FormData(form));
  const page=location.hash.split(/[?=&]/,1)[0];
  reference??=crypto.randomUUID();
  sending=true;
  send.disabled=true;
  fields.disabled=true;
  status.textContent='Sending report…';
  status.dataset.error='false';
  try{
   const {reportId}=await sendReport({...input,page,reportId:reference});
   submitted=true;
   status.textContent='Report received. Reference '+reportId.slice(0,8)+'.';
  }catch(error){
   status.textContent=error.message;
   status.dataset.error='true';
  }finally{
   sending=false;
   send.disabled=submitted;
   fields.disabled=submitted;
  }
 });
}
