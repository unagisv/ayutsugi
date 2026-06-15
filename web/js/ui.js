// ui.js ― 画面描画・遷移・モーダル・デバッグパネル（specs/04 の5画面構成を踏襲）
// ナビゲーションはホーム集約型（04 §1 確定事項1）。コアロジックには触れず game.js を呼ぶだけ。
import {
  createInitialState, catchUp, inputSteps, weekTotal, presentEvent, applyEventChoice,
  restart, reserveGoal, exportState, importState,
} from './core/game.js';
import { weekIdOf, weekDates, formatDateTime, formatDate, dateId, addDaysToId } from './core/time.js';
import { achievementRate, rateBand, expressionFor, fitnessLevel, outfitFor } from './core/life.js';
import { GOAL_MIN, GOAL_MAX, GOAL_STEP, GOAL_DEFAULT, DANGER_RATE } from './core/rules.js';
import { renderAvatar, avatarDescription } from './avatar.js';

let deps = null;          // { loadState, saveState, clearState, realNow, rng }
let state = null;
let currentScreen = 'home';
let modalQueue = [];      // 演出モーダルの順次表示キュー

const $ = (sel) => document.querySelector(sel);

function now() {
  return deps.realNow() + (state?.clock.offsetMs ?? 0);
}

function save() {
  deps.saveState(state);
}

// ─────────────────────────────────────────────
// 起動
// ─────────────────────────────────────────────

export function startApp(d) {
  deps = d;
  state = deps.loadState();
  $('#header-nav').addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) navigate(nav.dataset.nav);
  });
  $('#dev-toggle').addEventListener('click', toggleDebug);

  if (!state) {
    renderOnboarding();
  } else {
    tick();
  }
  // 実時間の経過（日付またぎ）を拾う（05 §5-2）
  setInterval(() => { if (state) tick(); }, 60 * 1000);
}

// catch-up → 保存 → 演出 → 再描画
function tick() {
  const log = catchUp(state, now(), deps.rng);
  save();
  enqueueLogModals(log);
  render();
  pumpModals();
}

function enqueueLogModals(log) {
  for (const item of log) {
    if (item.type === 'succession') modalQueue.push({ kind: 'succession', item });
    if (item.type === 'perish') modalQueue.push({ kind: 'perish', item });
    if (item.type === 'oldage') modalQueue.push({ kind: 'oldage', item });
  }
}

// ─────────────────────────────────────────────
// 画面遷移
// ─────────────────────────────────────────────

function navigate(screen) {
  currentScreen = screen;
  render();
}

function render() {
  $('#header').hidden = false;
  $('#footer').hidden = false;
  $('#virtual-time').textContent = formatDateTime(now());
  const dyn = state.dynasty;
  $('#header-title').textContent = state.phase === 'alive'
    ? `${dyn.familyName}家 ${dyn.generation}代目`
    : '─ 再出発を待つ ─';

  if (state.phase === 'perished') { renderPerished(); return; }
  if (currentScreen === 'home') renderHome();
  else if (currentScreen === 'family') renderFamily();
  else if (currentScreen === 'history') renderHistory();
  else if (currentScreen === 'settings') renderSettings();
}

// ─────────────────────────────────────────────
// オンボーディング（04 §3.5 をWebデモ向けに簡略化・05 §5-4）
// ─────────────────────────────────────────────

