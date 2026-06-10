// game.js ― 状態機械：日次バッチ／catch-up／週次判定／代替わり／滅亡／再出発
// specs/01（週判定・滅亡・冪等性）、02（人生）、03（イベント）、05（技術設計）準拠。
// このモジュールは現在時刻・乱数・保存先に直接触れない（now / rng は引数で注入）。
import {
  BASE_STATS, INHERIT_RATE, TRAIT_RATE,
  HEIRLOOM_GOLD_RATE, HEIRLOOM_SILVER_RATE, HEIRLOOM_BONUS,
  CHILD_QUALITY_BONUS, OLDAGE_ENTRY_DAYS, clampStat, clampGoal,
} from './rules.js';
import {
  dateId, parseDateId, nextDateId, weekIdOf, weekIdOfDateId, weekDates, isMondayId,
} from './time.js';
import {
  applyDailySteps, computeLifespan, stageFor, achievementRate, rateBand, isSick,
} from './life.js';
import { generateGender, generateName, generateTrait } from './names.js';
import { EVENTS, pickEvent } from './events.js';

export const SCHEMA_VERSION = 1;

// ─────────────────────────────────────────────
// 生成
// ─────────────────────────────────────────────

// 新しい当主を生成する（02 §7-3／§7-5）。parent=null なら初代（遺伝・家宝なし）。
export function createLeader(rng, nowMs, parent, heirloom) {
  const gender = generateGender(rng);
  const stats = { ...BASE_STATS };
  if (parent) {
    // ステータス継承：基礎超過分の20%のみ。活力は継承せず50（02 §7-3）
    for (const k of ['health', 'charm', 'wealth']) {
      const surplus = Math.max(parent.stats[k] - BASE_STATS[k], 0);
      stats[k] = BASE_STATS[k] + Math.round(surplus * INHERIT_RATE);
    }
    // E09（出産）由来の底上げ（03 E09／05 §9-D9）
    const cq = CHILD_QUALITY_BONUS[parent.flags.childQuality] ?? 0;
    for (const k of Object.keys(stats)) stats[k] += cq;
  }
  if (heirloom) {
    // 家宝補正：前当主が最も伸ばしたステータスに加点（02 §7-4）
    stats[heirloom.targetStat] += heirloom.bonus;
  }
  for (const k of Object.keys(stats)) stats[k] = clampStat(stats[k]);

  const traits = {
    appearance: parent && rng() < TRAIT_RATE ? parent.traits.appearance : generateTrait('appearance', rng),
    personality: parent && rng() < TRAIT_RATE ? parent.traits.personality : generateTrait('personality', rng),
  };

  return {
    name: generateName(gender, rng),
    gender,
    bornAt: nowMs,
    elapsedDays: 0,
    stage: '幼少期', // 誕生は瞬間。幼少期初日に内包（02 §3-1）
    stats,
    totalSteps: 0,
    expectedSteps: 0,
    lifespanDays: null, // 老年期突入時（経過13日完了時）に確定（02 §4-2）
    traits,
    sickFlag: false,
    flags: {
      childhoodFriend: false, education: null, job: null, married: false,
      spouseTalent: false, childQuality: null, familyTradition: null,
      legacyChoice: null, connectionHeirloom: false,
    },
    // 親世代の伏線フラグのスナップショット（03 §5：次代のイベント分岐が参照）
    parentFlags: parent ? {
      education: parent.flags.education,
      job: parent.flags.job,
      familyTradition: parent.flags.familyTradition,
      connectionHeirloom: parent.flags.connectionHeirloom,
    } : null,
    inheritedHeirloom: heirloom ?? null,
    consumedEvents: [],
    eventLog: [],
  };
}

