// tests.js ― コアロジックのユニットテスト（specs/05 §6 の必須ケース）
// 実行方法：node web/tests/tests.js ／ ブラウザ：web/tests/tests.html
import { dateId, parseDateId, weekIdOf, addDaysToId, isMondayId, weekDates } from '../js/core/time.js';
import { applyDailySteps, computeLifespan, rateBand, stageFor } from '../js/core/life.js';
import {
  createInitialState, createLeader, catchUp, inputSteps, weekTotal,
  applyEventChoice, presentEvent, restart, reserveGoal, computeHeirloom,
  exportState, importState,
} from '../js/core/game.js';
import { BASE_STATS } from '../js/core/rules.js';

// ── 最小テストハーネス ──────────────────────────────
let passed = 0, failed = 0;
const failures = [];
function assert(cond, label) {
  if (cond) { passed++; }
  else { failed++; failures.push(label); log(`  ✗ ${label}`); }
}
function eq(actual, expected, label) {
  assert(actual === expected, `${label}（期待:${expected} 実際:${actual}）`);
}
function section(name) { log(`■ ${name}`); }
function log(msg) {
  if (typeof document !== 'undefined') {
    const el = document.getElementById('out');
    if (el) { el.textContent += msg + '\n'; return; }
  }
  console.log(msg);
}

// 決定的な乱数（テスト用シード付きRNG）
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 基準となる月曜0:00（実行環境のローカルTZで算出。曜日のハードコードはしない）
const SOME_DAY = new Date(2026, 5, 10, 12, 0, 0).getTime(); // 2026-06-10 12:00
const MONDAY_ID = weekIdOf(SOME_DAY);
const MONDAY_MS = parseDateId(MONDAY_ID);
const DAY = (n) => parseDateId(addDaysToId(MONDAY_ID, n)); // 月曜からn日後の0:00

function newState(opts = {}) {
  const rng = mulberry32(opts.seed ?? 42);
  const bornAt = opts.bornAt ?? MONDAY_MS + 9 * 3600 * 1000; // 月曜9:00開始が既定
  const state = createInitialState(rng, bornAt, {
    familyName: '山田', goal: opts.goal ?? 21000, genderedEvents: false,
  });
  return { state, rng };
}

// 日次歩数を直接セット（テスト用。Webデモの手入力に相当）
function setSteps(state, dayIndexFromMonday, steps) {
  const d = addDaysToId(MONDAY_ID, dayIndexFromMonday);
  state.days[d] = { dateId: d, steps, g: null, finalized: false };
}

// 1日ずつ時間を進めながら、選択待ちイベントに毎日答える（実際のプレイ操作に相当）
// ※一括catch-upでは選択待ちが残る間の新規イベントがスキップされる（05 §9-D14の仕様どおり）
function advanceAnswering(state, rng, targetMs) {
  const logOut = [];
  let guard = 0;
  while (state.pendingEvent && guard++ < 10) applyEventChoice(state, 0);
  let t = state.progress.maxObservedTime;
  while (t < targetMs && state.phase === 'alive' && guard++ < 500) {
    t = Math.min(t + 24 * 3600 * 1000, targetMs);
    logOut.push(...catchUp(state, t, rng));
    while (state.pendingEvent) applyEventChoice(state, 0);
  }
  return logOut;
}

// ── 1. 週境界（01 §7-1） ──────────────────────────────
section('週境界・週ID');
{
  const sundayLate = DAY(6) + (23 * 3600 + 59 * 60 + 59) * 1000; // 日曜23:59:59
  const mondayZero = DAY(7);                                      // 翌月曜0:00:00
  eq(weekIdOf(sundayLate), MONDAY_ID, '日曜23:59:59は当週に帰属');
  eq(weekIdOf(mondayZero), addDaysToId(MONDAY_ID, 7), '月曜0:00:00は翌週に帰属');
  assert(isMondayId(MONDAY_ID), '週IDは月曜の日付');
  eq(weekDates(MONDAY_ID).length, 7, '週は7日');
  eq(dateId(parseDateId('2026-01-05')), '2026-01-05', 'dateId⇄parseDateIdの往復');
}

