// avatar.js ― 32×48ドットキャラのパーツ合成描画（specs/06 §3 準拠）
// sprites.html のレンダリングエンジンをモジュール化。
// ゲーム状態 → 見た目パラメータ → canvas を生成する。

import { fitnessLevel, expressionFor, outfitFor } from './core/life.js';

// ── 定数 ────────────────────────────────────
const HALF = 16;
const W = 32, H = 48;

function mirror(half) { return half + half.split('').reverse().join(''); }
function lerp(a, b, t) { return a + (b - a) * t; }

const PAL_BASE = {
  K: '#33241a', S: '#f2cfa4', s: '#dba87e', E: '#2a1c12',
  W: '#f5efdf', F: '#4c3c2c', G: '#d9b13f', R: '#d8504a',
};
const HAIR_COLORS = {
  black: '#413a34', brown: '#7a512f', chestnut: '#a06b38',
  gray: '#b8b0a2', white: '#eae6dc',
};
const TIER_PALETTES = {
  '質素': { C: '#9c8a66', c: '#7a6b4e', B: '#6b5d44' },
  '標準': { C: '#48688c', c: '#37516e', B: '#8c3b34' },
  '立派': { C: '#8c3b34', c: '#6e2c27', B: '#d9b13f' },
};

// ── 頭部（rows 0-15） ──────────────────────
const TOP_STD = [
  '..........KKKKKK', '.........KHHHHHH', '........KHHHHHHH', '........KHHHHHHH',
  '........KHHHHHHH', '........KHHHHHHH', '........KHHSSSSS', '........KHSSSSSS',
];

const HAIRS = {
  short:    { side: 10, top: TOP_STD },
  spiky:    { side: 9, top: [
    '..........KK.KK.', '.........KHHKHHK', '........KHHHHHHH', '........KHHHHHHH',
    '........KHHHHHHH', '........KHHHHHHH', '........KHSHSHSH', '........KHSSSSSS'] },
  bob:      { side: 12, wide: true, top: [
    '..........KKKKKK', '.........KHHHHHH', '........KHHHHHHH', '........KHHHHHHH',
    '........KHHHHHHH', '........KHHHHHHH', '........KHHHHHHH', '........KHHSSSSS'] },
  long:     { side: 13, top: TOP_STD,
    post: [[14,9,'H'],[14,10,'H'],[15,9,'H'],[15,10,'H'],[16,8,'H'],[16,9,'H'],[17,8,'H'],[17,9,'H'],
           [18,8,'H'],[18,9,'H'],[19,8,'H'],[20,8,'H'],
           [14,21,'H'],[14,22,'H'],[15,21,'H'],[15,22,'H'],[16,22,'H'],[16,23,'H'],[17,22,'H'],[17,23,'H'],
           [18,22,'H'],[18,23,'H'],[19,23,'H'],[20,23,'H']] },
  ponytail: { side: 10, top: TOP_STD,
    post: [[1,22,'H'],[2,22,'H'],[2,23,'H'],[3,23,'H'],[4,23,'H'],[4,24,'H'],[5,24,'H'],[6,24,'H'],
           [7,24,'H'],[8,24,'H'],[9,24,'H'],[10,24,'H'],[11,23,'H'],[12,23,'H'],[13,23,'H'],[14,22,'H'],[15,22,'H']] },
  twintail: { side: 11, top: TOP_STD,
    post: [[8,8,'H'],[9,8,'H'],[10,8,'H'],[11,8,'H'],[12,8,'H'],[13,8,'H'],[14,8,'H'],[15,8,'H'],[16,7,'H'],[17,7,'H'],
           [8,23,'H'],[9,23,'H'],[10,23,'H'],[11,23,'H'],[12,23,'H'],[13,23,'H'],[14,23,'H'],[15,23,'H'],[16,24,'H'],[17,24,'H']] },
  bun:      { side: 10, top: [
    '........HH.KKKKK', '........HHKHHHHH', '........KHHHHHHH', '........KHHHHHHH',
    '........KHHHHHHH', '........KHHHHHHH', '........KHHSSSSS', '........KHSSSSSS'] },
  mage:     { side: 9, top: [
    '..............HH', '...........KKKHH', '..........KSSSSS', '........KKSSSSSS',
    '........KHSSSSSS', '........KHSSSSSS', '........KHSSSSSS', '........KHSSSSSS'] },
  bald:     { side: -1, top: [
    '................', '..........KKKKKK', '.........KSSSSSS', '........KSSSSSSS',
    '........KSSSSSSS', '........KSSSSSSS', '........KSSSSSSS', '........KSSSSSSS'] },
};