function renderOnboarding() {
  $('#header').hidden = true;
  $('#footer').hidden = true;
  $('#screen').innerHTML = `
    <div class="onboarding">
      <h1>歩継ぎ<span class="kana">（あゆつぎ）</span></h1>
      <p class="concept">あなたが歩いた分だけ、<br>一族の物語が続いていく。</p>
      <div class="card">
        <p>毎日の歩数を記録すると、画面の中の当主の人生が豊かになります。</p>
        <p>週間目標を達成し続ける限り、一族は代をつないでいきます。<br><strong>目標を破れば、一族は滅亡します。</strong></p>
        <p class="note">※これは体験デモ版です。歩数は手で入力します。</p>
      </div>
      <div class="card">
        <label>家名（一族の名前）<br>
          <input type="text" id="ob-family" placeholder="例：山田" maxlength="10">
        </label>
      </div>
      <div class="card">
        <label>イベント性差
          <select id="ob-gendered">
            <option value="no" selected>なし（性別によらない表現）</option>
            <option value="yes">あり（性別で文章が変化）</option>
          </select>
        </label>
        <p class="note">あとから目標設定でいつでも変更できます。</p>
      </div>
      <div class="card">
        <label>週間目標歩数<br>
          <input type="number" id="ob-goal" value="${GOAL_DEFAULT}" min="${GOAL_MIN}" max="${GOAL_MAX}" step="${GOAL_STEP}" inputmode="numeric">
        </label>
        <p class="note">1日3,000歩 × 7日 ＝ 21,000歩が目安です。${GOAL_MIN.toLocaleString()}〜${GOAL_MAX.toLocaleString()}歩・1,000歩刻み。<br>最初の1週間はお試し期間（滅亡しません）。</p>
      </div>
      <button class="primary" id="ob-start">一族の歴史をはじめる</button>
    </div>`;
  $('#ob-start').addEventListener('click', () => {
    const familyName = $('#ob-family').value.trim();
    if (!familyName) { alert('家名を入力してください'); return; }
    const goal = Number($('#ob-goal').value) || GOAL_DEFAULT;
    state = createInitialState(deps.rng, deps.realNow(), {
      familyName,
      goal,
      genderedEvents: $('#ob-gendered').value === 'yes',
    });
    save();
    currentScreen = 'home';
    tick();
  });
}

// ─────────────────────────────────────────────
// ホーム（04 §3.1：第一視認領域＝当主ビジュアル・今日の歩数・週間進捗）
// ─────────────────────────────────────────────

function insertAvatar(container, leader, scale) {
  const cv = renderAvatar(leader, scale);
  container.appendChild(cv);
}

