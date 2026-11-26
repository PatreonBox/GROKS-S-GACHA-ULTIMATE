export const achievementBoostLabels={mine:'Coin mine income',battle:'Arena squad HP',mana:'Mana collected'};

export function achievementBoost(wallet,key){
 return (wallet?.achievementBonusBp?.[key]||0)/100;
}

export function achievementBoosts(wallet){
 return Object.fromEntries(Object.keys(achievementBoostLabels).map(key=>[key,achievementBoost(wallet,key)]));
}
