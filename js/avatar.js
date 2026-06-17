// avatar.js ― AI生成スプライト画像の表示（specs/06 §3 準拠）
// 性別×ステージの128×128透過PNGを読み込み、canvas に描画する。

import { fitnessLevel, expressionFor, outfitFor } from './core/life.js';

const SPRITE_DIR = 'assets/sprites/';
const SPRITE_SIZE = 128;

const STAGE_KEY = {
  '幼少期': 'child',
  '学生期': 'student',
  '青年期': 'youth',
  '壮年期': 'prime',
  '老年期': 'elder',
};

const GENDER_KEY = { M: 'male', F: 'female' };

const imageCache = new Map();

function spriteKey(gender, stage) {
  const g = GENDER_KEY[gender] ?? 'male';
  const s = STAGE_KEY[stage] ?? 'youth';
  return `${g}_${s}`;
}

function loadImage(key) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { imageCache.set(key, img); resolve(img); };
    img.onerror = () => reject(new Error(`sprite not found: ${key}`));
    img.src = `${SPRITE_DIR}${key}.png`;
  });
}

export function preloadSprites() {
  const keys = [];
  for (const g of Object.values(GENDER_KEY)) {
    for (const s of Object.values(STAGE_KEY)) {
      keys.push(`${g}_${s}`);
    }
  }
  return Promise.all(keys.map(k => loadImage(k).catch(() => null)));
}

/**
 * 当主データから canvas 要素を生成して返す。
 * preloadSprites() 完了後に呼ぶこと。
 * @param {object} leader - state.dynasty.leader（または pastLeaders の要素）
 * @param {number} scale - 表示倍率（ホーム用=5, 一覧用=2〜3）
 * @returns {HTMLCanvasElement}
 */
export function renderAvatar(leader, scale = 5) {
  const displaySize = 32 * scale;
  const key = spriteKey(leader.gender, leader.stage);
  const cv = document.createElement('canvas');
  cv.width = displaySize;
  cv.height = displaySize;
  cv.style.imageRendering = 'pixelated';
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const img = imageCache.get(key);
  if (img) {
    ctx.drawImage(img, 0, 0, displaySize, displaySize);
  }

  return cv;
}

/**
 * 当主の見た目情報をテキストで返す（UIの補助表示用）。
 */
export function avatarDescription(leader) {
  const fit = fitnessLevel(leader.stats.health, leader.totalSteps);
  const expr = expressionFor(leader.stats.vitality);
  const tier = outfitFor(leader.stats.wealth);
  return { expression: expr, fitLevel: fit, tier };
}
