// life.js ― ステータス日次更新・寿命計算・達成率・見た目段階（specs/02 準拠）
import {
  BASE_LIFESPAN, STAGE_FIXED, MIN_LIFE, MAX_LIFE, STAGES,
  D_MIN, D_MAX, VITALITY_DECAY, SICK_THRESHOLD,
  RATE_HIGH, RATE_MID, FITNESS_STEP_SCALE,
  clamp, clampStat,
} from './rules.js';

// 日次更新式（02 §5-2）。stats を直接更新する。
// 中立点はその週の週間目標の日割り g＝activeGoal÷7（目標相対・02 §1-3）。
export function applyDailySteps(stats, stepsToday, g) {
  let d = (stepsToday - g) / g;
  d = clamp(d, D_MIN, D_MAX);
  stats.vitality = clampStat(stats.vitality + Math.round(d * 10) - VITALITY_DECAY);
  stats.health = clampStat(stats.health + Math.round(d * 2));
  stats.charm = clampStat(stats.charm + Math.round(d * 4));
  stats.wealth = clampStat(stats.wealth + Math.round(Math.max(d, 0) * 2));
  return stats;
}

// 最終寿命の計算（02 §4-3）。老年期突入時（経過13日完了時）に1回だけ呼ぶ。
// H: 健康（0〜100）／ S: 累計実歩数 ／ expectedTotal: 期待累計歩数 Σg
export function computeLifespan(H, S, expectedTotal) {
  const healthBonus = (H - 50) / 50.0 * 4.0;                       // -4〜+4日
  const rate = expectedTotal > 0 ? S / expectedTotal : 1.0;
  const stepsBonus = clamp((rate - 1.0) / 0.5 * 3.0, -3.0, 3.0);   // -3〜+3日
  const raw = BASE_LIFESPAN + healthBonus + stepsBonus;
  const lifespanDays = Math.round(clamp(raw, MIN_LIFE, MAX_LIFE)); // 14〜26
  const oldAgeDays = Math.max(1, lifespanDays - STAGE_FIXED);      // 1〜13
  return { lifespanDays: STAGE_FIXED + oldAgeDays, oldAgeDays };
}

// 現在ステージ名。currentDayNumber＝いま進行中の日が人生の何日目か（経過日数+1）。
// 誕生は瞬間イベントで幼少期初日に内包（02 §3-1）。
export function stageFor(currentDayNumber) {
  for (const s of STAGES) {
    if (currentDayNumber >= s.firstDay && currentDayNumber <= s.lastDay) return s.name;
  }
  return '老年期';
}

// 当代の達成率（02 §4-3が正本：累計実歩数÷期待累計歩数）。
// expectedSteps==0（誕生当日）は1.0（中）とみなす（05 §9-D13）。
export function achievementRate(totalSteps, expectedSteps) {
  return expectedSteps > 0 ? totalSteps / expectedSteps : 1.0;
}

// イベント分岐の高/中/低（03 §6-2：高≥110%／中80〜110%／低<80%）
export function rateBand(rate) {
  if (rate >= RATE_HIGH) return '高';
  if (rate >= RATE_MID) return '中';
  return '低';
}

export function isSick(health) {
  return health <= SICK_THRESHOLD; // 病気イベント誘発フラグ（02 §5-3）
}

// 見た目段階（02 §6-2〜§6-4）
export function fitnessLevel(health, totalSteps) {
  const score = clamp(health, 0, 100) * 0.6 + clamp(totalSteps / FITNESS_STEP_SCALE, 0, 100) * 0.4;
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}

export function expressionFor(vitality) {
  if (vitality <= 20) return 'しょんぼり';
  if (vitality <= 60) return 'ふつう';
  return 'いきいき';
}

export function outfitFor(wealth) {
  if (wealth <= 33) return '質素';
  if (wealth <= 66) return '標準';
  return '立派';
}
