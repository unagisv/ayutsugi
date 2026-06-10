// events.js ― 人生イベント E01〜E14 の定義・発生制御・分岐適用（specs/03 準拠）
// 方針（03 §0.1）：全イベントは正の表現。低でも控えめな良い結果。ステータスのマイナスは使わない。
import { EFFECT, STAT_GATE } from './rules.js';

const E = EFFECT; // ◎=8 ○=4 △=1（03 §3 凡例の数値化・05 §9-D15）

// ctx: { leader, gendered, variant }（leader.parentFlags＝親世代の伏線フラグ）

// 性差あり/なしのテキスト分岐（03 §1-5：あり＝性別で文面変化／なし＝汎用テキスト）
function genderText(ctx, maleText, femaleText, neutralText) {
  if (!ctx.gendered) return neutralText;
  return ctx.leader.gender === 'M' ? maleText : femaleText;
}

export const EVENTS = {
  // ── 誕生 ──────────────────────────────────────────
  E01: {
    id: 'E01', name: '名づけと産声', stage: '誕生', kind: 'ceremony',
    intro(ctx) {
      const L = ctx.leader;
      const lines = [`新たな当主「${L.name}」が誕生した。`];
      if (L.inheritedHeirloom) {
        const h = L.inheritedHeirloom;
        lines.push(`先代より家宝『${h.label}』（${h.rank}）を受け継いだ。`);
      } else {
        lines.push('ここから一族の物語がはじまる。');
      }
      if (L.traits) lines.push(`${L.traits.appearance}で、${L.traits.personality}な気質を感じさせる。`);
      return lines.join('\n');
    },
    choices() { return null; }, // 選択肢なし（自動演出・03 E01）
    resolve() {
      return { text: '一族の新しい一歩が記された。', effects: {} };
    },
  },

  // ── 幼少期 ──────────────────────────────────────────
  E02: {
    id: 'E02', name: 'はじめてのおつかい', stage: '幼少期', kind: 'sub',
    intro() { return 'はじめてひとりでおつかいに出かけることになった。'; },
    choices() { return ['まっすぐ帰る', '寄り道して帰る']; },
    resolve(ctx, choice, band) {
      return {
        '高': { text: 'しっかり歩いて道を覚え、「頼もしい子だ」と評判になった。', effects: { vitality: E['◎'], charm: E['○'] } },
        '中': { text: '無事におつかいを果たし、小さな自信がついた。', effects: { vitality: E['○'] } },
        '低': { text: 'おつかいを終えて家に帰った。穏やかな一日だった。', effects: { vitality: E['△'] } },
      }[band];
    },
  },
  E03: {
    id: 'E03', name: '外遊びの仲間', stage: '幼少期', kind: 'sub',
    intro() { return '近所の子どもたちが外遊びに誘いに来た。'; },
    choices() { return ['みんなと走り回る', 'のんびり過ごす']; },
    resolve(ctx, choice, band) {
      if (band === '高') {
        ctx.leader.flags.childhoodFriend = true; // 伏線：E07の選択肢+1（03 E03）
        return { text: '仲間の輪の中心に。生涯の友となる相手と出会った。', effects: { charm: E['◎'], health: E['○'] } };
      }
      return band === '中'
        ? { text: '良い友だちができた。', effects: { charm: E['○'] } }
        : { text: '穏やかに過ごし、気の合う相手と出会った。', effects: { charm: E['△'] } };
    },
  },

  // ── 学生期 ──────────────────────────────────────────
  E04: {
    id: 'E04', name: '進学の岐路', stage: '学生期', kind: 'core',
    intro(ctx) {
      let t = '進路を決めるときが来た。';
      if (ctx.leader.parentFlags?.education === '高') t += '\n親の学びの足跡が、進める道を少し広げてくれている。'; // 伏線（03 E04）
      return t;
    },
    choices() { return ['上の学校を目指す', '手に職をつける道へ']; },
    resolve(ctx, choice, band) {
      ctx.leader.flags.education = band; // 学歴フラグ（03 E04）
      return {
        '高': { text: '望む進路をのびのびと選べた。将来の道が大きく開けている。', effects: { health: E['○'], wealth: E['○'], charm: E['△'] } },
        '中': { text: '着実に進路を進めることができた。', effects: { wealth: E['△'], health: E['△'] } },
        '低': { text: '自分に合った堅実な進路を選んだ。', effects: { wealth: E['△'] } },
      }[band];
    },
  },
  E05: {
    id: 'E05', name: '部活と打ち込み', stage: '学生期', kind: 'sub',
    intro() { return '何かに打ち込んでみたい年頃になった。'; },
    choices() { return ['運動系に打ち込む', '文化系に打ち込む']; },
    resolve(ctx, choice, band) {
      return {
        '高': { text: '打ち込んだことが実を結び、心身ともに充実した。', effects: { health: E['◎'], vitality: E['○'] } },
        '中': { text: '続けた経験が確かな自信になった。', effects: { vitality: E['○'] } },
        '低': { text: '自分のペースで取り組み、好きなものを見つけた。', effects: { vitality: E['△'] } },
      }[band];
    },
  },

  // ── 青年期 ──────────────────────────────────────────
  E06: {
    id: 'E06', name: '就職活動', stage: '青年期', kind: 'core',
    intro(ctx) {
      let t = '働き方を選ぶときが来た。';
      if (ctx.leader.parentFlags?.connectionHeirloom) t += '\n親の代から続く人脈が、思わぬ誘いを運んでくる。'; // 人脈系家宝の伏線（03 §5.2）
      return t;
    },
    choices(ctx) {
      const c = ['安定の道を選ぶ', '挑戦の道へ進む'];
      // 親が家業を選んでいれば強化選択肢として出現（03 §5.3 例1）
      c.push(ctx.leader.parentFlags?.job === '家業' ? '家業を継ぐ（先代からの道）' : '家業を興す');
      return c;
    },
    resolve(ctx, choice, band) {
      ctx.leader.flags.job = ['安定', '挑戦', '家業'][choice] ?? '安定'; // 職業フラグ（03 E06）
      const inherited = choice === 2 && ctx.leader.parentFlags?.job === '家業';
      const r = {
        '高': { text: '望む職に就き、好スタートを切った。', effects: { wealth: E['◎'], charm: E['○'], vitality: E['△'] } },
        '中': { text: '堅実な職に就いた。財産が着実に伸びはじめる。', effects: { wealth: E['○'] } },
        '低': { text: '自分に合った仕事に就き、地道に歩み出した。', effects: { wealth: E['△'] } },
      }[band];
      if (inherited) r.text += '\n先代の築いた家業が、その歩みを支えてくれる。';
      return r;
    },
  },
  E07: {
    id: 'E07', name: '出会いと結婚', stage: '青年期', kind: 'core',
    intro() { return '人生をともに歩む相手について、考えるときが来た。'; },
    choices(ctx) {
      const c = ['良縁を結ぶ', 'いまは仕事に専念する'];
      // 人望が高い／幼少からの友人フラグで選択肢+1（03 E03・E07／閾値は05 §9-D5）
      if (ctx.leader.flags.childhoodFriend || ctx.leader.stats.charm >= STAT_GATE) {
        c.push(ctx.leader.flags.childhoodFriend ? '幼なじみとの縁を結ぶ' : '紹介された良縁を結ぶ');
      }
      return c;
    },
    resolve(ctx, choice, band) {
      const married = choice !== 1;
      ctx.leader.flags.married = married;
      if (!married) {
        return { text: '自分らしい歩み方を選んだ。仕事に打ち込む日々もまた充実している。', effects: { vitality: E['△'] } };
      }
      const partner = genderText(ctx, '妻を迎えた。', '夫を迎えた。', '連れ合いを得た。');
      if (band === '高') {
        ctx.leader.flags.spouseTalent = true; // 配偶者素質フラグ（03 E07）
        const t = choice === 2 && ctx.leader.flags.childhoodFriend
          ? `幼いころからの友と心を確かめ合い、${partner}家庭が大きな支えになる。`
          : `心通う相手と結ばれ、${partner}家庭が大きな支えになる。`;
        return { text: t, effects: { charm: E['◎'], vitality: E['○'], health: E['△'] } };
      }
      return band === '中'
        ? { text: `良い縁に恵まれ、${partner}`, effects: { charm: E['○'] } }
        : { text: `穏やかな縁に恵まれ、${partner}`, effects: { vitality: E['△'] } };
    },
  },
  E08: {
    id: 'E08', name: '独り立ちの家計', stage: '青年期', kind: 'sub',
    intro() { return '独り立ちして、自分の家計を預かるようになった。'; },
    choices() { return ['堅実に貯える', '自分に投資する']; },
    resolve(ctx, choice, band) {
      return {
        '高': { text: 'やりくり上手で蓄えが育った。次の挑戦の余地が生まれている。', effects: { wealth: E['◎'], health: E['△'] } },
        '中': { text: '着実に家計を整えた。', effects: { wealth: E['○'] } },
        '低': { text: '身の丈に合った暮らしを整えた。', effects: { wealth: E['△'] } },
      }[band];
    },
  },

  // ── 壮年期 ──────────────────────────────────────────
  E09: {
    id: 'E09', name: '子を授かる', stage: '壮年期', kind: 'core',
    intro(ctx) {
      if (ctx.variant === 'unmarried') return '次の世代に何を遺すか、考えるときが来た。';
      return genderText(ctx,
        '配偶者が身ごもった。新しい命を迎える準備がはじまる。',
        '身ごもった。新しい命を迎える準備がはじまる。',
        '子を授かった。新しい命を迎える準備がはじまる。');
    },
    choices(ctx) {
      // 未婚時は「別の遺し方」分岐（養子・後進育成。すべて肯定的・03 E09）
      if (ctx.variant === 'unmarried') return ['養子を迎える', '後進を育てる'];
      return ['家庭を大切に育む', '仕事と両立する'];
    },
    resolve(ctx, choice, band) {
      ctx.leader.flags.childQuality = band; // 次代への遺伝の質（03 E09／05 §9-D9）
      if (ctx.variant === 'unmarried') {
        const who = choice === 0 ? '迎えた養子' : '育てた後進';
        return {
          '高': { text: `${who}がすくすくと育ち、一族の希望が大きく広がった。`, effects: { charm: E['◎'], vitality: E['○'], health: E['○'] } },
          '中': { text: `${who}との日々が、家に温かさを運んでくれる。`, effects: { charm: E['○'] } },
          '低': { text: `静かに${who}を見守る日々を過ごした。`, effects: { charm: E['△'] } },
        }[band];
      }
      return {
        '高': { text: '健やかな子に恵まれ、一族の希望が大きく広がった。', effects: { charm: E['◎'], vitality: E['○'], health: E['○'] } },
        '中': { text: '子を授かり、家庭が温かくなった。', effects: { charm: E['○'] } },
        '低': { text: '静かに家庭を慈しむ日々を過ごした。', effects: { charm: E['△'] } },
      }[band];
    },
  },
  E10: {
    id: 'E10', name: '人生の転機', stage: '壮年期', kind: 'core',
    intro(ctx) {
      let t = 'このままの道を行くか、新しい一歩を踏み出すか。人生の転機が訪れた。';
      if (ctx.leader.parentFlags?.familyTradition === '挑戦') t += '\n挑戦を尊ぶ家風が、背中を押してくる。'; // 家風フラグの伏線（03 E10）
      return t;
    },
    choices() { return ['いまの道を究める', '新しい挑戦に踏み出す']; },
    resolve(ctx, choice, band) {
      ctx.leader.flags.familyTradition = choice === 1 ? '挑戦' : '堅実'; // 家風フラグ（03 E10）
      return {
        '高': { text: '思い切った一歩が実を結び、一族の物語に転換点が刻まれた。', effects: { wealth: E['◎'], charm: E['○'], vitality: E['○'] } },
        '中': { text: '着実な一歩を踏み出し、確かな手応えを得た。', effects: { wealth: E['○'] } },
        '低': { text: '今の道を大切に守り抜くと決めた。それもまた立派な選択である。', effects: { health: E['△'] } },
      }[band];
    },
  },
  E11: {
    id: 'E11', name: '円熟の人脈', stage: '壮年期', kind: 'sub',
    intro() { return '長年の歩みの中で、人とのつながりが厚みを増してきた。'; },
    choices() { return ['人を支える側に回る', '自分の道を深める']; },
    resolve(ctx, choice, band) {
      if (band === '高') {
        ctx.leader.flags.connectionHeirloom = true; // 人脈系家宝の素地（03 E11）
        return { text: '厚い信頼が集まり、一族の名が地域に知られるようになった。', effects: { charm: E['◎'], wealth: E['○'] } };
      }
      return band === '中'
        ? { text: '良い縁がさらに広がった。', effects: { charm: E['○'] } }
        : { text: '身近な人とのつながりを大切にした。', effects: { charm: E['△'] } };
    },
  },

  // ── 老年期 ──────────────────────────────────────────
  E12: {
    id: 'E12', name: '健やかな晩成', stage: '老年期', kind: 'sub',
    intro() { return '歩んできた日々が、晩年の暮らしぶりに表れはじめた。'; },
    choices() { return ['孫や後進に伝える', '趣味に打ち込む']; },
    resolve(ctx, choice, band) {
      return {
        '高': { text: '心身ともに健やかな晩年。大往生までの日々に充実が続く。', effects: { health: E['◎'], charm: E['○'], vitality: E['○'] } },
        '中': { text: '穏やかで満ち足りた晩年を過ごしている。', effects: { health: E['○'] } },
        '低': { text: '静かで安らかな晩年を過ごしている。', effects: { health: E['△'] } },
      }[band];
    },
  },
  E13: {
    id: 'E13', name: '次代への遺し', stage: '老年期', kind: 'legacy',
    intro() { return '一生の歩みを振り返り、次の代に何を一番に遺すかを考えるときが来た。'; },
    choices() { return ['丈夫な体（健康）を遺す', '豊かな人脈を遺す', '蓄えた財を遺す', '家風（生き方）を遺す']; },
    resolve(ctx, choice, band) {
      ctx.leader.flags.legacyChoice = ['健康', '人脈', '財産', '家風'][choice] ?? null;
      return {
        '高': { text: 'よく歩き抜いた一生。最上の家宝が次代へ遺される。', effects: {} },
        '中': { text: '確かな足跡を刻んだ一生。家宝が次代へ遺される。', effects: {} },
        '低': { text: '穏やかに歩んだ一生。ささやかな、しかし確かな家宝が次代へ遺される。', effects: {} },
      }[band];
    },
  },
  E14: {
    id: 'E14', name: '余生のひととき', stage: '老年期', kind: 'flavor', // 反復可（03 E14）
    variants: [
      { intro: '散歩仲間が縁側の外から声をかけてきた。', choices: ['みんなと歩く', '縁側で語らう'] },
      { intro: '地域の行事の知らせが届いた。', choices: ['行事に顔を出す', '家でゆっくり祝う'] },
      { intro: '健康診断の時期になった。', choices: ['しっかり受ける', 'ほどほどに労る'] },
    ],
    intro(ctx) { return this.variants[(ctx.variant ?? 0) % this.variants.length].intro; },
    choices(ctx) { return this.variants[(ctx.variant ?? 0) % this.variants.length].choices; },
    resolve(ctx, choice, band) {
      return {
        '高': { text: '充実した余生のひととき。心身が満たされていく。', effects: { health: E['○'], charm: E['○'] } },
        '中': { text: '穏やかで温かな余生のひとときだった。', effects: { health: E['△'], charm: E['△'] } },
        '低': { text: '静かで安らかなひとときだった。', effects: { health: E['△'] } },
      }[band];
    },
  },
};