function renderHome() {
  const L = state.dynasty.leader;
  const wid = weekIdOf(now());
  const week = state.weeks[wid];
  const goal = week?.activeGoal ?? state.goal.activeGoal;
  const total = weekTotal(state, wid);
  const remaining = Math.max(0, goal - total);
  const pct = Math.min(100, Math.round(total / goal * 100));
  const today = dateId(now());
  const todaySteps = state.days[today]?.steps;
  const desc = avatarDescription(L);
  const rate = achievementRate(L.totalSteps, L.expectedSteps);
  const isGrace = wid === state.progress.graceWeek;
  const dow = new Date(now()).getDay(); // 0=日曜
  const danger = !isGrace && dow === 0 && total < goal * DANGER_RATE;
  const dayNum = L.elapsedDays + 1;

  $('#screen').innerHTML = `
    <div class="home">
      ${danger ? `<div class="banner danger">⚠ 危険水域：今日中（日曜24時まで）にあと${remaining.toLocaleString()}歩。未達なら${state.dynasty.familyName}家は途絶えます。</div>` : ''}
      ${isGrace ? `<div class="banner grace">🌱 最初の週はお試し期間です（滅亡しません）。来週の月曜から本番がはじまります。</div>` : ''}
      <div class="avatar-block outfit-${desc.tier}">
        <div class="avatar" id="home-avatar"></div>
        <div class="avatar-meta">
          <div class="leader-name">${L.name} <span class="expr">${desc.expression}</span></div>
          <div class="stage-line">${L.stage}・${dayNum}日目${L.lifespanDays ? `（寿命 ${L.lifespanDays}日）` : ''}</div>
          <div class="trait-line">${L.traits.appearance}／${L.traits.personality}・体つきLv${desc.fitLevel}・装い:${desc.tier}</div>
        </div>
      </div>
      ${state.pendingEvent ? `<button class="event-cta" id="open-event">📖 人生イベントが発生しています</button>` : ''}
      <div class="card steps-card">
        <label>今日の歩数（手入力）<br>
          <span class="steps-row">
            <input type="number" id="steps-input" inputmode="numeric" min="0" max="99999" placeholder="0" value="${todaySteps ?? ''}">
            <button class="primary" id="steps-save">記録</button>
          </span>
        </label>
      </div>
      <div class="card progress-card">
        <div class="progress-head">
          <span>今週 ${total.toLocaleString()} / ${goal.toLocaleString()} 歩</span>
          <span>${total >= goal ? '✅ 達成！' : `あと ${remaining.toLocaleString()} 歩`}</span>
        </div>
        <div class="bar"><div class="bar-fill ${total >= goal ? 'done' : ''}" style="width:${pct}%"></div></div>
        ${total >= goal ? `<p class="note">今週は達成済み。残りの歩みは当主の人生を豊かにします（存続の確定は日曜24時）。</p>` : ''}
        ${state.goal.pendingGoal !== null ? `<p class="note">来週から：${state.goal.pendingGoal.toLocaleString()}歩（予約中）</p>` : ''}
      </div>
      <details class="card stats-card">
        <summary>ステータス（達成率 ${(rate * 100).toFixed(0)}%・当代累計 ${L.totalSteps.toLocaleString()}歩）</summary>
        ${statBar('健康', L.stats.health)}
        ${statBar('活力', L.stats.vitality)}
        ${statBar('人望', L.stats.charm)}
        ${statBar('財産', L.stats.wealth)}
        ${L.sickFlag ? '<p class="note">⚠ 健康が低下しています（30以下）。よく歩いて立て直しましょう。</p>' : ''}
        <p class="note">基準は「週間目標÷7」。目標より多く歩いた日は人生が好転します。</p>
      </details>
    </div>`;

  insertAvatar($('#home-avatar'), L, 5);

  $('#steps-save').addEventListener('click', () => {
    const v = Number($('#steps-input').value);
    if (Number.isNaN(v) || v < 0) { alert('0以上の数を入力してください'); return; }
    inputSteps(state, now(), v);
    save();
    render();
  });
  $('#open-event')?.addEventListener('click', openEventModal);
}

function statBar(label, value) {
  return `<div class="stat-row"><span class="stat-label">${label}</span>
    <div class="bar small"><div class="bar-fill" style="width:${value}%"></div></div>
    <span class="stat-val">${value}</span></div>`;
}

// ─────────────────────────────────────────────
// 人生イベントモーダル（04 §4.2：モーダル表示・軽い選択肢）
// ─────────────────────────────────────────────

function openEventModal() {
  const ev = presentEvent(state);
  if (!ev) return;
  const choicesHtml = ev.choices
    ? ev.choices.map((c, i) => `<button class="choice" data-i="${i}">${c}</button>`).join('')
    : `<button class="choice" data-i="-1">つづける</button>`;
  showModal(`
    <h2>📖 ${ev.name}</h2>
    <p class="event-text">${ev.intro.replace(/\n/g, '<br>')}</p>
    <div class="choices">${choicesHtml}</div>`,
    (root, close) => {
      root.querySelectorAll('.choice').forEach(btn => btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i);
        const out = applyEventChoice(state, i < 0 ? null : i);
        save();
        root.innerHTML = `
          <h2>📖 ${out.name}</h2>
          <p class="event-text">${out.text.replace(/\n/g, '<br>')}</p>
          <p class="band-line">${out.band === '高' ? '✨ よく歩いた日々が実を結んだ（高）' : out.band === '中' ? '🙂 堅実な歩み（中）' : '🍵 控えめな歩み（低）'}</p>
          <button class="primary" id="ev-close">とじる</button>`;
        root.querySelector('#ev-close').addEventListener('click', () => { close(); render(); pumpModals(); });
      }));
    });
}

// ─────────────────────────────────────────────
// 演出モーダル（大往生・老年期突入・滅亡）
// ─────────────────────────────────────────────