// 新規ゲーム状態（オンボーディング完了時）。初回開始週はグレース週（01 §0-6／§7-8）。
export function createInitialState(rng, nowMs, { familyName, goal, genderedEvents }) {
  const state = {
    schemaVersion: SCHEMA_VERSION,
    settings: { genderedEvents: !!genderedEvents },
    clock: { offsetMs: 0 },
    progress: {
      lastJudgedWeek: null,
      maxObservedTime: nowMs,
      longestGenerations: 0,
      graceWeek: weekIdOf(nowMs),       // 初回のみ。再出発時は設定しない（01 §6-4）
      lastProcessedDate: dateId(nowMs), // いま進行中（未確定）の日
    },
    goal: { activeGoal: clampGoal(goal), pendingGoal: null },
    phase: 'alive', // 'alive' | 'perished'（再出発待ち）
    perishInfo: null,
    dynasty: {
      familyName,
      foundedAt: nowMs,
      generation: 1,
      pastLeaders: [],
      leader: createLeader(rng, nowMs, null, null),
    },
    weeks: {},
    days: {},
    history: [],
    pendingEvent: { id: 'E01', variant: null }, // 就任時に必発（03 E01）
  };
  ensureWeek(state, weekIdOf(nowMs));
  return state;
}

// ─────────────────────────────────────────────
// 歩数入力（Webデモ：当日のみ・上書き可。05 §5-1／§9-D1）
// ─────────────────────────────────────────────

export function inputSteps(state, nowMs, steps) {
  if (state.phase !== 'alive') return false;
  const d = dateId(Math.max(nowMs, state.progress.maxObservedTime));
  const rec = state.days[d] ?? { dateId: d, steps: null, g: null, finalized: false };
  if (rec.finalized) return false; // 確定済みの日は変更不可
  rec.steps = Math.max(0, Math.floor(steps));
  state.days[d] = rec;
  ensureWeek(state, weekIdOfDateId(d));
  return true;
}

// ─────────────────────────────────────────────
// catch-up：未処理の日境界を古い順に処理（01 §5-3 B／§7-6、05 §4-1）
// ─────────────────────────────────────────────

export function catchUp(state, nowMs, rng) {
  const log = [];
  // 端末時計の巻き戻しに耐える：観測済み最大時刻より過去には戻さない（01 §7-2）
  const eff = Math.max(nowMs, state.progress.maxObservedTime);
  const today = dateId(eff);
  let guard = 0;
  while (state.phase === 'alive' && state.progress.lastProcessedDate < today && guard++ < 4000) {
    const d = state.progress.lastProcessedDate; // 確定対象の日
    finalizeDay(state, d, log);
    const boundaryId = nextDateId(d);
    state.progress.lastProcessedDate = boundaryId;
    const boundaryMs = parseDateId(boundaryId);

    // 1. 週境界（月曜0:00）なら先に週次判定（存亡が寿命より先・01 §7-4／§9-3）
    if (isMondayId(boundaryId)) {
      const result = judgeWeek(state, weekIdOfDateId(d), boundaryMs, log);
      if (result === 'PERISH') break; // 以降の週は旧一族では存在しない（01 §7-6）
    }
    // 2. 存続しているときのみ寿命到来（大往生→代替わり）を処理（01 §7-4／§7-5）
    const L = state.dynasty.leader;
    if (state.phase === 'alive' && L.lifespanDays !== null && L.elapsedDays >= L.lifespanDays) {
      succeed(state, boundaryMs, rng, log);
    }
  }
  state.progress.maxObservedTime = Math.max(state.progress.maxObservedTime, eff);
  return log;
}

