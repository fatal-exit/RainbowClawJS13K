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

export const SHOP_CATALOG: ShopItem[] = [
  {
    id: 'titanium_grip',
    name: 'Titanium Grip',
    category: 'claw',
    cost: 4,
    desc: '+35% Pinch Hold. Plushies rarely slip out.',
  },
  {
    id: 'wide_span',
    name: 'Wide Span Paws',
    category: 'claw',
    cost: 4,
    desc: '+25% Claw Reach. Easily scoops multiple toys.',
  },
  {
    id: 'turbo_winch',
    name: 'Turbo Winch',
    category: 'claw',
    cost: 3,
    desc: '+40% Winch speed for swift drops.',
  },
  {
    id: 'magnet_horn',
    name: 'Magnetic Coil',
    category: 'claw',
    cost: 5,
    desc: 'Electromagnet pulls nearby unicorns to center.',
  },
  {
    id: 'prism_restock',
    name: 'Prism Seeds',
    category: 'pit',
    cost: 5,
    desc: 'Spawns Rare, Epic & Mythic plushies in pit.',
  },
  {
    id: 'midas_touch',
    name: 'Midas Horns',
    category: 'pit',
    cost: 4,
    desc: '+15% Golden Unicorn spawn chance (5x Chips!).',
  },
  {
    id: 'plush_overflow',
    name: 'Plush Refill',
    category: 'pit',
    cost: 3,
    desc: 'Instantly adds 6 fresh plushies to the pit.',
  },
  {
    id: 'extra_grab',
    name: 'Grab Voucher',
    category: 'voucher',
    cost: 6,
    desc: '+1 Grab Attempt per day permanently!',
  },
  {
    id: 'quota_bribe',
    name: 'Arcade Bribe',
    category: 'voucher',
    cost: 4,
    desc: 'Reduces the next day quota by 20%.',
  },
  {
    id: 'joker_pair',
    name: 'Joker: Twin Souls',
    category: 'joker',
    cost: 5,
    desc: '+15 Mult on any Pair or Two Pair.',
  },
  {
    id: 'joker_spectrum',
    name: 'Joker: Prism Beam',
    category: 'joker',
    cost: 6,
    desc: '+25 Mult and x1.5 Mult for All-5-Unique.',
  },
  {
    id: 'joker_straight',
    name: 'Joker: Rainbow Trail',
    category: 'joker',
    cost: 5,
    desc: '+50 Chips and x2 Mult on Straights.',
  },
  {
    id: 'joker_heavy',
    name: 'Joker: Mega Hug',
    category: 'joker',
    cost: 5,
    desc: '+60 Chips permanently to every haul.',
  },
];

export function getDayQuota(day: number): number {
  if (day === 1) return 300;
  if (day === 2) return 750;
  if (day === 3) return 1600;
  if (day === 4) return 3200;
  if (day === 5) return 6000;
  if (day === 6) return 11000;
  // Geometric scaling beyond day 6
  return Math.round(11000 * Math.pow(1.7, day - 6));
}

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

  switch (item.id) {
    case 'titanium_grip':
      stats.gripStrength += 0.35;
      break;
    case 'wide_span':
      stats.clawSpan += 0.25;
      break;
    case 'turbo_winch':
      stats.winchSpeed += 0.4;
      break;
    case 'magnet_horn':
      stats.magnetism += 1.0;
      break;
    case 'prism_restock':
      stats.rarityLuck += 1.2;
      break;
    case 'midas_touch':
      stats.goldenChance += 0.15;
      break;
    case 'extra_grab':
      stats.grabAttemptsMax += 1;
      stats.ownedJokerIds.push(item.id);
      break;
    case 'quota_bribe':
      stats.quota = Math.round(stats.quota * 0.8);
      break;
    case 'joker_pair':
      stats.pairBonusMult += 15;
      stats.ownedJokerIds.push(item.id);
      break;
    case 'joker_spectrum':
      stats.spectrumBonusMult += 25;
      stats.xMult *= 1.5;
      stats.ownedJokerIds.push(item.id);
      break;
    case 'joker_straight':
      stats.straightBonusChips += 50;
      stats.straightBonusMult *= 2.0;
      stats.ownedJokerIds.push(item.id);
      break;
    case 'joker_heavy':
      stats.flatChips += 60;
      stats.ownedJokerIds.push(item.id);
      break;
  }
}
