import {prepareGameAction, newWallet} from './game-rules.js';
import {normalizeWallet, pool} from './pack-engine.js';

let connection;
function legacyDatabase() {
 if (!connection) connection = new Promise((resolve, reject) => {
  const request = indexedDB.open('gd-lvl-battles-packs', 2);
  request.onupgradeneeded = event => {
   const db = request.result;
   if (!event.oldVersion) {
    db.createObjectStore('profile').put(newWallet(), 'wallet');
    db.createObjectStore('cards', {keyPath:'id'});
   } else {
    const profile = request.transaction.objectStore('profile');
    const old = profile.get('wallet');
    old.onsuccess = () => profile.put({gems:10,luck:0,bonus:0,...old.result}, 'wallet');
   }
  };
  request.onsuccess = () => {
   const db = request.result;
   db.onversionchange = () => { db.close(); connection = null; };
   resolve(db);
  };
  request.onerror = () => reject(request.error);
 }).catch(error => { connection = null; throw error; });
 return connection;
}
export async function readLocal(view) {
 const db = await legacyDatabase();
 return new Promise((resolve, reject) => {
  const store = db.transaction(view === 'cards' ? 'cards' : 'profile').objectStore(view === 'cards' ? 'cards' : 'profile');
  const request = view === 'cards' ? store.getAll() : store.get('wallet');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(view === 'cards' ? request.result : normalizeWallet(request.result));
 });
}
export async function playLocal(name, args) {
 const action = await prepareGameAction(name, args, pool);
 const db = await legacyDatabase();
 return new Promise((resolve, reject) => {
  const tx = db.transaction(action.cards ? ['profile', 'cards'] : ['profile'], 'readwrite');
  const profile = tx.objectStore('profile');
  const wallet = profile.get('wallet');
  const inventory = action.cards ? tx.objectStore('cards') : null;
  let result, error;
  function apply(records) {
   try {
    const state = normalizeWallet(wallet.result);
    const changes = new Map();
    const reply = action.apply(state, records, changes, Date.now(), false);
    for (const record of changes.values()) inventory.put(record);
    profile.put(state, 'wallet');
    result = {wallet:state, result:reply};
   } catch (cause) { error = cause; tx.abort(); }
  }
  wallet.onsuccess = () => {
   if (!inventory) return apply([]);
   const request = inventory.getAll();
   request.onsuccess = () => apply(request.result);
  };
  tx.oncomplete = () => resolve(result);
  tx.onabort = () => reject(error || tx.error || Error('The local save could not be written.'));
 });
}
