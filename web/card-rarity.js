const definitions=[
 ['Common','#aeb9cf'],['Uncommon','#8ad6ae'],['Rare','#84c8ff'],['Epic','#c4a0ff'],
 ['Legendary','#ffd47a'],['Mythic','#ff9aab'],['Ancient','#f0ae7a'],['Exotic','#76e9cf'],
 ['Celestial','#b5b5ff'],['Secret','#ed90f1'],['Divine','#ffebae'],['Apex','#ff9d84'],['Impossible','#e6c1ff']
];

export const cardRarities=Object.freeze(definitions.map(([label,color],index)=>Object.freeze({
 id:label.toLowerCase(),label,color,index
})));
const difficultyIndex=new Map([
 ['Unrated',0],['Auto',0],['Easy',0],['Normal',0],['Hard',1],['Harder',1],
 ['Insane',2],['Easy Demon',2],['Medium Demon',3],['Hard Demon',3],['Insane Demon',4]
]);
let currentRanks;

export function indexCardRanks(rows){
 currentRanks=new Map(rows.filter(row=>row[6]==='Extreme Demon').map(row=>[row[0],row[10]]));
}

export function displayCardRank(card){
 const row=Array.isArray(card)?card:card?.row;
 const current=row?.[6]??card?.difficulty;
 const id=row?.[0]??card?.id;
 if(current==='Extreme Demon'&&currentRanks&&id)return currentRanks.get(id)??0;
 return row?.[10]??card?.rank??0;
}

export function cardRarity(card,rank){
 const row=Array.isArray(card)?card:card?.row;
 const difficulty=row?.[6]??card?.difficulty;
 if(difficulty==='Impossible')return cardRarities[12];
 if(difficulty!=='Extreme Demon')return cardRarities[difficultyIndex.get(difficulty)??0];
 const position=Number(rank??displayCardRank(card));
 if(!Number.isInteger(position)||position<=0||position>=1500)return cardRarities[4];
 if(position>=800)return cardRarities[5];
 if(position>=400)return cardRarities[6];
 if(position>=151)return cardRarities[7];
 if(position>=76)return cardRarities[8];
 if(position>=30)return cardRarities[9];
 return cardRarities[position>=4?10:11];
}

export function rarityBadge({id,label},extraClass=''){
 return '<span class="card-rarity'+(extraClass?' '+extraClass:'')+'" data-card-rarity="'+id+'">'+label+'</span>';
}