function pumpModals() {
  if ($('#modal-root').hidden === false) return; // 表示中なら待つ
  const next = modalQueue.shift();
  if (!next) {
    // 演出が終わってイベントが待っていれば導線を見せる（自動では開かない）
    return;
  }
  if (next.kind === 'oldage') {
    showModal(`
      <h2>🍂 老年期</h2>
      <p class="event-text">当主は老年期を迎えた。<br>これまでの歩みから、天寿は <strong>${next.item.lifespanDays}日</strong> と定まった。</p>
      <button class="primary" id="m-ok">つづける</button>`,
      (root, close) => root.querySelector('#m-ok').addEventListener('click', () => { close(); pumpModals(); }));
  } else if (next.kind === 'succession') {
    const r = next.item.record;
    const h = next.item.heirloom;
    showModal(`
      <h2>🕊 大往生</h2>
      <p class="event-text">${r.name}は天寿を全うした。<br>${r.elapsedDays}日の一生だった。家系図に名が刻まれる。</p>
      <p class="event-text">家宝『${h.label}』（${h.rank}）が次代へ遺された。</p>
      <p class="event-text">${state.dynasty.familyName}家 ${next.item.generation}代目「${next.item.newLeader}」が当主となる。</p>
      <button class="primary" id="m-ok">次の代へ</button>`,
      (root, close) => root.querySelector('#m-ok').addEventListener('click', () => { close(); render(); pumpModals(); }));
  } else if (next.kind === 'perish') {
    showPerishCinematic(next.item.info);
  }
}

// 滅亡演出：全画面だが短く・1タップでスキップ可（04 §1 確定事項3）
function showPerishCinematic(info) {
  const root = $('#modal-root');
  root.hidden = false;
  root.innerHTML = `
    <div class="perish-screen" id="perish-screen">
      <div class="perish-inner">
        <p class="perish-title">${info.familyName}家、途絶える</p>
        <p class="perish-sub">${info.generations}代 続いた歴史が、ここで幕を閉じた。</p>
        <p class="perish-tap">（タップで進む）</p>
      </div>
    </div>`;
  $('#perish-screen').addEventListener('click', () => {
    root.innerHTML = '';
    root.hidden = true;
    render(); // → renderPerished（歴史書に刻まれた肯定的画面＋再出発1タップ）
  }, { once: true });
}

// 滅亡後の再出発画面（04 §4.4：肯定的画面→再出発1タップ）
function renderPerished() {
  const info = state.perishInfo;
  const longest = state.progress.longestGenerations;
  $('#screen').innerHTML = `
    <div class="perished">
      <div class="card">
        <h2>📜 歴史書に刻まれました</h2>
        <p>${info.familyName}家は <strong>${info.generations}代</strong> 続きました。</p>
        <p class="note">${formatDate(info.perishedAt)}・週間目標 ${info.goal.toLocaleString()}歩に対し ${info.total.toLocaleString()}歩</p>
        ${info.newRecord ? '<p class="record">🏆 自己ベスト更新！</p>' : `<p class="note">これまでの最長記録：${longest}代</p>`}
        <p>その歩みは消えません。歴史書からいつでも振り返れます。</p>
      </div>
      <div class="card">
        <h3>新しい一族で再出発</h3>
        <label>家名<br><input type="text" id="rs-family" value="${info.familyName}" maxlength="10"></label>
        <label>週間目標歩数<br><input type="number" id="rs-goal" value="${info.goal}" min="${GOAL_MIN}" max="${GOAL_MAX}" step="${GOAL_STEP}" inputmode="numeric"></label>
        <p class="note">※再出発の週からすぐに本判定です（お試し期間はありません）。</p>
        <button class="primary" id="rs-start">新しい一族で歩きはじめる</button>
      </div>
      <button class="ghost" data-nav-history>歴史書を見る</button>
    </div>`;
  $('#rs-start').addEventListener('click', () => {
    const familyName = $('#rs-family').value.trim() || info.familyName;
    const goal = Number($('#rs-goal').value) || info.goal;
    restart(state, deps.rng, now(), { familyName, goal });
    save();
    currentScreen = 'home';
    tick();
  });
  document.querySelector('[data-nav-history]')?.addEventListener('click', () => {
    renderHistoryInto($('#screen'), true);
  });
}