const HAIR_KEYS = ['short', 'spiky', 'bob', 'long', 'ponytail', 'twintail', 'bun', 'mage', 'bald'];
const HAIR_COLOR_KEYS = ['black', 'brown', 'chestnut', 'gray', 'white'];
const OUTFIT_SHAPES = ['samue', 'kimono', 'shima', 'shirt', 'haori', 'montsuki'];

function faceRows(eyes) {
  const e1 = eyes === 'sad' ? 'S' : 'E';
  const e2 = eyes === 'happy' ? 'S' : 'E';
  return [
    '........KHSSSSSS',
    '........KHSS' + e1 + 'SSS',
    '........KHSS' + e2 + 'SSS',
    '.........KSSSSSS',
    '.........KSSSSSS',
    '..........KSSSSS',
    '............KSSS',
    '............KSSS',
  ];
}
const FACE_PATCH = {
  normal: [[12,15,'s'],[12,16,'s']],
  happy:  [[12,14,'K'],[12,17,'K'],[11,11,'s'],[11,20,'s']],
  sad:    [[12,15,'K'],[12,16,'K']],
};

// ── 胴体（体型5段階パラメトリック） ──────────
const FITS = {
  1: { sh: 6, belly: 11, hip: 10, hem: 9, leg: 5, slump: true },
  2: { sh: 7, belly: 9,  hip: 9,  hem: 7, leg: 4 },
  3: { sh: 7, belly: 7,  hip: 8,  hem: 6, leg: 3 },
  4: { sh: 7, belly: 6,  hip: 7,  hem: 6, leg: 3 },
  5: { sh: 8, belly: 5,  hip: 7,  hem: 5, leg: 3 },
};

function trow(hw, fill, inner) {
  let s = '.'.repeat(HALF - hw) + 'K' + fill.repeat(hw - 1);
  for (const [c, k] of inner ?? []) {
    const i = HALF - hw + c;
    if (i > 0 && i < HALF) s = s.slice(0, i) + k + s.slice(i + 1);
  }
  return s;
}

function bodyRows(fit, outfit) {
  const P = FITS[fit];
  const rows = [];
  const slump = P.slump;
  rows.push(trow(P.sh - (slump ? 2 : 1), 'C'));
  rows.push(trow(P.sh - (slump ? 1 : 0), 'C'));
  for (let i = 0; i < 8; i++) {
    const hw = Math.round(lerp(P.sh, P.belly, Math.min(1, (i + 1) / 5)));
    rows.push(trow(hw, 'C'));
  }
  rows.push(trow(P.belly, 'B'));
  rows.push(trow(Math.round(lerp(P.belly, P.hip, 0.5)), outfit === 'shirt' ? 'F' : 'B'));
  if (outfit === 'samue' || outfit === 'shirt') {
    for (let i = 0; i < 6; i++) rows.push(trow(Math.round(lerp(P.hip, P.leg + 3, (i + 1) / 6)), 'F'));
    for (let i = 0; i < 10; i++) rows.push('.'.repeat(HALF - P.leg - 2) + 'K' + 'F'.repeat(P.leg) + '..');
    rows.push('.'.repeat(HALF - P.leg - 3) + 'K' + 'F'.repeat(P.leg + 1) + '..');
    rows.push('.'.repeat(HALF - P.leg - 3) + 'K'.repeat(P.leg + 2) + '..');
    rows.push('.'.repeat(HALF));
    rows.push('.'.repeat(HALF));
  } else {
    for (let i = 0; i < 16; i++) rows.push(trow(Math.round(lerp(P.hip, P.hem, (i + 1) / 16)), 'C'));
    rows.push(trow(P.hem, 'K'));
    rows.push('.'.repeat(HALF - 5) + 'KFF' + '..');
    rows.push('.'.repeat(HALF - 5) + 'KKK' + '..');
    rows.push('.'.repeat(HALF));
  }
  return rows;
}