// ── 2. 週次判定：達成・未達・ちょうど一致・グレース・昇格 ──
section('週次判定');
{
  // 達成（ちょうど一致は達成・01 §5-4）
  const { state, rng } = newState({ goal: 21000 });
  setSteps(state, 0, 21000); // 月曜に21,000歩＝目標ちょうど
  catchUp(state, DAY(7) + 1000, rng);
  eq(state.weeks[MONDAY_ID].result, 'SURVIVE', '累計＝目標ちょうどは達成');
  eq(state.phase, 'alive', '達成で存続');
}
{
  // 初週グレース：未達でも滅亡しない（01 §7-8）
  const { state, rng } = newState();
  catchUp(state, DAY(7) + 1000, rng); // 歩数ゼロのまま初週の締めへ
  eq(state.weeks[MONDAY_ID].result, 'GRACE', '初週は未達でもグレース');
  eq(state.phase, 'alive', 'グレース週で滅亡しない');
}
{
  // 2週目の未達は滅亡（グレースは初週のみ）
  const { state, rng } = newState();
  catchUp(state, DAY(14) + 1000, rng);
  const week2 = addDaysToId(MONDAY_ID, 7);
  eq(state.weeks[week2].result, 'PERISH', '2週目未達で滅亡');
  eq(state.phase, 'perished', '滅亡後は再出発待ち');
  eq(state.history.length, 1, '歴史書に1件記録');
  eq(state.history[0].familyName, '山田', '歴史書に家名');
  eq(state.progress.longestGenerations, 1, '最長記録を更新');
}
{
  // pendingGoal の翌週昇格（01 §4-3）：当週 activeGoal は不変
  const { state, rng } = newState({ goal: 21000 });
  setSteps(state, 0, 30000);
  reserveGoal(state, 14000);
  eq(state.goal.activeGoal, 21000, '予約しても当週목標は不変');
  catchUp(state, DAY(7) + 1000, rng);
  eq(state.goal.activeGoal, 14000, '存続確定後にpendingGoalが昇格');
  eq(state.goal.pendingGoal, null, '昇格後pendingGoalはnull');
  catchUp(state, DAY(8), rng);
  eq(state.weeks[addDaysToId(MONDAY_ID, 7)].activeGoal, 14000, '新しい週は新목標で固定');
}

// ── 3. 冪等性（01 §7-9）─────────────────────────────
section('冪等性');
{
  const { state, rng } = newState();
  setSteps(state, 0, 25000);
  catchUp(state, DAY(9) + 5000, rng);
  const snap1 = JSON.stringify(state);
  catchUp(state, DAY(9) + 5000, rng); // 同時刻で再実行
  eq(JSON.stringify(state), snap1, 'catch-upの二重実行で状態不変');
}

// ── 4. 複数週未起動の一括反映（01 §7-6）──────────────
section('複数週の遡及判定');
{
  const { state, rng } = newState({ goal: 21000 });
  // 週1=グレース（歩数0）／週2=達成／週3=未達→ここで滅亡／週4以降は処理されない
  setSteps(state, 7, 25000); // 週2の月曜に25,000歩
  catchUp(state, DAY(35), rng); // 5週ぶん一気に進める
  const w2 = addDaysToId(MONDAY_ID, 7);
  const w3 = addDaysToId(MONDAY_ID, 14);
  const w4 = addDaysToId(MONDAY_ID, 21);
  eq(state.weeks[w2].result, 'SURVIVE', '週2は存続として処理');
  eq(state.weeks[w3].result, 'PERISH', '最初に未達となった週3で滅亡');
  assert(!state.weeks[w4] || !state.weeks[w4].judged, '週4以降は旧一族では判定されない');
  eq(state.phase, 'perished', '滅亡で停止');
}