// ─────────────────────────────────────────────
// 家系図（04 §3.2）
// ─────────────────────────────────────────────

function leaderDigest(r, isCurrent = false) {
  const events = (r.eventLog ?? []).map(e => `<li><span class="ev-band ev-${e.band}">${e.band}</span> <strong>${e.name}</strong>：${e.text.split('\n')[0]}</li>`).join('');
  const heirloom = r.heirloomLeft ? `<p>遺した家宝：『${r.heirloomLeft.label}』（${r.heirloomLeft.rank}・次代の${{ health: '健康', charm: '人望', wealth: '財産' }[r.heirloomLeft.targetStat]}+${r.heirloomLeft.bonus}）</p>` : '';
  const inherited = r.inheritedHeirloom ? `<p>受け継いだ家宝：『${r.inheritedHeirloom.label}』（${r.inheritedHeirloom.rank}）</p>` : '';
  const flags = [];
  if (r.flags?.education) flags.push(`学歴:${r.flags.education}`);
  if (r.flags?.job) flags.push(`職:${r.flags.job}`);
  if (r.flags?.familyTradition) flags.push(`家風:${r.flags.familyTradition}`);
  return `
    <p>${r.perished ? '最後の当主として歴史に残る' : isCurrent ? `${r.stage}を生きている` : `${r.elapsedDays ?? '?'}日の一生（大往生）`}・生涯達成率 ${r.lifetimeRate !== undefined ? (r.lifetimeRate * 100).toFixed(0) + '%' : '—'}</p>
    <p>累計 ${(r.totalSteps ?? 0).toLocaleString()}歩・${r.traits?.appearance ?? ''}／${r.traits?.personality ?? ''}${flags.length ? '・' + flags.join('・') : ''}</p>
    ${inherited}${heirloom}
    ${events ? `<ul class="digest">${events}</ul>` : '<p class="note">記録された出来事はまだありません。</p>'}`;
}

function renderFamily() {
  const dyn = state.dynasty;
  const rows = dyn.pastLeaders.map((r, i) => `
    <details class="card leader-row">
      <summary><span class="leader-avatar" data-past="${i}"></span>${i + 1}代目 ${r.name}（${r.gender === 'M' ? '男' : '女'}）🕊</summary>
      ${leaderDigest(r)}
    </details>`).join('');
  const L = dyn.leader;
  const cur = `
    <details class="card leader-row current" open>
      <summary><span class="leader-avatar" data-current></span>${dyn.generation}代目 ${L.name}（${L.gender === 'M' ? '男' : '女'}）★当代</summary>
      ${leaderDigest({ ...L, lifetimeRate: achievementRate(L.totalSteps, L.expectedSteps) }, true)}
      <button class="ghost" id="rename-btn">当主の名を改める</button>
    </details>`;
  $('#screen').innerHTML = `
    <div class="family">
      <h2>${dyn.familyName}家 家系図</h2>
      <p class="note">創始：${formatDate(dyn.foundedAt)}</p>
      ${rows}${cur}
    </div>`;
  // 家系図のミニアバターを挿入
  dyn.pastLeaders.forEach((r, i) => {
    const el = document.querySelector(`[data-past="${i}"]`);
    if (el) insertAvatar(el, r, 2);
  });
  const curEl = document.querySelector('[data-current]');
  if (curEl) insertAvatar(curEl, L, 2);
  $('#rename-btn')?.addEventListener('click', () => {
    const name = prompt('新しい名前', L.name);
    if (name && name.trim()) { L.name = name.trim(); save(); render(); }
  });
}

// ─────────────────────────────────────────────
// 歴史書（04 §3.3）
// ─────────────────────────────────────────────

function renderHistory() {
  renderHistoryInto($('#screen'), false);
}