function outfitPatches(fit, outfit) {
  const P = FITS[fit];
  const p = [];
  p.push([16,14,'W'],[16,17,'W'],[17,14,'W'],[17,17,'W'],[18,15,'W'],[18,16,'W']);
  if (outfit === 'haori' || outfit === 'montsuki') {
    for (let r = 17; r <= 25; r++) { p.push([r,14,'W'],[r,17,'W']); }
    const e = 16 - P.sh;
    for (let r = 18; r <= 26; r++) { p.push([r, e + 1, 'c'], [r, 31 - e - 1, 'c']); }
  }
  if (outfit === 'montsuki') p.push([19,15,'G'],[19,16,'G'],[20,15,'G'],[20,16,'G']);
  if (outfit === 'shima') {
    for (let r = 18; r <= 43; r++) if (r !== 26 && r !== 27) {
      p.push([r,12,'c'],[r,19,'c']);
      if (r >= 20) p.push([r,15,'c'],[r,16,'c']);
    }
  }
  const edge = 16 - Math.round(lerp(P.sh, P.belly, 0.5));
  for (let r = 19; r <= 25; r++) { p.push([r, edge + 1, 'c'], [r, 30 - edge, 'c']); }
  p.push([26, edge, 'S'], [26, 31 - edge, 'S']);
  return p;
}

const ACCESSORIES = {
  kanzashi: [[1,21,'G'],[0,22,'G'],[2,23,'G'],[1,22,'G']],
  ribbon: [[0,20,'R'],[0,23,'R'],[1,20,'R'],[1,21,'R'],[1,22,'R'],[1,23,'R'],[2,21,'R'],[2,22,'R']],
  hachimaki: Array.from({length:14}, (_,i)=>[5,i+9,'W']).concat([[6,8,'W'],[6,23,'W']]),
  cane: [[26,25,'G'],[26,26,'G'],[27,26,'F'],[28,26,'F'],[29,26,'F'],[30,26,'F'],[31,26,'F'],[32,26,'F'],
         [33,26,'F'],[34,26,'F'],[35,26,'F'],[36,26,'F'],[37,26,'F'],[38,26,'F'],[39,26,'F'],[40,26,'F'],
         [41,26,'F'],[42,26,'F'],[43,26,'F'],[44,26,'F'],[27,25,'S']],
  beard: [[12,13,'H'],[12,14,'H'],[12,17,'H'],[12,18,'H'],
          [13,12,'H'],[13,13,'H'],[13,14,'H'],[13,15,'H'],[13,16,'H'],[13,17,'H'],[13,18,'H'],[13,19,'H'],
          [14,13,'H'],[14,14,'H'],[14,15,'H'],[14,16,'H'],[14,17,'H'],[14,18,'H'],
          [15,14,'H'],[15,15,'H'],[15,16,'H'],[15,17,'H']],
};

// ── 低レベル描画 ─────────────────────────────
function buildRows({hair = 'short', eyes = 'normal', fit = 3, outfit = 'kimono', age = 'adult'}) {
  const hc = HAIRS[hair];
  const head = [...hc.top, ...faceRows(eyes)];
  for (let r = 8; r <= Math.min(hc.side, 13); r++) {
    if (head[r][8] === 'K' || head[r][9] === 'K') {
      head[r] = head[r].slice(0, 8) + 'KH' + head[r].slice(10);
    } else if (head[r][9] === 'K') {
      head[r] = head[r].slice(0, 9) + 'H' + head[r].slice(10);
    }
    if (hc.wide && r <= 11) head[r] = head[r].slice(0, 10) + 'H' + head[r].slice(11);
  }
  let body = bodyRows(fit, outfit);
  if (age === 'child') {
    body = body.filter((_, i) => i % 3 !== 1).slice(0, 20);
  }
  return [...head.map(mirror), ...body.map(mirror)];
}

function drawSprite(rows, pal, patches, scale) {
  const h = rows.length, w = rows[0].length;
  const cv = document.createElement('canvas');
  cv.width = w * scale; cv.height = h * scale;
  cv.style.imageRendering = 'pixelated';
  const ctx = cv.getContext('2d');
  const grid = rows.map(r => r.split(''));
  for (const [r, c, k] of patches) {
    if (grid[r] && grid[r][c] !== undefined && grid[r][c] !== '.') grid[r][c] = k;
  }
  for (const [r, c, k] of patches) {
    if (grid[r] && grid[r][c] === '.' && 'HFGRSW'.includes(k)) grid[r][c] = k;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = grid[y][x];
    if (k === '.') continue;
    ctx.fillStyle = pal[k] ?? '#f0f';
    ctx.fillRect(x * scale, y * scale, scale, scale);
  }
  return cv;
}

