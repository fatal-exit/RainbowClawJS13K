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
  rerollCost: number;

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
  ['titanium_grip', 'Titanium Grip', 4, '+35% Grip', 'claw'],
  ['wide_span', 'Wide Reach', 4, '+25% Reach', 'claw'],
  ['turbo_winch', 'Turbo Winch', 3, '+40% Speed', 'claw'],
  ['magnet_horn', 'Magnetic Coil', 5, 'Magnet pull', 'claw'],
  ['prism_restock', 'Prism Seeds', 5, 'Rare+ spawns', 'pit'],
  ['midas_touch', 'Midas Horns', 4, '+15% Gold', 'pit'],
  ['plush_overflow', 'Plush Refill', 3, '+6 Plushies', 'pit'],
  ['extra_grab', 'Grab Voucher', 6, '+1 Attempt', 'voucher'],
  ['quota_bribe', 'Arcade Bribe', 4, '-20% Quota', 'voucher'],
  ['joker_pair', 'Twin Souls', 5, '+15 Pair Mult', 'joker'],
  ['joker_spectrum', 'Prism Beam', 6, '+25 & x1.5 Mult', 'joker'],
  ['joker_straight', 'Rainbow Trail', 5, '+50 & x2 Mult', 'joker'],
  ['joker_heavy', 'Mega Hug', 5, '+60 Chips', 'joker'],
] as const).map(([id, name, cost, desc, category]) => ({
  id,
  name,
  cost,
  desc,
  category,
}));

export const getDayQuota = (d: number): number => {
  let q = [0, 300, 750, 1600, 3200, 6500][d] || 6500, m = 2;
  for (let i = 6; i <= d; i++) q = Math.round(q * (m *= 1.15));
  return q;
};

export const generateShopOffer = (stats: PlayerStats): ShopItem[] =>
  SHOP_CATALOG
    .filter((i) =>
      !stats.ownedJokerIds.includes(i.id) &&
      (i.id !== 'turbo_winch' || stats.winchSpeed < 2.19) &&
      (i.id !== 'wide_span' || stats.clawSpan < 1.74) &&
      (i.id !== 'magnet_horn' || stats.magnetism < 1.99)
    )
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((i) => ({ ...i, cost: i.cost + stats.day - 1, purchased: false }));

export function applyShopPurchase(item: ShopItem, stats: PlayerStats): void {
  const s = stats, id = item.id;
  s.cash -= item.cost;
  if (item.category === 'joker' || id === 'extra_grab') s.ownedJokerIds.push(id);
  if (id === 'titanium_grip') s.gripStrength += 0.35;
  else if (id === 'wide_span') s.clawSpan = Math.min(1.75, s.clawSpan + 0.25);
  else if (id === 'turbo_winch') s.winchSpeed = Math.min(2.2, s.winchSpeed + 0.4);
  else if (id === 'magnet_horn') s.magnetism = Math.min(2.0, s.magnetism + 1);
  else if (id === 'prism_restock') s.rarityLuck += 1.2;
  else if (id === 'midas_touch') s.goldenChance += 0.15;
  else if (id === 'extra_grab') s.grabAttemptsMax++;
  else if (id === 'quota_bribe') s.quota = Math.round(s.quota * 0.8);
  else if (id === 'joker_pair') s.pairBonusMult += 15;
  else if (id === 'joker_spectrum') { s.spectrumBonusMult += 25; s.xMult *= 1.5; }
  else if (id === 'joker_straight') { s.straightBonusChips += 50; s.straightBonusMult *= 2; }
  else if (id === 'joker_heavy') s.flatChips += 60;
}
