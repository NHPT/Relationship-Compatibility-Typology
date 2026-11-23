/* ============================================================
 * RCT 关系适配类型学 — 题库引擎
 * 设计：考点模板 + 参数池，运行时动态生成题面（防背答案）
 * 扩容后：32 个考点模板，每个考点都带参数池，考点 + 参数双重随机
 *
 * 维度正方向定义：
 *   X 人生主轴：进取=+  安稳=-
 *   Y 关系形态：独立=+  共生=-
 *   C 冲突模式：回避=+  直面=-   （回避分越高越接近 E 警示型）
 *   B 边界模式：模糊=+  清晰=-   （模糊分越高越接近 F 警示型）
 *   M 消费观：  体验=+  规划=-
 *   K 生育意愿：要=+    不要=-
 *   S 定居倾向：流动=+  扎根=-
 * ============================================================ */

const DIMENSIONS = {
  X: { name: '人生主轴', pos: '进取攀登', neg: '安稳守成' },
  Y: { name: '关系形态', pos: '独立并置', neg: '深度共生' },
  C: { name: '冲突模式', pos: '回避压抑', neg: '直面修复' },
  B: { name: '边界模式', pos: '边界模糊', neg: '边界清晰' },
  M: { name: '消费观',   pos: '即时体验', neg: '规划积累' },
  K: { name: '生育意愿', pos: '想要孩子', neg: '不想要孩子' },
  S: { name: '定居倾向', pos: '流动探索', neg: '扎根安定' }
};

/* 每次测试各维度的抽题数量（合计 20 题；考点数 > 抽题数 → 考点随机） */
const TEST_PLAN = { X: 3, Y: 3, C: 3, B: 4, M: 3, K: 2, S: 2 };