// ── 5. 同時イベントの優先順位（01 §7-4／§7-5）─────────
section('存亡と寿命の同時発生');
{
  // 達成＋寿命到来 → 存続したうえで代替わり
  const { state, rng } = newState({ goal: 7000, bornAt: MONDAY_MS + 3600 * 1000 });
  state.dynasty.leader.lifespanDays = 14; // 月曜誕生→14日目完了＝翌々月曜0:00に寿命到来
  for (let i = 7; i < 14; i++) setSteps(state, i, 2000); // 週2達成（計14,000≧7,000）
  catchUp(state, DAY(14) + 1000, rng);
  const w2 = addDaysToId(MONDAY_ID, 7);
  eq(state.weeks[w2].result, 'SURVIVE', '達成で存続');
  eq(state.phase, 'alive', '一族は継続');
  eq(state.dynasty.generation, 2, '存続後に代替わり発生');
  eq(state.dynasty.pastLeaders.length, 1, '家系図に先代を記録');
  assert(state.dynasty.pastLeaders[0].heirloomLeft, '先代は家宝を遺す');
  assert(!state.dynasty.pastLeaders[0].perished, '先代は大往生（滅亡ではない）');
}
{
  // 未達＋寿命到来 → 滅亡。代替わりは発生しない
  const { state, rng } = newState({ goal: 21000, bornAt: MONDAY_MS + 3600 * 1000 });
  state.dynasty.leader.lifespanDays = 14;
  catchUp(state, DAY(14) + 1000, rng); // 週2は歩数ゼロ＝未達
  eq(state.phase, 'perished', '未達で滅亡');
  eq(state.dynasty.generation, 1, '代替わりは発生しない');
  assert(state.history[0].leaders[0].perished, '最後の当主として記録（大往生ではない）');
}

// ── 6. 寿命計算（02 §4-4 の計算例6ケース）──────────────
section('寿命計算');
{
  const cases = [
    [90, 200000, 26], [70, 130000, 23], [60, 104000, 21],
    [50, 90000, 19], [35, 60000, 16], [15, 25000, 14],
  ];
  for (const [H, S, expect] of cases) {
    eq(computeLifespan(H, S, 104000).lifespanDays, expect, `H=${H} S=${S} → 寿命${expect}日`);
  }
  eq(computeLifespan(100, 1000000, 104000).lifespanDays, 26, '上限26日でクランプ');
  eq(computeLifespan(0, 0, 104000).lifespanDays, 14, '下限14日でクランプ');
}

// ── 7. 日次更新式（02 §5-2）──────────────────────────
section('ステータス日次更新');
{
  const g = 3000;
  let s = { health: 60, vitality: 50, charm: 50, wealth: 40 };
  applyDailySteps(s, 3000, g); // d=0
  eq(s.vitality, 47, '目標どおりでも活力は-3（自然減衰）');
  eq(s.health, 60, 'd=0で健康は変化なし');
  s = { health: 60, vitality: 50, charm: 50, wealth: 40 };
  applyDailySteps(s, 6000, g); // d=+1
  eq(s.vitality, 57, 'd=+1で活力+10-3');
  eq(s.health, 62, 'd=+1で健康+2');
  eq(s.charm, 54, 'd=+1で人望+4');
  eq(s.wealth, 42, 'd=+1で財産+2');
  s = { health: 60, vitality: 50, charm: 50, wealth: 40 };
  applyDailySteps(s, 0, g); // d=-1
  eq(s.vitality, 37, 'd=-1で活力-10-3');
  eq(s.health, 58, 'd=-1で健康-2');
  eq(s.charm, 46, 'd=-1で人望-4');
  eq(s.wealth, 40, '財産はマイナスにしない');
  s = { health: 60, vitality: 50, charm: 50, wealth: 40 };
  applyDailySteps(s, 30000, g); // d=+9 → クランプで+2.0
  eq(s.vitality, 67, 'dは+2.0で頭打ち（活力+20-3）');
  s = { health: 1, vitality: 1, charm: 1, wealth: 0 };
  applyDailySteps(s, 0, g);
  eq(s.vitality, 0, 'ステータスは0で底打ち');
}