// 日次バッチ：日 d を確定する（02 §5-2／05 §4-1）
function finalizeDay(state, d, log) {
  const rec = state.days[d] ?? { dateId: d, steps: null, g: null, finalized: false };
  if (rec.finalized) return; // 冪等
  const week = ensureWeek(state, weekIdOfDateId(d));
  const g = week.activeGoal / 7; // 日次目標歩数（目標相対・01 §0-10）
  const steps = rec.steps ?? 0;  // Webデモ：未入力日は0歩確定（05 §9-D1）
  rec.g = g;
  rec.finalized = true;
  state.days[d] = rec;

  const L = state.dynasty.leader;
  applyDailySteps(L.stats, steps, g);
  L.totalSteps += steps;
  L.expectedSteps += g; // 期待累計歩数 Σg（02 §4-3が正本）
  L.elapsedDays += 1;
  L.sickFlag = isSick(L.stats.health);

  // 老年期突入＝経過13日完了時に最終寿命を確定（02 §4-2）
  if (L.elapsedDays === OLDAGE_ENTRY_DAYS && L.lifespanDays === null) {
    const { lifespanDays } = computeLifespan(L.stats.health, L.totalSteps, L.expectedSteps);
    L.lifespanDays = lifespanDays;
    log.push({ type: 'oldage', lifespanDays });
  }
  L.stage = stageFor(L.elapsedDays + 1);

  // E13（次代への遺し）：大往生前日のバッチで必発（中核扱い・既存の選択待ちより優先。05 §4-4）
  if (L.lifespanDays !== null && L.elapsedDays === L.lifespanDays - 1) {
    if (!state.pendingEvent || state.pendingEvent.id !== 'E13') {
      state.pendingEvent = { id: 'E13', variant: null };
      log.push({ type: 'event', id: 'E13' });
    }
    return;
  }
  // 通常イベント：経過日数が奇数になった日次バッチで発生（≒約2日に1回・05 §9-D3）。
  // 選択待ちが残っている間は新規発生をスキップ（最大1件・05 §9-D14）
  if (L.elapsedDays % 2 === 1 && !state.pendingEvent) {
    const ev = pickEvent(L);
    if (ev) {
      state.pendingEvent = ev;
      log.push({ type: 'event', id: ev.id });
    }
  }
}

// ─────────────────────────────────────────────
// 週次判定（01 §5-4）
// ─────────────────────────────────────────────

function ensureWeek(state, weekId) {
  if (!state.weeks[weekId]) {
    state.weeks[weekId] = {
      weekId,
      activeGoal: state.goal.activeGoal, // 月曜0:00時点の目標で固定（01 §4-1）
      judged: false,
      result: null,
      totalSteps: 0,
    };
  }
  return state.weeks[weekId];
}

export function weekTotal(state, weekId) {
  let total = 0;
  for (const d of weekDates(weekId)) total += state.days[d]?.steps ?? 0;
  return total;
}

function judgeWeek(state, weekId, boundaryMs, log) {
  const week = ensureWeek(state, weekId);
  if (week.judged) return week.result; // 冪等（01 §7-9）

  const total = weekTotal(state, weekId);
  week.totalSteps = total;
  const achieved = total >= week.activeGoal; // 累計≧目標で達成（01 §5-4）

  if (achieved) {
    week.result = 'SURVIVE';
  } else if (weekId === state.progress.graceWeek) {
    week.result = 'GRACE'; // 初週グレース：未達でも滅亡判定対象外（01 §7-8）
  } else {
    week.result = 'PERISH';
  }
  week.judged = true;
  if (state.progress.lastJudgedWeek === null || weekId > state.progress.lastJudgedWeek) {
    state.progress.lastJudgedWeek = weekId; // 単調増加（01 §7-9）
  }

  if (week.result === 'PERISH') {
    perish(state, week, boundaryMs, log);
  } else {
    // 存続確定後に pendingGoal を昇格（01 §4-3）
    if (state.goal.pendingGoal !== null) {
      state.goal.activeGoal = state.goal.pendingGoal;
      state.goal.pendingGoal = null;
    }
    log.push({ type: 'week', weekId, result: week.result, total, goal: week.activeGoal });
  }
  return week.result;
}

// ─────────────────────────────────────────────
// 滅亡処理（01 §6）
// ─────────────────────────────────────────────