// ── ゲーム状態 → 見た目パラメータへのマッピング ────────

// 当主の name をハッシュして決定論的に外見を選ぶ（遺伝対象の髪型・髪色・服形状）
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickByHash(list, name, salt) {
  return list[hashStr(name + salt) % list.length];
}

// 性別で使用可能な髪型を分ける
const HAIR_F = ['bob', 'long', 'ponytail', 'twintail', 'bun', 'short'];
const HAIR_M = ['short', 'spiky', 'mage', 'bald', 'bob'];
// 服形状も性別で偏りをつける
const OUTFIT_F = ['kimono', 'shima', 'shirt', 'haori', 'kimono', 'shima'];
const OUTFIT_M = ['kimono', 'samue', 'shirt', 'haori', 'shima', 'samue'];

function leaderAppearance(leader) {
  const isMale = leader.gender === 'M';
  const hairPool = isMale ? HAIR_M : HAIR_F;
  const outfitPool = isMale ? OUTFIT_M : OUTFIT_F;

  const hair = pickByHash(hairPool, leader.name, 'hair');
  const hairColor = pickByHash(
    ['black', 'brown', 'chestnut', 'brown', 'black', 'chestnut'],
    leader.name, 'hcolor'
  );
  const outfitShape = pickByHash(outfitPool, leader.name, 'outfit');
  const fit = fitnessLevel(leader.stats.health, leader.totalSteps);
  const expr = expressionFor(leader.stats.vitality);
  const tier = outfitFor(leader.stats.wealth);

  let eyes = 'normal';
  if (expr === 'いきいき') eyes = 'happy';
  else if (expr === 'しょんぼり') eyes = 'sad';

  let age = 'adult';
  if (leader.stage === '幼少期') age = 'child';
  else if (leader.stage === '老年期') age = 'elder';

  const acc = [];
  if (age === 'elder') acc.push('cane');
  if (leader.flags.married && !isMale) acc.push('kanzashi');
  if (leader.flags.married && isMale) acc.push('hachimaki');

  return { hair, hairColor, outfitShape, fit, eyes, age, tier, acc };
}

// ── 公開API ─────────────────────────────────

/**
 * 当主データから canvas 要素を生成して返す。
 * @param {object} leader - state.dynasty.leader（または pastLeaders の要素）
 * @param {number} scale - 表示倍率（整数。ホーム用=5, 一覧用=2〜3）
 * @returns {HTMLCanvasElement}
 */
export function renderAvatar(leader, scale = 5) {
  const a = leaderAppearance(leader);
  const pal = {
    ...PAL_BASE,
    H: HAIR_COLORS[a.age === 'elder' ? 'white' : a.hairColor],
    ...TIER_PALETTES[a.tier],
  };

  const outfitForRender = a.tier === '立派'
    ? (a.outfitShape === 'kimono' || a.outfitShape === 'shima' ? 'haori' : a.outfitShape)
    : a.tier === '質素'
      ? (a.outfitShape === 'haori' || a.outfitShape === 'montsuki' ? 'samue' : a.outfitShape)
      : a.outfitShape;

  let patches = [...FACE_PATCH[a.eyes], ...(HAIRS[a.hair].post ?? [])];
  if (a.age !== 'child') patches = patches.concat(outfitPatches(a.fit, outfitForRender));
  if (a.age === 'elder') patches = patches.concat(ACCESSORIES.beard);
  for (const accKey of a.acc) {
    if (ACCESSORIES[accKey]) patches = patches.concat(ACCESSORIES[accKey]);
  }

  return drawSprite(
    buildRows({ hair: a.hair, eyes: a.eyes, fit: a.fit, outfit: outfitForRender, age: a.age }),
    pal, patches, scale
  );
}

/**
 * 当主の見た目情報をテキストで返す（UIの補助表示用）。
 */
export function avatarDescription(leader) {
  const a = leaderAppearance(leader);
  const expr = expressionFor(leader.stats.vitality);
  return { expression: expr, fitLevel: a.fit, tier: a.tier };
}
