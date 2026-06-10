// rules.js ― 確定値定数の一元化（出典：specs/01〜03）
// コアロジックが参照する数値はすべてここに置く。値を変える場合は必ず仕様書を先に更新する。

// 週間目標の設定範囲（01 §0-4／§3-2）
export const GOAL_MIN = 7000;
export const GOAL_MAX = 210000;
export const GOAL_STEP = 1000;
// Webデモの初回提案値（01 §3-1 フォールバック／05 §9-D6）
export const GOAL_DEFAULT = 21000;

// 寿命（02 §1-1／§1-2／§4-3）
export const BASE_LIFESPAN = 20;   // 標準寿命（日）
export const STAGE_FIXED = 13;     // 幼少期〜壮年期の固定合計（日）
export const MIN_LIFE = 14;
export const MAX_LIFE = 26;
export const OLDAGE_ENTRY_DAYS = 13; // 老年期突入＝経過13日完了時（02 §4-2）

// ステージ区分：その日が人生の何日目か（経過日数+1）で判定（02 §3-1／05 §9-D2）
export const STAGES = [
  { name: '幼少期', firstDay: 1, lastDay: 3 },
  { name: '学生期', firstDay: 4, lastDay: 6 },
  { name: '青年期', firstDay: 7, lastDay: 9 },
  { name: '壮年期', firstDay: 10, lastDay: 13 },
  { name: '老年期', firstDay: 14, lastDay: Infinity }, // 終端は最終寿命
];

// ステータス基礎初期値（02 §1-4／§5-1）
export const BASE_STATS = { health: 60, vitality: 50, charm: 50, wealth: 40 };

// 日次更新（02 §5-2）
export const D_MIN = -1.0;
export const D_MAX = 2.0;
export const VITALITY_DECAY = 3;

// 病気誘発フラグ（02 §5-3）
export const SICK_THRESHOLD = 30;

// 遺伝（02 §1-5／§7-3）
export const INHERIT_RATE = 0.20;  // ステータス継承率（基礎超過分のみ）
export const TRAIT_RATE = 0.50;    // 外見・性格形質の継承率

// 家宝（02 §1-6／§7-4、03 §5.2）
export const HEIRLOOM_GOLD_RATE = 1.10;
export const HEIRLOOM_SILVER_RATE = 0.80;
export const HEIRLOOM_BONUS = { 金: 10, 銀: 6, 銅: 3 };

// イベント達成率の分岐閾値（03 §6-2）
export const RATE_HIGH = 1.10; // 高 ≥110%
export const RATE_MID = 0.80;  // 中 80〜110%／低 <80%

// E09（出産）由来の次代底上げ（05 §9-D9：仕様未記載のため技術設計で決定）
export const CHILD_QUALITY_BONUS = { 高: 2, 中: 1, 低: 0 };

// イベント選択肢拡張のステータス閾値（03 §6.3／05 §9-D5）
export const STAT_GATE = 60;

// イベントのステータス影響幅：◎／○／△（03 §3 凡例の数値化・05 §9-D15）
export const EFFECT = { '◎': 8, '○': 4, '△': 1 };

// 危険水域（01 §0-5／§8-1：日曜0:00時点で達成率80%未満）
export const DANGER_RATE = 0.80;

// 見た目段階（02 §6-2：S=500,000歩で歩数項が満点）
export const FITNESS_STEP_SCALE = 5000.0;

export function clamp(x, lo, hi) {
  return Math.min(Math.max(x, lo), hi);
}

export function clampStat(x) {
  return clamp(Math.round(x), 0, 100);
}

export function clampGoal(x) {
  const stepped = Math.round(x / GOAL_STEP) * GOAL_STEP;
  return clamp(stepped, GOAL_MIN, GOAL_MAX);
}
