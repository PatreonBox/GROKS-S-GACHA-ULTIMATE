const database='gd-lvl-battles-packs';
const transferKey='online-transfer-id';
const receiptKey='online-transfer-receipt';
const walletFields=['coins','gems','luck','bonus','redeemedCodes','mine','cubeCatalogVersion','ownedCubes',
 'equippedCube','training','drillBest','campaign','armyTrilogy','armySeries','remixBest','remixWins','squad'];

function openOldDatabase(){
 if(!globalThis.indexedDB)return Promise.resolve(null);
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(database);
  let missing=false;
  request.onupgradeneeded=()=>{
   missing=true;
   request.transaction.abort();
  };
  request.onerror=()=>missing?resolve(null):reject(request.error);
  request.onsuccess=()=>{
   const db=request.result;
   if(db.objectStoreNames.contains('profile')&&db.objectStoreNames.contains('cards'))resolve(db);
   else{db.close();resolve(null);}
  };
 });
}

function hasProgress(wallet,cards){
 return cards>0||Boolean(wallet&&((wallet.coins??1500)!==1500||(wallet.gems??10)!==10||
  wallet.luck||wallet.bonus||wallet.mine||wallet.ownedCubes?.length||wallet.training||
  wallet.campaign||wallet.armySeries||wallet.armyTrilogy||wallet.remixBest||wallet.redeemedCodes));
}

async function readSave(transfer){
 const db=await openOldDatabase();
 if(!db)return null;
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(['profile','cards'],transfer?'readwrite':'readonly');
   const profile=tx.objectStore('profile'),inventory=tx.objectStore('cards');
   const wallet=profile.get('wallet'),receipt=profile.get(receiptKey),id=profile.get(transferKey);
   const cards=transfer?inventory.getAll():inventory.count();
   let snapshot=null;
   cards.onsuccess=()=>{
    const count=transfer?cards.result.length:cards.result;
    if(receipt.result||!hasProgress(wallet.result,count))return;
    let transferId=id.result;
    if(!transfer){snapshot={id:transferId};return;}
    if(!transferId){
     transferId=crypto.randomUUID();
     profile.put(transferId,transferKey);
    }
    const old=wallet.result||{};
    snapshot={id:transferId,
     wallet:Object.fromEntries(walletFields.filter(key=>Object.hasOwn(old,key)).map(key=>[key,old[key]])),
     cards:cards.result.map(card=>[card.id,card.copies,card.holoCopies,card.antimatterCopies,
      Number(Boolean(card.everHolo))+2*Number(Boolean(card.everAntimatter)),card.indexReward,card.last])
    };
   };
   tx.oncomplete=()=>resolve(snapshot);
   tx.onabort=()=>reject(tx.error||Error('The old browser save could not be read.'));
  });
 }finally{db.close();}
}

export const findLegacySave=()=>readSave(false);
export const readLegacyTransfer=()=>readSave(true);

export async function finishLegacyTransfer(receipt){
 const db=await openOldDatabase();
 if(!db)return;
 try{
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(['profile','cards'],'readwrite'),profile=tx.objectStore('profile');
   const id=profile.get(transferKey);
   id.onsuccess=()=>{
    if(id.result!==receipt.id)return;
    // Keep a backup if the current catalogue cannot recover every old card.
    if(!receipt.skipped){profile.delete('wallet');tx.objectStore('cards').clear();}
    profile.put(receipt.id,receiptKey);
   };
   tx.oncomplete=resolve;
   tx.onabort=()=>reject(tx.error||Error('The transfer receipt could not be recorded.'));
  });
 }finally{db.close();}
}