function renderHistoryInto(el, fromPerished) {
  const longest = state.progress.longestGenerations;
  const recordLine = state.dynasty?.generation > longest
    ? '🏆 いまの一族が最長記録を更新中！'
    : longest > 0 ? `最長記録の更新まであと${longest - state.dynasty.generation + 1}代。` : '';
  const aliveLine = state.phase === 'alive'
    ? `<p>現在の${state.dynasty.familyName}家は <strong>${state.dynasty.generation}代</strong>。${recordLine}</p>`
    : '';
  const entries = [...state.history].reverse().map(h => `
    <details class="card">
      <summary>${h.familyName}家 ─ ${h.generations}代（${formatDate(h.foundedAt)}〜${formatDate(h.perishedAt)}）</summary>
      <p class="note">最後の週：目標${h.goalAtPerish.toLocaleString()}歩に対し ${h.totalAtPerish.toLocaleString()}歩</p>
      ${h.leaders.map((r, i) => `<details class="leader-row"><summary>${i + 1}代目 ${r.name}${r.perished ? '（最後の当主）' : ' 🕊'}</summary>${leaderDigest(r)}</details>`).join('')}
    </details>`).join('');
  el.innerHTML = `
    <div class="history">
      <h2>📜 歴史書</h2>
      <div class="card longest"><span>これまでの最長記録</span><strong>${longest > 0 ? `${longest}代` : 'まだ記録なし'}</strong></div>
      ${aliveLine}
      ${entries || '<p class="note">滅亡した一族はまだありません。この調子で歩き続けましょう。</p>'}
      ${fromPerished ? '<button class="primary" id="back-restart">再出発へ戻る</button>' : ''}
    </div>`;
  el.querySelector('#back-restart')?.addEventListener('click', () => render());
}

// ─────────────────────────────────────────────
// 目標設定（設定ハブ・04 §3.4）
// ─────────────────────────────────────────────