function perish(state, week, boundaryMs, log) {
  const dyn = state.dynasty;
  // 最後の当主として記録（大往生としては記録しない・01 §7-5）
  const lastLeader = snapshotLeader(dyn.leader, boundaryMs, { perished: true });
  const entry = {
    familyName: dyn.familyName,
    generations: dyn.generation,
    foundedAt: dyn.foundedAt,
    perishedAt: boundaryMs, // 滅亡時刻は本来の締め時刻（01 §6-1）
    goalAtPerish: week.activeGoal,
    totalAtPerish: week.totalSteps,
    leaders: [...dyn.pastLeaders, lastLeader],
  };
  state.history.push(entry); // 永久保存・削除不可（01 §6-2）

  const isRecord = dyn.generation > state.progress.longestGenerations;
  if (isRecord) state.progress.longestGenerations = dyn.generation; // 最長記録更新（01 §6-3）

  state.phase = 'perished';
  state.pendingEvent = null;
  state.perishInfo = {
    weekId: week.weekId,
    goal: week.activeGoal,
    total: week.totalSteps,
    perishedAt: boundaryMs,
    generations: dyn.generation,
    familyName: dyn.familyName,
    newRecord: isRecord,
  };
  log.push({ type: 'perish', info: state.perishInfo });
}

// 再出発：1タップで新一族を開始（01 §6-4）。グレース週は適用しない。
export function restart(state, rng, nowMs, { familyName, goal }) {
  if (state.phase !== 'perished') return false;
  const eff = Math.max(nowMs, state.progress.maxObservedTime);
  state.phase = 'alive';
  state.perishInfo = null;
  state.goal.activeGoal = clampGoal(goal);
  state.goal.pendingGoal = null;
  state.dynasty = {
    familyName,
    foundedAt: eff,
    generation: 1,
    pastLeaders: [],
    leader: createLeader(rng, eff, null, null),
  };
  state.weeks = {};
  state.days = {};
  state.progress.lastProcessedDate = dateId(eff);
  state.pendingEvent = { id: 'E01', variant: null };
  ensureWeek(state, weekIdOf(eff));
  return true;
}

// ─────────────────────────────────────────────
// 代替わり（大往生・02 §7）
// ─────────────────────────────────────────────

function succeed(state, nowMs, rng, log) {
  const dyn = state.dynasty;
  const old = dyn.leader;

  // E13が選択待ちのまま大往生に達した場合は既定（argmax）で自動確定（05 §4-4）
  if (state.pendingEvent && state.pendingEvent.id === 'E13') {
    state.pendingEvent = null;
  } else if (state.pendingEvent) {
    state.pendingEvent = null; // その他の選択待ちは一生の終わりとともに消える
  }

  const heirloom = computeHeirloom(old);
  const record = snapshotLeader(old, nowMs, { heirloomLeft: heirloom });
  dyn.pastLeaders.push(record);
  dyn.generation += 1;
  dyn.leader = createLeader(rng, nowMs, old, heirloom);
  state.pendingEvent = { id: 'E01', variant: null }; // 継承演出（03 E01）
  log.push({ type: 'succession', record, heirloom, generation: dyn.generation, newLeader: dyn.leader.name });
}

// 家宝の確定（02 §7-4、03 §5.2）。ランク＝生涯通算達成率。必ず銅以上。
export function computeHeirloom(leader) {
  const rate = achievementRate(leader.totalSteps, leader.expectedSteps);
  let rank;
  if (rate >= HEIRLOOM_GOLD_RATE) rank = '金';
  else if (rate >= HEIRLOOM_SILVER_RATE) rank = '銀';
  else rank = '銅';

  // 補正先＝前当主が最も伸ばしたステータス（02 §7-4 argmax(健康,人望,財産)）
  const cand = [['health', leader.stats.health], ['charm', leader.stats.charm], ['wealth', leader.stats.wealth]];
  cand.sort((a, b) => b[1] - a[1]);
  const targetStat = cand[0][0];

  // 種別＝E13の選択。未選択なら補正先に対応する種別（05 §9-D8）
  const typeFromStat = { health: '健康', charm: '人脈', wealth: '財産' }[targetStat];
  const type = leader.flags.legacyChoice ?? typeFromStat;
  const label = {
    '健康': '丈夫な体',
    '人脈': '豊かな人脈',
    '財産': '蓄えた財',
    '家風': leader.flags.familyTradition === '挑戦' ? '進取の家風' : '堅実な家風',
  }[type];

  return { rank, type, label, bonus: HEIRLOOM_BONUS[rank], targetStat, lifetimeRate: rate };
}

