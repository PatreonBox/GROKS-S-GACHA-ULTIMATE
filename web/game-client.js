export const localSave = typeof location !== 'undefined' && new URLSearchParams(location.search).get('save') === 'local';
const updates = typeof window !== 'undefined' && typeof BroadcastChannel === 'function'
 ? new BroadcastChannel(localSave ? 'gdlb-pack-updates' : 'gdlb-online-updates') : null;
let opening;
let ordered = Promise.resolve();

async function exchange(url, options) {
 const response = await fetch(url, {cache:'no-store', credentials:'same-origin', ...options});
 const result = await response.json().catch(() => ({}));
 if (!response.ok) throw Error(result.error || 'The game server is unavailable. Try again.');
 return result;
}

function connect() {
 if (!opening) {
  const begin = () => exchange('/api/game');
  opening = (navigator.locks ? navigator.locks.request('gdlb-session', begin) : begin())
   .catch(error => { opening = null; throw error; });
 }
 return opening;
}

export async function gameRead(view) {
 if (localSave) {
  const {readLocal} = await import('./legacy-game.js');
  return readLocal(view);
 }
 const initial = !opening;
 const session = await connect();
 const data = initial && view === 'wallet' ? session : await exchange('/api/game?view=' + view);
 if (view === 'wallet') renderAccount(data);
 return data[view];
}
export function gameCommand(action, args = {}, notice = 'changed') {
 const run = async () => {
  let data;
  if (localSave) {
   const {playLocal} = await import('./legacy-game.js');
   data = await playLocal(action, args);
  } else {
   await connect();
   const options = {method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action, args, requestId:crypto.randomUUID()})};
   try { data = await exchange('/api/game', options); }
   catch (error) {
    if (!(error instanceof TypeError)) throw error;
    data = await exchange('/api/game', options);
   }
   renderAccount(data);
  }
  if (notice) updates?.postMessage(notice);
  return data;
 };
 const pending = ordered.then(run);
 ordered = pending.catch(() => {});
 return pending;
}
export function onOtherTab(fn) { updates?.addEventListener('message', fn); }

function renderAccount({signedIn,accountSignIn=true}) {
 const account = document.getElementById('gameAccount');
 if (account) account.hidden = Boolean(signedIn||!accountSignIn);
 if (!accountSignIn) {
  const label = document.getElementById('gameSaveMode');
  const local = document.getElementById('gameLocal');
  if (label) { label.textContent = 'Guest save'; label.title = 'Your server save is linked to this browser.'; }
  if (local) local.hidden = true;
 }
}
if (typeof document !== 'undefined') {
 const local = document.getElementById('gameLocal');
 const label = document.getElementById('gameSaveMode');
 const account = document.getElementById('gameAccount');
 if (label) label.textContent = localSave ? 'Local save · unranked' : 'Online save';
 if (local) local.textContent = localSave ? 'Switch to online save' : 'Open old local save';
 function saveLinks() {
  if (local) local.href = (localSave ? '/' : '/?save=local') + (location.hash || '#gacha');
  if (account) account.href = '/signin-with-chatgpt?return_to=' + encodeURIComponent('/' + (location.hash || '#gacha'));
 }
 saveLinks();
 window.addEventListener('hashchange',saveLinks);
}