// ── 8. 家宝・遺伝（02 §7）────────────────────────────
section('家宝と遺伝');
{
  const mk = (rate, stats, legacy = null) => ({
    totalSteps: rate * 100000, expectedSteps: 100000,
    stats, flags: { legacyChoice: legacy, familyTradition: null },
  });
  const st = { health: 80, vitality: 50, charm: 60, wealth: 40 };
  eq(computeHeirloom(mk(1.10, st)).rank, '金', '達成率110%は金');
  eq(computeHeirloom(mk(1.09, st)).rank, '銀', '達成率109%は銀');
  eq(computeHeirloom(mk(0.80, st)).rank, '銀', '達成率80%は銀');
  eq(computeHeirloom(mk(0.79, st)).rank, '銅', '達成率79%は銅（必ず銅以上）');
  eq(computeHeirloom(mk(1.2, st)).bonus, 10, '金は+10');
  eq(computeHeirloom(mk(1.0, st)).bonus, 6, '銀は+6');
  eq(computeHeirloom(mk(0.1, st)).bonus, 3, '銅は+3');
  eq(computeHeirloom(mk(1.0, st)).targetStat, 'health', '補正先はargmax(健康,人望,財産)');
  eq(computeHeirloom(mk(1.0, st, '財産')).type, '財産', '種別はE13の選択を優先');
}
{
  // ステータス継承20%（基礎超過分のみ）・活力は継承しない（02 §7-3）
  const rng = mulberry32(7);
  const parent = createLeader(rng, MONDAY_MS, null, null);
  parent.stats = { health: 80, vitality: 90, charm: 40, wealth: 60 };
  parent.flags.childQuality = null;
  const child = createLeader(rng, MONDAY_MS, parent, null);
  eq(child.stats.health, BASE_STATS.health + 4, '健康：基礎超過20×20%=+4');
  eq(child.stats.vitality, 50, '活力は継承せず50');
  eq(child.stats.charm, BASE_STATS.charm, '基礎未満は継承しない（負の継承なし）');
  eq(child.stats.wealth, BASE_STATS.wealth + 4, '財産：基礎超過20×20%=+4');
  // E09高分岐の底上げ（05 §9-D9）
  parent.flags.childQuality = '高';
  const child2 = createLeader(mulberry32(8), MONDAY_MS, parent, null);
  eq(child2.stats.vitality, 52, 'E09高で全ステータス+2');
  // 家宝補正
  const h = { rank: '金', type: '健康', label: '丈夫な体', bonus: 10, targetStat: 'health' };
  const child3 = createLeader(mulberry32(9), MONDAY_MS, parent, h);
  eq(child3.stats.health, BASE_STATS.health + 4 + 2 + 10, '遺伝+E09+家宝が加算される');
}

