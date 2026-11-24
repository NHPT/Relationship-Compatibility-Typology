const EX_DRAFT_KEY = 'rct_exploration_draft_v1';
const EX_REPORT_KEY = 'rct_exploration_reports_v1';

function emptyExplorationDraft() {
  return { version: EXPLORATION_VERSION, updatedAt: null, answers: {} };
}
function readExplorationDraft() {
  try {
    const raw = JSON.parse(localStorage.getItem(EX_DRAFT_KEY));
    if (!raw) return emptyExplorationDraft();
    const legacy = raw.version === 'rct-exploration-2026-11-23-v1';
    const previous = legacy || raw.version === 'rct-exploration-2026-11-23-v2';
    if (raw.version !== EXPLORATION_VERSION && !previous) return { ...emptyExplorationDraft(), incompatible: true };
    if (!raw.answers || typeof raw.answers !== 'object' || Array.isArray(raw.answers)) return emptyExplorationDraft();
    const answers = {};
    ALL_EXPLORATION_QUESTIONS.forEach(question => {
      if (legacy && PERSONAL_PROBES.some(probe => probe.questionId === question.id)) return;
      if (previous && PERSONAL_CORE_ADDITIONS.some(q => q.id === question.id)) return;
      const answer = raw.answers[question.id];
      if (answer && (answer.skipped === true && answer.optionId === null
        || answer.skipped !== true && question.options.some(option => option.id === answer.optionId))) {
        answers[question.id] = { ...answer };
      }
    });
    return { version: EXPLORATION_VERSION, updatedAt: raw.updatedAt, answers,
      ...(previous ? { migratedFrom: raw.version } : {}) };
  } catch {
    return emptyExplorationDraft();
  }
}
function saveExplorationDraft(draft) {
  if (draft.incompatible) return false;
  try { localStorage.setItem(EX_DRAFT_KEY, JSON.stringify(draft)); return true; }
  catch { return false; }
}
function explorationAnswer(question, draft) {
  const answer = draft.answers[question.id];
  if (answer?.skipped === true && answer.optionId === null) return { status: 'skipped', text: '已跳过' };
  const option = question.options.find(option => option.id === answer?.optionId);
  return option ? { status: 'answered', text: option.text, optionId: option.id }
    : { status: 'unanswered', text: '尚未作答' };
}
function recordExplorationChoice(draft, questionId, optionId, skipped = false) {
  const question = getExplorationQuestion(questionId);
  if (!question || (skipped ? optionId !== null : !question.options.some(option => option.id === optionId))) {
    throw new Error('探索答案与题库不一致');
  }
  if (draft.incompatible) throw new Error('旧版探索记录需要先导出并清空');
  draft.answers[questionId] = { optionId, skipped, answeredAt: Date.now() };
  draft.updatedAt = Date.now();
  return saveExplorationDraft(draft);
}
function explorationProgress(groupId, draft) {
  const questions = groupId ? explorationQuestions(groupId) : PERSONAL_CORE_QUESTIONS;
  const statuses = questions.map(q => explorationAnswer(q, draft).status);
  const answered = statuses.filter(status => status === 'answered').length;
  const skipped = statuses.filter(status => status === 'skipped').length;
  return { total: questions.length, answered, skipped, processed: answered + skipped, complete: answered + skipped === questions.length };
}
function buildExplorationReport(draft, groupId = null) {
  const questions = groupId ? explorationQuestions(groupId) : PERSONAL_CORE_QUESTIONS;
  const topicIds = [...new Set(questions.map(q => q.topicId))];
  const topics = topicIds.map(id => EXPLORATION_TOPICS.find(topic => topic.id === id));
  const rows = topics.map(topic => ({
    topicId: topic.id, name: topic.name, reflection: topic.reflection,
    facets: questions.filter(question => question.topicId === topic.id).map(question => ({
      questionId: question.id, facet: question.facet, questionText: question.text,
      mode: question.mode, ...explorationAnswer(question, draft)
    }))
  }));
  const facets = rows.flatMap(row => row.facets);
  const report = {
    version: EXPLORATION_VERSION,
    resultId: globalThis.crypto?.randomUUID?.() || `ex-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(), groupId,
    title: groupId ? getExplorationGroup(groupId).name : '个人综合画像',
    scope: groupId ? 'legacy_group' : 'personal_core',
    source: 'self_report', validated: false,
    answered: facets.filter(facet => facet.status === 'answered').length,
    skipped: facets.filter(facet => facet.status === 'skipped').length,
    total: facets.length,
    topicCount: rows.length, topics: rows
  };
  report.personalProfile = buildPersonalProfile(report);
  return report;
}
function getExplorationReports() {
  try {
    const raw = JSON.parse(localStorage.getItem(EX_REPORT_KEY));
    return Array.isArray(raw) ? raw.filter(row => row
      && typeof row.title === 'string' && typeof row.version === 'string'
      && [row.timestamp, row.answered, row.skipped, row.total, row.topicCount].every(Number.isFinite)
      && row.answered >= 0 && row.skipped >= 0 && row.total >= row.answered + row.skipped
      && Array.isArray(row.topics) && row.topicCount === row.topics.length
      && row.topics.every(topic => topic && Number.isInteger(topic.topicId) && topic.topicId >= 1 && topic.topicId <= 48
        && typeof topic.name === 'string' && typeof topic.reflection === 'string'
        && Array.isArray(topic.facets) && topic.facets.every(facet => facet
          && typeof facet.facet === 'string' && typeof facet.questionText === 'string'
          && typeof facet.text === 'string'
          && ['answered', 'skipped', 'unanswered'].includes(facet.status)))) : [];
  } catch { return []; }
}
function saveExplorationReport(report) {
  const reports = getExplorationReports();
  // 相同范围、相同具体回答只保留一次快照，不把重复点击当新增样本。
  const same = reports.find(row => row.version === report.version && row.groupId === report.groupId
    && row.personalProfile?.version === report.personalProfile?.version
    && JSON.stringify(row.topics) === JSON.stringify(report.topics));
  if (same) return true;
  reports.push(report);
  try { localStorage.setItem(EX_REPORT_KEY, JSON.stringify(reports)); return true; }
  catch { return false; }
}
function clearExplorationData() {
  try {
    localStorage.removeItem(EX_DRAFT_KEY);
    localStorage.removeItem(EX_REPORT_KEY);
    return true;
  } catch { return false; }
}
function getExplorationData() {
  let original = null;
  try { original = JSON.parse(localStorage.getItem(EX_DRAFT_KEY)); } catch { /* 损坏记录不冒充有效回答 */ }
  return { version: EXPLORATION_VERSION, draft: original, reports: getExplorationReports() };
}

function currentPersonalFoundation() {
  const draft = typeof explorationState !== 'undefined' && explorationState.draft
    ? explorationState.draft : readExplorationDraft();
  if (draft.incompatible) return {
    source: 'current_personal_draft', status: 'incompatible', available: false,
    title: '个人基础画像尚不可用', summary: '当前个人草稿版本未识别，未参与这份婚恋报告。'
  };
  const report = buildExplorationReport(draft);
  return {
    source: 'current_personal_draft', sourceVersion: report.version,
    typeVersion: PERSONAL_TYPE_VERSION, explanationVersion: PERSONAL_EXPLANATION_VERSION,
    capturedAt: Date.now(), draftUpdatedAt: draft.updatedAt,
    available: report.answered > 0, status: report.personalProfile.classificationStatus,
    answered: report.answered, total: report.total,
    title: report.personalProfile.title, summary: report.personalProfile.summary,
    profile: report.personalProfile
  };
}
