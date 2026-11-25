import {packLevels} from './level-access.js';

// Both catalogues use GDHistory rows. Demon rows also carry community scores and placements.
export const tierNames = {
  easy: 'Easy', medium: 'Medium', hard: 'Hard', insane: 'Insane', extreme: 'Extreme',
};
export const starTiers = {
  auto: {name: 'Auto', stars: [1]},
  easy: {name: 'Easy', stars: [2]},
  normal: {name: 'Normal', stars: [3]},
  hard: {name: 'Hard', stars: [4, 5]},
  harder: {name: 'Harder', stars: [6, 7]},
  insane: {name: 'Insane', stars: [8, 9]},
};
const catalogues = new Map();
const orderByName = new Intl.Collator('en', {sensitivity: 'base', numeric: true});

export function readRoute(hash) {
  const [page, slug] = hash.replace(/^#/, '').toLowerCase().split('/');
  if ((page==='leaderboard'||page==='battle')&&slug==='players')return {section:'leaderboard',tier:'players'};
  if (page === 'battle') return {section:'battle',tier:['training','army','arcade'].includes(slug)?slug:'easy'};
  if (page === 'kingdom') return {section:'kingdom',tier:'kingdom'};
  if (page === 'cubes') return {section:'gacha',tier:'cubes'};
  if (page==='gacha'&&Object.hasOwn(packLevels,slug))return {section:'gacha',tier:'shop',pack:slug};
  if (page === 'gacha') return {section: 'gacha', tier: ['mine','collection','upgrades','results','index','merge','vault','cubes'].includes(slug) ? slug : 'shop'};
  if (page === 'stars') return {section: 'stars', tier: Object.hasOwn(starTiers, slug) ? slug : 'auto'};
  const section = ['demons', 'leaderboard', 'saved'].includes(page) ? page : 'leaderboard';
  return {section, tier: Object.hasOwn(tierNames, slug) ? slug : 'extreme'};
}

export async function loadTier(tier, collection = 'demons') {
  const standard = collection === 'stars';
  if (standard ? !Object.hasOwn(starTiers, tier) : !Object.hasOwn(tierNames, tier) || tier === 'extreme') {
    throw Error('Unknown tier');
  }
  const path = '/data/' + (standard ? 'stars/' : 'lists/') + tier + '.json';
  if (!catalogues.has(path)) {
    const request = fetch(path).then(async response => {
      if (!response.ok) throw Error('Tier data unavailable');
      return response.json();
    }).catch(error => {
      catalogues.delete(path);
      throw error;
    });
    catalogues.set(path, request);
  }
  return catalogues.get(path);
}

export function browseTier(rows, {query, format, stars = null, sort, page, size}) {
  const text = query.trim().toLowerCase();
  const exactId = /^\d+$/.test(text) ? Number(text) : null;
  const ordered = rows.filter(r => {
    if (stars !== null && r[7] !== stars) return false;
    if (format === 'classic' && r[8] === 'Platformer') return false;
    if (format === 'platformer' && r[8] !== 'Platformer') return false;
    if ((sort === 'placement' || sort === 'star-list') && !(r[12] > 0)) return false;
    return true;
  });
  if (sort === 'name') ordered.sort((a, b) => orderByName.compare(a[1], b[1]) || a[0] - b[0]);
  else if (sort === 'placement' || sort === 'star-list') ordered.sort((a, b) => a[12] - b[12] || orderByName.compare(a[1], b[1]));
  else if (sort === 'challenge') ordered.sort((a, b) => (b[11] ?? 0) - (a[11] ?? 0) || orderByName.compare(a[1], b[1]) || a[0] - b[0]);
  else {
    const column = {rating: 11, downloads: 4, likes: 5, newest: 0}[sort] ?? 4;
    ordered.sort((a, b) => (b[column] ?? -1) - (a[column] ?? -1) || a[0] - b[0]);
  }
  const positions = new Map();
  let groupPosition = 0;
  const matches = ordered.filter((row, index) => {
    if (sort === 'challenge' && (!index || ordered[index - 1][11] !== row[11])) groupPosition = index + 1;
    const hit = !text || (exactId !== null ? row[0] === exactId
      : row[1].toLowerCase().includes(text) || (row[2] || '').toLowerCase().includes(text));
    if (hit) positions.set(row[0], sort === 'challenge' ? (row[11] ? groupPosition : null) : index + 1);
    return hit;
  });
  const visible = matches.slice(page * size, (page + 1) * size);
  return {rows: visible, ranks: visible.map(row => positions.get(row[0])), total: matches.length, next: (page + 1) * size < matches.length};
}
