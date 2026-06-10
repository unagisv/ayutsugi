// main.js ― 起動処理。アダプタ（保存・実時刻・乱数）を注入してUIを開始する（05 §2）。
import { startApp } from './ui.js';
import { loadState, saveState, clearState } from './storage.js';

startApp({
  loadState,
  saveState,
  clearState,
  realNow: () => Date.now(),
  rng: Math.random,
});
