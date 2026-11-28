// Slot numbers are permanent save IDs. The server reveals a slot's creator after arrival.
// skillBonus is a Kingdom balancing value, expressed as a percentage of the base Stars per minute.
const slots = [
 // Rarity, house rating, lifetime Stars, playing bonus, former rating-only threshold.
 ['Common',     0.30,   0,   0],
 ['Common',     0.60,   0,   5],
 ['Uncommon',   0.90,   0,  10],
 ['Uncommon',   1.20,   0,  15],
 ['Uncommon',   0.96,  12,  20, 1.5],
 ['Rare',       0.96,  24,  25, 1.8],
 ['Rare',       1.05,  48, 130, 2.4],
 ['Epic',       1.20,  75, 150, 3.0],
 ['Epic',       1.22, 110,  95, 3.6],
 ['Legendary',  1.24, 160,  65, 4.5],
 ['Epic',       1.20, 100,  90],
 ['Epic',       1.22, 140, 110],
 ['Legendary',  1.24, 180, 120],
 ['Legendary',  1.27, 230, 135],
 ['Legendary',  1.28, 270, 180],
 ['Mythic',     1.32, 340, 195],
 ['Mythic',     1.36, 440, 200],
 ['Mythic',     1.40, 560, 200]
];

export const visitorSlots = slots.map(([rarity, stars, earnedStars, skillBonus, legacyStars], slot) =>
 ({slot, rarity, stars, earnedStars, skillBonus, ...(legacyStars ? {legacyStars} : {})}));

export function visitorEligible(slot, rating, lifetimeStars = 0) {
 return (slot.legacyStars !== undefined && rating >= slot.legacyStars) ||
  (rating >= slot.stars && lifetimeStars >= slot.earnedStars);
}
