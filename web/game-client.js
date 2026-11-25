import {renderPlayerMenu,setupPlayerMenu} from './account-menu.js';
import {setupAdminTools} from './admin-tools.js';
import {playerProgress} from './player-progression.js';

const updates = typeof window !== 'undefined' && typeof BroadcastChannel === 'function'
 ? new BroadcastChannel('gdlb-online-updates') : null;
let opening;
let legacy;
let discordRequired=false;
let canAdmin=false;
let ordered = Promise.resolve();

async function exchange(url, options) {
 const response = await fetch(url, {cache:'no-store', credentials:'same-origin', ...options});
 const result = await response.json().catch(() => ({}));
 if(response.status===401&&discordRequired){
  opening=null;
  document.getElementById('gameAuthError').textContent='Your session has expired. Sign in again to continue.';
  renderAccount({signedIn:false,accountProvider:'discord',requiresSignIn:true});
 }
 if (!response.ok) throw Error(result.error || 'The game server is unavailable. Try again.');
 return result;
}

export function gameSession() {
 if (!opening) {
  const begin = () => exchange('/api/game');
  opening = (navigator.locks ? navigator.locks.request('gdlb-session', begin) : begin())
   .then(data => {
    renderAccount(data);
    if(data.playerProfile?.autoRefresh)refreshDiscordProfile(true);
    return data;
   })
   .catch(error => { opening = null; throw error; });
 }
 return opening;
}

export async function gameRead(view) {
 const initial = !opening;
 const session = await gameSession();
 if(session.requiresSignIn&&!session.signedIn)throw Error('Sign in with Discord to play.');
 const data = initial && view === 'wallet' ? session : await exchange('/api/game?view=' + view);
 if (view === 'wallet') renderAccount(data);
 return data[view];
}

