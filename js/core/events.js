// events.js ― 人生イベント E01〜E14 の定義・発生制御・分岐適用（specs/03 準拠）
// 方針（03 §0.1）：全イベントは正の表現。低でも控えめな良い結果。ステータスのマイナスは使わない。
// v2: イベント濃度パラメータ（density: simple/rich）で物語の深さを制御
import { EFFECT, STAT_GATE } from './rules.js';

const E = EFFECT;

function genderText(ctx, maleText, femaleText, neutralText) {
  if (!ctx.gendered) return neutralText;
  return ctx.leader.gender === 'M' ? maleText : femaleText;
}

// NPC名をフラグに記録して以降のイベントで参照する
function friendName(ctx) {
  return ctx.leader.flags.friendName || '幼なじみ';
}
function spouseName(ctx) {
  return ctx.leader.flags.spouseName || '連れ合い';
}

// 濃度判定：ctx.density が 'rich' のとき追加テキストを返す
function rich(ctx, text) {
  return ctx.density === 'rich' ? text : '';
}
function nl(text) { return text ? '\n' + text : ''; }

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
      if (ctx.density === 'rich') {
        lines.push('小さな産声が家に響きわたる。この子がどんな人生を歩むのか、まだ誰も知らない。');
      }
      return lines.join('\n');
    },
    choices() { return null; },
    resolve() {
      return { text: '一族の新しい一歩が記された。', effects: {} };
    },
  },

  // ── 幼少期 ──────────────────────────────────────────
  E02: {
    id: 'E02', name: 'はじめてのおつかい', stage: '幼少期', kind: 'sub',
    intro(ctx) {
      const base = 'お母さんから頼まれた。「お豆腐を買ってきてくれる？」\nはじめてひとりで町に出る日が来た。';
      return base + nl(rich(ctx,
        '家の前の坂道を下り、角を曲がれば商店街。\n知っている道のはずなのに、ひとりだと景色がぜんぶ違って見える。'));
    },
    choices() { return ['しっかり買い物をして帰る', '気になるお店に寄り道してみる']; },
    resolve(ctx, choice, band) {
      if (band === '高') {
        const detail = rich(ctx, '\n「あの子、しっかりしてるね」と近所のおばあちゃんにも褒められた。');
        return { text: 'しっかり歩いてお豆腐を届け、帰り道では胸を張って歩いた。小さいけれど確かな自信が芽生えた。' + detail, effects: { vitality: E['◎'], charm: E['○'] } };
      }
      if (band === '中') {
        return { text: '無事にお豆腐を買って帰れた。「えらいね」と頭を撫でてもらい、嬉しかった。', effects: { vitality: E['○'] } };
      }
      return { text: 'おつかいを終えて家に帰った。お母さんの笑顔が待っていた。穏やかな一日だった。', effects: { vitality: E['△'] } };
    },
  },
  E03: {
    id: 'E03', name: '外遊びの仲間', stage: '幼少期', kind: 'sub',
    intro(ctx) {
      const base = '「一緒に遊ぼう！」\n近所の子どもたちが外遊びに誘いに来た。';
      return base + nl(rich(ctx,
        '空き地に集まると、鬼ごっこやかくれんぼ、虫捕り。\n日が暮れるまで走り回る、かけがえのない時間。'));
    },
    choices() { return ['みんなの輪に飛び込む', 'ひとりの子とじっくり遊ぶ']; },
    resolve(ctx, choice, band) {
      if (band === '高') {
        const name = ctx.npcName;
        ctx.leader.flags.childhoodFriend = true;
        ctx.leader.flags.friendName = name;
        const detail = rich(ctx, `\n夕焼けの帰り道、「また明日も遊ぼうね」と${name}が笑った。きっとずっと忘れない約束。`);
        return { text: `仲間の輪の中心で走り回った。中でも${name}とは特に気が合い、「ずっと友だちだよ」と指きりをした。生涯の友になるかもしれない。` + detail,
          effects: { charm: E['◎'], health: E['○'] } };
      }
      return band === '中'
        ? { text: '良い友だちができた。一緒にいると楽しい。明日も遊ぶ約束をした。', effects: { charm: E['○'] } }
        : { text: '穏やかに過ごし、気の合う相手と出会えた。少しずつ世界が広がっていく。', effects: { charm: E['△'] } };
    },
  },

  // ── 学生期 ──────────────────────────────────────────
  E04: {
    id: 'E04', name: '進学の岐路', stage: '学生期', kind: 'core',
    intro(ctx) {
      let t = '卒業が近づいてきた。「この先、どうする？」\n先生に問われ、自分の将来を真剣に考えはじめた。';
      if (ctx.leader.parentFlags?.education === '高') {
        t += '\n親が学問に打ち込んでいたおかげで、家には参考書が揃っている。進める道が少し広い。';
      }
      t += nl(rich(ctx, '勉強を続けるか、手に職をつけるか。どちらを選んでも、この先の人生に大きく関わる選択だ。'));
      return t;
    },
    choices() { return ['上の学校を目指して勉強に励む', '実践的な技術を身につける道へ']; },
    resolve(ctx, choice, band) {
      ctx.leader.flags.education = band;
      if (band === '高') {
        const detail = rich(ctx, '\n努力した日々は、これからの土台になる。');
        return { text: '目標に向かって懸命に勉強した。その努力が実を結び、望んだ進路に進むことができた。将来の可能性が大きく広がった。' + detail,
          effects: { health: E['○'], wealth: E['○'], charm: E['△'] } };
      }
      if (band === '中') {
        return { text: '着実に進路を進めることができた。自分に合った道を選べた実感がある。', effects: { wealth: E['△'], health: E['△'] } };
      }
      return { text: '自分の手で何かを作る道を選んだ。地に足のついた、堅実な一歩だった。', effects: { wealth: E['△'] } };
    },
  },
  E05: {
    id: 'E05', name: '熱中する日々', stage: '学生期', kind: 'sub',
    intro(ctx) {
      const base = '放課後、何かに打ち込む仲間たちが眩しく見えた。\n自分も何か夢中になれるものを見つけたい。';
      const friend = ctx.leader.flags.friendName;
      const friendLine = friend ? `\n${friend}も「一緒にやろうよ」と誘ってくれた。` : '';
      return base + friendLine + nl(rich(ctx, '青春は短い。いま打ち込んだことが、きっと一生の宝物になる。'));
    },
    choices() { return ['体を動かすことに全力を注ぐ', '創作や研究に没頭する']; },
    resolve(ctx, choice, band) {
      const what = choice === 0 ? '体を鍛え、仲間と汗を流した' : '好きなことに没頭し、夜遅くまで取り組んだ';
      if (band === '高') {
        return { text: `${what}。努力が認められ、大会や発表の場で成果を出せた。心身ともに充実した日々だった。`, effects: { health: E['◎'], vitality: E['○'] } };
      }
      if (band === '中') {
        return { text: `${what}。目覚ましい成果は出なかったが、続けた経験が確かな自信になった。`, effects: { vitality: E['○'] } };
      }
      return { text: `自分のペースで取り組んだ。好きなものが見つかった、それだけで十分だった。`, effects: { vitality: E['△'] } };
    },
  },

  // ── 青年期 ──────────────────────────────────────────
  E06: {
    id: 'E06', name: '社会への船出', stage: '青年期', kind: 'core',
    intro(ctx) {
      let t = '学びの季節が終わり、社会に出るときが来た。\n自分はどんな仕事で世の中と関わっていくのだろう。';
      if (ctx.leader.parentFlags?.connectionHeirloom) t += '\n親の代から続く人脈のおかげで、思わぬところから声がかかった。';
      if (ctx.leader.flags.education === '高') t += nl(rich(ctx, '学生時代に積み重ねた努力が、選択肢の幅を広げてくれている。'));
      return t;
    },
    choices(ctx) {
      const inherited = ctx.leader.parentFlags?.job === '家業';
      return [
        '安定した職に就く（堅実に暮らしを築く）',
        '夢を追って挑戦する（リスクはあるが可能性も大きい）',
        inherited ? '家業を継ぐ（先代が築いた道を受け継ぐ）' : '自分の店や事業を興す',
      ];
    },
    resolve(ctx, choice, band) {
      ctx.leader.flags.job = ['安定', '挑戦', '家業'][choice] ?? '安定';
      const inherited = choice === 2 && ctx.leader.parentFlags?.job === '家業';
      const jobDesc = { '安定': '堅実な職場', '挑戦': '夢の舞台', '家業': inherited ? '先代の家業' : '自分の事業' }[ctx.leader.flags.job];
      if (band === '高') {
        const detail = rich(ctx, `\n「この道を選んでよかった」。そう思える日が、きっとこれから何度も来る。`);
        let text = `${jobDesc}で好スタートを切った。周囲からも認められ、充実した日々がはじまった。`;
        if (inherited) text += '\n先代の築いた信頼が、その歩みを力強く支えてくれる。';
        return { text: text + detail, effects: { wealth: E['◎'], charm: E['○'], vitality: E['△'] } };
      }
      if (band === '中') {
        return { text: `${jobDesc}で着実に歩みはじめた。まだ道半ばだが、手応えは感じている。`, effects: { wealth: E['○'] } };
      }
      let text = `自分に合った場所を見つけ、地道に歩み出した。`;
      if (inherited) text += '\n先代の築いた家業が、その歩みを支えてくれる。';
      return { text, effects: { wealth: E['△'] } };
    },
  },
  E07: {
    id: 'E07', name: '巡りあい', stage: '青年期', kind: 'core',
    intro(ctx) {
      let t = 'ふとした瞬間に思う。「誰かと一緒に歩めたら、この景色はもっと美しいのだろうか」';
      const friend = friendName(ctx);
      const hasFriend = ctx.leader.flags.childhoodFriend;
      if (hasFriend) {
        t += `\n${friend}とは変わらず親しいが、最近その存在が少し特別に感じることがある。`;
      }
      t += nl(rich(ctx, '人生の伴侶を得るか、ひとりの道を歩むか。どちらも立派な選択だ。'));
      return t;
    },
    choices(ctx) {
      const hasFriend = ctx.leader.flags.childhoodFriend;
      const hasCharm = ctx.leader.stats.charm >= STAT_GATE;
      const c = [
        '新しい出会いの中から伴侶を見つける',
        'ひとりの道を歩む（仕事や趣味に打ち込む）',
      ];
      if (hasFriend) {
        c.push(`${friendName(ctx)}との関係を一歩進める`);
      } else if (hasCharm) {
        c.push('友人の紹介で出会った相手と');
      }
      return c;
    },
    resolve(ctx, choice, band) {
      const married = choice !== 1;
      ctx.leader.flags.married = married;
      if (!married) {
        const detail = rich(ctx, '\nひとりだからこそ自由に歩ける道がある。自分の人生を、自分の足で。');
        return { text: 'ひとりの道を選んだ。仕事に打ち込み、趣味を深め、自分らしい日々を過ごしている。' + detail, effects: { vitality: E['△'] } };
      }
      const sName = ctx.npcName;
      ctx.leader.flags.spouseName = sName;
      const partner = genderText(ctx, `${sName}を妻に迎えた`, `${sName}を夫に迎えた`, `${sName}と結ばれた`);
      const hasFriend = ctx.leader.flags.childhoodFriend;

      if (band === '高') {
        ctx.leader.flags.spouseTalent = true;
        if (choice === 2 && hasFriend) {
          const detail = rich(ctx, `\n幼い日の指きりの約束が、こんな形で実を結ぶとは。${friendName(ctx)}の笑顔がいっそう輝いて見えた。`);
          return { text: `長い年月を経て、${friendName(ctx)}と想いを確かめ合った。\n${partner}。かけがえのない日々がはじまる。` + detail,
            effects: { charm: E['◎'], vitality: E['○'], health: E['△'] } };
        }
        const detail = rich(ctx, `\n${sName}がそばにいるだけで、毎日の景色が少し明るくなった。`);
        return { text: `心通う相手と出会い、${partner}。\n家庭が大きな支えになり、歩む力が湧いてくる。` + detail,
          effects: { charm: E['◎'], vitality: E['○'], health: E['△'] } };
      }
      if (band === '中') {
        return { text: `良い縁に恵まれ、${partner}。新しい暮らしがはじまった。`, effects: { charm: E['○'] } };
      }
      return { text: `穏やかな縁に恵まれ、${partner}。ふたりで歩む日々は静かだが温かい。`, effects: { vitality: E['△'] } };
    },
  },
  E08: {
    id: 'E08', name: '暮らしの基盤', stage: '青年期', kind: 'sub',
    intro(ctx) {
      const spouse = ctx.leader.flags.married ? `${spouseName(ctx)}と相談しながら、` : '';
      return `${spouse}自分の暮らしの基盤を築くときが来た。\n限られた収入をどう使うか、人生設計が問われている。`;
    },
    choices() { return ['堅実に貯蓄して将来に備える', '自分の成長に投資する（学びや経験に使う）']; },
    resolve(ctx, choice, band) {
      if (band === '高') {
        const detail = rich(ctx, '\nこの蓄えが、いつか家族を守る盾になるだろう。');
        return { text: 'やりくり上手で着実に蓄えが育った。この余裕が、次の挑戦への土台になる。' + detail, effects: { wealth: E['◎'], health: E['△'] } };
      }
      if (band === '中') {
        return { text: '着実に家計を整えた。贅沢はできないが、不安のない暮らしができている。', effects: { wealth: E['○'] } };
      }
      return { text: '身の丈に合った暮らしを整えた。小さな幸せを大切にする日々。', effects: { wealth: E['△'] } };
    },
  },

  // ── 壮年期 ──────────────────────────────────────────
  E09: {
    id: 'E09', name: '新しい命', stage: '壮年期', kind: 'core',
    intro(ctx) {
      if (ctx.variant === 'unmarried') {
        return '一族の未来を想う。自分の次の世代に、何を残せるだろうか。\n血のつながりだけが「家族」ではない。';
      }
      const spouse = spouseName(ctx);
      return genderText(ctx,
        `${spouse}が身ごもった。新しい命がやってくる。\n嬉しさと、親になる責任の重さが胸に迫る。`,
        `新しい命を宿した。${spouse}が静かに手を握ってくれた。\nふたりの歩みが、三人の物語になる。`,
        `${spouse}とともに、新しい命を迎える準備がはじまった。\n家族が増える喜びと、守るべきものが増える実感。`);
    },
    choices(ctx) {
      if (ctx.variant === 'unmarried') return ['養子を迎え、家族をつくる', '後進を育て、志を託す'];
      return ['家庭を第一に、子育てに力を注ぐ', '仕事と家庭、両方を欲張る'];
    },
    resolve(ctx, choice, band) {
      ctx.leader.flags.childQuality = band;
      if (ctx.variant === 'unmarried') {
        const who = choice === 0 ? '迎えた養子' : '育てた後進';
        if (band === '高') {
          return { text: `${who}がすくすくと育ち、一族の希望が大きく広がった。血のつながりを超えた絆が、家を温かくしている。`, effects: { charm: E['◎'], vitality: E['○'], health: E['○'] } };
        }
        return band === '中'
          ? { text: `${who}との日々が、家に笑い声を運んでくれる。`, effects: { charm: E['○'] } }
          : { text: `静かに${who}を見守る日々。穏やかだが、確かに温かい。`, effects: { charm: E['△'] } };
      }
      const spouse = spouseName(ctx);
      if (band === '高') {
        const detail = rich(ctx, `\n${spouse}と顔を見合わせて笑った。「この子のために、もっと歩こう」。`);
        return { text: `健やかな子に恵まれた。${spouse}と力を合わせ、にぎやかな家庭が築かれていく。一族の未来に大きな希望が灯った。` + detail,
          effects: { charm: E['◎'], vitality: E['○'], health: E['○'] } };
      }
      if (band === '中') {
        return { text: `子を授かり、家庭に新しい笑顔が増えた。${spouse}とともに歩む日々がいっそう愛おしい。`, effects: { charm: E['○'] } };
      }
      return { text: `静かに家庭を慈しむ日々を過ごしている。大きな変化はなくても、確かに幸せだ。`, effects: { charm: E['△'] } };
    },
  },
  E10: {
    id: 'E10', name: '人生の岐路', stage: '壮年期', kind: 'core',
    intro(ctx) {
      const job = ctx.leader.flags.job;
      const jobName = { '安定': '今の職場', '挑戦': '夢を追う日々', '家業': '家業の経営' }[job] || '仕事';
      let t = `${jobName}にも慣れ、ふと立ち止まる。\n「このままでいいのだろうか」「もっと違う自分になれるのでは」`;
      if (ctx.leader.parentFlags?.familyTradition === '挑戦') t += '\n「挑戦を恐れるな」――先代の言葉が心に響く。';
      t += nl(rich(ctx, '人生の折り返し地点。ここからの選択が、残りの人生を大きく変える。'));
      return t;
    },
    choices(ctx) {
      const job = ctx.leader.flags.job;
      if (job === '安定') return ['この職場で昇進を目指し、道を究める', '思い切って転職し、新しい分野に飛び込む'];
      if (job === '挑戦') return ['さらに大きな目標に挑む', '安定した基盤を築く方向に舵を切る'];
      return ['家業をさらに大きく発展させる', '家業を人に任せ、新しいことに挑む'];
    },
    resolve(ctx, choice, band) {
      ctx.leader.flags.familyTradition = choice === 1 ? '挑戦' : '堅実';
      if (band === '高') {
        const detail = rich(ctx, '\n振り返ったとき、「あのとき踏み出してよかった」と思える日が来るだろう。');
        return { text: '思い切った決断が実を結んだ。新しい景色が開け、一族の物語に大きな転換点が刻まれた。' + detail,
          effects: { wealth: E['◎'], charm: E['○'], vitality: E['○'] } };
      }
      if (band === '中') {
        return { text: '一歩を踏み出した。劇的な変化ではないが、確かに前に進んでいる手応えがある。', effects: { wealth: E['○'] } };
      }
      return { text: '今ある道を大切に守り抜くと決めた。それは「選ばなかった」のではなく「選んだ」のだ。', effects: { health: E['△'] } };
    },
  },
  E11: {
    id: 'E11', name: '深まる絆', stage: '壮年期', kind: 'sub',
    intro(ctx) {
      const friend = ctx.leader.flags.friendName;
      let t = '長年の歩みの中で、人とのつながりが深く、厚みを増してきた。';
      if (friend) t += `\n${friend}とは今でも時々会い、お互いの近況を語り合う仲だ。`;
      const spouse = ctx.leader.flags.married ? spouseName(ctx) : null;
      if (spouse) t += nl(rich(ctx, `${spouse}も「あなたの周りにはいい人が多いね」と微笑む。`));
      return t;
    },
    choices() { return ['困っている人を助ける側に回る', '自分の専門を深め、求められる存在になる']; },
    resolve(ctx, choice, band) {
      if (band === '高') {
        ctx.leader.flags.connectionHeirloom = true;
        return { text: '厚い信頼が集まり、一族の名が地域に広く知られるようになった。困ったときには互いに助け合える、かけがえのない絆だ。',
          effects: { charm: E['◎'], wealth: E['○'] } };
      }
      return band === '中'
        ? { text: '良い縁がさらに広がった。人とのつながりは、何よりの財産だ。', effects: { charm: E['○'] } }
        : { text: '身近な人とのつながりを大切にした。小さくても温かい輪が、暮らしを支えてくれる。', effects: { charm: E['△'] } };
    },
  },

  // ── 老年期 ──────────────────────────────────────────
  E12: {
    id: 'E12', name: '穏やかな晩年', stage: '老年期', kind: 'sub',
    intro(ctx) {
      const spouse = ctx.leader.flags.married ? spouseName(ctx) : null;
      let t = '歩んできた日々が、晩年の暮らしぶりに表れはじめた。';
      if (spouse) t += `\n${spouse}と縁側に並んで座る。穏やかな時間が流れる。`;
      t += nl(rich(ctx, 'これまでの選択の一つ一つが、今の自分を作ってきた。'));
      return t;
    },
    choices() { return ['これまでの経験を次の世代に伝える', '好きなことに没頭して過ごす']; },
    resolve(ctx, choice, band) {
      if (band === '高') {
        return { text: '心身ともに健やかな晩年。よく歩いた日々が、今の自分を支えている。大往生までの日々に充実が続く。', effects: { health: E['◎'], charm: E['○'], vitality: E['○'] } };
      }
      if (band === '中') {
        return { text: '穏やかで満ち足りた晩年を過ごしている。贅沢はなくても、幸せだと思える。', effects: { health: E['○'] } };
      }
      return { text: '静かで安らかな晩年を過ごしている。少しずつ歩みは遅くなっても、景色はいつも美しい。', effects: { health: E['△'] } };
    },
  },
  E13: {
    id: 'E13', name: '次代への遺し', stage: '老年期', kind: 'legacy',
    intro(ctx) {
      const L = ctx.leader;
      let t = '一生の歩みを振り返り、次の代に何を遺すかを考えるときが来た。';
      if (L.flags.married) t += `\n${spouseName(ctx)}が静かに寄り添ってくれている。`;
      const friend = L.flags.friendName;
      if (friend) t += `\n${friend}が見舞いに来て、昔話に花が咲いた。`;
      t += nl(rich(ctx, '自分がいなくなっても、遺したものは生き続ける。それが一族の力になる。'));
      return t;
    },
    choices() { return ['丈夫な体を遺す（健康の知恵を次代に）', '広い人脈を遺す（つながりの力を次代に）', '蓄えた財を遺す（経済の基盤を次代に）', '生き方を遺す（家風を次代に）']; },
    resolve(ctx, choice, band) {
      ctx.leader.flags.legacyChoice = ['健康', '人脈', '財産', '家風'][choice] ?? null;
      if (band === '高') {
        return { text: 'よく歩き抜いた一生だった。最上の家宝が次の代へ遺される。この歩みは、きっと次の世代の力になる。', effects: {} };
      }
      if (band === '中') {
        return { text: '確かな足跡を刻んだ一生。家宝とともに、歩み続けた記憶が次代へ遺される。', effects: {} };
      }
      return { text: '穏やかに歩んだ一生。ささやかだが確かな家宝が、次の代へ手渡される。', effects: {} };
    },
  },
  E14: {
    id: 'E14', name: '余生のひととき', stage: '老年期', kind: 'flavor',
    variants: [
      { intro(ctx) {
          const friend = ctx.leader.flags.friendName;
          return friend
            ? `${friend}から手紙が届いた。「たまには一緒に歩こう」`
            : '散歩仲間が縁側の外から声をかけてきた。「天気がいいから歩かないか」';
        },
        choices: ['一緒に歩きに出かける', '家でゆっくり語り合う'] },
      { intro() { return '地域のお祭りの知らせが届いた。孫のような世代が準備に走り回っている。'; },
        choices: ['お祭りに顔を出す', '家で静かにお囃子を聴く'] },
      { intro(ctx) {
          const spouse = ctx.leader.flags.married ? spouseName(ctx) : null;
          return spouse
            ? `${spouse}と庭を眺めていると、ふと「あの頃はよく歩いたね」と思い出話になった。`
            : '庭の花が咲いているのを見て、ふと若い頃を思い出した。';
        },
        choices: ['昔の場所を歩いてみる', '思い出に浸りながら過ごす'] },
    ],
    intro(ctx) {
      const v = this.variants[(ctx.variant ?? 0) % this.variants.length];
      return typeof v.intro === 'function' ? v.intro(ctx) : v.intro;
    },
    choices(ctx) { return this.variants[(ctx.variant ?? 0) % this.variants.length].choices; },
    resolve(ctx, choice, band) {
      if (band === '高') {
        return { text: '充実した余生のひととき。歩いてきた日々に感謝する気持ちが湧いてくる。', effects: { health: E['○'], charm: E['○'] } };
      }
      if (band === '中') {
        return { text: '穏やかで温かな時間だった。こういう何気ない日々こそ、幸せなのかもしれない。', effects: { health: E['△'], charm: E['△'] } };
      }
      return { text: '静かで安らかなひとときだった。人生の夕暮れは、案外美しい。', effects: { health: E['△'] } };
    },
  },
};

// ステージ別イベントプール
const POOLS = {
  '幼少期': ['E02', 'E03'],
  '学生期': ['E04', 'E05'],
  '青年期': ['E06', 'E07', 'E08'],
  '壮年期': ['E09', 'E10', 'E11'],
  '老年期': ['E12'],
};

const CORE_IDS = new Set(['E04', 'E06', 'E07', 'E09', 'E10']);

export function pickEvent(leader) {
  const stage = leader.stage;
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

