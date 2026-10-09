/**
 * Agent 工具定义。
 *
 * 三个工具都只是 `lib/operations.js` 的薄封装，真正的算法与存储都在那边，
 * 与 Web 界面走的路由共用同一份实现。
 */
import { REFERENCES } from './protocol.js';

const text = (value) => [{ type: 'text', text: typeof value === 'string' ? value : value.text }];

/**
 * @param {ReturnType<import('./operations.js').createOperations>} ops
 */
export function createTools(ops) {
  /** 起卦排盘。 */
  const cast = {
    name: 'meihuayi_cast',
    description: [
      '梅花易数起卦并排盘。用户想要占卜、算卦、起卦、问吉凶、测事、卜一卦时使用。',
      '支持三种起卦方式：method="time"（按当前或指定时刻的农历年月日时起卦，用户没给数字时用这个）；',
      'method="number"（用户给出任意三位数 100-999 时用这个，如「258」「想用 187 起卦」）；',
      'method="char"（一字占/测字法：用户给出一个字时用这个，需先拆字算笔画再传 upperStrokes/lowerStrokes）。',
      '拆字规则：上下结构取上半/下半；左右结构取左半/右半；包围结构取外框/内核；独体字按总笔画对半分（奇数时下部多一画）。笔画按用户打字所用的简体或手写实际笔画计，AI 自己算，不要问用户要笔画数。',
      '返回完整排盘（干支、五行旺衰、主卦/互卦/变卦、动爻、体用生克）与 record_id，',
      '并附带必须遵守的两阶段断卦流程：先完整展示排盘并向用户询问「三要十应」外应，等用户回答后再推断。',
      '⚠️ 前置条件：**必须先有所问之事**（question 必填）。用户没写清楚就先问清楚，不得先排盘后补问题，也不要替用户编一个问题。',
      '起卦后不要立刻给出结论。',
    ].join(''),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        method: {
          type: 'string',
          enum: ['time', 'number', 'char'],
          description:
            '起卦方式。time=时间起卦（农历年月日时）；number=数字起卦（需给 number）；char=一字占（需给 upperStrokes/lowerStrokes）。',
        },
        upperStrokes: {
          type: 'integer',
          description: '一字占的上画数（上半/左半/外框的笔画数，1 起）。仅 method="char" 时必填。',
        },
        lowerStrokes: {
          type: 'integer',
          description: '一字占的下画数（下半/右半/内核的笔画数，1 起）。仅 method="char" 时必填。',
        },
        number: {
          type: 'integer',
          description: '数字起卦用的三位数 100-999（method="number" 时必填）。',
        },
        question: {
          type: 'string',
          description: '所问之事，尽量保留用户原话，如「这个月能不能拿到 offer」。',
        },
        datetime: {
          type: 'string',
          description: '起卦时刻（北京时间），格式 YYYY-MM-DD HH:mm。省略则用当前时间。仅 method="time" 时有意义。',
        },
        save: {
          type: 'boolean',
          description: '是否立即保存卦例草稿，默认 true。仅在用户明确说「只是练手、不用记录」时传 false。',
        },
      },
      required: ['method', 'question'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
          text: { type: 'string' },
          recordId: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
          chart: { type: 'string' },
          error: { type: 'string' },
        },
        required: ['ok', 'text', 'recordId', 'chart'],
      },
      render: (_args, value) => text(value),
    },
    async execute(args) {
      const r = ops.cast(args);
      if (!r.ok) return { ok: false, text: `起卦失败：${r.error}`, recordId: null, chart: '', error: r.error };
      return { ok: true, text: r.text, recordId: r.recordId, chart: r.chart };
    },
  };

  /** 卦例与学习笔记。 */
  const journal = {
    name: 'meihuayi_journal',
    description: [
      '梅花易数卦例库与学习笔记。用于：把推断过程和结论写回卦例（action="update"）；',
      '查询历史卦例（list/query/pending/detail）；记录事后反馈（feedback）；写复盘总结（summary）；' +
      '删除卦例（delete，支持 ids 多选或 pendingOnly 清空未反馈，必须先预览再带 confirm=true 确认）；',
      '建立学习笔记（note）；查看笔记与准确率（notes/note_stats）。',
      '规范要求：断卦完成后必须用 update 写回 analysis 与 conclusion，' +
      '并把用户回答的外应原文（waijing）与你的取象解读（waijing_analysis）一并写回；' +
      '用户回报结果后必须用 feedback 记录，并紧接着用 note 建立学习笔记。',
    ].join(''),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'query', 'pending', 'detail', 'update', 'feedback', 'delete', 'summary', 'note', 'notes', 'note_stats', 'settings'],
          description:
            'list=全部卦例；query=按关键词搜索（用 keyword）；pending=未反馈的卦例；detail=某条详情（用 id）；' +
            'update=写回推断、结论与外应（id + analysis + conclusion + waijing + waijing_analysis）；feedback=记录实际结果（id + result + correct + reason）；' +
            'summary=复盘总结（id + summary）；note=新增学习笔记（recordId + correct + reason_analysis + lesson + improvement）；' +
            'notes=查看学习笔记；note_stats=准确率统计；' +
            'settings=读取或修改设置（font_scale 字号缩放 0.5–2、auto_note 反馈后是否自动建笔记）。',
        },
        id: { type: 'integer', description: '卦例编号，detail/update/feedback/summary/delete 使用。' },
        ids: {
          type: 'array',
          items: { type: 'integer' },
          description: 'delete：要删除的卦例编号列表（多选）。与 id、pendingOnly 三者只需给一个。',
        },
        pendingOnly: {
          type: 'boolean',
          description: 'delete：删除全部「未反馈」的卦例（一键清理）。',
        },
        confirm: {
          type: 'boolean',
          description:
            'delete：必须显式传 true 才真正删除。不传时只返回将被删除的清单（预览），不改动任何数据；请先把清单给用户看并得到同意，再传 true 重试。',
        },
        keyword: { type: 'string', description: 'query 用的搜索关键词（匹配问题原文）。' },
        question: { type: 'string', description: 'update：订正卦例的「所问之事」（起卦时留空或写错时用）。' },
        analysis: { type: 'string', description: 'update：完整推断过程（按体用/取象/动爻/外应/综合/结论分节）。' },
        waijing: {
          type: 'string',
          description: 'update：用户回答的「外应」原文（三要十应：天时/地理/人事/声音/颜色/器物/动静），照原话记，别改写。',
        },
        waijing_analysis: {
          type: 'string',
          description: 'update：你对这些外应的取象解读（哪一条对应什么事、与卦象是印证还是相悖）。',
        },
        conclusion: { type: 'string', description: 'update：给出的结论与建议。' },
        result: { type: 'string', description: 'feedback：实际发生了什么。' },
        correct: { type: 'boolean', description: 'feedback/note：推断是否正确。' },
        reason: { type: 'string', description: 'feedback：正确或错误的原因。' },
        xiangAnalysis: { type: 'string', description: 'feedback：取象分析是否正确、偏在哪里。' },
        summary: { type: 'string', description: 'summary：复盘总结正文。' },
        recordId: { type: 'integer', description: 'note：关联的卦例编号。' },
        question_type: { type: 'string', description: 'note：问题类型，如「求职」「感情」「出行」。' },
        reason_analysis: { type: 'string', description: 'note：原因分析。' },
        lesson: { type: 'string', description: 'note：教训总结。' },
        improvement: { type: 'string', description: 'note：改进方向。' },
        font_scale: { type: 'number', description: 'settings：界面字号缩放，0.5–2，1 为标准。' },
        auto_note: {
          type: 'boolean',
          description:
            'settings：是否在用户填写反馈后自动建立学习笔记。开启时，发现「已反馈但没有笔记」的卦例必须立即用 action="note" 补建。',
        },
        incorrectOnly: { type: 'boolean', description: 'notes：只看判断错误的笔记。' },
        detailed: { type: 'boolean', description: 'notes：是否逐条详细展开。' },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
          text: { type: 'string' },
          error: { type: 'string' },
        },
        required: ['ok', 'text'],
      },
      render: (_args, value) => text(value),
    },
    async execute(args) {
      switch (args.action) {
        case 'list':
        case 'query':
          return pack(ops.records({ keyword: args.keyword }));
        case 'pending':
          return pack(ops.records({ pendingOnly: true }));
        case 'detail':
          return pack(ops.detail(args));
        case 'update':
          return pack(ops.saveAnalysis(args));
        case 'feedback':
          return pack(ops.feedback(args));
        case 'delete':
          return pack(ops.removeRecords(args));
        case 'summary':
          return pack(ops.summary(args));
        case 'note':
          return pack(ops.note(args));
        case 'notes':
          return pack(ops.notes(args));
        case 'note_stats':
          return pack(ops.noteStats());
        case 'settings':
          return pack(ops.settings(args));
        default:
          return { ok: false, text: `未知操作：${args.action}`, error: 'unknown-action' };
      }
    },
  };

  /** 参考文档。 */
  const reference = {
    name: 'meihuayi_reference',
    description: [
      '梅花易数断卦参考文档。断卦前建议先读 sanyao（三要十应，心法要诀，断卦必读）；',
      '取象拿不准时读 leixiang（八卦万物类象）；推断思路卡住时读 jiegua（解卦技巧）。',
    ].join(''),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        topic: {
          type: 'string',
          enum: Object.keys(REFERENCES),
          description: `文档：${Object.entries(REFERENCES)
            .map(([k, v]) => `${k}=${v.label}`)
            .join('；')}。`,
        },
      },
      required: ['topic'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
          text: { type: 'string' },
          error: { type: 'string' },
        },
        required: ['ok', 'text'],
      },
      render: (_args, value) => text(value),
    },
    async execute(args) {
      return pack(ops.reference(args));
    },
  };

  return [cast, journal, reference];
}

function pack(result) {
  if (!result.ok) return { ok: false, text: `操作失败：${result.error}`, error: result.error };
  return { ok: true, text: result.text };
}
