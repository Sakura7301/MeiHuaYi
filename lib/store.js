/**
 * 卦例 / 学习笔记存储。
 *
 * 对应原 skill 的 `records.py`（SQLite）与 `learning_notes.py`。插件运行在
 * Harness 宿主进程中，没有可用的 sqlite 绑定，因此改用单文件 JSON 存档，
 * 字段与原有表结构一一对应，读写均走「临时文件 + rename」的原子替换。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SCHEMA_VERSION = 1;

function resolveProfileDir() {
  if (process.env.DSH_PROFILE_DIR) return process.env.DSH_PROFILE_DIR;
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  const profile = process.env.DSH_PROFILE || 'web';
  return join(home, 'profiles', profile);
}

function nowStamp() {
  const t = new Date(Date.now() + 8 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`;
}

/**
 * 建立卦例库。
 * @param {{dataDir?: string}} [config]
 */
export function createJournal(config = {}) {
  const dir = config.dataDir || join(resolveProfileDir(), '.dsh-meihuayi');
  const file = join(dir, 'journal.json');

  // autoNote 默认开启：用户点保存反馈就是为了沉淀经验，默认不该什么都不发生。
// 关掉它的人可以在设置页取消勾选。
const DEFAULT_SETTINGS = { fontScale: 1, autoNote: true };

  function empty() {
    return { version: SCHEMA_VERSION, seq: 0, records: [], notes: [], settings: { ...DEFAULT_SETTINGS } };
  }

  /**
   * 每次都从磁盘读。
   *
   * 早期版本把整份存档缓存在内存、写回时整份覆盖：一旦同时存在两个实例
   * （宿主重新 apply、外部脚本、离线测试），后写的一方就会把对方的数据抹掉
   * ——实测已发生过一次（工具实例看到 6 条、路由实例只有 1 条）。
   * 存档只有几 KB，读一次的成本可以忽略，所以改成「读盘 → 改 → 原子写回」。
   */
  function load() {
    if (!existsSync(file)) return empty();
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8'));
      return {
        version: parsed.version ?? SCHEMA_VERSION,
        seq: Number(parsed.seq) || 0,
        records: Array.isArray(parsed.records) ? parsed.records : [],
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      };
    } catch {
      // 存档损坏时保留现场，另起新档，避免静默丢数据。
      try {
        renameSync(file, `${file}.corrupt-${Date.now()}`);
      } catch {
        /* 备份失败不阻塞后续写入 */
      }
      return empty();
    }
  }

  /** 原子替换：读到的永远是完整文件。 */
  function save(data) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    renameSync(tmp, file);
    return data;
  }

  /* ── 卦例 ───────────────────────────────── */

  function saveRecord({ question, method, params, pattern, analysis = '', conclusion = '' }) {
    const data = load();
    const id = data.seq + 1;
    data.seq = id;
    data.records.push({
      id,
      date: nowStamp(),
      question: question || '',
      method: method || '',
      params: params || '',
      pattern: pattern || {},
      analysis,
      conclusion,
      // 起卦时还没有外应；用户回答后由 AI 在阶段二回写。
      waijing: '',
      waijing_analysis: '',
      feedback: null,
      summary: null,
    });
    save(data);
    return id;
  }

  function getRecord(id) {
    return load().records.find((r) => r.id === Number(id)) || null;
  }

  function listRecords({ keyword = null, pendingOnly = false, method = null } = {}) {
    let rows = load().records.slice();
    if (keyword) rows = rows.filter((r) => String(r.question).includes(keyword));
    if (method) rows = rows.filter((r) => r.method === method);
    if (pendingOnly) rows = rows.filter((r) => !r.feedback);
    return rows.sort((a, b) => b.id - a.id);
  }

  function updateRecord(id, { question, analysis, conclusion, waijing, waijingAnalysis }) {
    const data = load();
    const r = data.records.find((x) => Number(x.id) === Number(id));
    if (!r) return false;
    // 问题允许事后订正（起卦时可能留空或写错）。
    if (question !== undefined) r.question = String(question);
    if (analysis !== undefined) r.analysis = analysis;
    if (conclusion !== undefined) r.conclusion = conclusion;
    // 外应：waijing 是用户所述的原文，waijingAnalysis 是 AI 的取象解读。
    if (waijing !== undefined) r.waijing = waijing;
    if (waijingAnalysis !== undefined) r.waijing_analysis = waijingAnalysis;
    save(data);
    return true;
  }

  function addFeedback(id, { result, correct, correctReason = null, incorrectReason = null, xiangAnalysis = null }) {
    const data = load();
    const r = data.records.find((x) => Number(x.id) === Number(id));
    if (!r) return false;
    r.feedback = {
      result: result ?? '',
      correct: !!correct,
      correct_reason: correctReason,
      incorrect_reason: incorrectReason,
      xiang_analysis: xiangAnalysis,
      updated_at: nowStamp(),
    };
    save(data);
    return true;
  }

  function addSummary(id, summary) {
    const data = load();
    const r = data.records.find((x) => Number(x.id) === Number(id));
    if (!r) return false;
    r.summary = { content: summary, updated_at: nowStamp() };
    save(data);
    return true;
  }

  /* ── 删除 ───────────────────────────────── */

  /**
   * 选出待删除的卦例（只读、不落盘），供「确认预览」与实际删除共用同一套筛选。
   * @param {{ids?: number[]|null, pendingOnly?: boolean}} options
   */
  function selectForDeletion({ ids = null, pendingOnly = false } = {}) {
    const rows = load().records;
    if (Array.isArray(ids) && ids.length) {
      const wanted = new Set(ids.map(Number));
      return rows.filter((r) => wanted.has(Number(r.id)));
    }
    if (pendingOnly) return rows.filter((r) => !r.feedback);
    return [];
  }

  /**
   * 永久删除指定卦例。
   *
   * 学习笔记不随之删除（那是复盘积累的材料），只在返回值里报告有多少条笔记
   * 因此失去关联，供调用方提示用户。卦例编号不复用：seq 不回退，编号继续递增。
   * @param {number[]} ids
   */
  function deleteRecords(ids) {
    const data = load();
    const doomed = new Set(ids.map(Number));
    const before = data.records.length;
    data.records = data.records.filter((r) => !doomed.has(Number(r.id)));
    const deleted = before - data.records.length;
    if (deleted) save(data);
    const orphanedNotes = data.notes.filter((n) => doomed.has(Number(n.record_id))).length;
    return { deleted, orphanedNotes };
  }

  /* ── 学习笔记 ────────────────────────────── */

  function addNote({ recordId, correct, questionType = '', reasonAnalysis = '', lessonLearned = '', improvement = '' }) {
    const data = load();
    const id = (data.notes.at(-1)?.id ?? 0) + 1;
    data.notes.push({
      id,
      record_id: Number(recordId) || 0,
      date: nowStamp(),
      question_type: questionType,
      correct: !!correct,
      reason_analysis: reasonAnalysis,
      lesson_learned: lessonLearned,
      improvement,
    });
    save(data);
    return id;
  }

  function listNotes() {
    return load().notes.slice().sort((a, b) => b.id - a.id);
  }

  /**
   * 学习统计。
   *
   * ⚠️ 准确率的基数取「现存卦例里已反馈的那些」，不是笔记条数。
   * 笔记按设计不随卦例删除（见 deleteRecords），若拿笔记当分母，
   * 删掉卦例后准确率纹丝不动，与用户看到的事实自相矛盾。
   * 笔记数单独给出；孤例笔记（对应卦例已删）只报数、不计入准确率。
   */
  function noteStats() {
    const data = load();
    const liveIds = new Set(data.records.map((r) => Number(r.id)));
    const rated = data.records.filter((r) => r.feedback && typeof r.feedback.correct === 'boolean');
    const correct = rated.filter((r) => r.feedback.correct).length;
    const noted = new Set(data.notes.map((n) => Number(n.record_id)));
    return {
      total: rated.length,
      correct,
      incorrect: rated.length - correct,
      accuracy: rated.length ? Math.round((correct / rated.length) * 1000) / 10 : 0,
      notes: data.notes.length,
      orphanNotes: data.notes.filter((n) => !liveIds.has(Number(n.record_id))).length,
      missingNotes: data.records.filter((r) => r.feedback && !noted.has(Number(r.id))).length,
    };
  }

  /* ── 设置 ───────────────────────────────── */

  function getSettings() {
    return load().settings;
  }

  /** 只更新传入的字段，其余保持原值。字号缩放限制在 0.5–2，避免离谱值撑坏界面。 */
  function updateSettings(patch = {}) {
    const data = load();
    if (patch.fontScale !== undefined) {
      const n = Number(patch.fontScale);
      if (Number.isFinite(n) && n >= 0.5 && n <= 2) data.settings.fontScale = Math.round(n * 100) / 100;
    }
    if (patch.autoNote !== undefined) data.settings.autoNote = !!patch.autoNote;
    save(data);
    return data.settings;
  }

  /** 已反馈、但还没有对应学习笔记的卦例——「反馈后自动建笔记」据此提醒 AI 补建。 */
  function recordsMissingNotes() {
    const data = load();
    const noted = new Set(data.notes.map((n) => Number(n.record_id)));
    return data.records.filter((r) => r.feedback && !noted.has(Number(r.id)));
  }

  return {
    dir,
    file,
    getSettings,
    updateSettings,
    recordsMissingNotes,
    saveRecord,
    getRecord,
    listRecords,
    updateRecord,
    addFeedback,
    addSummary,
    selectForDeletion,
    deleteRecords,
    addNote,
    listNotes,
    noteStats,
    /** 供 UI 列表使用的精简投影。 */
    overview() {
      const records = listRecords();
      return {
        total: records.length,
        pending: records.filter((r) => !r.feedback).length,
        stats: noteStats(),
      };
    },
  };
}

