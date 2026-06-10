// storage.js ― localStorage アダプタ（05 §5-3）。コアロジックはここに依存しない。
const KEY = 'ayutsugi.v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.schemaVersion !== 1) return null; // 将来のスキーマ移行はここで
    return data;
  } catch (e) {
    console.error('保存データの読み込みに失敗:', e);
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('保存に失敗:', e);
  }
}

export function clearState() {
  localStorage.removeItem(KEY);
}
