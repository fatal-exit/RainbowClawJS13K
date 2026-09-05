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

  let [comboName, subTitle, baseChips, baseMult] = ['High Plush', 'Single catch', 10, 1.0];

  if (counts[0] === 5) {
    [comboName, subTitle, baseChips, baseMult] = ['Mythic Pantheon', '5 of a Kind!', 300, 8.0];
  } else if (counts[0] === 4) {
    [comboName, subTitle, baseChips, baseMult] = ['Quadruple Glory', '4 of a Kind!', 140, 6.0];
  } else if (counts[0] === 3 && counts[1] === 2) {
    [comboName, subTitle, baseChips, baseMult] = ['Full Stable', 'Full House!', 80, 4.0];
  } else if (hand.length === 5 && uniqueCount === 5) {
    const isConsecutive = isStraight(sortedRanks);
    if (isConsecutive && isStraight([...ranks].reverse())) {
      [comboName, subTitle, baseChips, baseMult] = ['Descending Rainbow', 'High-to-Low Straight!', 120 + jokers.straightBonusChips, 5.5 * jokers.straightBonusMult];
    } else if (isConsecutive && isStraight(ranks)) {
      [comboName, subTitle, baseChips, baseMult] = ['Ascending Rainbow', 'Low-to-High Straight!', 100 + jokers.straightBonusChips, 5.0 * jokers.straightBonusMult];
    } else if (isConsecutive) {
      [comboName, subTitle, baseChips, baseMult] = ['Prism Straight', 'Straight 5-in-a-row!', 90 + jokers.straightBonusChips, 4.5 * jokers.straightBonusMult];
    } else {
      [comboName, subTitle, baseChips, baseMult] = ['Prism Spectrum', 'All 5 Unique Varieties!', 85, 4.0 + jokers.spectrumBonusMult];
    }
  } else if (counts[0] === 3) {
    [comboName, subTitle, baseChips, baseMult] = ['Triple Crown', '3 of a Kind!', 60, 3.2];
  } else if (counts[0] === 2 && counts[1] === 2) {
    [comboName, subTitle, baseChips, baseMult] = ['Twin Pairs', 'Two Pairs!', 40, 2.5 + jokers.pairBonusMult * 0.5];
  } else if (counts[0] === 2) {
    [comboName, subTitle, baseChips, baseMult] = ['Twin Horns', 'One Pair!', 25, 2.0 + jokers.pairBonusMult];
  } else if (hand.length >= 3 && isStraight(sortedRanks)) {
    [comboName, subTitle, baseChips, baseMult] = ['Mini Rainbow', `${hand.length}-Straight!`, 30 + hand.length * 10, 2.0 + hand.length * 0.4];
  }

  // Calculate sum of chips from all plushies in hand
  let plushChips = 0;
  for (const u of hand) {
    plushChips += u.variety.baseChips * (u.isGolden ? 5 : 1);
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

const isStraight = (arr: number[]) => arr.every((v, i) => !i || v === arr[i - 1] + 1);

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