function renderSettings() {
  const g = state.goal;
  $('#screen').innerHTML = `
    <div class="settings">
      <h2>⚙️ 目標設定</h2>
      <div class="card">
        <p>今週の目標：<strong>${g.activeGoal.toLocaleString()}歩</strong>（変更不可）</p>
        <label>来週からの目標<br>
          <span class="steps-row">
            <input type="number" id="goal-input" value="${g.pendingGoal ?? g.activeGoal}" min="${GOAL_MIN}" max="${GOAL_MAX}" step="${GOAL_STEP}" inputmode="numeric">
            <button class="primary" id="goal-save">予約</button>
          </span>
        </label>
        ${g.pendingGoal !== null ? `<p class="note">予約中：来週から ${g.pendingGoal.toLocaleString()}歩</p>` : ''}
        <p class="note">変更は翌週（次の月曜0時）から反映されます。当週の目標は変更できません。<br>苦しくなってから当週の目標を下げる抜け道をなくし、約束を守るための仕組みです。</p>
      </div>
      <div class="card">
        <label>イベント性差
          <select id="gendered-toggle">
            <option value="no" ${state.settings.genderedEvents ? '' : 'selected'}>なし（性別によらない表現）</option>
            <option value="yes" ${state.settings.genderedEvents ? 'selected' : ''}>あり（性別で文章が変化）</option>
          </select>
        </label>
        <p class="note">物語の彩りの設定です。ゲームの進行・判定には影響しません。</p>
      </div>
      <div class="card">
        <h3>データ移行（エクスポート / インポート）</h3>
        <p class="note">機種変更時の引き継ぎ用。ブラウザのデータは消えることがあるため、ときどきバックアップを取っておくと安心です。</p>
        <button class="ghost" id="export-btn">エクスポート（書き出し）</button>
        <textarea id="io-area" rows="4" placeholder="エクスポートするとここに表示されます。インポートはここに貼り付けて下のボタンを押してください。"></textarea>
        <span class="steps-row">
          <button class="ghost" id="copy-btn">コピー</button>
          <button class="ghost" id="download-btn">ファイル保存</button>
          <button class="ghost" id="import-btn">インポート（読み込み）</button>
        </span>
      </div>
      <div class="card danger-zone">
        <h3>全データリセット</h3>
        <p class="note">歴史書を含むすべてのデータを消去して最初からやり直します（デモ用）。</p>
        <button class="ghost danger" id="reset-btn">すべて消去してやり直す</button>
      </div>
    </div>`;

  $('#goal-save').addEventListener('click', () => {
    const v = Number($('#goal-input').value);
    if (Number.isNaN(v)) return;
    reserveGoal(state, v);
    save();
    render();
  });
  $('#gendered-toggle').addEventListener('change', (e) => {
    state.settings.genderedEvents = e.target.value === 'yes';
    save();
  });
  $('#export-btn').addEventListener('click', () => {
    $('#io-area').value = exportState(state);
  });
  $('#copy-btn').addEventListener('click', async () => {
    if (!$('#io-area').value) $('#io-area').value = exportState(state);
    try { await navigator.clipboard.writeText($('#io-area').value); alert('コピーしました'); }
    catch { $('#io-area').select(); }
  });
  $('#download-btn').addEventListener('click', () => {
    const blob = new Blob([exportState(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ayutsugi_backup_${dateId(now())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('#import-btn').addEventListener('click', () => {
    const text = $('#io-area').value.trim();
    if (!text) { alert('インポートするデータを貼り付けてください'); return; }
    if (!confirm('現在のデータを読み込んだ内容で置き換えます。よろしいですか？')) return;
    try {
      state = importState(state, text);
      save();
      tick();
      alert('インポートしました');
    } catch (e) {
      alert(`インポートに失敗しました：${e.message}`);
    }
  });
  $('#reset-btn').addEventListener('click', () => {
    if (!confirm('歴史書を含むすべてのデータが消えます。本当にやり直しますか？')) return;
    deps.clearState();
    location.reload();
  });
}

// ─────────────────────────────────────────────
// デバッグパネル（隠し気味・05 §5-2）
// ─────────────────────────────────────────────

function toggleDebug() {
  const panel = $('#debug-panel');
  if (!panel.hidden) { panel.hidden = true; return; }
  panel.hidden = false;
  panel.innerHTML = `
    <div class="debug-inner">
      <strong>🛠 デバッグ加速モード</strong>
      <p class="note">仮想時刻：<span id="dbg-time">${formatDateTime(now())}</span>（巻き戻しはできません）</p>
      <span class="steps-row">
        <button id="dbg-day">＋1日</button>
        <button id="dbg-week">＋1週</button>
      </span>
      <span class="steps-row">
        <button id="dbg-s2">今日に＋2,000歩</button>
        <button id="dbg-s10">今日に＋10,000歩</button>
      </span>
      <button class="danger" id="dbg-reset">全リセット</button>
    </div>`;
  const advance = (days) => {
    if (!state) return;
    state.clock.offsetMs += days * 24 * 3600 * 1000; // 単調増加のみ（01 §7-2）
    save();
    tick();
    if (!$('#debug-panel').hidden) $('#dbg-time').textContent = formatDateTime(now());
  };
  const addSteps = (n) => {
    if (!state || state.phase !== 'alive') return;
    const today = dateId(now());
    const cur = state.days[today]?.steps ?? 0;
    inputSteps(state, now(), cur + n);
    save();
    render();
  };
  $('#dbg-day').addEventListener('click', () => advance(1));
  $('#dbg-week').addEventListener('click', () => advance(7));
  $('#dbg-s2').addEventListener('click', () => addSteps(2000));
  $('#dbg-s10').addEventListener('click', () => addSteps(10000));
  $('#dbg-reset').addEventListener('click', () => {
    if (!confirm('すべてのデータを消去します。よろしいですか？')) return;
    deps.clearState();
    location.reload();
  });
}

// ─────────────────────────────────────────────
// 汎用モーダル
// ─────────────────────────────────────────────

function showModal(html, setup) {
  const root = $('#modal-root');
  root.hidden = false;
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
  const close = () => { root.innerHTML = ''; root.hidden = true; };
  setup(root.querySelector('.modal'), close);
}
