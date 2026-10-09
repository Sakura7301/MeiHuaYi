/**
 * 插件业务操作层。
 *
 * 每个操作只实现一次，由两个调用方共用：
 *  · Agent 工具（`lib/tools.js`）——聊天里的卜卦；
 *  · Web 路由（`lib/routes.js`）——界面上的点击卜卦。
 * 两条路径共用同一份排盘引擎与同一个卦例库，不存在第二套逻辑。
 */
import { readFileSync } from 'node:fs';
import {
  bjtNow,
  formatChart,
  getGanzhi,
  numberDivination,
  parseClock,
  timeDivination,
  charDivination,
  manualDivination,
} from './engine.js';
import { lunarDayName, lunarMonthName, solarToLunar } from './lunar.js';
import { formatNotes, formatRecords } from './store.js';
import { REFERENCES, castToolText } from './protocol.js';

/** 把排盘结果整理成卦例 pattern 字段（对齐原 skill 的字段名）。 */
function toPattern(result) {
  return {
    time: result.castAt,
    ganzhi: `${result.ganzhi.year}年 ${result.ganzhi.month}月 ${result.ganzhi.day}日 ${result.ganzhi.hour}时`,
    wuxing: result.wuxingText,
    main: `${result.ben.symbol} ${result.ben.fullName}（${result.relation}）`,
    main_guaci: `「${result.ben.scripture}」`,
    hugua: `互见${result.hu.fullName}`,
    hugua_guaci: `「${result.hu.scripture}」`,
    biangua: `${result.bian.symbol} ${result.bian.fullName}（${result.bianRelation}）`,
    biangua_guaci: `「${result.bian.scripture}」`,
    dongyao: result.dongyao.text,
    body: `体卦 ${result.body.name}（${result.body.element}）`,
    use: `用卦 ${result.use.name}（${result.use.element}）`,
    relation: result.relation,
    // 进阶盘：错卦 / 综卦 / 空亡 / 神煞（一字占起卦时同样带出）
    cuogua: result.cuogua ? `${result.cuogua.symbol} ${result.cuogua.fullName}` : '',
    zonggua: result.zonggua
      ? result.zongguaFixed
        ? `覆卦不动（${result.zonggua.fullName}）`
        : `${result.zonggua.symbol} ${result.zonggua.fullName}`
      : '',
    kongwang: result.kongwang
      ? {
          kong: result.kongwang.kong.join(''),
          xun: result.kongwang.xun,
          body: result.kongwang.body.text,
          use: result.kongwang.use.text,
        }
      : null,
    shensha: Array.isArray(result.shensha)
      ? result.shensha.map((row) => ({ name: row.name, zhis: row.zhis, text: row.text }))
      : [],
    chart: formatChart(result),
  };
}

function fail(message) {
  return { ok: false, error: message };
}

/**
 * @param {ReturnType<import('./store.js').createJournal>} journal
 */
