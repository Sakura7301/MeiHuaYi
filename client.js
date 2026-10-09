/**
 * 梅花易数卜卦插件 —— Web Client 半边。
 *
 * 两个注册点：
 *  · `conversation.composer.dock` —— 输入框下方的常驻入口（☯ 梅花易数 / 点击起卦）；
 *  · `shell.overlay`             —— 起卦面板本体（卦象可视化 + 卦例库）。
 *
 * 面板只做展示与交互，排盘与存储全部走宿主 `/meihuayi/api`（见 lib/routes.js），
 * 与 Agent 工具共用同一份实现，所以「点出来的卦」和「聊出来的卦」必然一致。
 */
window.__ModuleLoader__.load({
  id: '@sakura7301/dsh-meihuayi',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'meihuayi';
    /** 界面上会显示这个版本号，便于确认页面上跑的是哪一版前端代码。 */
    const VERSION = '1.2.3';

    /**
     * 五行配色令牌（背景 / 前景 / 描边，各含明暗两套取值）。
     *
     * 用「背景色块」而不是「前景文字色」来标五行：
     *  · 传统配色里「金=白、水=黑」，当文字色用时，白字在亮色主题、
     *    黑字在暗色主题下都会消失（之前借用的 --dsw-alias-brand-primary
     *    在亮色下就是近黑，所以「水」看起来没有颜色）；
     *  · 做成色块后，颜色由背景承担，文字只需保证与背景的对比度，
     *    同一套传统配色在明暗两套主题下都能看清。
     * 颜色本身按传统取：木绿、火红、土黄、金白、水黑。
     */
    /* ══════════════════════════════════════════
     *  文案
     * ══════════════════════════════════════════ */
    const ZH = {
      trigger: '梅花易数',
      title: '梅花易数卜卦',
      subtitle: '心诚则灵 · 起卦后请先回答外应，再行推断',
      collapse: '收起',
      tabCast: '起卦',
      tabJournal: '卦例',
      tabNotes: '笔记',
      tabSettings: '设置',
      allNotes: '全部',
      incorrectOnly: '只看错题',
      noteCorrect: '正确',
      noteWrong: '错误',
      noNotes: '还没有学习笔记。回报结果后 AI 会建立笔记（可在设置里开启「反馈后自动建笔记」）。',
      reasonAnalysis: '原因',
      lessonLearned: '教训',
      improvement: '改进',
      feedbackSaved: '反馈已保存。',
      wakeFailed: '但唤醒 AI 失败：',
      feedbackSavedAutoNote: '反馈已保存；AI 下次读卦例会看到这条「已反馈但还没有笔记」并立即补建。',
      fontSize: '界面字号',
      fontSizeHint: '只影响这个面板的显示大小，不影响卦例数据。',
      scaleSmall: '小',
      scaleNormal: '标准',
      scaleLarge: '大',
      scaleXLarge: '特大',
      autoNote: '反馈后自动建立学习笔记',
      autoNoteHint:
        '开启后：你在卦例里填完反馈并保存，AI 下次读卦例时会看到「已反馈但还没有笔记」并立即补建。' +
        '注意 AI 不会自己启动——需要你下一次跟它说话时才会执行。',
      settingsSaved: '设置已保存',
      question: '所问之事',
      questionPlaceholder: '例如：这个月能不能拿到 offer（必填，写清问什么）',
      questionRequired: '起卦前请先写下所问之事——问题不清，卦不应。',
      method: '起卦方式',
      methodTime: '时间起卦',
      methodTimeDesc: '以当前时刻的农历年支、月、日、时起卦',
      methodNumber: '数字起卦',
      methodNumberDesc: '心中默念所问之事，给出一个三位数，或点「随机取数」',
      methodChar: '一字占',
      methodCharDesc: '写下一个字，交给 AI 拆字算笔画起卦（测字法）',
      charPlaceholder: '一个字，如：想',
      charHint: '拆字与笔画由 AI 判断：上下结构取上半/下半，左右取左半/右半，包围取外框/内核，独体字按总笔画对半分。',
      charEcho: '已把「{char}」交给 AI 拆字起卦，请看对话。',
      cuoguaRow: '错卦',
      cuoguaNote: '六爻全翻，看反面与隐藏面',
      zongguaRow: '综卦',
      zongguaFixed: '覆卦不动',
      zongguaNote: '上下颠倒，换对方视角',
      kongwangRow: '空亡',
      kongHitRow: '逢空',
      shenshaRow: '神煞',
      notHit: '未中',
      charMethodName: '一字占',
      charChatHead: '【梅花易数 · 一字占】',
      charChatAsk: '请按字占章法拆这个字、算出两部分笔画，再用 meihuayi_cast（method="char"）起卦；',
      charChatFlow: '起卦后先完整展示排盘，再问我起卦时的外应（天时/地理/人事/声音/颜色/器物/动静），这一步先别推断。',
      charChatSave: '断完记得把外应原文与取象解读写回卦例。',
      charChatGuard: '（若 meihuayi_cast 忽略 method="char"、回退成时间起卦，说明宿主还没重启，请先提示我重启再起卦。）',
      charQuestion: '问：',
      charRequired: '请先写下一个字，再起卦。',
      charTarget: '所测之字：',
      charManual: '无法自动发送，请手动发送上面的内容。',
      charCopied: '已复制内容，粘贴到输入框发送即可。',
      numberPlaceholder: '三位数 100-999',
      randomDraw: '随机取数',
      cast: '起 卦',
      casting: '起卦中…',
      copyChart: '复制排盘',
      copied: '已复制',
      chart: '排盘',
      ben: '主卦',
      hu: '互卦',
      bian: '变卦',
      body: '体',
      use: '用',
      moving: '动',
      dongyao: '动爻',
      wuxing: '五行旺衰',
      ganzhi: '干支',
      relation: '体用',
      loading: '正在获取…',
      all: '全部',
      pending: '待反馈',
      refresh: '刷新',
      empty: '还没有卦例。起一卦吧。',
      back: '返回列表',
      analysis: '推断过程',
      conclusion: '结论',
      analysisNone: '（尚未推断，可以让 AI 断卦后用 meihuayi_journal 写回）',
      detailChart: '排盘',
      detailFeedback: '反馈',
      fbResult: '实际结果',
      fbResultPlaceholder: '事情后来实际是怎么发展的？',
      fbCorrect: '推断正确',
      fbIncorrect: '推断错误',
      fbReason: '原因 / 取象复盘',
      fbReasonPlaceholder: '哪一步对了或错了？体用？旺衰？取象？外应？',
      submit: '保存反馈',
      saving: '保存中…',
      accuracy: '准确率',
      ratedCount: '条已反馈',
      notes: '条学习笔记',
      records: '条卦例',
      pendingCount: '条待反馈',
      waijingSection: '外应',
      waijingUser: '用户所述',
      waijingAi: '取象解读',
      waijingNone: '（还没有记录）',
      askAi: '请 AI 解卦',
      askAiTitle: '把这份排盘发进对话，让 AI 按梅花易数规范先问外应再断卦',
      castTime: '时间',
      wuxingShort: '旺衰',
      methodLabel: '起卦方式',
      questionRow: '问题',
      questionPlaceholder: '这一卦你问的是什么？',
      saveQuestion: '保存问题',
      questionChanged: '有未保存的修改',
      questionSaved: '问题已保存',
      relationLabel: '体用关系',
      selectAll: '全选',
      selectedLabel: '已选',
      unitRecords: '条',
      deleteSelected: '删除选中',
      deletePending: '一键删除未反馈',
      deleteOne: '删除这一条',
      confirmHead: '确认删除',
      confirmTail: '？共 {n} 条，删除后不可恢复（学习笔记会保留）。',
      confirmDelete: '确认删除',
      cancelAction: '取消',
      labelSelected: '选中的卦例',
      labelPending: '全部未反馈的卦例',
    };
    const EN = {
      trigger: 'Plum Blossom',
      title: 'Plum Blossom Divination',
      subtitle: 'Cast first, answer the omens, then read the hexagram',
      collapse: 'Collapse',
      tabCast: 'Cast',
      tabJournal: 'Journal',
      tabNotes: 'Notes',
      tabSettings: 'Settings',
      allNotes: 'All',
      incorrectOnly: 'Wrong only',
      noteCorrect: 'Correct',
      noteWrong: 'Wrong',
      noNotes: 'No study notes yet. The AI writes one after you report the result (enable "Create a study note after feedback" in Settings).',
      reasonAnalysis: 'Reason',
      lessonLearned: 'Lesson',
      improvement: 'Improve',
      feedbackSaved: 'Feedback saved.',
      wakeFailed: ' but waking the AI failed: ',
      feedbackSavedAutoNote: 'Feedback saved. The AI will see "feedback recorded but no note yet" next time it reads the journal and write the note.',

      fontSize: 'Text size',
      fontSizeHint: 'Affects only how this panel renders, not the journal data.',
      scaleSmall: 'S',
      scaleNormal: 'M',
      scaleLarge: 'L',
      scaleXLarge: 'XL',
      autoNote: 'Create a study note after feedback',
      autoNoteHint:
        'When on, the AI will notice "feedback recorded but no note yet" the next time it reads the journal ' +
        'and fill the note in. The AI cannot start on its own — it runs when you next talk to it.',
      settingsSaved: 'Saved',
      question: 'Your question',
      questionPlaceholder: 'e.g. Will I get the offer this month? (optional)',
      method: 'Method',
      methodTime: 'By time',
      methodTimeDesc: 'Uses the lunar year branch, month, day and hour of this moment',
      methodNumber: 'By number',
      methodNumberDesc: 'Hold the question in mind and give a 3-digit number, or draw one',
      methodChar: 'By one character',
      methodCharDesc: 'Give a single character; the AI splits it and counts strokes',
      charPlaceholder: 'One character, e.g. 想',
      charHint: 'The AI splits it: top/bottom, left/right, outer/inner, or an even half for unsplittable characters.',
      charEcho: '「{char}」 sent to the AI to split and cast — see the conversation.',
      cuoguaRow: 'Inverse',
      cuoguaNote: 'All six lines flipped — the hidden, opposite side',
      zongguaRow: 'Reversed',
      zongguaFixed: 'self-reversing',
      zongguaNote: 'Turned upside down — the other party\'s view',
      kongwangRow: 'Void',
      kongHitRow: 'Void hit',
      shenshaRow: 'Stars',
      notHit: 'none',
      charMethodName: 'By character',
      charChatHead: '[Meihua Yishu - one-character divination]',
      charChatAsk: 'Split this character by the classical rules, count both parts, then cast with meihuayi_cast (method="char").',
      charChatFlow: 'Show the full chart first, then ask me for the omens (weather/place/people/sound/colour/objects/motion) — do not infer yet.',
      charChatSave: 'After inferring, write the omens and your reading back into the record.',
      charChatGuard: '(If meihuayi_cast ignores method="char" and falls back to a time cast, the host has not been restarted — ask me to restart first.)',
      charQuestion: 'Question: ',
      charRequired: 'Write one character first.',
      charTarget: 'Character: ',
      charManual: 'Could not send automatically — please send it yourself.',
      charCopied: 'Copied — paste it into the composer and send.',
      numberPlaceholder: '3 digits, 100-999',
      randomDraw: 'Draw a number',
      cast: 'Cast',
      casting: 'Casting…',
      copyChart: 'Copy chart',
      copied: 'Copied',
      chart: 'Chart',
      ben: 'Primary',
      hu: 'Mutual',
      bian: 'Changed',
      body: 'Body',
      use: 'Use',
      moving: 'Moving',
      dongyao: 'Moving line',
      wuxing: 'Five-element strength',
      ganzhi: 'Stems & branches',
      relation: 'Body–Use',
      loading: 'Loading…',
      all: 'All',
      pending: 'Unresolved',
      refresh: 'Refresh',
      empty: 'No records yet. Cast one.',
      back: 'Back to list',
      analysis: 'Reasoning',
      conclusion: 'Conclusion',
      analysisNone: '(not read yet)',
      detailChart: 'Chart',
      detailFeedback: 'Feedback',
      fbResult: 'What actually happened',
      fbResultPlaceholder: 'How did it actually turn out?',
      fbCorrect: 'The reading was right',
      fbIncorrect: 'The reading was wrong',
      fbReason: 'Why / what the imagery got wrong',
      fbReasonPlaceholder: 'Body–Use? Seasonal strength? Imagery? Omens?',
      submit: 'Save feedback',
      saving: 'Saving…',
      accuracy: 'Accuracy',
      ratedCount: 'rated',
      notes: 'study notes',
      records: 'records',
      pendingCount: 'unresolved',
      waijingSection: 'Omens (外应)',
      waijingUser: 'User reported',
      waijingAi: 'Reading',
      waijingNone: '(not recorded yet)',
      askAi: 'Ask the AI to read it',
      askAiTitle: 'Send this chart to the conversation so the AI asks for the omens before reading it',
      castTime: 'Time',
      wuxingShort: 'Strength',
      methodLabel: 'Method',
      questionRow: 'Question',
      questionPlaceholder: 'e.g. Will I get the offer this month? (required)',
      questionRequired: 'Write down your question before casting — an unclear question gets no clear answer.',
      saveQuestion: 'Save question',
      questionChanged: 'Unsaved changes',
      questionSaved: 'Question saved',
      relationLabel: 'Body / Use',
      selectAll: 'Select all',
      selectedLabel: 'Selected',
      unitRecords: '',
      deleteSelected: 'Delete selected',
      deletePending: 'Delete all unresolved',
      deleteOne: 'Delete this record',
      confirmHead: 'Delete',
      confirmTail: '? {n} record(s) will be removed permanently (study notes are kept).',
      confirmDelete: 'Delete',
      cancelAction: 'Cancel',
      labelSelected: ' the selected records',
      labelPending: ' all unresolved records',
    };

    /* ══════════════════════════════════════════
     *  状态（模块级：被两个注册点共享）
     * ══════════════════════════════════════════ */
    const listeners = new Set();
    let state = {
      open: false,
      tab: 'cast',
      method: 'time',
      question: '',
      number: '',
      char: '',
      busy: false,
      error: '',
      notice: '',
      cast: null, // ops.cast 的返回值
      clock: null,
      records: null,
      overview: null,
      detail: null,
      detailId: null,
      filterPending: false,
      feedback: { result: '', correct: true, reason: '' },
      saving: false,
      /** 勾选的卦例编号（字符串形式，便于与 DOM 值比较）。 */
      selected: [],
      /** 待确认的删除请求；为 null 表示没有待确认操作。 */
      confirm: null,
      /** 设置（宿主存储，AI 也读得到）：字号缩放 + 反馈后自动建笔记。 */
      settings: { fontScale: 1, autoNote: false },
      settingsLoaded: false,
      /** 详情页里「问题」的编辑草稿。 */
      questionDraft: '',
      /** 学习笔记页。 */
      notes: null,
      noteStats: null,
      notesIncorrectOnly: false,
    };
    /** 输入框控制器由 composer dock 提供，面板借它把排盘填进对话。 */
    let inputActions = null;
    /** 当前会话 id（由 dock slot 提供）：保存反馈时带给宿主，宿主用它唤醒 AI 建笔记。 */
    let sessionId = null;

    function setState(patch) {
      state = { ...state, ...patch };
      for (const l of listeners) l();
    }
    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
    const getSnapshot = () => state;
    function useStore() {
      return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    }
    /** 定时器只用于刷新「当前时刻」显示，关闭面板即清理。 */
    function useTicker(active) {
      React.useEffect(() => {
        if (!active) return undefined;
        let cancelled = false;
        const tick = () => {
          fetchNow().then((r) => {
            if (!cancelled && r) setState({ clock: r });
          });
        };
        tick();
        const id = setInterval(tick, 30000);
        return () => {
          cancelled = true;
          clearInterval(id);
        };
      }, [active]);
    }

    /* ══════════════════════════════════════════
     *  宿主调用
     * ══════════════════════════════════════════ */
    function apiPath() {
      const relative = `${NS}/api`.replace(/^\/+/, '');
      if (typeof document === 'undefined') return `/${relative}`;
      return new URL(relative, document.baseURI).pathname;
    }
    async function api(action, payload = {}) {
      const res = await fetch(apiPath(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      let json;
      try {
        json = await res.json();
      } catch {
        throw new Error(`宿主返回了无法解析的响应（HTTP ${res.status}）`);
      }
      if (!json || json.ok === false) throw new Error((json && json.error) || `请求失败（HTTP ${res.status}）`);
      return json;
    }
    const fetchNow = () => api('now').catch(() => null);

    /* ══════════════════════════════════════════
     *  动作
     * ══════════════════════════════════════════ */
    async function doCast() {
      const { method, number, question } = state;
      // 一字占：面板不自己排盘，把字交给对话里的 AI 拆字算笔画，再由它调 meihuayi_cast。
      if (method === 'char') {
        const ch = String(state.char || '').trim();
        if (!ch) return setState({ error: t('charRequired') });
        if (!String(question || '').trim()) return setState({ error: t('questionRequired') });
        fillChatChar(ch);
        return;
      }
      if (method === 'number') {
        const n = String(number).trim();
        if (!/^\d{3}$/.test(n)) {
          setState({ error: '数字起卦需要三位数（100-999）。' });
          return;
        }
      }
      setState({ busy: true, error: '', notice: '', detail: null, detailId: null });
      try {
        const payload = { method, question };
        if (method === 'number') payload.number = Number(String(number).trim());
        const result = await api('cast', payload);
        setState({ cast: result, busy: false, records: null });
      } catch (error) {
        setState({ busy: false, error: error.message });
      }
    }

    async function doRandomCast() {
      const n = 100 + Math.floor(Math.random() * 900);
      setState({ number: String(n), method: 'number' });
      await doCast();
    }

    async function loadRecords() {
      setState({ busy: true, error: '' });
      try {
        const result = await api('records', { pendingOnly: state.filterPending });
        setState({ records: result.records, overview: result.overview, busy: false });
      } catch (error) {
        setState({ busy: false, error: error.message });
      }
    }

    async function openDetail(id) {
      setState({ busy: true, error: '' });
      try {
        const result = await api('detail', { id });
        setState({
          detail: result.record,
          detailId: id,
          // 问题可编辑：草稿随详情一起载入，保存后刷新
          questionDraft: result.record.question || '',
          busy: false,
          feedback: { result: '', correct: true, reason: '' },
        });
      } catch (error) {
        setState({ busy: false, error: error.message });
      }
    }

    async function submitFeedback() {
      const fb = state.feedback;
      if (!state.detailId) return;
      setState({ saving: true, error: '' });
      try {
        const res = await api('feedback', {
          id: state.detailId,
          result: fb.result,
          correct: fb.correct,
          reason: fb.reason,
          // 带上会话 id：设置里开着「反馈后自动建笔记」时，宿主会用它直接唤醒 AI
          sessionId,
        });
        await openDetail(state.detailId);
        // 宿主会回一个 wake 字段说明唤醒结果（没有该字段 = 没开自动建笔记）
        setState({
          saving: false,
          notice: res.wake
            ? `${t('feedbackSaved')}${t('wakeFailed')}${res.wake}`
            : state.settings.autoNote
              ? t('feedbackSavedAutoNote')
              : t('feedbackSaved'),
        });
        if (state.records) await loadRecords();
      } catch (error) {
        setState({ saving: false, error: error.message });
      }
    }

    /* ── 删除卦例 ─────────────────────────────
     * 与宿主是同一条实现：/meihuayi/api 的 delete 动作 → lib/operations.js。
     * 界面上永远是「先确认、再删除」——askDelete 只记录意图，runDelete 才真的发请求。
     */
    function toggleSelect(id) {
      const key = String(id);
      setState({
        selected: state.selected.includes(key)
          ? state.selected.filter((x) => x !== key)
          : [...state.selected, key],
        confirm: null,
      });
    }

    /** 只登记删除意图；真正删除要点确认栏里的按钮。 */
    function askDelete(spec) {
      setState({ confirm: spec, error: '', notice: '' });
    }

    async function runDelete() {
      const pending = state.confirm;
      if (!pending) return;
      setState({ busy: true, error: '', notice: '' });
      try {
        const payload = { confirm: true };
        if (pending.ids) payload.ids = pending.ids;
        else if (pending.pendingOnly) payload.pendingOnly = true;
        const result = await api('delete', payload);
        setState({
          busy: false,
          confirm: null,
          selected: [],
          detail: null,
          detailId: null,
          records: null,
          overview: null,
          notice: result.text,
        });
      } catch (error) {
        setState({ busy: false, error: error.message });
      }
    }

    /** 保存详情页里改过的「问题」。 */
    async function saveQuestion() {
      if (!state.detailId) return;
      setState({ saving: true, error: '', notice: '' });
      try {
        await api('update', { id: state.detailId, question: state.questionDraft });
        await openDetail(state.detailId);
        setState({ saving: false, notice: t('questionSaved'), records: null });
      } catch (error) {
        setState({ saving: false, error: error.message });
      }
    }

    /** 删除确认条：列表页与详情页共用。 */
    function ConfirmBar() {
      const s = useStore();
      if (!s.confirm) return null;
      return h(
        'div',
        { className: 'mhy-confirm' },
        h('span', null, `${t('confirmHead')}${s.confirm.label}${t('confirmTail').replace('{n}', String(s.confirm.count))}`),
        h(
          'button',
          { type: 'button', className: 'mhy-btn mhy-btn-sm mhy-btn-danger', onClick: runDelete, disabled: s.busy },
          t('confirmDelete'),
        ),
        h('button', { type: 'button', className: 'mhy-btn mhy-btn-sm', onClick: () => setState({ confirm: null }) }, t('cancelAction')),
      );
    }

    /** 读取学习笔记（全部 / 只看错题）。 */
    async function loadNotes() {
      setState({ busy: true, error: '' });
      try {
        const r = await api('notes', { incorrectOnly: !!state.notesIncorrectOnly });
        setState({ busy: false, notes: r.notes || [], noteStats: r.stats || null });
      } catch (error) {
        setState({ busy: false, error: error.message });
      }
    }

    /** 读取设置（宿主存储，AI 也读同一份）。 */
    async function loadSettings() {
      try {
        const r = await api('settings');
        setState({ settings: r.settings, settingsLoaded: true });
      } catch (error) {
        setState({ settingsLoaded: true, error: error.message });
      }
    }

    /** 改设置：先本地生效（界面立刻响应），再落盘。 */
    async function saveSettings(patch) {
      setState({ settings: { ...state.settings, ...patch }, error: '', notice: '' });
      try {
        const r = await api('settings', patch);
        setState({ settings: r.settings, notice: t('settingsSaved') });
      } catch (error) {
        setState({ error: error.message });
      }
    }

    function fillChatChar(ch) {
      const text = [
        t('charChatHead'),
        `${t('charQuestion')}${state.question || '（未填写）'}`,
        `${t('charTarget')}${ch}`,
        '',
        t('charChatAsk'),
        t('charChatFlow'),
        t('charChatSave'),
        t('charChatGuard'),
      ].join('\n');
      if (inputActions && typeof inputActions.setDraft === 'function') {
        const actions = inputActions;
        actions.setDraft(text);
        if (typeof actions.submit === 'function') {
          setTimeout(() => {
            try {
              actions.submit();
              setState({ open: false, notice: t('charEcho').replace('{char}', ch), char: '', cast: null });
            } catch (error) {
              setState({ notice: `${t('charManual')}${error.message}` });
            }
          }, 0);
          return;
        }
        setState({ notice: t('charManual') });
        return;
      }
      copy(text).then((okay) => setState({ notice: okay ? t('charCopied') : t('charManual') }));
    }

    function fillChat() {
      const current = state.cast;
      if (!current) return;
      const text = [
        '【梅花易数 · 请替我断这一卦】',
        `问：${current.result.question || state.question || '（未填写）'}`,
        '',
        current.chart,
        '',
        '请先完整展示这份排盘，然后按「三要十应」问我起卦时的外应（天时/地理/人事/声音/颜色/器物/动静）；',
        '这一步只问我外应、先别推断，等我回答后再按体用生克、取象、动爻、外应验证的顺序断卦。',
        '断完记得把外应原文与你的取象解读一并写回卦例（waijing / waijing_analysis）。',
      ].join('\n');
      if (inputActions && typeof inputActions.setDraft === 'function') {
        const actions = inputActions;
        actions.setDraft(text);
        if (typeof actions.submit === 'function') {
          // setDraft 是编辑器状态写入，submit 要读到新草稿，所以让出一帧再提交。
          setTimeout(() => {
            try {
              actions.submit();
              // 排盘已经存进卦例，面板里清掉，避免下次打开还是旧卦
              setState({ open: false, notice: '', cast: null });
            } catch (error) {
              setState({ notice: `自动发送失败，请按回车：${error.message}` });
            }
          }, 0);
          return;
        }
        setState({ notice: '已填入输入框，按回车发送' });
      } else {
        copy(text).then((okay) => setState({ notice: okay ? '已复制排盘，粘贴到输入框即可' : '无法填入输入框，请手动复制' }));
      }
    }

    async function copy(value) {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
          return true;
        }
      } catch {
        /* 回退到 execCommand */
      }
      try {
        const area = document.createElement('textarea');
        area.value = value;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const okay = document.execCommand('copy');
        area.remove();
        return okay;
      } catch {
        return false;
      }
    }

    /* ══════════════════════════════════════════
     *  样式（组件内渲染，卸载即移除）
     * ══════════════════════════════════════════ */
    const CSS = `
/* 入口本身保持按钮的自然宽度：dock 那一行是 nowrap 居中的 flex，
   一旦让这个格子变宽就会把同一行的其他控件挤开，所以面板绝不参与这行布局。 */
.mhy-dock{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.mhy-dock-btn{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 10px;white-space:nowrap;font:inherit;font-size:calc(12px * var(--mhy-s,1));line-height:1;color:var(--dsw-alias-label-secondary);background:transparent;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;cursor:pointer}
.mhy-dock-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.mhy-dock-icon{color:var(--dsw-alias-brand-primary);font-size:calc(13px * var(--mhy-s,1));line-height:1}
/* 面板向上弹出：fixed 定位 + 运行时量出的坐标（贴在按钮上方、宽度对齐整条 dock 行），
   既不占文档流、不受祖先 overflow 裁剪，也不会影响同一行的其它控件。 */
.mhy-panel{--mhy-wx-wood-bg:#15803d;--mhy-wx-wood-fg:#ffffff;--mhy-wx-wood-bd:#15803d;--mhy-wx-fire-bg:#d43b3b;--mhy-wx-fire-fg:#ffffff;--mhy-wx-fire-bd:#d43b3b;--mhy-wx-earth-bg:#e9c046;--mhy-wx-earth-fg:#3d2f00;--mhy-wx-earth-bd:#bf9610;--mhy-wx-metal-bg:#ffffff;--mhy-wx-metal-fg:#2b3138;--mhy-wx-metal-bd:#9aa5b1;--mhy-wx-water-bg:#1c2026;--mhy-wx-water-fg:#f4f7fa;--mhy-wx-water-bd:#1c2026;--mhy-bar:#20262b;--mhy-bar-edge:rgba(255,255,255,.55);--mhy-accent:#14181c;--mhy-body-bg:#3f4753;--mhy-body-bd:#3f4753;--mhy-body-fg:#ffffff;--mhy-use-bd:#98a2ad;--mhy-use-fg:#3a424c;position:fixed;z-index:60;display:flex;flex-direction:column;max-height:min(62vh,600px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.16);overflow:hidden;font-size:calc(13px * var(--mhy-s,1))}
.mhy-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.mhy-head h2{margin:0;font-size:calc(15px * var(--mhy-s,1));font-weight:600}
.mhy-head .mhy-sub{color:var(--dsw-alias-label-secondary);font-size:calc(12px * var(--mhy-s,1))}
.mhy-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;margin-left:auto;padding:0;font:inherit;font-size:calc(13px * var(--mhy-s,1));line-height:1;color:var(--dsw-alias-label-secondary);background:transparent;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;cursor:pointer}
.mhy-iconbtn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.mhy-scale{margin-top:6px}
.mhy-checkline{display:flex;align-items:flex-start;gap:8px;margin-top:18px;font-size:calc(14px * var(--mhy-s,1));color:var(--dsw-alias-label-primary);cursor:pointer}
.mhy-hint{margin-top:6px;font-size:calc(12px * var(--mhy-s,1));line-height:1.7;color:var(--dsw-alias-label-secondary)}
.mhy-notecard{margin-top:0}
.mhy-note-sec{margin-top:7px;font-size:calc(12.5px * var(--mhy-s,1));line-height:1.7;color:var(--dsw-alias-label-primary);white-space:pre-wrap}
.mhy-note-sec b{margin-right:6px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.mhy-tabs{display:flex;gap:4px;padding:10px 16px 0}
.mhy-tab{padding:5px 12px;font:inherit;font-size:calc(13px * var(--mhy-s,1));color:var(--dsw-alias-label-secondary);background:transparent;border:1px solid transparent;border-radius:8px;cursor:pointer}
.mhy-tab[data-on="1"]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.mhy-body{padding:12px 16px 16px;overflow:auto}
.mhy-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.mhy-label{font-size:calc(13px * var(--mhy-s,1));color:var(--dsw-alias-label-secondary);min-width:64px}
.mhy-input,.mhy-area{width:100%;box-sizing:border-box;font:inherit;font-size:calc(13px * var(--mhy-s,1));color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:7px 9px}
.mhy-area{min-height:52px;resize:vertical}
.mhy-area-sm{min-height:38px}
.mhy-input:focus,.mhy-area:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.mhy-num{width:120px;letter-spacing:3px;text-align:center}
/* ══ 按钮：自带底色与字色，不引用 --dsw-* 令牌 ══
   以前主按钮是「背景=brand-primary、文字=bg-base」，主题插件一改这俩令牌
   就会出现同色/近色，文字看不见。现在每个状态都有实底色，对比度均 ≥5:1，
   禁用态也不再靠 opacity 淡化（那样会把文字一起洗掉）。 */
.mhy-btn{font:inherit;font-size:calc(13px * var(--mhy-s,1));padding:7px 14px;border-radius:8px;border:1px solid #525c69;background:#39414c;color:#eaeef3;cursor:pointer}
.mhy-btn:hover{background:#434c58;border-color:#8b96a5}
.mhy-btn:disabled{background:#4a535f;border-color:#5f6a78;color:#cdd5de;opacity:1;cursor:default}
.mhy-btn-primary{background:#2563eb;border-color:#2563eb;color:#ffffff;font-weight:600;padding:7px 20px}
.mhy-btn-primary:hover{background:#1d4ed8;border-color:#1d4ed8}
.mhy-btn-primary:disabled{background:#4a535f;border-color:#5f6a78;color:#cdd5de}
.mhy-btn-sm{font-size:calc(12px * var(--mhy-s,1));padding:4px 10px;border-radius:6px}
.mhy-methods{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}
.mhy-method{text-align:left;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;font:inherit;color:inherit}
.mhy-method[data-on="1"]{border-color:var(--dsw-alias-brand-primary);box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary)}
.mhy-method b{display:block;font-size:calc(13px * var(--mhy-s,1));color:var(--dsw-alias-label-primary);margin-bottom:2px}
.mhy-method span{font-size:calc(12px * var(--mhy-s,1));color:var(--dsw-alias-label-secondary)}
.mhy-method-wide{grid-column:1/-1}
.mhy-card{margin-top:12px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}
/* 起卦信息：两列对齐成表格式；上下两块表用同一列宽，所以纵向也能对齐 */
.mhy-rows{display:grid;grid-template-columns:68px 1fr;row-gap:3px;align-items:baseline}
.mhy-k{font-size:calc(13px * var(--mhy-s,1));line-height:1.7;color:var(--dsw-alias-label-secondary);padding-right:10px;border-right:1px solid var(--dsw-alias-border-l1)}
.mhy-v{display:flex;flex-wrap:wrap;align-items:center;gap:5px;min-width:0;padding-left:10px;font-size:calc(14px * var(--mhy-s,1));line-height:1.7;color:var(--dsw-alias-label-primary)}
.mhy-v-lg{font-size:calc(15px * var(--mhy-s,1));font-weight:600}
.mhy-v .mhy-wx{font-size:calc(13px * var(--mhy-s,1));line-height:calc(19px * var(--mhy-s,1));min-width:1.6em}
.mhy-v .mhy-wx-state{font-size:calc(13px * var(--mhy-s,1))}
.mhy-v .mhy-gz-unit{font-size:calc(12px * var(--mhy-s,1));font-weight:400}
.mhy-dim{color:var(--dsw-alias-label-secondary);font-weight:400}
.mhy-brand{color:var(--mhy-accent)}
/* 五行色块：背景承担颜色，文字只保证与背景的对比度（传统配色 木绿/火红/土黄/金白/水黑） */
/* ══ 五行配色：色值写死在插件自己的样式里（见上方 .mhy-panel 的 --mhy-wx-* ）══
   以前用 theme.overrideTokens 注册 --mhy-wx-*，主题插件一换就把它们清掉，
   五行色块直接消失。现在只依赖 harness 打在 <body> 上的 data-ds-dark-theme
   （主题呈现层会设 document.documentElement.style.colorScheme + 这个属性），
   主题插件改不动我的色值。 */
body[data-ds-dark-theme] .mhy-panel{
  --mhy-wx-metal-bg:#e9edf2; --mhy-wx-metal-fg:#1f242a; --mhy-wx-metal-bd:#e9edf2;
  --mhy-wx-water-bg:#0b0e11; --mhy-wx-water-fg:#eef2f6; --mhy-wx-water-bd:#6b7480; --mhy-bar:#e9eef0; --mhy-bar-edge:rgba(0,0,0,.6); --mhy-accent:#ffffff; --mhy-body-bg:#4a535f; --mhy-body-bd:#4a535f; --mhy-body-fg:#f0f4f8; --mhy-use-bd:#6b7480; --mhy-use-fg:#c9d2db;
}
.mhy-wx{display:inline-flex;align-items:center;justify-content:center;min-width:1.5em;padding:0 3px;border-radius:4px;border:1px solid transparent;font-size:calc(12px * var(--mhy-s,1));line-height:calc(17px * var(--mhy-s,1));font-weight:600;text-align:center}
.mhy-wx-wood{background:var(--mhy-wx-wood-bg);color:var(--mhy-wx-wood-fg);border-color:var(--mhy-wx-wood-bd)}
.mhy-wx-fire{background:var(--mhy-wx-fire-bg);color:var(--mhy-wx-fire-fg);border-color:var(--mhy-wx-fire-bd)}
.mhy-wx-earth{background:var(--mhy-wx-earth-bg);color:var(--mhy-wx-earth-fg);border-color:var(--mhy-wx-earth-bd)}
.mhy-wx-metal{background:var(--mhy-wx-metal-bg);color:var(--mhy-wx-metal-fg);border-color:var(--mhy-wx-metal-bd)}
.mhy-wx-water{background:var(--mhy-wx-water-bg);color:var(--mhy-wx-water-fg);border-color:var(--mhy-wx-water-bd)}
.mhy-ver{margin-left:6px;font-size:calc(11px * var(--mhy-s,1));font-weight:400;color:var(--dsw-alias-label-secondary)}
.mhy-gz{margin-right:6px}
.mhy-gz:last-child{margin-right:0}
.mhy-gz-unit{color:var(--dsw-alias-label-secondary)}
.mhy-wx-state{color:var(--dsw-alias-label-secondary)}
/* 五张卦卡同排（主卦/互卦/变卦/错卦/综卦）。
   宽度用「百分比基准 + flex-grow:0」：每行恰好摆满 5/3/2 张，折行时
   末行的孤卡也不会被撑成整行宽（撑满会把六爻拉成巨型长条）。
   爻线是百分比宽度，随卡宽自适应。 */
.mhy-hexes{display:flex;gap:10px;flex-wrap:wrap;align-items:stretch;justify-content:center;margin:12px 0}
.mhy-hex{flex:0 1 calc(20% - 9px);min-width:0;padding:9px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base)}
.mhy-hex-head{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.mhy-hex-tag{font-size:calc(11px * var(--mhy-s,1));color:var(--dsw-alias-label-secondary);white-space:nowrap}
.mhy-hex-name{font-size:calc(13.5px * var(--mhy-s,1));font-weight:600;line-height:1.35;word-break:break-word}
.mhy-hex-note{flex:1 1 100%;font-size:calc(10.5px * var(--mhy-s,1));line-height:1.45;color:var(--dsw-alias-label-secondary)}
/* 每个三爻：说明占整行，爻线也占整行 —— 不再用左侧标签列，六爻等宽对齐 */
.mhy-tri + .mhy-tri{margin-top:10px}
.mhy-tri-cap{display:flex;align-items:center;gap:5px;margin-bottom:5px;font-size:calc(12px * var(--mhy-s,1));line-height:1.3;color:var(--dsw-alias-label-secondary)}
.mhy-tri-name{font-size:calc(13px * var(--mhy-s,1));font-weight:600}
.mhy-tri-lines{display:flex;flex-direction:column;gap:5px}
.mhy-line{display:flex;align-items:center;justify-content:space-between;height:10px}
/* 爻线：全部同色，不用任何高亮色（动爻在下方信息行里有文字说明）。
   色值自带，不引用 --dsw-* 令牌，只按明暗两套取值。
   体/用徽标同理，只用中性灰：体＝实心深灰，用＝描边灰。 */
.mhy-bar{height:10px;border-radius:2px;background:var(--mhy-bar);box-shadow:0 0 0 1px var(--mhy-bar-edge)}
.mhy-yang .mhy-bar{width:100%}
.mhy-yin .mhy-bar{width:44%}
.mhy-badge{margin-left:auto;font-size:calc(10px * var(--mhy-s,1));line-height:calc(15px * var(--mhy-s,1));padding:0 5px;border-radius:4px;font-weight:600;background:transparent;border:1px solid var(--mhy-use-bd);color:var(--mhy-use-fg)}
.mhy-badge[data-role="body"]{background:var(--mhy-body-bg);border-color:var(--mhy-body-bd);color:var(--mhy-body-fg)}
.mhy-guaci{margin-top:10px;font-size:calc(13px * var(--mhy-s,1));line-height:1.6;color:var(--dsw-alias-label-secondary)}
.mhy-pre{margin:10px 0 0;padding:10px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:calc(12px * var(--mhy-s,1));line-height:1.65;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary);max-height:320px;overflow:auto}
.mhy-list{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.mhy-item{display:flex;align-items:flex-start;gap:8px;padding:9px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2)}
.mhy-item:hover{border-color:var(--dsw-alias-brand-primary)}
.mhy-item-on{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1)}
.mhy-item-body{flex:1 1 auto;min-width:0;text-align:left;font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
.mhy-check{flex:0 0 auto;margin:2px 0 0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.mhy-row-del{flex:0 0 auto;width:22px;height:22px;padding:0;line-height:1;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:calc(12px * var(--mhy-s,1))}
.mhy-row-del:hover{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.mhy-toolbar{margin-top:10px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1)}
.mhy-selall{display:inline-flex;align-items:center;gap:5px;font-size:calc(12px * var(--mhy-s,1));color:var(--dsw-alias-label-secondary);cursor:pointer}
.mhy-selcount{font-size:calc(12px * var(--mhy-s,1));color:var(--dsw-alias-label-secondary)}
.mhy-btn-danger{background:#b3261e;border-color:#b3261e;color:#ffffff}
.mhy-btn-danger:hover{background:#8f1d17;border-color:#8f1d17}
.mhy-btn-danger:disabled{background:#5a3a38;border-color:#6d4643;color:#e6c9c7}
.mhy-confirm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-state-error-primary);font-size:calc(12px * var(--mhy-s,1));line-height:1.6;color:var(--dsw-alias-label-primary)}
.mhy-item .mhy-q{font-size:calc(13.5px * var(--mhy-s,1));color:var(--dsw-alias-label-primary)}
.mhy-item .mhy-m{font-size:calc(12px * var(--mhy-s,1));color:var(--dsw-alias-label-secondary);margin-top:3px;display:flex;gap:8px;flex-wrap:wrap}
.mhy-tag{font-size:calc(11px * var(--mhy-s,1));padding:0 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1)}
.mhy-tag[data-s="ok"]{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.mhy-tag[data-s="bad"]{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.mhy-tag[data-s="wait"]{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}
.mhy-err{margin-top:10px;padding:8px 10px;border-radius:8px;font-size:calc(12px * var(--mhy-s,1));color:var(--dsw-alias-state-error-primary);border:1px solid var(--dsw-alias-state-error-primary)}
.mhy-note{margin-top:10px;font-size:calc(12px * var(--mhy-s,1));color:var(--dsw-alias-label-secondary)}
.mhy-empty{padding:24px 0;text-align:center;color:var(--dsw-alias-label-secondary);font-size:calc(13px * var(--mhy-s,1))}
.mhy-sep{height:1px;background:var(--dsw-alias-border-l1);margin:14px 0}
.mhy-kv{font-size:calc(13px * var(--mhy-s,1));color:var(--dsw-alias-label-secondary);display:flex;gap:6px}
.mhy-kv b{color:var(--dsw-alias-label-primary);font-weight:600}
.mhy-fb{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.mhy-switch{display:inline-flex;gap:4px}
.mhy-switch button{font:inherit;font-size:calc(12px * var(--mhy-s,1));padding:4px 12px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.mhy-switch button[data-on="1"]{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}
.mhy-stats{display:flex;gap:14px;flex-wrap:wrap;font-size:calc(12px * var(--mhy-s,1));color:var(--dsw-alias-label-secondary)}
.mhy-stats b{color:var(--dsw-alias-label-primary)}
/* 五张卦卡降档：宽屏一行五张，中等屏三张，窄屏两张。同样不伸展，末行不留撑满的孤卡。 */
@media (max-width:699px){
  .mhy-hex{flex:0 1 calc(33.333% - 7px)}
  .mhy-hexes{gap:9px}
}
@media (max-width:479px){
  .mhy-hex{flex:0 1 calc(50% - 6px);padding:8px}
  .mhy-hex-name{font-size:calc(12.5px * var(--mhy-s,1))}
  .mhy-guaci{font-size:calc(12px * var(--mhy-s,1))}
}
/* 窄屏（手机）：输入框下方那一行极其拥挤，只留图标最清爽 */
@media (max-width:640px){
  .mhy-dock-label{display:none}
  .mhy-dock-btn{padding:0 8px}
  /* 抬头副标题会折成好几行，窄屏直接隐去 */
  .mhy-head .mhy-sub{display:none}
  .mhy-rows{grid-template-columns:56px 1fr}
  .mhy-body{padding:10px 12px 12px}
}
`;

    const styleEl = () => h('style', { key: 'mhy-style' }, CSS);

    /* ══════════════════════════════════════════
     *  五行配色（展示层：只负责给五行着色，不参与排盘）
     * ══════════════════════════════════════════ */
    /** 天干五行。 */
    const GAN_WX = {
      甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
      己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
    };
    /** 地支五行。 */
    const ZHI_WX = {
      子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
      午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
    };
    /** 五行 → CSS 类（背景色块）。 */
    const WX_CLASS = {
      木: 'mhy-wx mhy-wx-wood',
      火: 'mhy-wx mhy-wx-fire',
      土: 'mhy-wx mhy-wx-earth',
      金: 'mhy-wx mhy-wx-metal',
      水: 'mhy-wx mhy-wx-water',
    };
    const wxClass = (element) => WX_CLASS[element] || '';
    /** 干支四柱的单位与字段名。 */
    const GANZHI_FIELDS = [
      ['year', '年'],
      ['month', '月'],
      ['day', '日'],
      ['hour', '时'],
    ];

    /* ══════════════════════════════════════════
     *  卦象图形
     * ══════════════════════════════════════════ */
    function Trigram({ info, role, pattern, movingIndex, base }) {
      // pattern 自下而上，渲染时自上而下。
      const rows = [];
      for (let i = 2; i >= 0; i--) {
        const index = base + i;
        rows.push(
          h(
            'div',
            {
              key: index,
              className: `mhy-line ${pattern[index] ? 'mhy-yang' : 'mhy-yin'}${
                movingIndex === index ? ' mhy-moving' : ''
              }`,
              title: `${['初', '二', '三', '四', '五', '上'][index]}爻${pattern[index] ? '阳' : '阴'}${
                movingIndex === index ? '（动爻）' : ''
              }`,
            },
            h('span', { className: 'mhy-bar' }),
            pattern[index] ? null : h('span', { className: 'mhy-bar' }),
          ),
        );
      }
      return h(
        'div',
        { className: 'mhy-tri' },
        h(
          'div',
          { className: 'mhy-tri-cap' },
          h('span', { className: 'mhy-tri-name' }, info.name),
          h('span', { className: wxClass(info.element) }, info.element),
          role ? h('span', { className: 'mhy-badge', 'data-role': role }, role === 'body' ? t('body') : t('use')) : null,
        ),
        h('div', { className: 'mhy-tri-lines' }, rows),
      );
    }

    /**
     * 量出面板该待的位置：贴在入口按钮上方 8px，宽度对齐整条 dock 行。
     * 从按钮往上找第一个「明显比按钮宽、又没占满整帧」的祖先，就是 dock 那一行
     * （harness 的容器是 nowrap 居中的 flex，宽度算不出，只能量）。
     */
    function measurePanelAnchor(buttonEl) {
      if (!buttonEl || typeof window === 'undefined') return null;
      const btn = buttonEl.getBoundingClientRect();
      let node = buttonEl.parentElement;
      let row = null;
      while (node && node !== document.body) {
        const r = node.getBoundingClientRect();
        if (r.width >= 360 && r.width <= window.innerWidth - 8) {
          row = r;
          break;
        }
        node = node.parentElement;
      }
      // 宽度不跟这一行走：dock 行为了给左右按钮让位，比输入框卡片窄得多
      // （实测约 533px），三张卦卡会因此被挤成三行。直接取视口可用宽，
      // 再居中到这一行的中心——既容得下三卦，也不会超出窗口。
      const anchor = row || btn;
      const vw = window.innerWidth;
      const width = Math.round(Math.min(vw - 48, 900));
      const maxLeft = Math.max(12, vw - width - 12);
      const left = Math.min(Math.max(Math.round(anchor.left + anchor.width / 2 - width / 2), 12), maxLeft);
      return {
        left: `${left}px`,
        width: `${width}px`,
        bottom: `${Math.round(window.innerHeight - btn.top + 8)}px`,
      };
    }

    /** 表格式一行：标签 + 值。Fragment 展平，两个子节点直接成为 grid 的两列。 */
    function InfoRow({ label, big, children }) {
      return h(
        React.Fragment,
        null,
        h('div', { className: 'mhy-k' }, label),
        h('div', { className: big ? 'mhy-v mhy-v-lg' : 'mhy-v' }, children),
      );
    }

    function Hexagram({ title, gua, bodySide, note, hideScripture }) {
      // bodySide：'upper' | 'lower' | null —— 体卦在上卦还是下卦（互卦不标体用）。
      const upperRole = bodySide === 'upper' ? 'body' : bodySide === 'lower' ? 'use' : null;
      const lowerRole = bodySide === 'lower' ? 'body' : bodySide === 'upper' ? 'use' : null;
      const movingIndex = gua.moving === null || gua.moving === undefined ? null : gua.moving - 1;
      return h(
        'div',
        { className: 'mhy-hex' },
        h(
          'div',
          { className: 'mhy-hex-head' },
          h('span', { className: 'mhy-hex-tag' }, title),
          h('span', { className: 'mhy-hex-name' }, `${gua.symbol} ${gua.fullName}`),
          // 错卦/综卦是参考视角，卡内带一句取用说明；主/互/变不带。
          note ? h('span', { className: 'mhy-hex-note' }, note) : null,
        ),
        h(Trigram, { info: gua.upperInfo, role: upperRole, pattern: gua.pattern, movingIndex, base: 3 }),
        h(Trigram, { info: gua.lowerInfo, role: lowerRole, pattern: gua.pattern, movingIndex, base: 0 }),
        // 卦辞统一显示；旧卦例没存互卦卦辞时直接不渲染，避免空的「」
        !hideScripture && gua.scripture
          ? h('div', { className: 'mhy-guaci' }, `「${gua.scripture}」`)
          : null,
      );
    }

    /** 干支四柱：天干、地支各自按五行着色，年/月/日/时保持中性色。 */
    function GanzhiNodes({ ganzhi }) {
      return h(
        React.Fragment,
        null,
        ...GANZHI_FIELDS.map(([key, unit]) => {
          const text = (ganzhi && ganzhi[key]) || '';
          return h(
            'span',
            { key, className: 'mhy-gz' },
            [...text].map((ch, ci) =>
              h('span', { key: ci, className: wxClass(GAN_WX[ch] || ZHI_WX[ch]) }, ch),
            ),
            h('span', { className: 'mhy-gz-unit' }, unit),
          );
        }),
      );
    }

    /** 五行旺衰：五行字按五行着色，旺/相/休/囚/死保持中性色。 */
    function WuxingNodes({ wuxing, fallback }) {
      if (!wuxing || !wuxing.length) return h(React.Fragment, null, fallback || '');
      return h(
        React.Fragment,
        null,
        ...wuxing.flatMap((w, i) => {
          const nodes = [];
          if (i) nodes.push(h('span', { key: `sep${i}`, className: 'mhy-wx-state' }, '，'));
          nodes.push(
            h(
              'span',
              { key: `wx${i}` },
              h('span', { className: wxClass(w.element) }, w.element),
              h('span', { className: 'mhy-wx-state' }, w.state),
            ),
          );
          return nodes;
        }),
      );
    }

    /* ══════════════════════════════════════════
     *  由卦例记录还原卦象
     *
     *  卦例库里存的是 pattern 的一组文本字段（沿用原 skill 的记录格式），
     *  这里把它解析回卦象结构，好让「翻看卦例」和「刚起完卦」长得一模一样。
     *  纯字符串解析、不依赖 React，便于离线逐卦验证。
     * ══════════════════════════════════════════ */
    /** 自然象 → 八卦。 */
    const NATURE_TRIGRAM = { 天: '乾', 泽: '兑', 火: '离', 雷: '震', 风: '巽', 水: '坎', 山: '艮', 地: '坤' };
    /** 八卦 → 五行 + 三爻（自下而上，1=阳）。 */
    const TRIGRAM_FACTS = {
      乾: { element: '金', lines: [1, 1, 1] },
      兑: { element: '金', lines: [1, 1, 0] },
      离: { element: '火', lines: [1, 0, 1] },
      震: { element: '木', lines: [1, 0, 0] },
      巽: { element: '木', lines: [0, 1, 1] },
      坎: { element: '水', lines: [0, 1, 0] },
      艮: { element: '土', lines: [0, 0, 1] },
      坤: { element: '土', lines: [0, 0, 0] },
    };
    /** 爻位字 → 序数。 */
    const YAO_POS = { 初: 1, 二: 2, 三: 3, 四: 4, 五: 5, 上: 6 };

    /** 「天山遁」→ { upper:'乾', lower:'艮' }；「乾为天」这类同位卦也认。 */
    function parseGuaName(rawName) {
      const name = String(rawName || '').replace(/^互见/, '').trim();
      // 同位卦形如「乾为天」「离为火」；坎写作「坎为水」，故「为」前允许多字
      // （旧卦例可能存着「习坎为水」，这条规则同样认）
      const same = name.match(/^(.+)为(.)$/);
      if (same && NATURE_TRIGRAM[same[2]]) {
        const tri = NATURE_TRIGRAM[same[2]];
        return { upper: tri, lower: tri };
      }
      const upper = NATURE_TRIGRAM[name[0]];
      const lower = NATURE_TRIGRAM[name[1]];
      return upper && lower ? { upper, lower } : null;
    }

    /** 爻名（九五 / 六二 / 初九 / 上六）→ 爻位 1-6。 */
    function yaoPosition(yaoText) {
      for (const ch of String(yaoText || '').slice(0, 2)) if (YAO_POS[ch]) return YAO_POS[ch];
      return null;
    }

    /**
     * 旧卦例里存着「习坎为水」（旧引擎的卦名），按现行卦名显示为「坎为水」。
     * 记录里的原文不动，只在显示时正名——这样历史卦例和新起的卦看起来一致。
     */
    const normalizeGuaName = (name) => String(name || '').replace(/^习坎/, '坎').replace(/([^\s])习坎/g, '$1坎');

    /** 单卦字段（"䷀ 乾为天（体用比和）" / "互见乾为天"）→ 卦象视图。 */
    function guaFromField(field, guaciField, moving) {
      const text = String(field || '');
      const split = text.match(/^(\S+)\s+(.*)$/);
      const symbol = split ? split[1] : '';
      const body = split ? split[2] : text;
      // 记录里互卦写成「互见乾为天」，标题栏已经写了「互卦」，名字里去掉前缀
      const fullName = normalizeGuaName(body.replace(/（[^）]*）\s*$/, '').replace(/^互见/, '').trim());
      const relation = (body.match(/（([^）]*)）/) || [])[1] || '';
      const sides = parseGuaName(fullName);
      if (!sides) return null;
      const pattern = [...TRIGRAM_FACTS[sides.lower].lines, ...TRIGRAM_FACTS[sides.upper].lines].map((n) => n === 1);
      return {
        symbol,
        fullName,
        scripture: String(guaciField || '').replace(/^「|」$/g, ''),
        pattern,
        upperInfo: { name: sides.upper, element: TRIGRAM_FACTS[sides.upper].element },
        lowerInfo: { name: sides.lower, element: TRIGRAM_FACTS[sides.lower].element },
        moving: moving ?? null,
        relation,
      };
    }

    /** "丙午年 戊戌月 丙辰日 戊子时" → { year:'丙午', … }。 */
    function ganzhiFromText(text) {
      const keys = ['year', 'month', 'day', 'hour'];
      const out = { year: '', month: '', day: '', hour: '' };
      String(text || '')
        .split(/\s+/)
        .filter(Boolean)
        .forEach((part, i) => {
          if (i < 4) out[keys[i]] = part.replace(/[年月日时]$/, '');
        });
      return out;
    }

    /** "木囚，火休，土旺，金相，水死" → [{element,state}]。 */
    function wuxingFromText(text) {
      return String(text || '')
        .split(/[，,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => ({ element: s[0], state: s.slice(1) }));
    }

    /** "体卦 乾（金，相）" → { name:'乾', element:'金' }。 */
    function bodyUseFromText(text) {
      const m = String(text || '').match(/(\S)（(\S)/);
      return m ? { name: m[1], element: m[2] } : null;
    }

    /**
     * 卦例记录 → ChartView 需要的结构；解析不出来时返回 null，调用方退回文本。
     * @param {{method?:string, params?:string, question?:string, date?:string, pattern?:object}} record
     */
    function recordToResult(record) {
      const p = (record && record.pattern) || {};
      const moving = yaoPosition(p.dongyao);
      const ben = guaFromField(p.main, p.main_guaci, moving);
      const hu = guaFromField(p.hugua, p.hugua_guaci, null);
      const bian = guaFromField(p.biangua, p.biangua_guaci, moving);
      if (!ben || !hu || !bian) return null;
      const body = bodyUseFromText(p.body) || { name: ben.upperInfo.name, element: ben.upperInfo.element };
      const use = bodyUseFromText(p.use) || { name: ben.lowerInfo.name, element: ben.lowerInfo.element };
      // 引擎的定则：动爻在下卦（初/二/三）则上卦为体，否则下卦为体。
      // 同位卦上下同名，靠卦名判断会误判，所以以动爻为准。
      const bodySide = moving !== null && moving !== undefined
        ? moving <= 3
          ? '上卦'
          : '下卦'
        : body.name === ben.upperInfo.name
          ? '上卦'
          : '下卦';
      return {
        castAt: p.time || record.date || '',
        ganzhi: ganzhiFromText(p.ganzhi),
        wuxing: wuxingFromText(p.wuxing),
        wuxingText: p.wuxing || '',
        method: record.method,
        methodDetail: record.params,
        question: record.question,
        ben,
        hu,
        bian,
        body: { name: body.name, element: body.element, gua: bodySide },
        use: { name: use.name, element: use.element, gua: bodySide === '上卦' ? '下卦' : '上卦' },
        relation: p.relation || ben.relation || '',
        bianRelation: bian.relation,
        dongyao: { index: moving, name: String(p.dongyao || '').slice(0, 2), text: p.dongyao || '' },
        cuogua: p.cuogua || '',
        zonggua: p.zonggua || '',
        kongwang: p.kongwang || null,
        shensha: Array.isArray(p.shensha) ? p.shensha : [],
      };
    }

    /* 进阶盘（错卦/综卦/空亡/神煞）两种来源形状不同：
       新起卦是引擎对象，历史卦例是 pattern 里的字符串；这里统一成显示文本。 */
    function cuoText(r) {
      const v = r && r.cuogua;
      if (!v) return '';
      return typeof v === 'string' ? normalizeGuaName(v) : `${v.symbol} ${v.fullName}`;
    }
    function zongText(r) {
      const v = r && r.zonggua;
      if (!v) return '';
      if (typeof v === 'string') return normalizeGuaName(v);
      return r.zongguaFixed ? `${t('zongguaFixed')}（${v.fullName}）` : `${v.symbol} ${v.fullName}`;
    }

    /** 「䷫ 天风姤」/「覆卦不动（乾为天）」→ { symbol, fullName, fixed }。 */
    function splitGuaText(raw) {
      let text = String(raw || '').trim();
      if (!text) return null;
      let fixed = false;
      const fixedMatch = text.match(/^覆卦不动（(.+)）$/);
      if (fixedMatch) {
        fixed = true;
        text = fixedMatch[1];
      }
      // 首段不含汉字时视为卦符（䷀…䷿），其余是卦名
      const split = text.match(/^([^\s\u4e00-\u9fff]+)\s+(.+)$/);
      const hasSymbol = !!split;
      const body = (hasSymbol ? split[2] : text).replace(/（[^）]*）\s*$/, '').trim();
      if (!body) return null;
      return { symbol: hasSymbol ? split[1] : '', fullName: normalizeGuaName(body), fixed };
    }

    /**
     * 错卦 / 综卦 → 卦卡数据。两种来源：
     *   · 新起卦：字段已是引擎对象，直接带爻画与上下卦；
     *   · 历史卦例：只存了「䷫ 天风姤」这样的文本，卦名取文本、爻画由主卦现算
     *     （错＝六爻全翻，综＝六爻颠倒），与引擎算法一致。
     * 解析不出来时返回 null，调用方退回原来的文字行。
     */
    function guaCardFor(kind, r) {
      const raw = r && r[kind];
      if (!raw) return null;
      if (typeof raw === 'object') {
        if (!Array.isArray(raw.pattern) || !raw.upperInfo || !raw.lowerInfo) return null;
        return { gua: raw, fixed: kind === 'zonggua' && !!r.zongguaFixed };
      }
      const split = splitGuaText(raw);
      const ben = r && r.ben;
      if (!split || !ben || !Array.isArray(ben.pattern)) return null;
      const sides = parseGuaName(split.fullName);
      // 卦名解析不出来就不硬凑卦卡——宁可让调用方退回文字行，也不能张冠李戴
      if (!sides) return null;
      const pattern =
        kind === 'cuogua' ? ben.pattern.map((b) => !b) : [...ben.pattern].reverse();
      return {
        fixed: split.fixed,
        gua: {
          symbol: split.symbol,
          fullName: split.fullName,
          scripture: '',
          pattern,
          upperInfo: { name: sides.upper, element: TRIGRAM_FACTS[sides.upper].element },
          lowerInfo: { name: sides.lower, element: TRIGRAM_FACTS[sides.lower].element },
          moving: null,
        },
      };
    }

    function kongParts(r) {
      const k = r && r.kongwang;
      if (!k) return null;
      const kong = Array.isArray(k.kong) ? k.kong.join('') : k.kong || '';
      const pick = (v) => (v && typeof v === 'object' ? v.text : v) || '';
      return {
        head: `${kong}${k.xun ? `（${k.xun}）` : ''}`,
        detail: [pick(k.body), pick(k.use)].filter(Boolean).join(' · '),
      };
    }
    function shenshaText(r) {
      const list = r && r.shensha;
      if (!Array.isArray(list) || !list.length) return '';
      const hits = list.filter((x) => x && x.text && x.text !== '未中');
      return hits.length ? hits.map((x) => `${x.name}→${x.text}`).join(' · ') : t('notHit');
    }

    function ChartView({ data }) {
      const r = data.result;
      const bodySide = r.body.gua === '上卦' ? 'upper' : 'lower';
      // 错卦/综卦与主/互/变同排：既是给用户看的参考面，也是断卦要一并对照的维度。
      const cuoCard = guaCardFor('cuogua', r);
      const zongCard = guaCardFor('zonggua', r);
      return h(
        'div',
        null,
        // 起卦信息排成表格式两列：标签列定宽，上下两块表共用同一列宽，纵向对齐
        h(
          'div',
          { className: 'mhy-rows' },
          h(InfoRow, { label: t('castTime'), big: true }, h('span', null, r.castAt)),
          h(InfoRow, { label: t('ganzhi'), big: true }, h(GanzhiNodes, { ganzhi: r.ganzhi })),
          h(
            InfoRow,
            { label: t('wuxingShort'), big: true },
            h(WuxingNodes, { wuxing: r.wuxing, fallback: r.wuxingText }),
          ),
          h(
            InfoRow,
            { label: t('methodLabel') },
            h(
              'span',
              null,
              r.method === '数字'
                ? t('methodNumber')
                : r.method === '一字占'
                  ? t('methodChar')
                  : t('methodTime'),
            ),
            r.methodDetail ? h('span', { className: 'mhy-dim' }, `· ${r.methodDetail}`) : null,
          ),
          r.question ? h(InfoRow, { label: t('questionRow') }, h('span', null, r.question)) : null,
        ),
        h(
          'div',
          { className: 'mhy-hexes' },
          h(Hexagram, { title: t('ben'), gua: r.ben, bodySide }),
          h(Hexagram, { title: t('hu'), gua: r.hu, bodySide: null }),
          h(Hexagram, { title: t('bian'), gua: r.bian, bodySide }),
          // 错卦/综卦不显示卦辞：它们是参考视角，卡面留白不如让主/互/变的信息更突出
          cuoCard
            ? h(Hexagram, {
                title: t('cuoguaRow'),
                gua: cuoCard.gua,
                bodySide: null,
                note: t('cuoguaNote'),
                hideScripture: true,
              })
            : null,
          zongCard
            ? h(Hexagram, {
                title: t('zongguaRow'),
                gua: zongCard.gua,
                bodySide: null,
                note: `${t('zongguaNote')}${zongCard.fixed ? ` · ${t('zongguaFixed')}` : ''}`,
                hideScripture: true,
              })
            : null,
        ),
        h(
          'div',
          { className: 'mhy-rows' },
          h(InfoRow, { label: t('dongyao') }, h('span', null, r.dongyao.text)),
          h(
            InfoRow,
            { label: t('relationLabel') },
            h('span', { className: 'mhy-dim' }, t('body')),
            h('b', null, r.body.name),
            h('span', { className: wxClass(r.body.element) }, r.body.element),
            h('span', { className: 'mhy-dim' }, '·'),
            h('span', { className: 'mhy-dim' }, t('use')),
            h('b', null, r.use.name),
            h('span', { className: wxClass(r.use.element) }, r.use.element),
            h('span', { className: 'mhy-dim' }, '→'),
            h('b', { className: 'mhy-brand' }, r.relation),
          ),
          // 错卦/综卦正常都在上面的卦卡里；只有卦卡解析不出来时才退回文字行，信息不丢
          !cuoCard && cuoText(r)
            ? h(
                InfoRow,
                { label: t('cuoguaRow') },
                h('span', null, cuoText(r)),
                h('span', { className: 'mhy-dim' }, ` · ${t('cuoguaNote')}`),
              )
            : null,
          !zongCard && zongText(r)
            ? h(
                InfoRow,
                { label: t('zongguaRow') },
                h('span', null, zongText(r)),
                h('span', { className: 'mhy-dim' }, ` · ${t('zongguaNote')}`),
              )
            : null,
          kongParts(r) ? h(InfoRow, { label: t('kongwangRow') }, h('span', null, kongParts(r).head)) : null,
          kongParts(r) && kongParts(r).detail
            ? h(InfoRow, { label: t('kongHitRow') }, h('span', { className: 'mhy-dim' }, kongParts(r).detail))
            : null,
          shenshaText(r) ? h(InfoRow, { label: t('shenshaRow') }, h('span', null, shenshaText(r))) : null,
        ),
      );
    }

    /**
     * 笔记条数怎么取。
     *
     * `stats.notes` 由宿主提供，但客户端与宿主是**两份独立加载的代码**：
     * 只刷新页面、没重启宿主时，旧宿主不会返回这个字段。此时绝不能显示 0
     * （那会把 3 条笔记写成 0 条），退回「本次加载到的笔记条数」；
     * 若列表正被「只看错题」筛过，就干脆不显示这个数字。
     * @returns {number|null} null 表示「不知道，别显示」
     */
    function noteCountOf(stats, loadedRows, filtered) {
      if (stats && typeof stats.notes === 'number') return stats.notes;
      if (filtered) return null;
      return Array.isArray(loadedRows) ? loadedRows.length : null;
    }

    /** 笔记页：准确率统计 + 笔记列表（可只看错题）。 */
    function NotesTab() {
      const s = useStore();
      const rows = s.notes || [];
      const stats = s.noteStats;
      const noteTotal = noteCountOf(stats, rows, s.notesIncorrectOnly);
      // 宿主返回了 notes 才说明它是新版：此时 total 是「已反馈卦例」；
      // 旧宿主没这个字段，它的 total 仍是笔记条数，标签得跟着换，别张冠李戴。
      const baseLabel = stats && typeof stats.notes === 'number' ? t('ratedCount') : t('notes');
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'mhy-row' },
          h(
            'div',
            { className: 'mhy-switch' },
            h(
              'button',
              {
                type: 'button',
                'data-on': s.notesIncorrectOnly ? '0' : '1',
                onClick: () => setState({ notesIncorrectOnly: false, notes: null }),
              },
              t('allNotes'),
            ),
            h(
              'button',
              {
                type: 'button',
                'data-on': s.notesIncorrectOnly ? '1' : '0',
                onClick: () => setState({ notesIncorrectOnly: true, notes: null }),
              },
              t('incorrectOnly'),
            ),
          ),
          h('button', { type: 'button', className: 'mhy-btn mhy-btn-sm', onClick: loadNotes, disabled: s.busy }, t('refresh')),
          stats
            ? h(
                'div',
                { className: 'mhy-stats' },
                // 准确率的基数是「现存卦例里已反馈的那些」，笔记条数单独列，
                // 免得删了卦例之后两个数字对不上、让人以为统计没生效。
                h('span', null, h('b', null, stats.total ?? 0), ` ${baseLabel}`),
                h('span', null, `${t('accuracy')} `, h('b', null, `${stats.accuracy}%`)),
                h('span', null, `${t('noteCorrect')} `, h('b', null, stats.correct)),
                h('span', null, `${t('noteWrong')} `, h('b', null, stats.incorrect)),
                noteTotal === null ? null : h('span', null, h('b', null, noteTotal), ` ${t('notes')}`),
              )
            : null,
        ),
        s.error ? h('div', { className: 'mhy-err' }, s.error) : null,
        s.busy && !rows.length ? h('div', { className: 'mhy-empty' }, t('loading')) : null,
        !s.busy && !rows.length ? h('div', { className: 'mhy-empty' }, t('noNotes')) : null,
        h(
          'div',
          { className: 'mhy-list' },
          rows.map((n) =>
            h(
              'div',
              { key: n.id, className: 'mhy-card mhy-notecard' },
              h(
                'div',
                { className: 'mhy-q' },
                `#${n.id}`,
                h('span', { className: 'mhy-tag', 'data-s': n.correct ? 'ok' : 'bad' }, n.correct ? '✅ 正确' : '❌ 错误'),
                n.record_id ? h('span', { className: 'mhy-dim' }, ` → 卦例 #${n.record_id}`) : null,
                n.question_type ? h('span', { className: 'mhy-dim' }, ` · ${n.question_type}`) : null,
                h('span', { className: 'mhy-dim' }, ` · ${n.date}`),
              ),
              n.reason_analysis ? h('div', { className: 'mhy-note-sec' }, h('b', null, t('reasonAnalysis')), n.reason_analysis) : null,
              n.lesson_learned ? h('div', { className: 'mhy-note-sec' }, h('b', null, t('lessonLearned')), n.lesson_learned) : null,
              n.improvement ? h('div', { className: 'mhy-note-sec' }, h('b', null, t('improvement')), n.improvement) : null,
            ),
          ),
        ),
      );
    }

    /** 设置页：字号缩放 + 反馈后自动建笔记。 */
    const FONT_SCALES = [
      ['scaleSmall', 0.9],
      ['scaleNormal', 1],
      ['scaleLarge', 1.12],
      ['scaleXLarge', 1.25],
    ];

    function SettingsTab() {
      const s = useStore();
      const scale = s.settings.fontScale || 1;
      return h(
        'div',
        null,
        h('div', { className: 'mhy-label' }, t('fontSize')),
        h(
          'div',
          { className: 'mhy-switch mhy-scale' },
          FONT_SCALES.map(([key, value]) =>
            h(
              'button',
              {
                key,
                type: 'button',
                'data-on': Math.abs(scale - value) < 0.001 ? '1' : '0',
                onClick: () => saveSettings({ fontScale: value }),
              },
              t(key),
            ),
          ),
        ),
        h('div', { className: 'mhy-hint' }, t('fontSizeHint')),
        h(
          'label',
          { className: 'mhy-checkline' },
          h('input', {
            type: 'checkbox',
            className: 'mhy-check',
            checked: !!s.settings.autoNote,
            onChange: () => saveSettings({ autoNote: !s.settings.autoNote }),
          }),
          h('span', null, t('autoNote')),
        ),
        h('div', { className: 'mhy-hint' }, t('autoNoteHint')),
        s.notice ? h('div', { className: 'mhy-note', style: { marginTop: '12px' } }, s.notice) : null,
        s.error ? h('div', { className: 'mhy-err', style: { marginTop: '12px' } }, s.error) : null,
      );
    }

    /* ══════════════════════════════════════════
     *  面板
     * ══════════════════════════════════════════ */
    function CastTab() {
      const s = useStore();
      useTicker(s.open && s.tab === 'cast');
      return h(
        'div',
        null,
        h('div', { className: 'mhy-label', style: { marginBottom: '4px' } }, t('question')),
        h('textarea', {
          className: 'mhy-area',
          value: s.question,
          placeholder: t('questionPlaceholder'),
          onChange: (e) => setState({ question: e.target.value }),
        }),
        !s.question.trim() ? h('div', { className: 'mhy-hint' }, t('questionRequired') ) : null,
        h('div', { className: 'mhy-label', style: { margin: '12px 0 0' } }, t('method')),
        h(
          'div',
          { className: 'mhy-methods' },
          h(
            'button',
            {
              type: 'button',
              className: 'mhy-method',
              'data-on': s.method === 'time' ? '1' : '0',
              onClick: () => setState({ method: 'time', error: '' }),
            },
            h('b', null, `☯ ${t('methodTime')}`),
            h('span', null, t('methodTimeDesc')),
            s.clock
              ? h(
                  'span',
                  { style: { display: 'block', marginTop: '6px', color: 'var(--dsw-alias-brand-primary)' } },
                  `${s.clock.castAt} · 农历${s.clock.lunarText}`,
                )
              : null,
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mhy-method',
              'data-on': s.method === 'number' ? '1' : '0',
              onClick: () => setState({ method: 'number', error: '' }),
            },
            h('b', null, `# ${t('methodNumber')}`),
            h('span', null, t('methodNumberDesc')),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mhy-method mhy-method-wide',
              'data-on': s.method === 'char' ? '1' : '0',
              onClick: () => setState({ method: 'char', error: '' }),
            },
            h('b', null, `字 ${t('methodChar')}`),
            h('span', null, t('methodCharDesc')),
          ),
        ),
        s.method === 'number'
          ? h(
              'div',
              { className: 'mhy-row', style: { marginTop: '10px' } },
              h('input', {
                className: 'mhy-input mhy-num',
                inputMode: 'numeric',
                maxLength: 3,
                value: s.number,
                placeholder: t('numberPlaceholder'),
                onChange: (e) => setState({ number: e.target.value.replace(/\D/g, '').slice(0, 3), error: '' }),
              }),
              h(
                'button',
                { type: 'button', className: 'mhy-btn mhy-btn-sm', onClick: doRandomCast, disabled: s.busy },
                t('randomDraw'),
              ),
            )
          : null,
        s.method === 'char'
          ? h(
              'div',
              { style: { marginTop: '10px' } },
              h('input', {
                className: 'mhy-input',
                value: s.char,
                maxLength: 2,
                placeholder: t('charPlaceholder'),
                onChange: (e) => setState({ char: e.target.value.slice(0, 2), error: '' }),
                onKeyDown: (e) => {
                  if (e.key === 'Enter') doCast();
                },
              }),
              h('div', { className: 'mhy-hint' }, t('charHint')),
            )
          : null,
        h(
          'div',
          { className: 'mhy-row', style: { marginTop: '14px' } },
          h(
            'button',
            {
              type: 'button',
              className: 'mhy-btn mhy-btn-primary',
              onClick: doCast,
              // 起卦前必须先写下所问之事：没写就不让起卦
              disabled: s.busy || !s.question.trim(),
              title: s.question.trim() ? '' : t('questionRequired'),
            },
            s.busy ? t('casting') : t('cast'),
          ),
          s.cast
            ? h(
                'button',
                { type: 'button', className: 'mhy-btn mhy-btn-primary mhy-btn-sm', title: t('askAiTitle'), onClick: fillChat },
                t('askAi'),
              )
            : null,
          s.cast
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'mhy-btn mhy-btn-sm',
                  onClick: () => copy(s.cast.chart).then((okay) => setState({ notice: okay ? t('copied') : '复制失败' })),
                },
                t('copyChart'),
              )
            : null,
        ),
        s.error ? h('div', { className: 'mhy-err' }, s.error) : null,
        s.notice ? h('div', { className: 'mhy-note' }, s.notice) : null,
        s.cast
          ? h('div', { className: 'mhy-card' }, h(ChartView, { data: s.cast }))
          : null,
      );
    }

    function JournalTab() {
      const s = useStore();
      React.useEffect(() => {
        if (s.open && s.tab === 'journal' && s.records === null && !s.busy) loadRecords();
        return undefined;
      }, [s.open, s.tab, s.records]);

      if (s.detail) {
        const r = s.detail;
        const p = r.pattern || {};
        const recordResult = recordToResult(r);
        return h(
          'div',
          null,
          h(
            'div',
            { className: 'mhy-row' },
            h('button', { type: 'button', className: 'mhy-btn mhy-btn-sm', onClick: () => setState({ detail: null, detailId: null }) }, `← ${t('back')}`),
            h(
              'button',
              {
                type: 'button',
                className: 'mhy-btn mhy-btn-sm mhy-btn-danger',
                onClick: () => setState({ confirm: { ids: [r.id], count: 1, label: ` #${r.id}` } }),
              },
              t('deleteOne'),
            ),
            h('span', { className: 'mhy-kv' }, h('b', null, `#${r.id}`), h('span', null, p.time || r.date)),
            h(
              'span',
              { className: 'mhy-tag', 'data-s': r.feedback ? (r.feedback.correct ? 'ok' : 'bad') : 'wait' },
              r.feedback ? (r.feedback.correct ? '✅ 正确' : '❌ 错误') : '⏳ 待反馈',
            ),
          ),
          h(ConfirmBar),
          h(
            'div',
            { className: 'mhy-card' },
            h('div', { className: 'mhy-label', style: { marginBottom: '6px' } }, t('question')),
            h('textarea', {
              className: 'mhy-area mhy-area-sm',
              rows: 2,
              value: s.questionDraft,
              placeholder: t('questionPlaceholder'),
              onChange: (e) => setState({ questionDraft: e.target.value }),
            }),
            h(
              'div',
              { className: 'mhy-row', style: { marginTop: '8px' } },
              h(
                'button',
                {
                  type: 'button',
                  className: 'mhy-btn mhy-btn-primary mhy-btn-sm',
                  disabled: s.saving || s.questionDraft === (r.question || ''),
                  onClick: saveQuestion,
                },
                t('saveQuestion'),
              ),
              s.questionDraft !== (r.question || '')
                ? h('span', { className: 'mhy-hint', style: { marginTop: '0' } }, t('questionChanged'))
                : null,
            ),
          ),
          h(
            'div',
            { className: 'mhy-card' },
            h('div', { className: 'mhy-label', style: { marginBottom: '6px' } }, t('detailChart')),
            // 与「刚起完卦」完全同一套渲染：由记录里的文本字段还原卦象
            recordResult
              ? h(ChartView, { data: { result: recordResult } })
              : h('pre', { className: 'mhy-pre' }, p.chart || `${r.method}（${r.params}）`),
          ),
          h(
            'div',
            { className: 'mhy-card' },
            h('div', { className: 'mhy-label', style: { marginBottom: '6px' } }, t('waijingSection')),
            h(
              'div',
              { className: 'mhy-rows' },
              h(InfoRow, { label: t('waijingUser') }, h('span', null, r.waijing || t('waijingNone'))),
              h(InfoRow, { label: t('waijingAi') }, h('span', null, r.waijing_analysis || t('waijingNone'))),
            ),
          ),
          h(
            'div',
            { className: 'mhy-card' },
            h('div', { className: 'mhy-label', style: { marginBottom: '6px' } }, t('analysis')),
            h('div', { className: 'mhy-pre', style: { fontFamily: 'inherit' } }, r.analysis || t('analysisNone')),
          ),
          h(
            'div',
            { className: 'mhy-card' },
            h('div', { className: 'mhy-label', style: { marginBottom: '6px' } }, t('conclusion')),
            h('div', { className: 'mhy-pre', style: { fontFamily: 'inherit' } }, r.conclusion || t('analysisNone')),
          ),
          h(
            'div',
            { className: 'mhy-card' },
            h('div', { className: 'mhy-label', style: { marginBottom: '6px' } }, t('detailFeedback')),
            r.feedback
              ? h(
                  'div',
                  null,
                  h('div', { className: 'mhy-kv' }, h('span', null, `${t('fbResult')}：`), h('b', null, r.feedback.result || '-')),
                  r.feedback.correct_reason ? h('div', { className: 'mhy-guaci' }, `${r.feedback.correct_reason}`) : null,
                  r.feedback.incorrect_reason ? h('div', { className: 'mhy-guaci' }, `${r.feedback.incorrect_reason}`) : null,
                  r.feedback.xiang_analysis ? h('div', { className: 'mhy-guaci' }, `取象：${r.feedback.xiang_analysis}`) : null,
                  h('div', { className: 'mhy-note' }, '反馈已记录。可以让 AI 建立学习笔记，沉淀经验。'),
                )
              : h(
                  'div',
                  { className: 'mhy-fb' },
                  h('textarea', {
                    className: 'mhy-area',
                    value: s.feedback.result,
                    placeholder: t('fbResultPlaceholder'),
                    onChange: (e) => setState({ feedback: { ...s.feedback, result: e.target.value } }),
                  }),
                  h(
                    'div',
                    { className: 'mhy-switch' },
                    h(
                      'button',
                      {
                        type: 'button',
                        'data-on': s.feedback.correct ? '1' : '0',
                        onClick: () => setState({ feedback: { ...s.feedback, correct: true } }),
                      },
                      `✅ ${t('fbCorrect')}`,
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        'data-on': s.feedback.correct ? '0' : '1',
                        onClick: () => setState({ feedback: { ...s.feedback, correct: false } }),
                      },
                      `❌ ${t('fbIncorrect')}`,
                    ),
                  ),
                  h('textarea', {
                    className: 'mhy-area',
                    value: s.feedback.reason,
                    placeholder: t('fbReasonPlaceholder'),
                    onChange: (e) => setState({ feedback: { ...s.feedback, reason: e.target.value } }),
                  }),
                  h(
                    'div',
                    { className: 'mhy-row' },
                    h(
                      'button',
                      { type: 'button', className: 'mhy-btn mhy-btn-primary', onClick: submitFeedback, disabled: s.saving },
                      s.saving ? t('saving') : t('submit'),
                    ),
                  ),
                ),
          ),
          s.error ? h('div', { className: 'mhy-err' }, s.error) : null,
        );
      }

      const rows = s.records || [];
      const selected = new Set(s.selected);
      const allOn = rows.length > 0 && rows.every((r) => selected.has(String(r.id)));
      const pendingCount = (s.overview && s.overview.pending) || 0;
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'mhy-row' },
          h(
            'div',
            { className: 'mhy-switch' },
            h(
              'button',
              {
                type: 'button',
                'data-on': s.filterPending ? '0' : '1',
                onClick: () => setState({ filterPending: false, records: null, selected: [] }),
              },
              t('all'),
            ),
            h(
              'button',
              {
                type: 'button',
                'data-on': s.filterPending ? '1' : '0',
                onClick: () => setState({ filterPending: true, records: null, selected: [] }),
              },
              t('pending'),
            ),
          ),
          h('button', { type: 'button', className: 'mhy-btn mhy-btn-sm', onClick: loadRecords, disabled: s.busy }, t('refresh')),
          s.overview
            ? h(
                'div',
                { className: 'mhy-stats' },
                h('span', null, h('b', null, s.overview.total), ` ${t('records')}`),
                h('span', null, h('b', null, s.overview.pending), ` ${t('pendingCount')}`),
                h('span', null, `${t('accuracy')} `, h('b', null, `${s.overview.stats.accuracy}%`)),
                typeof s.overview.stats.notes === 'number'
                  ? h('span', null, h('b', null, s.overview.stats.notes), ` ${t('notes')}`)
                  : null,
              )
            : null,
        ),
        h(
          'div',
          { className: 'mhy-row mhy-toolbar' },
          h(
            'label',
            { className: 'mhy-selall' },
            h('input', {
              type: 'checkbox',
              className: 'mhy-check',
              checked: allOn,
              disabled: !rows.length,
              onChange: () => setState({ selected: allOn ? [] : rows.map((r) => String(r.id)) }),
            }),
            t('selectAll'),
          ),
          s.selected.length
            ? h('span', { className: 'mhy-selcount' }, `${t('selectedLabel')} ${s.selected.length} ${t('unitRecords')}`)
            : null,
          s.selected.length
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'mhy-btn mhy-btn-sm mhy-btn-danger',
                  onClick: () =>
                    setState({
                      confirm: { ids: s.selected.map(Number), count: s.selected.length, label: t('labelSelected') },
                    }),
                },
                `${t('deleteSelected')}（${s.selected.length}）`,
              )
            : null,
          h(
            'button',
            {
              type: 'button',
              className: 'mhy-btn mhy-btn-sm mhy-btn-danger',
              disabled: !pendingCount,
              onClick: () => setState({ confirm: { pendingOnly: true, count: pendingCount, label: t('labelPending') } }),
            },
            `${t('deletePending')}${pendingCount ? `（${pendingCount}）` : ''}`,
          ),
        ),
        h(ConfirmBar),
        s.error ? h('div', { className: 'mhy-err' }, s.error) : null,
        s.notice ? h('div', { className: 'mhy-note' }, s.notice) : null,
        s.busy && !rows.length ? h('div', { className: 'mhy-empty' }, t('loading')) : null,
        !s.busy && !rows.length ? h('div', { className: 'mhy-empty' }, t('empty')) : null,
        h(
          'div',
          { className: 'mhy-list' },
          rows.map((r) => {
            const on = selected.has(String(r.id));
            return h(
              'div',
              { key: r.id, className: `mhy-item${on ? ' mhy-item-on' : ''}` },
              h('input', {
                type: 'checkbox',
                className: 'mhy-check',
                checked: on,
                onChange: () => toggleSelect(r.id),
              }),
              h(
                'button',
                { type: 'button', className: 'mhy-item-body', onClick: () => openDetail(r.id) },
                h('div', { className: 'mhy-q' }, `#${r.id}　${r.question || '（未填写问题）'}`),
                h(
                  'div',
                  { className: 'mhy-m' },
                  h('span', null, (r.pattern && r.pattern.time) || r.date),
                  h('span', null, `${r.method}（${r.params}）`),
                  h(
                    'span',
                    { className: 'mhy-tag', 'data-s': r.feedback ? (r.feedback.correct ? 'ok' : 'bad') : 'wait' },
                    r.feedback ? (r.feedback.correct ? '✅ 正确' : '❌ 错误') : '⏳ 待反馈',
                  ),
                ),
                r.conclusion ? h('div', { className: 'mhy-m' }, r.conclusion.slice(0, 60)) : null,
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mhy-row-del',
                  title: t('deleteOne'),
                  'aria-label': `${t('deleteOne')} #${r.id}`,
                  onClick: () => setState({ confirm: { ids: [r.id], count: 1, label: ` #${r.id}` } }),
                },
                '✕',
              ),
            );
          }),
        ),
      );
    }

    /** 面板主体（不含外层容器）。 */
    function PanelBody({ anchor }) {
      const s = useStore();
      return h(
        'div',
        {
          className: 'mhy-panel',
          style: { ...(anchor || {}), '--mhy-s': String(s.settings.fontScale || 1) },
        },
        h(
          'div',
          { className: 'mhy-head' },
          h('h2', null, `☯ ${t('title')}`, h('span', { className: 'mhy-ver' }, `v${VERSION}`)),
          h('span', { className: 'mhy-sub' }, t('subtitle')),
          h(
            'button',
            {
              type: 'button',
              className: 'mhy-iconbtn',
              onClick: () => setState({ open: false }),
              title: t('collapse'),
              'aria-label': t('collapse'),
            },
            '▾',
          ),
        ),
        h(
          'div',
          { className: 'mhy-tabs' },
          h(
            'button',
            { type: 'button', className: 'mhy-tab', 'data-on': s.tab === 'cast' ? '1' : '0', onClick: () => setState({ tab: 'cast' }) },
            t('tabCast'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mhy-tab',
              'data-on': s.tab === 'journal' ? '1' : '0',
              onClick: () => setState({ tab: 'journal' }),
            },
            t('tabJournal'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mhy-tab',
              'data-on': s.tab === 'notes' ? '1' : '0',
              onClick: () => {
                setState({ tab: 'notes', error: '', notice: '' });
                if (!state.notes) loadNotes();
              },
            },
            t('tabNotes'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mhy-tab',
              'data-on': s.tab === 'settings' ? '1' : '0',
              onClick: () => setState({ tab: 'settings', error: '', notice: '' }),
            },
            t('tabSettings'),
          ),
        ),
        h(
          'div',
          { className: 'mhy-body' },
          s.tab === 'cast'
            ? h(CastTab)
            : s.tab === 'journal'
              ? h(JournalTab)
              : s.tab === 'notes'
                ? h(NotesTab)
                : h(SettingsTab),
        ),
      );
    }

    /* ══════════════════════════════════════════
     *  常驻入口：点一下面板向上弹出，点「收起」/再点一次/Esc 收起
     * ══════════════════════════════════════════ */
    function Dock(props) {
      const s = useStore();
      const btnRef = React.useRef(null);
      const [anchor, setAnchor] = React.useState(null);

      React.useEffect(() => {
        inputActions = props.inputActions || null;
        sessionId = props.sessionId || null;
        return () => {
          if (inputActions === (props.inputActions || null)) inputActions = null;
          if (sessionId === (props.sessionId || null)) sessionId = null;
        };
      }, [props.inputActions, props.sessionId]);

      // 展开时量一次坐标，并在窗口变化/滚动时跟着走（useLayoutEffect 缺失时退回 useEffect）
      const useLayout = React.useLayoutEffect || React.useEffect;
      useLayout(() => {
        if (!s.open) return undefined;
        const measure = () => setAnchor(measurePanelAnchor(btnRef.current));
        measure();
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);
        return () => {
          window.removeEventListener('resize', measure);
          window.removeEventListener('scroll', measure, true);
        };
      }, [s.open]);

      // 打开时载入一次设置
      React.useEffect(() => {
        if (s.open && !s.settingsLoaded) loadSettings();
      }, [s.open, s.settingsLoaded]);

      // Esc 收起
      React.useEffect(() => {
        if (!s.open) return undefined;
        const onKey = (e) => {
          if (e.key === 'Escape') setState({ open: false });
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [s.open]);

      return h(
        'div',
        { className: 'mhy-dock' },
        styleEl(),
        h(
          'button',
          {
            ref: btnRef,
            type: 'button',
            className: 'mhy-dock-btn',
            title: t('subtitle'),
            'aria-expanded': s.open ? 'true' : 'false',
            onClick: () => setState({ open: !s.open, error: '', notice: '' }),
          },
          h('span', { className: 'mhy-dock-icon' }, '☯'),
          h('span', { className: 'mhy-dock-label' }, t('trigger')),
        ),
        s.open && anchor ? h(PanelBody, { anchor }) : null,
      );
    }

    /* ══════════════════════════════════════════
     *  文案绑定
     * ══════════════════════════════════════════ */
    let t = (key) => ZH[key] || key;
    let bindLocale = null;

    return {
      inject: ['slots'],
      apply(ctx) {
        try {
          if (ctx.locale) {
            ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'meihuayi: dictionaries');
            bindLocale = ctx.locale;
            const bound = ctx.locale.bind(NS);
            t = (key) => {
              const value = bound(key);
              return value === key ? ZH[key] || key : value;
            };
          }
        } catch (error) {
          console.warn('[meihuayi] 文案注册失败，回退到中文：', error);
        }

        // 五行配色不再走主题服务：色值写在 CSS 里（见 --mhy-wx-* 定义），
        // 只依赖 harness 打在 <body> 上的 data-ds-dark-theme 区分明暗。
        // 这样主题插件换掉令牌也不会让五行色块消失。

        // 只注册在输入框下方这一处：面板就地展开，不再占用 shell.overlay 弹浮层。
        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register({ name: 'conversation.composer.dock', id: 'meihuayi-dock', order: 40, label: () => t('trigger') }, Dock),
        );
      },
    };
  },
});
