// names.js ― 当主名・性別・形質の自動生成（02 §1-7主管の具体実装／05 §9-D4）
// 家名のみプレイヤー入力。当主名・性別は自動生成（任意で改名可）。
// rng は 0〜1 の乱数関数を注入する（テストでは固定シードを渡す）。

const MALE_NAMES = ['太郎', '健一', '翔太', '蓮', '大和', '悠真', '一郎', '海斗', '賢治', '朝陽', '正雄', '直樹'];
const FEMALE_NAMES = ['花子', '美咲', '葵', '凛', '結衣', 'さくら', '千代', '陽菜', '静香', '心春', '和子', '真奈'];

// 遺伝対象の形質（02 §7-3：各カテゴリ50%継承・残りは突然変異枠）
export const APPEARANCES = ['面長', '丸顔', '切れ長の目', '大きな瞳', '彫りの深い顔', '柔和な顔立ち'];
export const PERSONALITIES = ['のんびり', '働き者', '社交的', '慎重', '好奇心旺盛', '芯が強い'];

function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

// 性別は50/50で自動生成（05 §9-D4）
export function generateGender(rng) {
  return rng() < 0.5 ? 'M' : 'F';
}

export function generateName(gender, rng) {
  return pick(gender === 'M' ? MALE_NAMES : FEMALE_NAMES, rng);
}

export function generateTrait(kind, rng) {
  return pick(kind === 'appearance' ? APPEARANCES : PERSONALITIES, rng);
}