export function createOperations(journal) {
  /**
   * 起卦并排盘。
   * @param {{method?:string, number?:number, upper?:number, lower?:number, moving?:number,
   *   upperStrokes?:number, lowerStrokes?:number, question?:string, datetime?:string, save?:boolean}} input
   */
  function cast(input = {}) {
    try {
      const method =
        input.method === 'number' ? 'number'
        : input.method === 'char' ? 'char'
        : input.method === 'manual' ? 'manual'
        : 'time';
      const question = input.question ? String(input.question).trim() : '';
      // 起卦前必须先有所问之事：问题不清则卦不应，界面与工具都走这一条校验。
      if (!question) return fail('起卦前请先写下所问之事（这一卦问什么）。问题不清，卦不应。');
      let result;
      if (method === 'number') {
        if (input.number === undefined || input.number === null || input.number === '') {
          return fail('数字起卦必须提供三位数 number（100-999）。');
        }
        result = numberDivination(Number(input.number), question, parseClock(input.datetime));
      } else if (method === 'char') {
        // 一字占：拆字与笔画数由 AI 判定，这里只接两个数。
        const up = input.upperStrokes;
        const lo = input.lowerStrokes;
        if (up === undefined || up === null || up === '' || lo === undefined || lo === null || lo === '') {
          return fail(
            '一字占必须给出 upperStrokes（上画数）与 lowerStrokes（下画数）：上下结构取上半/下半笔画，' +
              '左右结构取左半/右半，包围结构取外框/内核，独体字按总笔画对半分（奇数时下部多一画）。',
          );
        }
        try {
          result = charDivination(Number(up), Number(lo), question, parseClock(input.datetime));
        } catch (error) {
          return fail(error.message);
        }
      } else if (method === 'manual') {
        // 手动起卦：上卦 / 下卦 / 动爻由使用者直接指定（面板三个下拉框，或 AI 传入）。
        const miss = (v) => v === undefined || v === null || v === '';
        if (miss(input.upper) || miss(input.lower) || miss(input.moving)) {
          return fail(
            '手动起卦必须给出 upper（上卦 1-8）、lower（下卦 1-8）与 moving（动爻 1-6）：' +
              '先天八卦序 1 乾 / 2 兑 / 3 离 / 4 震 / 5 巽 / 6 坎 / 7 艮 / 8 坤；动爻 1-6 为初二三四五上。',
          );
        }
        try {
          result = manualDivination(
            Number(input.upper),
            Number(input.lower),
            Number(input.moving),
            question,
            parseClock(input.datetime),
          );
        } catch (error) {
          return fail(error.message);
        }
      } else {
        result = timeDivination(parseClock(input.datetime), question);
      }
      const chart = formatChart(result);

      let recordId = null;
      if (input.save !== false) {
        recordId = journal.saveRecord({
          question,
          method: result.method,
          params: result.methodDetail,
          pattern: toPattern(result),
        });
      }

      return {
        ok: true,
        recordId,
        chart,
        result,
        text: castToolText(chart, recordId),
      };
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  }

  /** 卦例列表 / 搜索 / 待反馈。 */
  function records(input = {}) {
    const rows = journal.listRecords({
      keyword: input.keyword ? String(input.keyword) : null,
      pendingOnly: !!input.pendingOnly || input.action === 'pending',
      method: input.method ? String(input.method) : null,
    });
    const settings = journal.getSettings();
    const missing = journal.recordsMissingNotes();
    const lines = [formatRecords(rows)];
    if (settings.autoNote && missing.length) {
      lines.push('');
      lines.push(`⚠️ 已反馈但还没有学习笔记的卦例：${missing.map((r) => '#' + r.id).join('、')}`);
      lines.push('设置「反馈后自动建笔记」已开启 → 请立即用 action="note" 逐条补建。');
    }
    return {
      ok: true,
      count: rows.length,
      records: rows,
      missingNotes: missing.map((r) => r.id),
      overview: journal.overview(),
      text: lines.join('\n'),
    };
  }

  /** 单条卦例详情。 */
  function detail(input = {}) {
    const record = journal.getRecord(input.id);
    if (!record) return fail(`未找到卦例 #${input.id}`);
    return { ok: true, record, text: formatRecords([record], true) };
  }

  /**
   * 写回推断过程、结论，以及外应两栏（用户所述 / AI 取象解读）。
   * 只传其中任意几项都可以，未传的字段保持原值。
   */
  function saveAnalysis(input = {}) {
    const okUpdated = journal.updateRecord(input.id, {
      question: input.question,
      analysis: input.analysis,
      conclusion: input.conclusion,
      waijing: input.waijing,
      // 工具参数是 snake_case（waijing_analysis），界面传 camelCase，两种都收。
      waijingAnalysis: input.waijingAnalysis ?? input.waijing_analysis,
    });
    if (!okUpdated) return fail(`未找到卦例 #${input.id}`);
    const saved = [];
    if (input.question !== undefined) saved.push('问题');
    if (input.analysis !== undefined) saved.push('推断过程');
    if (input.conclusion !== undefined) saved.push('结论');
    if (input.waijing !== undefined) saved.push('外应');
    if (input.waijingAnalysis !== undefined || input.waijing_analysis !== undefined) saved.push('外应解读');
    return {
      ok: true,
      id: Number(input.id),
      text: `卦例 #${input.id} 已更新：${saved.join('、') || '（没有可更新的字段）'}。`,
    };
  }

  /** 记录事后反馈。 */
  function feedback(input = {}) {
    const okUpdated = journal.addFeedback(input.id, {
      result: input.result ?? '',
      correct: !!input.correct,
      correctReason: input.correct ? input.reason ?? null : null,
      incorrectReason: input.correct ? null : input.reason ?? null,
      xiangAnalysis: input.xiangAnalysis ?? null,
    });
    if (!okUpdated) return fail(`未找到卦例 #${input.id}`);
    const autoNote = journal.getSettings().autoNote;
    const missing = journal.recordsMissingNotes();
    const lines = [`卦例 #${input.id} 已记录反馈：${input.correct ? '✅ 推断正确' : '❌ 推断错误'}`];
    if (autoNote) {
      lines.push('设置里「反馈后自动建笔记」是**开**：请立即用 action="note" 建立学习笔记（原因分析 / 教训 / 改进方向）。');
      if (missing.length) lines.push(`另有 ${missing.length} 条已反馈但缺笔记：${missing.map((r) => '#' + r.id).join('、')}`);
    } else {
      lines.push('（设置里「反馈后自动建笔记」是关；如需沉淀，请让用户说一声再建。）');
    }
    return { ok: true, id: Number(input.id), missingNotes: missing.map((r) => r.id), text: lines.join('\n') };
  }

  /** 复盘总结。 */
  function summary(input = {}) {
    const okUpdated = journal.addSummary(input.id, input.summary ?? '');
    if (!okUpdated) return fail(`未找到卦例 #${input.id}`);
    return { ok: true, id: Number(input.id), text: `卦例 #${input.id} 的复盘总结已保存。` };
  }

  /** 新增学习笔记。 */
  function note(input = {}) {
    const id = journal.addNote({
      recordId: input.recordId ?? input.id,
      correct: !!input.correct,
      questionType: input.question_type ?? '',
      reasonAnalysis: input.reason_analysis ?? '',
      lessonLearned: input.lesson ?? '',
      improvement: input.improvement ?? '',
    });
    return { ok: true, noteId: id, text: `学习笔记 #${id} 已创建。` };
  }

  /** 学习笔记列表。 */
  function notes(input = {}) {
    const rows = journal.listNotes();
    const filtered = input.incorrectOnly ? rows.filter((n) => !n.correct) : rows;
    return {
      ok: true,
      count: filtered.length,
      notes: filtered,
      stats: journal.noteStats(),
      text: formatNotes(filtered, !input.detailed),
    };
  }

  /**
   * 读取或更新设置（字号缩放 / 反馈后自动建笔记）。
   * 工具参数是 snake_case（font_scale / auto_note），界面传 camelCase，两种都收。
   */
  function settings(input = {}) {
    const patch = {};
    const scale = input.font_scale ?? input.fontScale;
    const autoNote = input.auto_note ?? input.autoNote;
    if (scale !== undefined) patch.fontScale = scale;
    if (autoNote !== undefined) patch.autoNote = autoNote;
    const current = Object.keys(patch).length ? journal.updateSettings(patch) : journal.getSettings();
    const missing = journal.recordsMissingNotes();
    const lines = [
      '⚙️ 梅花易数设置',
      `字号缩放：${current.fontScale}（1 = 标准）`,
      `反馈后自动建笔记：${current.autoNote ? '开' : '关'}`,
    ];
    if (current.autoNote && missing.length) {
      lines.push('');
      lines.push(`⚠️ 有 ${missing.length} 条已反馈但还没有笔记：${missing.map((r) => '#' + r.id).join('、')}`);
      lines.push('请立即用 action="note" 逐条补建。');
    }
    return { ok: true, settings: current, missingNotes: missing.map((r) => r.id), text: lines.join('\n') };
  }

  /** 学习统计。准确率按「现存卦例的反馈」计，删掉卦例就会跟着变。 */
  function noteStats() {
    const stats = journal.noteStats();
    const lines = [
      '📊 学习统计',
      `已反馈卦例：${stats.total}`,
      `正确：${stats.correct}`,
      `错误：${stats.incorrect}`,
      `准确率：${stats.accuracy}%`,
      `学习笔记：${stats.notes} 条`,
    ];
    if (stats.orphanNotes) lines.push(`（其中 ${stats.orphanNotes} 条笔记对应的卦例已删除，只作复盘材料，不计入准确率）`);
    if (stats.missingNotes) lines.push(`⚠️ 有 ${stats.missingNotes} 条已反馈卦例还没有笔记，请用 action="note" 补建。`);
    return { ok: true, stats, text: lines.join('\n') };
  }

  /**
   * 删除卦例。
   *
   * 默认只做「预览」：返回将被删除的清单，不动磁盘；必须显式传
   * `confirm: true` 才真正删除。这样 Agent 工具不会在用户没确认的情况下
   * 悄悄删掉卦例，界面也复用同一套筛选与删除实现。
   *
   * @param {{ids?: number[], id?: number, pendingOnly?: boolean, confirm?: boolean}} input
   */
  function removeRecords(input = {}) {
    const ids =
      Array.isArray(input.ids) && input.ids.length
        ? input.ids.map(Number).filter((n) => Number.isInteger(n))
        : input.id !== undefined && input.id !== null
          ? [Number(input.id)]
          : null;
    const pendingOnly = !!input.pendingOnly;

    if (!ids && !pendingOnly) {
      return fail('请指定要删除的卦例：传 ids（编号列表）、id（单条）或 pendingOnly=true（全部未反馈）。');
    }

    const targets = journal.selectForDeletion({ ids, pendingOnly });
    if (!targets.length) {
      return { ok: true, deleted: 0, count: 0, ids: [], text: '没有符合条件的卦例，未删除任何记录。' };
    }

    const targetIds = targets.map((r) => r.id);
    const listing = targets
      .map((r) => `#${r.id} ${r.question || '（未填写问题）'}${r.feedback ? '（已反馈）' : '（待反馈）'}`)
      .join('\n');

    if (input.confirm !== true) {
      return {
        ok: true,
        preview: true,
        deleted: 0,
        count: targets.length,
        ids: targetIds,
        text:
          `准备删除以下 ${targets.length} 条卦例（尚未执行，需要确认）：\n${listing}\n\n` +
          '确认请再次调用本操作并带上 confirm=true；学习笔记会保留。',
      };
    }

    const result = journal.deleteRecords(targetIds);
    return {
      ok: true,
      deleted: result.deleted,
      count: result.deleted,
      ids: targetIds,
      text:
        `已删除 ${result.deleted} 条卦例。` +
        (result.orphanedNotes
          ? `另有 ${result.orphanedNotes} 条学习笔记保留（作为复盘材料，未一并删除）。`
          : ''),
    };
  }

  /** 参考文档。 */
  function reference(input = {}) {
    const topic = String(input.topic || '').toLowerCase();
    const entry = REFERENCES[topic];
    if (!entry) {
      return fail(`未知的参考文档：${input.topic}。可用：${Object.keys(REFERENCES).join(' / ')}`);
    }
    try {
      const body = readFileSync(new URL(`../data/${entry.file}`, import.meta.url), 'utf8');
      return { ok: true, topic, label: entry.label, content: body, text: `【${entry.label}】\n\n${body}` };
    } catch (error) {
      return fail(`读取参考文档失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** 当前时刻（北京时间）与农历干支，供界面展示起卦时刻。 */
  function now() {
    const clock = bjtNow();
    const lunar = solarToLunar(clock.year, clock.month, clock.day);
    const lunarText = `${lunar.isLeap ? '闰' : ''}${lunarMonthName(lunar.lMonth)}${lunarDayName(lunar.lDay)}`;
    const gz = getGanzhi(clock.year, clock.month, clock.day, clock.hour);
    const pad = (n) => String(n).padStart(2, '0');
    return {
      ok: true,
      clock,
      castAt: `${clock.year}-${clock.month}-${clock.day} ${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}`,
      lunarText,
      ganzhiText: `${gz.year}年 ${gz.month}月 ${gz.day}日 ${gz.hour}时`,
    };
  }

  return { cast, records, detail, saveAnalysis, feedback, summary, removeRecords, note, notes, noteStats, settings, reference, now, toPattern };
}