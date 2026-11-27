import {cardRarity} from '../web/card-rarity.js';
import {addCardSerials} from '../web/card-serials.js';

const editionKey=(id,finish)=>id+':'+finish;
const exotic=7;

export function draftCardEditions(){
 const drafts=[];
 function mint(card,finish){
  if(cardRarity(card.row,card.row[10]).index<exotic)return undefined;
  const token=-1-drafts.length;
  drafts.push({id:card.id,finish,token});
  addCardSerials(card,finish,[token]);
  return token;
 }
 async function resolve(db,changes,pull,merge){
  if(!drafts.length)return [];
  const reserved=new Set();
  for(const card of changes.values())for(const serials of Object.values(card.serials||{})){
   for(const serial of serials)if(serial<0)reserved.add(serial);
  }
  const groups=new Map();
  for(const {id,finish,token} of drafts){
   if(!reserved.has(token))continue;
   const key=editionKey(id,finish);
   if(!groups.has(key))groups.set(key,{id,finish,tokens:[]});
   groups.get(key).tokens.push(token);
  }
  if(!groups.size){if(merge)delete merge.serial;return []}
  const {results}=await db.prepare(`SELECT json_extract(e.value,'$.id') AS id,
   json_extract(e.value,'$.finish') AS finish, COALESCE(s.last_number,0) AS previous
   FROM json_each(?) e LEFT JOIN game_card_editions s
   ON s.level_id=json_extract(e.value,'$.id') AND s.finish=json_extract(e.value,'$.finish')`)
   .bind(JSON.stringify([...groups.values()].map(({id,finish})=>({id,finish})))).all();
  const numbers=new Map(),updates=[];
  for(const {id,finish,previous} of results){
   const {tokens}=groups.get(editionKey(id,finish)),next=previous+tokens.length;
   if(!Number.isSafeInteger(next))throw Error('The card edition reached its serial number limit.');
   tokens.forEach((token,i)=>numbers.set(token,previous+i+1));
   updates.push({id,finish,previous,next});
  }
  const issued=serial=>serial<0?numbers.get(serial):serial;
  for(const card of changes.values())for(const [finish,serials] of Object.entries(card.serials||{})){
   card.serials[finish]=serials.map(issued);
  }
  if(pull?.serials)for(const [index,serial] of Object.entries(pull.serials))pull.serials[index]=issued(serial);
  if(merge?.serial<0)merge.serial=issued(merge.serial);
  return updates;
 }
 return {mint,resolve};
}
