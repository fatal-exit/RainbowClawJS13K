/**
 * Rainbow Claw — Balatro-Style Combo Evaluator
 * Evaluates the day's haul for Pairs, Full House, Straights (Low-to-High, High-to-Low),
 * All Unique (Prism Spectrum), 4 of a Kind, 5 of a Kind, etc.
 */

import { UnicornPlush } from './unicorns';

export interface ComboResult {
  name: string;
  subTitle: string;
  baseChips: number;
  baseMult: number;
  totalChips: number;
  totalMult: number;
  finalScore: number;
  scoringUnicorns: UnicornPlush[];
}

export interface ActiveJokers {
  pairBonusMult: number;
  spectrumBonusMult: number;
  straightBonusChips: number;
  straightBonusMult: number;
  flatChips: number;
  flatMult: number;
  xMult: number;
}

export function evaluateHaul(
  haul: UnicornPlush[],
  jokers: ActiveJokers
): ComboResult {
  if (haul.length === 0) {
    return {
      name: 'Empty Claw',
      subTitle: 'No plushies caught!',
      baseChips: 0,
      baseMult: 1,
      totalChips: 0,
      totalMult: 1,
      finalScore: 0,
      scoringUnicorns: [],
    };
  }

  // If haul has more than 5 plushies, find the best combination of up to 5
  const candidates = getCombinations(haul, Math.min(haul.length, 5));
  let bestResult: ComboResult | null = null;

  for (const group of candidates) {
    const res = evaluateFiveOrFewer(group, jokers);
    if (!bestResult || res.finalScore > bestResult.finalScore) {
      bestResult = res;
    }
  }

  return bestResult!;
}

function evaluateFiveOrFewer(
  hand: UnicornPlush[],
  jokers: ActiveJokers
): ComboResult {
  const ranks = hand.map((u) => u.variety.rank);
  const rankCounts = new Map<number, number>();
  for (const r of ranks) {
    rankCounts.set(r, (rankCounts.get(r) || 0) + 1);
  }

  const counts = Array.from(rankCounts.values()).sort((a, b) => b - a);
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  const uniqueCount = rankCounts.size;

  let comboName = 'High Plush';
  let subTitle = 'Single catch';
  let baseChips = 10;
  let baseMult = 1.0;

  // Check 5 of a Kind
  if (counts[0] === 5) {
    comboName = 'Mythic Pantheon';
    subTitle = '5 of a Kind!';
    baseChips = 300;
    baseMult = 8.0;
  }
  // Check 4 of a Kind
  else if (counts[0] === 4) {
    comboName = 'Quadruple Glory';
    subTitle = '4 of a Kind!';
    baseChips = 140;
    baseMult = 6.0;
  }
  // Check Full House (3 of one + 2 of another)
  else if (counts[0] === 3 && counts[1] === 2) {
    comboName = 'Full Stable';
    subTitle = 'Full House!';
    baseChips = 80;
    baseMult = 4.0;
  }
  // Check All Unique / Prism Spectrum (5 unique varieties)
  else if (hand.length === 5 && uniqueCount === 5) {
    // Check if it's also a Straight!
    const isConsecutive = isStraight(sortedRanks);
    // Check original catch order for Low-to-High vs High-to-Low
    const originalRanks = hand.map(u => u.variety.rank);
    const isAscending = isStrictlyIncreasing(originalRanks);
    const isDescending = isStrictlyDecreasing(originalRanks);

    if (isConsecutive && isDescending) {
      comboName = 'Descending Rainbow';
      subTitle = 'High-to-Low Straight!';
      baseChips = 120 + jokers.straightBonusChips;
      baseMult = 5.5 * jokers.straightBonusMult;
    } else if (isConsecutive && isAscending) {
      comboName = 'Ascending Rainbow';
      subTitle = 'Low-to-High Straight!';
      baseChips = 100 + jokers.straightBonusChips;
      baseMult = 5.0 * jokers.straightBonusMult;
    } else if (isConsecutive) {
      comboName = 'Prism Straight';
      subTitle = 'Straight 5-in-a-row!';
      baseChips = 90 + jokers.straightBonusChips;
      baseMult = 4.5 * jokers.straightBonusMult;
    } else {
      comboName = 'Prism Spectrum';
      subTitle = 'All 5 Unique Varieties!';
      baseChips = 85;
      baseMult = 4.0 + jokers.spectrumBonusMult;
    }
  }
  // Check 3 of a Kind
  else if (counts[0] === 3) {
    comboName = 'Triple Crown';
    subTitle = '3 of a Kind!';
    baseChips = 60;
    baseMult = 3.2;
  }
  // Check Two Pair
  else if (counts[0] === 2 && counts[1] === 2) {
    comboName = 'Twin Pairs';
    subTitle = 'Two Pairs!';
    baseChips = 40;
    baseMult = 2.5 + jokers.pairBonusMult * 0.5;
  }
  // Check Pair
  else if (counts[0] === 2) {
    comboName = 'Twin Horns';
    subTitle = 'One Pair!';
    baseChips = 25;
    baseMult = 2.0 + jokers.pairBonusMult;
  }
  // Less than 5 cards: check if 3 or 4 consecutive
  else if (hand.length >= 3 && isStraight(sortedRanks)) {
    comboName = 'Mini Rainbow';
    subTitle = `${hand.length}-Straight!`;
    baseChips = 30 + hand.length * 10;
    baseMult = 2.0 + hand.length * 0.4;
  }

  // Calculate sum of chips from all plushies in hand
  let plushChips = 0;
  for (const u of hand) {
    let c = u.variety.baseChips;
    if (u.isGolden) c *= 5; // Golden Horn 5x multiplier!
    plushChips += c;
  }

  const totalChips = plushChips + baseChips + jokers.flatChips;
  const totalMult = (baseMult + jokers.flatMult) * jokers.xMult;
  const finalScore = Math.round(totalChips * totalMult);

  return {
    name: comboName,
    subTitle,
    baseChips,
    baseMult,
    totalChips,
    totalMult,
    finalScore,
    scoringUnicorns: hand,
  };
}

function isStraight(sorted: number[]): boolean {
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

function isStrictlyIncreasing(arr: number[]): boolean {
  if (arr.length < 3) return false;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] <= arr[i - 1]) return false;
  }
  return true;
}

function isStrictlyDecreasing(arr: number[]): boolean {
  if (arr.length < 3) return false;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] >= arr[i - 1]) return false;
  }
  return true;
}

function getCombinations<T>(items: T[], k: number): T[][] {
  if (k >= items.length) return [items];
  const results: T[][] = [];

  function helper(start: number, combo: T[]) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }

  helper(0, []);
  return results;
}
