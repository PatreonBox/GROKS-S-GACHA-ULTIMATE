import {coinPrice,previousCoinPrice} from './coin-economy.js';

export const spikeKind='spike-shooter';
export const spikeIcon='/assets/training/spike.webp';
export const spikePrice=coinPrice(8_000);
export const spikeDamage=[10,15,22,28,36];
const spikeHp=[200,250,320,410];
const spikeUpgrades=[
 {towerLevel:1,coins:0,mana:30,buildMs:10_000},
 {towerLevel:2,coins:coinPrice(12_000),mana:100,buildMs:20_000},
 {towerLevel:3,coins:coinPrice(30_000),mana:200,buildMs:30_000}
];

export function spikePlan(building,now=Date.now()){
 const saved=building.level,built=Number.isInteger(saved)&&saved>=1&&saved<=spikeHp.length?saved:1;
 const site=building.upgrade;
 const valid=site?.level===built+1&&spikeUpgrades[built-1];
 const construction=valid&&now<site.endsAt?site:null;
 const level=valid&&!construction?site.level:built;
 const upgrade=spikeUpgrades[level-1];
 return {level,hp:spikeHp[level-1],damage:spikeDamage[level-1],construction,
  next:upgrade?{...upgrade,damage:spikeDamage[level]}:null};
}

export function spikeInvestment(building){
 const investedLevel=Math.max(building.level||1,building.upgrade?.level||1);
 return building.upgradeCoinInvestment??spikeUpgrades.slice(0,investedLevel-1).reduce((sum,tier)=>sum+previousCoinPrice(tier.coins),0);
}
