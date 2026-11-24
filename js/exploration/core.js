/* 默认个人测评：保留主型与特征所需的观察，不使用婚恋专项题。 */
const PERSONAL_CORE_ADDITIONS = [
  {
    id: 'pc-autonomy-2', topicId: 24, facet: '个人时间与边界',
    text: '朋友或同事临时希望占用你已安排好的个人时间，你通常会？',
    options: ['说明可用时间，商量双方能接受的安排', '保留原安排，另约时间提供帮助', '先取消自己的安排，避免让对方失望', '直接拒绝，不再说明自己的安排']
  },
  {
    id: 'pc-connection-1', topicId: 45, facet: '日常联系',
    text: '对于你在意的朋友或家人，你更常怎样维持联系？',
    options: ['主动交流近况，保持稳定联系', '约好共同时间，定期见面或交流', '主要在有事情需要处理时联系', '不固定联系，偶尔想起时再说']
  },
  {
    id: 'pc-connection-2', topicId: 45, facet: '需要支持时的联系',
    text: '遇到需要支持的事情时，你更希望怎样与熟悉的人联系？',
    options: ['主动说明情况，约时间认真交流', '保持日常交流，在交流中谈到需要', '先自己处理，需要具体帮助时再说', '主要独自处理，暂时不想谈这件事']
  }
].map(question => ({
  ...question, mode: 'scenario',
  options: question.options.map((text, index) => ({ id: `${question.id}:${index}`, text }))
}));

const PERSONAL_CORE_FEATURE_IDS = [
  'ex-11-1', 'ex-11-2', 'ex-11-4', 'ex-38-4',
  'ex-3-2', 'pc-autonomy-2', 'ex-22-3', 'ex-22-5',
  'ex-12-1', 'ex-12-2', 'ex-12-3', 'ex-12-5',
  'ex-17-2', 'ex-17-4', 'ex-37-2', 'ex-37-5',
  'ex-3-3', 'ex-23-3', 'ex-46-2', 'ex-46-4',
  'ex-11-3', 'ex-29-1', 'ex-29-2', 'ex-34-4',
  'ex-47-1', 'ex-47-2', 'ex-47-3', 'ex-47-5',
  'pc-connection-1', 'pc-connection-2', 'ex-45-2', 'ex-45-5'
];
const ALL_EXPLORATION_QUESTIONS = new Map(
  [...Object.values(EXPLORATION_BANK).flat(), ...PERSONAL_CORE_ADDITIONS].map(q => [q.id, q])
);
const PERSONAL_CORE_QUESTIONS = [
  ...PERSONAL_PROBES.map(probe => probe.questionId), ...PERSONAL_CORE_FEATURE_IDS
].map(id => {
  const question = ALL_EXPLORATION_QUESTIONS.get(id);
  if (!question) throw new Error(`个人测评缺少题目：${id}`);
  return question;
});

function getExplorationQuestion(questionId) {
  return ALL_EXPLORATION_QUESTIONS.get(questionId) || null;
}