// ── 9. イベント発生制御（03 §2.3）────────────────────
section('イベント発生制御');
{
  // 中核必発：青年期E06/E07、壮年期E09/E10。発生は約2日に1回
  const { state, rng } = newState({ goal: 7000 });
  // 大量に歩いて長寿にする（全日6,000歩 > g=1,000）
  for (let i = 0; i < 30; i++) setSteps(state, i, 6000);
  advanceAnswering(state, rng, DAY(13) + 1000); // 壮年期の終わりまで
  const fired = state.dynasty.leader.eventLog.map(e => e.id);
  assert(fired.includes('E01'), 'E01（就任）が発生');
  assert(fired.includes('E04'), 'E04（進学・中核）が学生期に必発');
  assert(fired.includes('E06'), 'E06（就職・中核）が青年期に必発');
  assert(fired.includes('E07'), 'E07（結婚・中核）が青年期に必発');
  assert(fired.includes('E09'), 'E09（出産・中核）が壮年期に必発');
  assert(fired.includes('E10'), 'E10（転機・中核）が壮年期に必発');
  // 老年期：E14が反復、E13は大往生の直前
  advanceAnswering(state, rng, DAY(30));
  const L0 = state.dynasty.pastLeaders[0] ?? state.dynasty.leader;
  const all = L0.eventLog.map(e => e.id);
  assert(all.includes('E12'), 'E12（晩成）が老年期に発生');
  assert(all.filter(id => id === 'E14').length >= 2, 'E14（余生）が反復発生');
  assert(all.includes('E13'), 'E13（次代への遺し）が大往生前に必発');
  eq(all.indexOf('E13'), all.length - 1, 'E13は一生の最後のイベント');
  // 達成率の分岐：よく歩いたので高
  const e06 = L0.eventLog.find(e => e.id === 'E06');
  assert(e06 && e06.band === '高', '達成率≥110%で高分岐');
}
{
  // ステージ判定
  eq(stageFor(1), '幼少期', '1日目は幼少期');
  eq(stageFor(4), '学生期', '4日目は学生期');
  eq(stageFor(7), '青年期', '7日目は青年期');
  eq(stageFor(10), '壮年期', '10日目は壮年期');
  eq(stageFor(14), '老年期', '14日目は老年期');
  eq(rateBand(1.10), '高', '110%は高');
  eq(rateBand(1.0999), '中', '110%未満は中');
  eq(rateBand(0.80), '中', '80%は中');
  eq(rateBand(0.7999), '低', '80%未満は低');
}

// ── 10. 再出発（01 §6-4）────────────────────────────
section('再出発');
{
  const { state, rng } = newState();
  catchUp(state, DAY(14) + 1000, rng); // 週2未達で滅亡
  eq(state.phase, 'perished', '滅亡確認');
  const ok = restart(state, rng, DAY(14) + 2000, { familyName: '佐藤', goal: 14000 });
  assert(ok, '再出発できる');
  eq(state.dynasty.familyName, '佐藤', '家名は変更可');
  eq(state.goal.activeGoal, 14000, '目標も変更可');
  eq(state.dynasty.generation, 1, '初代から再スタート');
  eq(state.history.length, 1, '歴史書は残る');
  // 再出発時はグレースなし：最初の週も未達なら滅亡（01 §6-4）
  catchUp(state, DAY(21) + 1000, rng);
  eq(state.phase, 'perished', '再出発週は未達なら即滅亡（グレースなし）');
  eq(state.history.length, 2, '歴史書に2件目');
}

// ── 11. 歩数入力とエクスポート/インポート ──────────────
section('歩数入力・エクスポート/インポート');
{
  const { state, rng } = newState();
  const now = MONDAY_MS + 10 * 3600 * 1000;
  assert(inputSteps(state, now, 5000), '当日の歩数を入力できる');
  eq(weekTotal(state, MONDAY_ID), 5000, '週累計に反映');
  assert(inputSteps(state, now, 8000), '当日は上書き可');
  eq(weekTotal(state, MONDAY_ID), 8000, '上書きが反映');
  const json = exportState(state);
  const imported = importState(state, json);
  eq(imported.dynasty.familyName, '山田', 'エクスポート→インポートで復元');
  // 進行ポインタは後退しない（01 §6-5）
  catchUp(state, DAY(7) + 1000, rng);
  const old = importState(state, json);
  eq(old.progress.lastJudgedWeek, state.progress.lastJudgedWeek, 'インポートで判定済み週を後退させない');
  assert(old.progress.maxObservedTime >= state.progress.maxObservedTime, 'maxObservedTimeも後退しない');
}

// ── 結果 ──────────────────────────────────────────
log('');
log(`結果：${passed} 件成功 / ${failed} 件失敗`);
if (failed > 0) {
  log('失敗したテスト：');
  for (const f of failures) log(`  - ${f}`);
}
if (typeof process !== 'undefined') process.exit(failed > 0 ? 1 : 0);