/* ============ 题库：考点模板 ============ */
const QUESTION_BANK = [
  /* ---------- X 人生主轴（5 考点，抽 3） ---------- */
  {
    id: 'X1', dimension: 'X',
    template: '{机会}，你会更倾向？',
    vars: { '机会': [
      '有个机会去陌生城市做更累但更有挑战的工作',
      '有一个高风险高回报的项目机会摆在面前',
      '公司想调你到一个从零开始的新业务线',
      '有朋友拉你一起辞职创业',
      '有个能让你快速成长但压力很大的岗位'
    ] },
    options: [
      { text: '去，想看看自己能走多远', score: 2 },
      { text: '不去，现在的生活挺好', score: -2 },
      { text: '会去，但需要有人支持才安心', score: 1 },
      { text: '看条件和前景再说，不盲目折腾', score: 0 }
    ]
  },
  {
    id: 'X2', dimension: 'X',
    template: '{自由情境}，你会？',
    vars: { '自由情境': [
      '突然不用为钱发愁了',
      '突然多出大把可自由支配的时间',
      '如果实现了财务自由'
    ] },
    options: [
      { text: '去折腾新项目、学新东西', score: 2 },
      { text: '好好经营现在的日子，稳定下来', score: -2 },
      { text: '先休息，规划好再慢慢来', score: -1 },
      { text: '不确定，可能都有', score: 0 }
    ]
  },
  {
    id: 'X3', dimension: 'X',
    template: '你理想中{时间}的生活是？',
    vars: { '时间': ['十年后', '五年后', '退休后'] },
    options: [
      { text: '一直在往上走、不断变化', score: 2 },
      { text: '已经定下来、按部就班经营', score: -2 },
      { text: '有变化，但节奏可控', score: 1 },
      { text: '没细想，走一步看一步', score: 0 }
    ]
  },
  {
    id: 'X4', dimension: 'X',
    template: '你怎么看那些{折腾行为}的人？',
    vars: { '折腾行为': [
      '辞职去创业',
      '频繁跳槽',
      '裸辞去旅行',
      '三十岁还重新开始学新东西'
    ] },
    options: [
      { text: '佩服，敢想敢干', score: 2 },
      { text: '不理解，太冒险了', score: -2 },
      { text: '佩服，但自己不会这么做', score: -1 },
      { text: '看结果，成了就是本事', score: 0 }
    ]
  },
  {
    id: 'X5', dimension: 'X',
    template: '你怎么看{稳定选择}？',
    vars: { '稳定选择': [
      '考公进体制',
      '一份工作干很多年',
      '按部就班过一辈子',
      '早点安定下来结婚生子'
    ] },
    options: [
      { text: '挺好的，稳定踏实', score: -2 },
      { text: '太闷了，我会受不了', score: 2 },
      { text: '可以当退路，但不想一直这样', score: 1 },
      { text: '看个人选择', score: 0 }
    ]
  },

  /* ---------- Y 关系形态（5 考点，抽 3） ---------- */
  {
    id: 'Y1', dimension: 'Y',
    template: '和重要的人在一起后，理想的{休息时间}是？',
    vars: { '休息时间': ['周末', '假期', '休息日'] },
    options: [
      { text: '两人待一起，哪怕各做各的', score: -2 },
      { text: '各自和朋友聚，晚上回家一起', score: 2 },
      { text: '一起出去见共同的朋友', score: -1 },
      { text: '看心情，有时想一个人待着', score: 1 }
    ]
  },
  {
    id: 'Y2', dimension: 'Y',
    template: '{情境}下，你更认同哪种相处方式？',
    vars: { '情境': ['长期相处中', '两个人工作都很忙的时候', '刚开始一段关系时'] },
    options: [
      { text: '好关系是高度融合、随时在一起', score: -2 },
      { text: '好关系是各自独立、并排同行', score: 2 },
      { text: '陪伴重要，但也要各自空间', score: -1 },
      { text: '需要很多独处时间给自己充电', score: 1 }
    ]
  },
  {
    id: 'Y3', dimension: 'Y',
    template: '你怎么看「{关系对象}之间不该有秘密」这句话？',
    vars: { '关系对象': ['伴侣', '搭档', '最亲近的人'] },
    options: [
      { text: '认同，该无话不谈', score: -2 },
      { text: '不认同，各自可以有自己的边界', score: 2 },
      { text: '大事不瞒，小事可以有空间', score: 1 },
      { text: '看情况，说不清', score: 0 }
    ]
  },
  {
    id: 'Y4', dimension: 'Y',
    template: '你会主动和{亲近的人}分享日常琐事吗？',
    vars: { '亲近的人': ['伴侣', '最好的朋友', '搭档'] },
    options: [
      { text: '会，大事小事都想说', score: -2 },
      { text: '只分享重要的，琐事不说', score: 1 },
      { text: '看心情，想说才说', score: 2 },
      { text: '说不好', score: 0 }
    ]
  },
  {
    id: 'Y5', dimension: 'Y',
    template: '和朋友聚会时，你会带上{亲近的人}吗？',
    vars: { '亲近的人': ['伴侣', '关系很好的对象'] },
    options: [
      { text: '当然带，喜欢待在一起', score: -2 },
      { text: '偶尔带，各自有各自的圈子', score: 1 },
      { text: '一般不带，想有自己的社交', score: 2 },
      { text: '看情况', score: 0 }
    ]
  },

  /* ---------- C 冲突模式（5 考点，抽 3，高回避 → E） ---------- */
  {
    id: 'C1', dimension: 'C',
    template: '和重要的人因为{分歧}意见不合时，你更可能？',
    vars: { '分歧': ['周末去哪', '一笔钱怎么花', '一个重要决定', '生活方式的选择'] },
    options: [
      { text: '当场说清楚，折中解决', score: -2 },
      { text: '先各自冷静，过几天再谈', score: 1 },
      { text: '算了听对方的，但心里不太舒服', score: 2 },
      { text: '坚持自己的，不太退让', score: -1 }
    ]
  },
  {
    id: 'C2', dimension: 'C',
    template: '和好朋友因为{起因}闹矛盾，你一般会？',
    vars: { '起因': ['一件小事', '一个误会', '观点不同', '利益冲突'] },
    options: [
      { text: '主动找对方说开', score: -2 },
      { text: '等对方先来找我', score: 1 },
      { text: '冷处理，觉得时间会解决', score: 2 },
      { text: '找第三方评评理', score: -1 }
    ]
  },
  {
    id: 'C3', dimension: 'C',
    template: '你小时候家里，大人因为{事}闹矛盾通常怎么解决？',
    vars: { '事': ['家务', '钱', '亲戚关系', '孩子的教育'] },
    options: [
      { text: '会吵开，但很快和好', score: -1 },
      { text: '冷战，很久不说话', score: 2 },
      { text: '总是一方让着一方', score: 1 },
      { text: '不记得，或者很少闹矛盾', score: 0 }
    ]
  },
  {
    id: 'C4', dimension: 'C',
    template: '你被人{误解场景}时，通常会？',
    vars: { '误解场景': ['误会了', '冤枉了', '曲解了你的意思'] },
    options: [
      { text: '立刻解释清楚', score: -2 },
      { text: '算了，懒得解释', score: 2 },
      { text: '先冷静，找机会再解释', score: -1 },
      { text: '心里很不舒服，但不说', score: 1 }
    ]
  },
  {
    id: 'C5', dimension: 'C',
    template: '{重要的人}情绪低落时，你会？',
    vars: { '重要的人': ['伴侣', '好朋友', '家人'] },
    options: [
      { text: '主动问怎么了，陪着他', score: -2 },
      { text: '给他空间，等他自己好', score: 1 },
      { text: '假装没发现，怕说错话', score: 2 },
      { text: '用行动哄他开心', score: -1 }
    ]
  },

  /* ---------- B 边界模式（6 考点，抽 4，高模糊 → F） ---------- */
  {
    id: 'B1', dimension: 'B',
    template: '{他人}的对象和一个异性同事关系特别好、经常单独吃饭，你怎么看？',
    vars: { '他人': ['一个朋友', '你的朋友'] },
    options: [
      { text: '正常，只是工作关系', score: 2 },
      { text: '有点过了，该避避嫌', score: -2 },
      { text: '看有没有瞒着，透明就行', score: -1 },
      { text: '完全不能接受', score: -2 }
    ]
  },
  {
    id: 'B2', dimension: 'B',
    template: '{对象}还能和前任保持联系吗？',
    vars: { '对象': ['你', '你的伴侣', '你的搭档'] },
    options: [
      { text: '能，都已经是过去式了', score: 2 },
      { text: '尽量回避，减少误会', score: -2 },
      { text: '有事才联系，平时不聊', score: -1 },
      { text: '看对方的态度', score: 0 }
    ]
  },
  {
    id: 'B3', dimension: 'B',
    template: '以后{阶段}，你希望和父母保持怎样的关系？',
    vars: { '阶段': ['成家', '立业', '独立生活'] },
    options: [
      { text: '住得近、多来往，大事听父母', score: 2 },
      { text: '保持距离，自己独立做决定', score: -2 },
      { text: '可以来往，但大事自己定', score: -1 },
      { text: '还没想过', score: 0 }
    ]
  },
  {
    id: 'B4', dimension: 'B',
    template: '父母对你{人生大事}有不同意见，你会？',
    vars: { '人生大事': ['的对象', '的事业选择', '的定居城市', '的婚姻安排'] },
    options: [
      { text: '父母意见很重要，会认真听甚至照做', score: 2 },
      { text: '听，但最终自己拿主意', score: -1 },
      { text: '我的事我自己定，父母少插手', score: -2 },
      { text: '会很纠结，难两全', score: 1 }
    ]
  },
  {
    id: 'B5', dimension: 'B',
    template: '你能接受{亲近的人}有一个关系很要好的异性朋友吗？',
    vars: { '亲近的人': ['伴侣', '另一半'] },
    options: [
      { text: '不能接受，容易出问题', score: -2 },
      { text: '能，但要保持分寸', score: -1 },
      { text: '能，正常交友而已', score: 2 },
      { text: '看那个人的为人', score: 0 }
    ]
  },
  {
    id: 'B6', dimension: 'B',
    template: '{家庭阶段}，小家庭或你的人生大事，你会让父母参与决策吗？',
    vars: { '家庭阶段': ['结婚以后', '独立生活以后'] },
    options: [
      { text: '会，父母经验丰富', score: 2 },
      { text: '听意见，但决定权在我', score: -1 },
      { text: '完全自己做主', score: -2 },
      { text: '看什么事', score: 0 }
    ]
  },

  /* ---------- M 消费观（5 考点，抽 3） ---------- */
  {
    id: 'M1', dimension: 'M',
    template: '月底看中一个{心动物品}，你会？',
    vars: { '心动物品': ['有点贵但很想要的东西', '很想要的新手机', '一直想去的旅行', '想报的课程'] },
    options: [
      { text: '买，喜欢就值得', score: 2 },
      { text: '先看预算，超了就不买', score: -2 },
      { text: '纠结，最后可能还是买', score: 1 },
      { text: '等打折或下个月再说', score: -1 }
    ]
  },
  {
    id: 'M2', dimension: 'M',
    template: '{收入}到手后，你一般会？',
    vars: { '收入': ['工资', '奖金', '年终奖', '一笔外快'] },
    options: [
      { text: '先存下一部分', score: -2 },
      { text: '先花在当下该花的地方', score: 2 },
      { text: '存一些、花一些', score: -1 },
      { text: '没细算，比较随性', score: 1 }
    ]
  },
  {
    id: 'M3', dimension: 'M',
    template: '你怎么看{分期消费}？',
    vars: { '分期消费': ['分期买大件', '信用卡透支', '借钱消费', '网贷'] },
    options: [
      { text: '尽量不用，量入为出', score: -2 },
      { text: '合理用，能提前享受', score: 2 },
      { text: '应急的时候才用', score: -1 },
      { text: '不排斥，看情况', score: 1 }
    ]
  },
  {
    id: 'M4', dimension: 'M',
    template: '要花一笔大钱（比如{大额}），你会？',
    vars: { '大额': ['买房', '买车', '装修', '留学'] },
    options: [
      { text: '提前存钱，攒够再买', score: -2 },
      { text: '贷款或分期，先享受', score: 2 },
      { text: '精打细算，选性价比高的', score: -1 },
      { text: '随性，喜欢就下手', score: 1 }
    ]
  },
  {
    id: 'M5', dimension: 'M',
    template: '{关系对象}过生日或重要日子，你会？',
    vars: { '关系对象': ['伴侣', '好朋友', '家人'] },
    options: [
      { text: '精心准备，花点钱值得', score: 2 },
      { text: '量力而行，心意最重要', score: -2 },
      { text: '会花，但控制预算', score: -1 },
      { text: '看心情', score: 1 }
    ]
  },

  /* ---------- K 生育意愿（3 考点，抽 2） ---------- */
  {
    id: 'K1', dimension: 'K',
    template: '你怎么看身边{人}选择丁克？',
    vars: { '人': ['夫妻', '朋友', '同事'] },
    options: [
      { text: '挺好，各有各的活法', score: -1 },
      { text: '理解，但我自己还是想要孩子', score: 2 },
      { text: '不太理解，有孩子家庭才完整', score: 2 },
      { text: '没想过这个问题', score: 0 }
    ]
  },
  {
    id: 'K2', dimension: 'K',
    template: '{情境}时，你想象过自己有孩子的画面吗？',
    vars: { '情境': ['看到别人带孩子', '被问起什么时候要孩子', '独处的时候'] },
    options: [
      { text: '想过，很期待', score: 2 },
      { text: '偶尔想，但也不强求', score: 0 },
      { text: '基本没想，更想为自己活', score: -2 },
      { text: '说不好', score: 0 }
    ]
  },
  {
    id: 'K3', dimension: 'K',
    template: '你怎么看{养育话题}？',
    vars: { '养育话题': ['养一个孩子的成本', '有孩子后失去自由', '有了孩子人生才完整', '传宗接代这回事'] },
    options: [
      { text: '值得，再累也愿意', score: 2 },
      { text: '挺大的负担，我不确定要不要', score: -1 },
      { text: '成本太高，我更想为自己活', score: -2 },
      { text: '没认真想过', score: 0 }
    ]
  },

  /* ---------- S 定居倾向（3 考点，抽 2） ---------- */
  {
    id: 'S1', dimension: 'S',
    template: '{人生阶段}，你想在哪里定居？',
    vars: { '人生阶段': ['以后', '成家后', '工作稳定后'] },
    options: [
      { text: '就现在这座城市，扎根下来', score: -2 },
      { text: '跟着机会和事业走', score: 2 },
      { text: '想稳定，但不排斥为大事搬', score: -1 },
      { text: '没想好', score: 0 }
    ]
  },
  {
    id: 'S2', dimension: 'S',
    template: '为了{机会}，你愿意搬去陌生城市吗？',
    vars: { '机会': ['一个很好的工作机会', '一个重要的发展机会', '和重要的人团聚', '更好的生活'] },
    options: [
      { text: '愿意，机会难得', score: 2 },
      { text: '不愿意，稳定更重要', score: -2 },
      { text: '愿意，但会犹豫', score: 1 },
      { text: '看对方/团队是不是一起', score: 0 }
    ]
  },
  {
    id: 'S3', dimension: 'S',
    template: '你如何看待{生活状态}？',
    vars: { '生活状态': ['在一个城市待很多年', '经常换城市生活', '四海为家', '回老家定居'] },
    options: [
      { text: '向往，想去不同的地方', score: 2 },
      { text: '不喜欢，想安定下来', score: -2 },
      { text: '年轻时可以，老了要安定', score: -1 },
      { text: '没什么特别感觉', score: 0 }
    ]
  }
];

/* ============ 出题引擎 ============ */

/* 洗牌（Fisher-Yates），返回新数组 */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* 从数组随机取一个 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* 实例化单个考点模板 → 一道题 */
function instantiate(tpl) {
  let text = tpl.template;
  for (const [varName, pool] of Object.entries(tpl.vars || {})) {
    text = text.replace(new RegExp(`\\{${varName}\\}`, 'g'), pick(pool));
  }
  return {
    id: tpl.id,
    dimension: tpl.dimension,
    text: text,
    options: shuffle(tpl.options.map((o, i) => ({ ...o, idx: i })))
  };
}

/* 生成一张完整试卷（20 题，覆盖 7 维度，考点随机） */
function generateTest() {
  const questions = [];
  for (const [dim, count] of Object.entries(TEST_PLAN)) {
    const pool = QUESTION_BANK.filter(t => t.dimension === dim);
    const chosen = shuffle(pool).slice(0, count);
    for (const tpl of chosen) {
      questions.push(instantiate(tpl));
    }
  }
  return shuffle(questions);
}