/* ══════════════════════════════════════════════
 *  文本格式化（对齐原 skill 的显示规范）
 * ══════════════════════════════════════════════ */

/** 简略列表 / 详情显示。 */
export function formatRecords(records, detailed = false) {
  if (!records.length) return '没有找到匹配的卦例记录。';
  const lines = [];
  if (detailed && records.length === 1) {
    const r = records[0];
    const p = r.pattern || {};
    lines.push(`卦例 #${r.id}`);
    lines.push('');
    lines.push(`问：${r.question}`);
    lines.push(`时间：${p.time || r.date}`);
    lines.push(`方式：${r.method}（${r.params}）`);
    lines.push(`干支：${p.ganzhi || 'N/A'}`);
    lines.push(`五行：${p.wuxing || 'N/A'}`);
    lines.push('');
    lines.push('排盘');
    lines.push(`主卦：${p.main || ''} ${p.main_guaci || ''}`);
    lines.push(`互卦：${p.hugua || 'N/A'}`);
    lines.push(`变卦：${p.biangua || ''} ${p.biangua_guaci || ''}`);
    lines.push(`动爻：${p.dongyao || 'N/A'}`);
    lines.push('');
    if (r.waijing || r.waijing_analysis) {
      lines.push('外应');
      if (r.waijing) lines.push(`  用户所述：${r.waijing}`);
      if (r.waijing_analysis) lines.push(`  取象解读：${r.waijing_analysis}`);
      lines.push('');
    }
    lines.push('推断过程');
    lines.push('');
    lines.push(r.analysis || '（尚未推断）');
    lines.push('');
    lines.push('结论');
    lines.push('');
    lines.push(r.conclusion || '（尚未给出结论）');
    lines.push('');
    if (r.summary?.content) {
      lines.push('复盘总结');
      lines.push('');
      lines.push(r.summary.content);
      lines.push('');
    }
    const fb = r.feedback;
    if (fb) {
      lines.push(`状态：${fb.correct ? '✅ 正确' : '❌ 错误'}`);
      lines.push('');
      lines.push(`  实际结果：${fb.result || ''}`);
      if (fb.correct_reason) lines.push(`  正确原因：${fb.correct_reason}`);
      if (fb.incorrect_reason) lines.push(`  错误原因：${fb.incorrect_reason}`);
      if (fb.xiang_analysis) lines.push(`  取象分析：${fb.xiang_analysis}`);
    } else {
      lines.push('状态：⏳ 待反馈');
    }
    return lines.join('\n');
  }

  lines.push(`共找到 ${records.length} 条记录：`);
  lines.push('');
  for (const r of records) {
    const p = r.pattern || {};
    const conclusion = r.conclusion || '（未推断）';
    const short = conclusion.length > 40 ? `${conclusion.slice(0, 40)}…` : conclusion;
    lines.push(`#${r.id} [${p.time || r.date}] ${r.question}`);
    lines.push(`    方式：${r.method}（${r.params}）`);
    lines.push(`    推断：${short}`);
    lines.push(`    状态：${r.feedback ? (r.feedback.correct ? '✅ 正确' : '❌ 错误') : '⏳ 待反馈'}`);
  }
  return lines.join('\n');
}