// ステージ別イベントプール（03 §2.3-1。中核を先・サブを後に並べる＝優先消化順）
const POOLS = {
  '幼少期': ['E02', 'E03'],
  '学生期': ['E04', 'E05'],          // E04=中核必発
  '青年期': ['E06', 'E07', 'E08'],   // E06/E07=中核必発
  '壮年期': ['E09', 'E10', 'E11'],   // E09/E10=中核必発
  '老年期': ['E12'],                 // E13は大往生直前に必発、E14は反復（別扱い）
};

const CORE_IDS = new Set(['E04', 'E06', 'E07', 'E09', 'E10']);

// イベント発生制御（03 §2.3／05 §9-D3）
// 発生タイミング（経過日数が奇数になった日次バッチ）に呼ばれ、発生イベントを返す。
// 優先順位：(a)現ステージ未消化の中核 →(b)未消化サブ →(c)老年期なら余生E14（反復可）。
export function pickEvent(leader) {
  const stage = stageFor_(leader);
  const pool = POOLS[stage] ?? [];
  const unconsumed = pool.filter(id => !leader.consumedEvents.includes(id));
  const core = unconsumed.find(id => CORE_IDS.has(id));
  if (core) return { id: core, variant: eventVariant(core, leader) };
  if (unconsumed.length > 0) return { id: unconsumed[0], variant: eventVariant(unconsumed[0], leader) };
  if (stage === '老年期') {
    const count = leader.eventLog.filter(e => e.id === 'E14').length;
    return { id: 'E14', variant: count };
  }
  return null;
}

function eventVariant(id, leader) {
  if (id === 'E09' && !leader.flags.married) return 'unmarried';
  return null;
}

function stageFor_(leader) {
  // 発生イベントのステージは「いま終えた日（elapsedDays日目）」で判定する。
  // これにより 7・9日目=青年期（E06/E07）、11・13日目=壮年期（E09/E10）の中核必発が成立（05 §9-D3）
  const day = Math.max(1, leader.elapsedDays);
  if (day <= 3) return '幼少期';
  if (day <= 6) return '学生期';
  if (day <= 9) return '青年期';
  if (day <= 13) return '壮年期';
  return '老年期';
}
