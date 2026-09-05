/**
 * Rainbow Claw — Shop, Upgrades, Jokers & Day Quota System
 */

export interface ShopItem {
  id: string;
  name: string;
  category: 'claw' | 'pit' | 'joker' | 'voucher';
  cost: number;
  desc: string;
  purchased?: boolean;
}

export interface PlayerStats {
  day: number;
  score: number;
  cash: number;
  quota: number;
  grabAttemptsMax: number;
  grabAttemptsLeft: number;

  // Claw upgrades
  gripStrength: number;     // 1.0 default, increases pinch hold force
  clawSpan: number;         // 1.0 default, wider arm span for scooping
  winchSpeed: number;       // 1.0 default, faster lowering/lifting
  magnetism: number;        // 0 default, pulls plushies into claw center

  // Pit upgrades
  rarityLuck: number;       // 1.0 default, higher chances for Rank 4-7
  goldenChance: number;     // 0.08 default (8%), increased by Midas Touch

  // Jokers / Scoring
  pairBonusMult: number;
  spectrumBonusMult: number;
  straightBonusChips: number;
  straightBonusMult: number;
  flatChips: number;
  flatMult: number;
  xMult: number;

  ownedJokerIds: string[];
}

export const SHOP_CATALOG: ShopItem[] = ([
  ['titanium_grip', 'Titanium Grip', 4, '+35% Grip. Less slip.', 'claw'],
  ['wide_span', 'Wide Span Paws', 4, '+25% Claw Reach.', 'claw'],
  ['turbo_winch', 'Turbo Winch', 3, '+40% Winch speed.', 'claw'],
  ['magnet_horn', 'Magnetic Coil', 5, 'Draws plushies to hub.', 'claw'],
  ['prism_restock', 'Prism Seeds', 5, 'Spawns Rare+ plushies.', 'pit'],
  ['midas_touch', 'Midas Horns', 4, '+15% Gold spawn.', 'pit'],
  ['plush_overflow', 'Plush Refill', 3, '+6 plushies in pit.', 'pit'],
  ['extra_grab', 'Grab Voucher', 6, '+1 Attempt/day.', 'voucher'],
  ['quota_bribe', 'Arcade Bribe', 4, '-20% day quota.', 'voucher'],
  ['joker_pair', 'Joker: Twin Souls', 5, '+15 Mult on Pairs.', 'joker'],
  ['joker_spectrum', 'Joker: Prism Beam', 6, '+25 Mult, x1.5 Mult.', 'joker'],
  ['joker_straight', 'Joker: Rainbow Trail', 5, '+50 Chips, x2 Mult.', 'joker'],
  ['joker_heavy', 'Joker: Mega Hug', 5, '+60 Chips per haul.', 'joker'],
] as const).map(([id, name, cost, desc, category]) => ({
  id,
  name,
  cost,
  desc,
  category,
}));

const QUOTAS = [0, 300, 750, 1600, 3200, 6000, 11000];
export const getDayQuota = (day: number): number =>
  QUOTAS[day] || Math.round(11000 * Math.pow(1.7, day - 6));

export function generateShopOffer(stats: PlayerStats): ShopItem[] {
  // Filter out unique vouchers/jokers already owned
  const pool = SHOP_CATALOG.filter(
    (item) => !stats.ownedJokerIds.includes(item.id)
  );

  // Shuffle and pick 3 items
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map((item) => ({ ...item, purchased: false }));
}

export function applyShopPurchase(item: ShopItem, stats: PlayerStats): void {
  stats.cash -= item.cost;
  if (item.category === 'joker' || item.id === 'extra_grab') stats.ownedJokerIds.push(item.id);
  const id = item.id;
  if (id === 'titanium_grip') stats.gripStrength += 0.35;
  else if (id === 'wide_span') stats.clawSpan += 0.25;
  else if (id === 'turbo_winch') stats.winchSpeed += 0.4;
  else if (id === 'magnet_horn') stats.magnetism += 1.0;
  else if (id === 'prism_restock') stats.rarityLuck += 1.2;
  else if (id === 'midas_touch') stats.goldenChance += 0.15;
  else if (id === 'extra_grab') stats.grabAttemptsMax += 1;
  else if (id === 'quota_bribe') stats.quota = Math.round(stats.quota * 0.8);
  else if (id === 'joker_pair') stats.pairBonusMult += 15;
  else if (id === 'joker_spectrum') { stats.spectrumBonusMult += 25; stats.xMult *= 1.5; }
  else if (id === 'joker_straight') { stats.straightBonusChips += 50; stats.straightBonusMult *= 2.0; }
  else if (id === 'joker_heavy') stats.flatChips += 60;
}