/** 学习笔记显示。 */
export function formatNotes(notes, brief = true) {
  if (!notes.length) return '暂无学习笔记。';
  if (brief) {
    const lines = [`共 ${notes.length} 条笔记：`, ''];
    for (const n of notes) {
      const lesson = n.lesson_learned || '';
      lines.push(`#${n.id} ${n.date.slice(0, 10)} ${n.question_type || '-'} ${n.correct ? '✅' : '❌'} 卦例#${n.record_id}`);
      if (lesson) lines.push(`    ${lesson.length > 40 ? `${lesson.slice(0, 40)}…` : lesson}`);
    }
    return lines.join('\n');
  }
  const lines = [];
  for (const n of notes) {
    lines.push('═'.repeat(24));
    lines.push(`【笔记 #${n.id}】 卦例 #${n.record_id}`);
    lines.push(`日期：${n.date}`);
    lines.push(`问题类型：${n.question_type || '-'}`);
    lines.push(`判断结果：${n.correct ? '✅ 正确' : '❌ 错误'}`);
    lines.push('');
    lines.push('【原因分析】');
    lines.push(n.reason_analysis || '-');
    lines.push('');
    lines.push('【教训】');
    lines.push(n.lesson_learned || '-');
    lines.push('');
    lines.push('【改进方向】');
    lines.push(n.improvement || '-');
  }
  return lines.join('\n');
}