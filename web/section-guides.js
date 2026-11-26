export const sectionGuides={
 'level-leaderboard':{title:'Level leaderboard',art:'/assets/faces/demon-extreme.webp',steps:[
  ['Find a level','Search by name, creator, or level ID. Filter by difficulty and sort by downloads, likes, or newest.'],
  ['Open or save it','Select a level for its details and video. Use the bookmark to find it again under Saved.']
 ]},
 'star-levels':{title:'Star levels',art:'/assets/gd-star.png',steps:[
  ['Browse a difficulty','Choose Auto through Insane to see rated levels in that star range.'],
  ['Compare levels','Filter by star rating and switch between downloads, likes, and community difficulty.']
 ]},
 'demon-lists':{title:'Demon lists',art:'/assets/faces/demon-hard.webp',steps:[
  ['Choose a demon tier','Browse Easy through Extreme Demons. Extreme Demons show their AREDL placements.'],
  ['Narrow it down','Search a level or creator. Use the format and sort controls to find the type of level you want.']
 ]},
 'pack-shop':{title:'Pack shop',art:'/assets/packs/common.png',steps:[
  ['Open a Common pack','A new save starts with 1,500 coins and 10 gems. A Common pack costs 100 coins and deals at least five cards.'],
  ['Compare the packs','Select a pack to see its difficulty odds. Buy one, ten, or fifty at a time, then reveal your cards.']
 ]},
 'pack-results':{title:'Pack results',art:'/assets/packs/common.png',steps:[
  ['Check your new cards','Each pull shows its difficulty and rarity. Holo and Antimatter finishes have their own odds.'],
  ['Keep building','Open My cards to inspect, sort, and train your new cards.']
 ]},
 'my-cards':{title:'My cards',art:'/assets/packs/common.png',steps:[
  ['Find your fighters','Search by name or filter by difficulty. Sort hardest first or rarest first to find your strongest or rarest cards.'],
  ['Open a card','Check its stats and signature move. Feed spare copies to earn XP or take it to the Training zone.']
 ]},
 'card-index':{title:'Card index',art:'/assets/packs/gem.png',steps:[
  ['Track discoveries','Choose a difficulty to see which levels you’ve collected.'],
  ['Claim gems','Collect the one-time gem reward for each discovered level with an available claim. Harder levels award more gems.']
 ]},
 'secret-vault':{title:'Secret vault',art:'/assets/impossible/mark.webp',steps:[
  ['Discover Impossible cards','Godly packs can reveal a hidden level. A vault entry shows its identity after you discover it.'],
  ['Check your collection','Return here to see which secrets you’ve uncovered.']
 ]},
 'merge-station':{title:'Merge station',art:'/assets/packs/gem.png',steps:[
  ['Choose duplicate levels','Fuse two copies of a level into one harder card and collect gems. The station shows possible results before you confirm.'],
  ['Merge in batches','Use Multi-merge or Merge all to work through eligible duplicate pairs, strongest first.']
 ]},
 'coin-mine':{title:'Coin mine',art:'/assets/packs/coin.png',steps:[
  ['Earn coins','Tap the coin to earn directly. Buy machines to build passive income.'],
  ['Upgrade your mine','Spend coins on the skill tree to increase production. Your machines can build up five hours of earnings while you’re away.']
 ]},
 'gem-upgrades':{title:'Gem upgrades',art:'/assets/packs/gem.png',steps:[
  ['Spend your gems','Card luck improves difficulty rolls. Extra card increases the chance of drawing an additional card in a pack.'],
  ['Choose a purchase size','Check the cost before buying one level, ten levels, or the most you can afford.']
 ]},
 'cube-shop':{title:'Cube shop',art:'/assets/cubes/01.webp',steps:[
  ['Pick a cube','Browse the catalog or filter to Owned. Purchase a cube with coins to unlock it.'],
  ['Equip it','Your equipped cube explores your Kingdom and appears in supported training drills and meme levels.']
 ]},
 'kingdom':{title:'Your Kingdom',art:'/assets/gd-kingdom-castle-icon.png',steps:[
  ['Look around','Drag to orbit the plot. Use Pan to slide the camera, and zoom with the scroll wheel, pinch, or the on-screen buttons.'],
   ['Place a building','Open Build Mode to preview a building and check its cost. Choose a clear spot, then press E or Place. Press R to rotate and Q to cancel.'],
   ['Collect mana','Build a Mana Forge and wait for the blue bubble. Click the bubble to add its stored mana to your Kingdom.'],
  ['Attract visitors','Your first tower holds two houses. Upgrade it to add more lots and raise your Kingdom’s rating. The Visitor index reveals creators as you reach their star requirements.']
 ]},
 'battle-campaign':{title:'Battle campaign',art:'/assets/faces/demon-extreme.webp',steps:[
  ['Build a squad of four','Choose four different cards from your collection. Start at the earliest unlocked campaign stage.'],
  ['Plan your moves','Read enemy intent. Basic attacks build charge. Spend it on signature moves or interrupt a dangerous cast.'],
  ['Clear the objectives','Win to unlock the next stage. Each stage shows its medal goals and rewards.']
 ]},
 'battle-arenas':{title:'Battle arenas',art:'/assets/faces/demon-hard.webp',steps:[
  ['Choose a difficulty','Equip four cards and choose an arena. Stronger opponents award more coins.'],
  ['Watch enemy intent','Tap a rival to target it. Build charge with attacks and use signatures, interrupts, and cover at the right moment.']
 ]},
 'army-mode':{title:'Army mode',art:'/assets/faces/demon-extreme.webp',steps:[
  ['Deploy up to ten units','Pick a map, difficulty, and squad. You can deploy duplicate levels when you own enough copies.'],
  ['Fight in real time','Units move and use their own skills after you start. Pick a trilogy and clear its stages to earn rewards.']
 ]},
 'training-zone':{title:'Training zone',art:'/assets/training/portal-cyan.webp',steps:[
  ['Choose a card and drill','Spike Forge raises attack, Saw Slalom trains saws, and Portal Endurance raises durability.'],
  ['Beat your best','Clear obstacles to earn XP and upgrades. Use How to Play inside a drill for its controls and timing.']
 ]},
 'meme-levels':{title:'Meme levels',art:'/assets/training/portal-cyan.webp',steps:[
  ['Choose a mini level','Each level has its own cube, wave, or ship controls. Open How to Play in its corner to review them.'],
  ['Finish the run','A full clear gives your squad extra starting charge in that level’s arena.']
 ]},
 'player-ranks':{title:'Player leaderboard',art:'/assets/faces/demon-extreme.webp',steps:[
  ['Build your collection','Each distinct owned card adds its HP and three times its Attack to your Power. Training raises both stats.'],
  ['Raise your player level','Opening packs, beating rivals, training, and building earn player XP. The blue bar shows progress to your next level.']
 ]},
 'saved-levels':{title:'Saved levels',art:'/assets/gd-kingdom-castle-icon.png',steps:[
  ['Keep levels nearby','Use the bookmark on any level to add it here.'],
  ['Return to a favorite','Open a bookmarked level for its details, or click the bookmark again to remove it.']
 ]},
};

const gachaGuides={shop:'pack-shop',collection:'my-cards',index:'card-index',vault:'secret-vault',
 merge:'merge-station',mine:'coin-mine',upgrades:'gem-upgrades',results:'pack-results',cubes:'cube-shop'};
const battleGuides={army:'army-mode',training:'training-zone',arcade:'meme-levels'};
const mainGuides={leaderboard:'level-leaderboard',stars:'star-levels',demons:'demon-lists',kingdom:'kingdom',saved:'saved-levels'};

export function sectionGuideId(section,tier){
 if(section==='leaderboard'&&tier==='players')return 'player-ranks';
 if(section==='gacha')return gachaGuides[tier];
 if(section==='battle')return battleGuides[tier];
 return mainGuides[section];
}
