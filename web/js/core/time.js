// time.js ― 週境界・日付ユーティリティ
// 週の定義：月曜0:00:00〜日曜23:59:59（端末ローカルタイムゾーン）（01 §1-1／§5-1）
// 週ID・日IDは "YYYY-MM-DD"（ローカル日付）。文字列の辞書順＝時系列順になる。
// このモジュールは現在時刻を一切取得しない（Clockは呼び出し側が注入する）。

function pad(n) {
  return String(n).padStart(2, '0');
}

// epoch ms → ローカル日付ID "YYYY-MM-DD"
export function dateId(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 日付ID → その日のローカル0:00の epoch ms
export function parseDateId(id) {
  const [y, m, d] = id.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

// 日付IDのn日後（DST安全：Dateの日付演算に任せる）
export function addDaysToId(id, n) {
  const [y, m, d] = id.split('-').map(Number);
  return dateId(new Date(y, m - 1, d + n).getTime());
}

export function nextDateId(id) {
  return addDaysToId(id, 1);
}

// その時刻が属する週の週ID（＝その週の月曜のローカル日付。01 §5-1／05 §9-D12）
export function weekIdOf(ms) {
  const d = new Date(ms);
  const dow = (d.getDay() + 6) % 7; // 月曜=0 … 日曜=6
  return dateId(new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow).getTime());
}

export function weekIdOfDateId(id) {
  return weekIdOf(parseDateId(id));
}

// 週IDに属する7日分の日付ID（月〜日）
export function weekDates(weekId) {
  const out = [];
  for (let i = 0; i < 7; i++) out.push(addDaysToId(weekId, i));
  return out;
}

// その日付IDは月曜か（週境界＝月曜0:00の判定に使う）
export function isMondayId(id) {
  return new Date(parseDateId(id)).getDay() === 1;
}

// 表示用：仮想日時の整形
export function formatDateTime(ms) {
  const d = new Date(ms);
  const youbi = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}（${youbi}） ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
