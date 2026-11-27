import {campaignStages,medalCount,stageFor,stageUnlocked,stageCleared,stageRules,campaignFirstCoins,campaignMasterCoins,campaignFirstMultiplier,campaignRepeatMultiplier} from './campaign.js';
import {difficulties} from './pack-engine.js';
import {ico,ratingIcon} from './icons.js';
import {campaignKeyReward} from './demon-keys.js';

const number=n=>n.toLocaleString('en-US');
const coin='<img src="/assets/packs/coin.png" alt="">';

export function campaignView(w,tier,{action,coverSource,face,enc,colors}){
 const stage=stageFor(tier),record=w.campaign?.[tier],cleared=stageCleared(w,tier),mastered=medalCount(record)===3;
 const clearPrize=cleared?record.clearPrize??campaignFirstCoins(stage,true):campaignFirstCoins(stage);
 const masteryPrize=mastered?(record.masteryPrize??stage.master):campaignMasterCoins(stage,!cleared);
 const medals=campaignStages.reduce((n,_,i)=>n+medalCount(w.campaign?.[i+1]),0);
 const stages=campaignStages.filter((_,i)=>stageCleared(w,i+1)).length;
 const goals=[
  [cleared,'Win the battle'],
  [record?.tempo,'Clear in '+stage.turns+' turns or fewer'],
  [record?.squad,'Keep at least 3 allies standing']
 ];
 const map=campaignStages.map((entry,i)=>{
  const next=i+1,unlocked=stageUnlocked(w,next),earned=medalCount(w.campaign?.[next]);
  const state=unlocked?(earned?earned+' / 3 stars':'Ready'):'Locked';
  return '<button class="stage-tile" data-stage="'+next+'" '+(unlocked?'':'disabled ')+'aria-pressed="'+(next===tier)+'">'+
   '<span class="stage-number">'+String(next).padStart(2,'0')+'</span><span><strong>'+entry.name+'</strong><small>'+difficulties[next]+'</small></span>'+
   '<span class="stage-tile-state">'+(unlocked?(earned?ratingIcon():ico('battle')):ico('lock'))+state+'</span></button>';
 }).join('');
 const rules=stageRules(stage);
 return '<section class="campaign" aria-label="Battle campaign"><header class="campaign-heading"><h2>Campaign</h2>'+
  '<div><span><b>'+stages+' / '+campaignStages.length+'</b> cleared</span><span>'+ratingIcon()+' <b>'+medals+' / '+campaignStages.length*3+'</b></span></div></header>'+
  '<div class="campaign-layout"><article class="campaign-focus" style="--chapter:'+colors[tier]+'"><img class="campaign-art" src="'+enc(coverSource(stage.team.at(-1)))+'" alt="">'+
  '<div class="campaign-focus-body"><small class="campaign-tier"><img src="'+face(difficulties[tier])+'" alt=""> Stage '+tier+' · '+difficulties[tier]+'</small>'+
  '<h3>'+stage.name+'</h3><p class="campaign-captain">Captain <b>'+stage.captain+'</b></p>'+
  '<ul class="campaign-rules">'+rules.map(rule=>'<li>'+rule+'</li>').join('')+'</ul>'+
  '<ul class="campaign-goals">'+goals.map(([done,label])=>'<li class="'+(done?'earned':'')+'">'+ratingIcon()+
   '<span>'+label+'</span>'+(done?'<strong>Earned</strong>':'')+'</li>').join('')+'</ul>'+
  '<div class="campaign-prizes"><span>'+coin+' <b>'+number(clearPrize)+'</b> first clear'+(cleared?' ✓':'')+'</span>'+
  '<span class="campaign-key-prize">'+ico('demonKey')+' <b>'+campaignKeyReward+' Demon Keys</b> first clear'+(cleared?' ✓':'')+'</span>'+
  '<span>'+coin+' <b>'+number(masteryPrize)+'</b> 3-star bonus'+(mastered?' ✓':'')+
  '</span><span>'+coin+' <b>'+(cleared?campaignRepeatMultiplier+'×</b> replay bounties':campaignFirstMultiplier+'×</b> bounties on first clear')+'</span></div>'+
  '<div class="campaign-actions">'+action+'</div></div></article><div class="campaign-map" aria-label="Campaign stages">'+map+'</div></div></section>';
}

export function campaignOutcome(b){
 const stage=stageFor(b.campaign),receipt=b.campaignReceipt;
 if(!receipt)return '';
 const stars=Array.from({length:3},(_,i)=>i<receipt.medals?ratingIcon():'<span class="empty-medal">☆</span>').join('');
 const awards=[receipt.first?'First clear':'',receipt.mastered?'3-star mastery':''].filter(Boolean).join(' · ');
 return '<div class="campaign-outcome"><span class="earned-stars" aria-label="'+receipt.medals+' of 3 stars">'+stars+'</span>'+
  '<span>'+b.seq+' / '+stage.turns+' turns · '+receipt.survivors+' / 4 standing</span>'+
  (receipt.coins?'<strong class="campaign-clear-reward">'+coin+' +'+number(receipt.coins)+' · '+(awards||'Campaign reward')+'</strong>':'')+
  (receipt.demonKeys?'<strong class="campaign-key-prize">'+ico('demonKey')+' +'+number(receipt.demonKeys)+' Demon Keys</strong>':'')+'</div>';
}