function snapshotLeader(leader, diedAt, extra = {}) {
  return {
    name: leader.name,
    gender: leader.gender,
    bornAt: leader.bornAt,
    diedAt,
    elapsedDays: leader.elapsedDays,
    stage: leader.stage,
    stats: { ...leader.stats },
    totalSteps: leader.totalSteps,
    expectedSteps: leader.expectedSteps,
    lifespanDays: leader.lifespanDays,
    lifetimeRate: achievementRate(leader.totalSteps, leader.expectedSteps),
    traits: { ...leader.traits },
    flags: { ...leader.flags },
    eventLog: [...leader.eventLog],
    inheritedHeirloom: leader.inheritedHeirloom,
    heirloomLeft: extra.heirloomLeft ?? null,
    perished: !!extra.perished, // 滅亡した一族の最後の当主か
  };
}

// ─────────────────────────────────────────────
// イベントの提示と選択の適用（03 §2.3-4：分岐は選択時点の達成率）
// ─────────────────────────────────────────────

export function presentEvent(state) {
  if (!state.pendingEvent) return null;
  const ev = EVENTS[state.pendingEvent.id];
  const ctx = {
    leader: state.dynasty.leader,
    gendered: state.settings.genderedEvents,
    variant: state.pendingEvent.variant,
  };
  return {
    id: ev.id,
    name: ev.name,
    intro: ev.intro(ctx),
    choices: ev.choices(ctx),
  };
}

export function applyEventChoice(state, choiceIndex) {
  if (!state.pendingEvent) return null;
  const pe = state.pendingEvent;
  const ev = EVENTS[pe.id];
  const L = state.dynasty.leader;
  const ctx = { leader: L, gendered: state.settings.genderedEvents, variant: pe.variant };
  const rate = achievementRate(L.totalSteps, L.expectedSteps);
  const band = rateBand(rate);
  const out = ev.resolve(ctx, choiceIndex, band);
  for (const [k, v] of Object.entries(out.effects ?? {})) {
    L.stats[k] = clampStat(L.stats[k] + v);
  }
  if (pe.id !== 'E14') L.consumedEvents.push(pe.id); // E14は反復可（03 E14）
  L.eventLog.push({ id: pe.id, name: ev.name, band, text: out.text, day: L.elapsedDays });
  state.pendingEvent = null;
  return { ...out, band, name: ev.name, id: pe.id };
}

// ─────────────────────────────────────────────
// 目標変更（翌週反映の予約・01 §4）
// ─────────────────────────────────────────────

export function reserveGoal(state, value) {
  if (state.phase !== 'alive') return false;
  state.goal.pendingGoal = clampGoal(value); // activeGoal は不変（当週変更不可）
  return true;
}

// ─────────────────────────────────────────────
// エクスポート/インポート（01 §6-5、05 §5-3）
// ─────────────────────────────────────────────

export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

// インポート：検証のうえ全置換。進行ポインタは現在値より後退させない（01 §6-5）。
export function importState(currentState, json) {
  const data = JSON.parse(json);
  if (data.schemaVersion !== SCHEMA_VERSION) throw new Error('対応していないデータ形式です');
  if (!data.dynasty || !data.progress || !data.goal) throw new Error('データが壊れています');
  if (currentState) {
    data.progress.maxObservedTime = Math.max(
      data.progress.maxObservedTime ?? 0, currentState.progress.maxObservedTime ?? 0);
    if (currentState.progress.lastJudgedWeek &&
        (!data.progress.lastJudgedWeek || data.progress.lastJudgedWeek < currentState.progress.lastJudgedWeek)) {
      data.progress.lastJudgedWeek = currentState.progress.lastJudgedWeek;
    }
    data.clock = data.clock ?? { offsetMs: 0 };
    data.clock.offsetMs = Math.max(data.clock.offsetMs ?? 0, currentState.clock?.offsetMs ?? 0);
  }
  return data;
}
