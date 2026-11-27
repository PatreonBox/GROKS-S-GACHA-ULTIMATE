import {ico} from './icons.js';
import {demonKeyDiscordBonus} from './demon-keys.js';

const kindContent={
 'trade-request':['New trade request','exchange',name=>(name||'A player')+' sent you a trade offer.'],
 'trade-accepted':['Trade accepted','check',name=>(name||'The other player')+' accepted your trade.'],
 'trade-declined':['Trade declined','x',name=>(name||'The other player')+' declined your trade.'],
 'discord-key-bonus':['Discord membership reward','demonKey',()=>demonKeyDiscordBonus+' Demon Keys were added to your wallet.']
};
const messages={
 cancelled:'Discord verification was cancelled. You can try again whenever you are ready.',
 mismatch:'Use the Discord account linked to this save.',
 'not-member':'Join the official Discord from the link by your wallet, then verify again.',
 pending:'Finish the server’s membership screening in Discord, then verify again.',
 unavailable:'Discord membership could not be checked. Try again in a moment.',
 failed:'Discord membership could not be checked. Try again in a moment.'
};
const timeFormat=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'});
const empty=()=>({unread:0,list:[]});

function noticeItem(notice){
 const [heading,icon,description]=kindContent[notice.kind];
 const item=document.createElement('li');
 const link=notice.tradeId?document.createElement('a'):document.createElement('button');
 link.className='notification-item';
 link.dataset.noticeId=notice.id;
 link.dataset.unread=String(!notice.read);
 if(notice.tradeId)link.href='#trading/trade/'+notice.tradeId;
 else link.type='button';
 link.innerHTML='<i class="notification-kind" aria-hidden="true">'+ico(icon)+'</i><span class="notification-detail"><b></b><small></small><time></time></span>'+(!notice.read?'<mark aria-label="Unread"></mark>':'');
 link.querySelector('b').textContent=heading;
 link.querySelector('small').textContent=description(notice.playerName);
 const at=new Date(notice.createdAt),time=link.querySelector('time');
 time.dateTime=at.toISOString();time.textContent=timeFormat.format(at);
 item.append(link);
 return item;
}

export function setupNotifications({load,mark,membershipResult}){
 const panel=document.getElementById('gameNotifications'),bell=document.getElementById('notificationBell');
 const badge=document.getElementById('notificationUnread'),list=document.getElementById('notificationList');
 const readAll=document.getElementById('readNotifications'),status=document.getElementById('notificationsStatus');
 const check=document.getElementById('discordKeyCheck'),reward=document.querySelector('[data-discord-invite-reward]');
 let account=false,claimed=false,changing=false,loading=false,serial=0,seenData=false,previous='',state=empty(),pollId;
 let result=membershipResult;
 const hide=()=>{if(panel.matches(':popover-open'))panel.hidePopover();};
 function paint(){
  badge.hidden=!state.unread;
  badge.textContent=state.unread||'';
  bell.setAttribute('aria-label',state.unread?'Notifications, '+state.unread+' unread':'Notifications');
  readAll.hidden=!state.unread;
  readAll.disabled=changing;
  const key=JSON.stringify(state.list);
  if(key===previous)return;
  const focused=document.activeElement?.closest('[data-notice-id]')?.dataset.noticeId;
  previous=key;
  list.replaceChildren(...state.list.filter(notice=>Object.hasOwn(kindContent,notice.kind)).map(noticeItem));
  if(focused)list.querySelector('[data-notice-id="'+focused+'"]')?.focus({preventScroll:true});
 }
 function showStatus(error){
  status.textContent=error||result==='verified'&&(claimed?'Discord membership verified. Your 15 keys are in your wallet.':'Discord membership verified. You need space in your wallet for 15 keys.')||
   messages[result]||(!seenData?'Loading notifications…':state.list.length?'':'No notifications yet.');
 }
 async function refresh(){
  if(!account||document.hidden||loading||changing)return;
  const version=serial;
  loading=true;
  try{
   const next=await load();
   if(version!==serial||!account)return;
   state=next;seenData=true;paint();showStatus();
  }catch{
   if(version===serial&&account&&!seenData)showStatus('Notifications could not load. Open the bell again to retry.');
  }finally{loading=false;}
 }
 async function markRead(payload){
  if(!account||changing)return;
  changing=true;
  const version=++serial;
  paint();
  try{
   const next=await mark(payload);
   if(version!==serial||!account)return;
   state=next;seenData=true;showStatus();
  }catch{
   if(version===serial&&account)showStatus('Notifications could not be marked read. Try again.');
  }finally{
   changing=false;
   paint();
  }
 }
 function position(){
  const bounds=bell.getBoundingClientRect(),viewport=document.documentElement;
  const top=Math.max(10,bounds.bottom+8);
  panel.style.setProperty('--notice-top',top+'px');
  panel.style.setProperty('--notice-right',Math.max(10,viewport.clientWidth-bounds.right)+'px');
  panel.style.setProperty('--notice-height',Math.max(120,viewport.clientHeight-top-10)+'px');
 }
 panel.addEventListener('beforetoggle',event=>{if(event.newState==='open'){position();showStatus();refresh();}});
 panel.addEventListener('toggle',()=>{bell.setAttribute('aria-expanded',String(panel.matches(':popover-open')));});
 list.addEventListener('click',event=>{
  const link=event.target.closest('[data-notice-id]');
  if(!link)return;
  result=null;
  if(link.dataset.unread==='true')markRead({id:Number(link.dataset.noticeId)});
  if(link.matches('a'))hide();
 });
 readAll.addEventListener('click',()=>{result=null;markRead({through:state.list[0]?.id});});
 check.addEventListener('submit',()=>{
  check.action='/api/auth/discord/membership?'+new URLSearchParams({return_to:'/'+(location.hash||'#gacha')});
 });
 document.addEventListener('visibilitychange',refresh);
 window.addEventListener('focus',refresh);
 window.addEventListener('resize',()=>{if(panel.matches(':popover-open'))position();});
 return {refresh,setAccount({signedIn,discord,keyBonusClaimed}){
  if(typeof keyBonusClaimed==='boolean')claimed=keyBonusClaimed;
  check.hidden=!discord||claimed;
  reward.textContent=claimed?'15 free keys claimed':'Get 15 free keys!';
  if(account===signedIn)return;
  account=signedIn;
  bell.hidden=!account;
  if(!account){
   serial++;clearInterval(pollId);hide();state=empty();seenData=false;paint();
   return;
  }
  refresh();
  pollId=setInterval(refresh,30_000);
  if(result)queueMicrotask(()=>{if(account&&!panel.matches(':popover-open'))panel.showPopover();});
 }};
}