async function submit(url,body) {
 const options = {method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
 try { return await exchange(url,options); }
 catch (error) {
  if (!(error instanceof TypeError)) throw error;
  return exchange(url,options);
 }
}

function queue(run) {
 const pending=ordered.then(run);
 ordered=pending.catch(()=>{});
 return pending;
}

export function gameCommand(action, args = {}, notice = 'changed') {
 return queue(async()=>{
  const session=await gameSession();
  if(session.requiresSignIn&&!session.signedIn)throw Error('Sign in with Discord to play.');
  const data=await submit('/api/game',{action,args,requestId:crypto.randomUUID()});
  renderAccount(data);
  if(notice)updates?.postMessage(notice);
  return data;
 });
}
export function onOtherTab(fn) { updates?.addEventListener('message', fn); }

function saveLinks(provider) {
 const link=document.getElementById('gameAccount');
 if(!link||!provider)return;
 const target=provider==='discord'?'/signin-with-discord':'/signin-with-chatgpt';
 link.href=target+'?return_to='+encodeURIComponent('/'+(location.hash||'#gacha'));
}

function refreshDiscordProfile(automatic=false) {
 const form=document.getElementById('playerProfileRefresh');
 if(!form)return;
 const params=new URLSearchParams({return_to:'/'+(location.hash||'#gacha')});
 if(automatic)params.set('automatic','1');
 form.action='/api/auth/discord/profile?'+params;
 form.submit();
}

function renderAccount({signedIn,accountProvider,requiresSignIn,wallet,playerProfile,admin}) {
 const account=document.getElementById('gameAccount');
 const logout=document.getElementById('gameSignOut');
 const transfer=document.getElementById('gameTransfer');
 const status=document.getElementById('gameSaveNotice');
 const locked=requiresSignIn&&!signedIn;
 discordRequired=Boolean(requiresSignIn);
 canAdmin=Boolean(signedIn&&admin);
 document.body.dataset.account=locked?'locked':'ready';
 document.getElementById('accountGate').hidden=!locked;
 document.getElementById('gameMain').hidden=locked;
 document.getElementById('gameGateLoading').hidden=true;
 document.getElementById('gameAuthRetry').hidden=true;
 if(locked)for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
 if(wallet){
  const {level,xp,goal,ratio}=playerProgress(wallet.playerXp);
  const track=document.getElementById('playerXpTrack');
  const progress=xp.toLocaleString('en-US')+' / '+goal.toLocaleString('en-US')+' XP to Level '+(level+1);
  document.getElementById('playerLevel').textContent='Level '+level;
  document.getElementById('playerXpPercent').textContent=Math.floor(ratio*100)+'%';
  track.style.setProperty('--xp-fill',ratio*100+'%');
  track.setAttribute('aria-valuemax',String(goal));
  track.setAttribute('aria-valuenow',String(xp));
  track.setAttribute('aria-valuetext',progress);
  track.title=progress;
 }
 if(account){
  account.hidden=!locked;
  account.dataset.provider=accountProvider||'';
  saveLinks(accountProvider);
 }
 if(logout)logout.hidden=accountProvider!=='discord'||!signedIn;
 renderPlayerMenu(accountProvider==='discord'&&signedIn,playerProfile);
 if(!transfer||!wallet)return;
 const receipt=wallet.legacyTransfer;
 if(receipt)transfer.hidden=true;
 if(receipt?.skipped&&status)status.textContent='Transferred save. '+receipt.skipped+' older card entries are in a browser backup.';
 legacy??=import('./legacy-game.js').then(module=>module.findLegacySave()).catch(()=>null);
 legacy.then(async saved=>{
  if(receipt&&saved?.id===receipt.id){
   const {finishLegacyTransfer}=await import('./legacy-game.js');
   await finishLegacyTransfer(receipt);
   legacy=Promise.resolve(null);
  }
  if(!transfer.disabled)transfer.hidden=Boolean(receipt)||!saved;
 }).catch(()=>{});
}

if (typeof document !== 'undefined') {
 setupPlayerMenu({loadStats:()=>gameRead('profile'),sendReport:body=>submit('/api/game/report',body)});
 setupAdminTools({canOpen:()=>canAdmin,loadWallet:()=>gameRead('wallet'),run:async(action,args)=>{
  const data=await gameCommand(action,args);
  if(action==='admin.adjust')document.dispatchEvent(new CustomEvent('gdlb-admin-wallet',{detail:data.wallet}));
  return data;
 }});
 document.getElementById('playerProfileRefresh')?.addEventListener('submit',event=>{
  event.preventDefault();
  refreshDiscordProfile();
 });
 const url=new URL(location.href);
 const error=url.searchParams.get('discord');
 const profileError=url.searchParams.get('discord_profile');
 const status=document.getElementById('gameSaveNotice');
 if(url.searchParams.get('save')==='local')url.searchParams.delete('save');
 if(error){
  url.searchParams.delete('discord');
  const message=document.getElementById('gameAuthError');
  if(message)message.textContent=error==='cancelled'?'Discord sign-in was cancelled.':'Discord sign-in could not finish. Try again.';
 }
 if(profileError){
  url.searchParams.delete('discord_profile');
  const note=document.getElementById('playerProfileRefreshNote');
  if(note)note.textContent=profileError==='mismatch'
   ?'Discord is open to a different account. Use the account linked to this save.'
   :'Continue with Discord to load your name and avatar for this save.';
 }
 if(url.href!==location.href)history.replaceState(history.state,'',url);
 window.addEventListener('hashchange',()=>saveLinks(document.getElementById('gameAccount')?.dataset.provider));
 const transfer=document.getElementById('gameTransfer');
 transfer?.addEventListener('click',async()=>{
  transfer.disabled=true;
  status.textContent='Transferring your save…';
  try{
   const {readLegacyTransfer,finishLegacyTransfer}=await import('./legacy-game.js');
   const snapshot=await readLegacyTransfer();
   if(!snapshot){transfer.hidden=true;status.textContent='';return;}
   const data=await queue(async()=>{
    await gameSession();
    return submit('/api/game/transfer',snapshot);
   });
   transfer.hidden=true;
   await finishLegacyTransfer(data.result).catch(()=>{});
   updates?.postMessage('changed');
   location.reload();
  }catch(error){
   status.textContent=error.message;
  }finally{transfer.disabled=false;}
 });
}
