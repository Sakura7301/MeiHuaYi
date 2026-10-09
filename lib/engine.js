/**
 * 梅花易数排盘引擎。
 *
 * 移植自梅花易数 skill 的 `meihuayi.py`（作者 Sakura7301），
 * 算法与输出格式保持一致：八卦定义、互卦/变卦、体用生克、五行旺衰、
 * 干支推算、时间起卦（农历）与数字起卦。
 */
import { readFileSync } from 'node:fs';
import { solarToLunar, lunarMonthName, lunarDayName } from './lunar.js';

/* ══════════════════════════════════════════════
 *  八卦定义
 * ══════════════════════════════════════════════ */

/** 先天八卦序（1 乾 … 8 坤），lines 自下而上。 */
export const TRIGRAMS = {
  1: { name: '乾', element: '金', symbol: '☰', lines: ['yang', 'yang', 'yang'] },
  2: { name: '兑', element: '金', symbol: '☱', lines: ['yang', 'yang', 'yin'] },
  3: { name: '离', element: '火', symbol: '☲', lines: ['yang', 'yin', 'yang'] },
  4: { name: '震', element: '木', symbol: '☳', lines: ['yang', 'yin', 'yin'] },
  5: { name: '巽', element: '木', symbol: '☴', lines: ['yin', 'yang', 'yang'] },
  6: { name: '坎', element: '水', symbol: '☵', lines: ['yin', 'yang', 'yin'] },
  7: { name: '艮', element: '土', symbol: '☶', lines: ['yin', 'yin', 'yang'] },
  8: { name: '坤', element: '土', symbol: '☷', lines: ['yin', 'yin', 'yin'] },
};

/** 八卦自然象。 */
export const TRIGRAM_NATURE = {
  乾: '天', 兑: '泽', 离: '火', 震: '雷',
  巽: '风', 坎: '水', 艮: '山', 坤: '地',
};

/* ══════════════════════════════════════════════
 *  五行
 * ══════════════════════════════════════════════ */

const GENERATING = { 金: '水', 水: '木', 木: '火', 火: '土', 土: '金' };
const OVERCOMING = { 金: '木', 木: '土', 土: '水', 水: '火', 火: '金' };

/** 五行旺衰：同我者旺，我生者相，生我者休，克我者囚，我克者死。 */
export const WX_MONTH_STATE = {
  寅: { 木: '旺', 火: '相', 土: '死', 金: '囚', 水: '休' },
  卯: { 木: '旺', 火: '相', 土: '死', 金: '囚', 水: '休' },
  辰: { 木: '囚', 火: '休', 土: '旺', 金: '相', 水: '死' },
  巳: { 木: '休', 火: '旺', 土: '相', 金: '死', 水: '囚' },
  午: { 木: '休', 火: '旺', 土: '相', 金: '死', 水: '囚' },
  未: { 木: '囚', 火: '休', 土: '旺', 金: '相', 水: '死' },
  申: { 木: '死', 火: '囚', 土: '休', 金: '旺', 水: '相' },
  酉: { 木: '死', 火: '囚', 土: '休', 金: '旺', 水: '相' },
  戌: { 木: '囚', 火: '休', 土: '旺', 金: '相', 水: '死' },
  亥: { 木: '相', 火: '死', 土: '囚', 金: '休', 水: '旺' },
  子: { 木: '相', 火: '死', 土: '囚', 金: '休', 水: '旺' },
  丑: { 木: '囚', 火: '休', 土: '旺', 金: '相', 水: '死' },
};

const ZHI_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ZHI_ORDER;
const SHICHEN_NUM = Object.fromEntries(ZHI_ORDER.map((z, i) => [z, i + 1]));

/* ══════════════════════════════════════════════
 *  六十四卦数据
 * ══════════════════════════════════════════════ */

let guaIndex = null;

function loadGuaIndex() {
  if (guaIndex) return guaIndex;
  const raw = JSON.parse(readFileSync(new URL('../data/iching.json', import.meta.url), 'utf8'));
  const index = new Map();
  for (const h of raw) {
    const bits = h.array;
    const lower = bitsToTrigramNum(bits.slice(0, 3));
    const upper = bitsToTrigramNum(bits.slice(3, 6));
    index.set(`${upper},${lower}`, h);
  }
  guaIndex = index;
  return index;
}

function bitsToTrigramNum(bits) {
  const pattern = bits.map((b) => (b === 1 ? 'yang' : 'yin'));
  for (const [num, tri] of Object.entries(TRIGRAMS)) {
    if (tri.lines.join(',') === pattern.join(',')) return Number(num);
  }
  return 1;
}

/** 卦辞。 */
export function getGuaCi(upper, lower) {
  const h = loadGuaIndex().get(`${upper},${lower}`);
  return h ? h.scripture : '未知卦辞';
}

/** 爻辞：verse 是爻辞本体（不含爻名），text 是「爻名，爻辞」。 */
export function getYaoCi(upper, lower, yao) {
  const h = loadGuaIndex().get(`${upper},${lower}`);
  const line = h && (h.lines || [])[yao - 1];
  if (!line) {
    const fallback = `详见${upper}卦${yao}爻`;
    return { name: '', verse: fallback, text: fallback };
  }
  return { name: line.name, verse: line.scripture, text: `${line.name}，${line.scripture}` };
}

/** 短卦名，如「遁」。 */
export function getGuaName(upper, lower) {
  const h = loadGuaIndex().get(`${upper},${lower}`);
  if (h) return h.name;
  return `${TRIGRAMS[upper].name}${TRIGRAMS[lower].name}`;
}

/** 全卦名，如「天山遁」「乾为天」。 */
export function getGuaFullName(upper, lower) {
  const short = getGuaName(upper, lower);
  const upperNature = TRIGRAM_NATURE[TRIGRAMS[upper].name];
  const lowerNature = TRIGRAM_NATURE[TRIGRAMS[lower].name];
  if (upper === lower) return `${short}为${lowerNature}`;
  return `${upperNature}${lowerNature}${short}`;
}

/** 卦符，如「䷠」。 */
export function getGuaSymbol(upper, lower) {
  const h = loadGuaIndex().get(`${upper},${lower}`);
  return h ? h.symbol : '䷀';
}

/* ══════════════════════════════════════════════
 *  时辰 / 干支
 * ══════════════════════════════════════════════ */

/** 由 24 小时制小时数取（时支, 时辰序数 1-12）。子时 23:00-00:59。 */
export function getShichen(hour) {
  const idx = hour === 23 ? 0 : Math.floor((hour + 1) / 2);
  const zhi = ZHI_ORDER[idx % 12];
  return { zhi, num: SHICHEN_NUM[zhi] };
}

/** 节气近似表（月, 日, 月令地支）。 */
const SOLAR_TERMS = [
  [1, 5, '丑'], [2, 4, '寅'], [3, 5, '卯'], [4, 5, '辰'],
  [5, 5, '巳'], [6, 5, '午'], [7, 7, '未'], [8, 7, '申'],
  [9, 7, '酉'], [10, 8, '戌'], [11, 7, '亥'], [12, 7, '子'],
];

/** 恒非负取余（对齐 Python 的 `%` 语义）。 */
const mod = (n, m) => ((n % m) + m) % m;

/** 干支推算（与原 skill 一致）：日干支以 2000-01-07 甲子日为基准，月支用节气近似表。 */
export function getGanzhi(year, month, day, hour) {
  const yearStemIdx = mod(year - 4, 10);
  const yearZhiIdx = mod(year - 4, 12);

  let monthZhi;
  for (let i = 0; i < SOLAR_TERMS.length; i++) {
    const [stM, stD, zhiName] = SOLAR_TERMS[i];
    const next = SOLAR_TERMS[(i + 1) % 12];
    if ((month === stM && day >= stD) || (month === next[0] && day < next[1])) {
      monthZhi = zhiName;
      break;
    }
  }
  if (!monthZhi) monthZhi = ZHI[(month + 1) % 12];

  const monthStemStart = ((yearStemIdx % 5) * 2 + 2) % 10;
  const monthOffset = (ZHI.indexOf(monthZhi) - 2 + 12) % 12;
  const monthGan = GAN[(monthStemStart + monthOffset) % 10];

  const REF = Date.UTC(2000, 0, 7); // 甲子日
  const delta = Math.round((Date.UTC(year, month - 1, day) - REF) / 86400000);
  const dayGan = GAN[mod(delta, 10)];
  const dayZhi = ZHI[mod(delta, 12)];

  const { zhi: shichenZhi, num: shichenNum } = getShichen(hour);
  const dayStemIdx = mod(delta, 10);
  const hourStemStart = (dayStemIdx % 5) * 2;
  const hourGan = GAN[(hourStemStart + shichenNum - 1) % 10];

  return {
    year: GAN[yearStemIdx] + ZHI[yearZhiIdx],
    month: monthGan + monthZhi,
    day: dayGan + dayZhi,
    hour: hourGan + shichenZhi,
  };
}

/* ══════════════════════════════════════════════
 *  起卦
 * ══════════════════════════════════════════════ */

const mod8 = (n) => (n % 8 === 0 ? 8 : n % 8);
const mod6 = (n) => (n % 6 === 0 ? 6 : n % 6);

function findTrigram(lines) {
  const key = lines.join(',');
  for (const [num, tri] of Object.entries(TRIGRAMS)) {
    if (tri.lines.join(',') === key) return Number(num);
  }
  return 1;
}

/** 互卦：取本卦二三四爻为下卦，三四五爻为上卦。 */
function getHugua(upper, lower) {
  const ben = [...TRIGRAMS[lower].lines, ...TRIGRAMS[upper].lines];
  const hu = ben.slice(1, 5);
  return { upper: findTrigram(hu.slice(1, 4)), lower: findTrigram(hu.slice(0, 3)) };
}

/** 变卦：动爻阴阳互变。 */
function getBiangua(upper, lower, moving) {
  const ben = [...TRIGRAMS[lower].lines, ...TRIGRAMS[upper].lines];
  const next = [...ben];
  next[moving - 1] = next[moving - 1] === 'yin' ? 'yang' : 'yin';
  return { upper: findTrigram(next.slice(3)), lower: findTrigram(next.slice(0, 3)) };
}

/** 体用五行关系。 */
function wuxingRelation(bodyElem, useElem) {
  if (OVERCOMING[bodyElem] === useElem) return { relation: '体克用', fortune: '吉' };
  if (GENERATING[useElem] === bodyElem) return { relation: '用生体', fortune: '吉' };
  if (GENERATING[bodyElem] === useElem) return { relation: '体生用', fortune: '耗' };
  if (bodyElem === useElem) return { relation: '体用比和', fortune: '吉' };
  return { relation: '用克体', fortune: '凶' };
}

function guaView(upper, lower, { moving = null } = {}) {
  const lowerLines = TRIGRAMS[lower].lines;
  const upperLines = TRIGRAMS[upper].lines;
  const pattern = [...lowerLines, ...upperLines].map((l) => l === 'yang');
  return {
    upper: upper,
    lower: lower,
    gua: [upper, lower],
    upperInfo: TRIGRAMS[upper],
    lowerInfo: TRIGRAMS[lower],
    name: getGuaName(upper, lower),
    fullName: getGuaFullName(upper, lower),
    symbol: getGuaSymbol(upper, lower),
    scripture: getGuaCi(upper, lower),
    pattern,
    lowerPattern: pattern.slice(0, 3),
    upperPattern: pattern.slice(3, 6),
    moving,
  };
}

/**
 * 由上下卦与动爻组装完整排盘结果。
 * @param {number} upper 上卦
 * @param {number} lower 下卦
 * @param {number} moving 动爻 1-6
 * @param {string} method 起卦方式（时间/数字）
 * @param {string} methodDetail 起卦参数描述
 * @param {{year:number,month:number,day:number,hour:number,minute:number,second:number}} clock 起卦时刻（北京时间）
 * @param {object} [lunar] 农历信息（时间起卦时有）
 */
export function buildResult(upper, lower, moving, method, methodDetail, clock, lunar = null) {
  const benUpper = TRIGRAMS[upper];
  const benLower = TRIGRAMS[lower];
  const hu = getHugua(upper, lower);
  const bian = getBiangua(upper, lower, moving);

  // 动爻在下卦（初二三）则上卦为体；动爻在上卦（四五六）则下卦为体。
  const bodyIsUpper = moving <= 3;
  const body = bodyIsUpper ? benUpper : benLower;
  const use = bodyIsUpper ? benLower : benUpper;
  const { relation, fortune } = wuxingRelation(body.element, use.element);

  const ganzhi = getGanzhi(clock.year, clock.month, clock.day, clock.hour);
  const monthBranch = ganzhi.month.slice(-1);
  const monthState = WX_MONTH_STATE[monthBranch] || {};
  const wuxing = ['木', '火', '土', '金', '水'].map((element) => ({
    element,
    state: monthState[element] || '-',
  }));

  const bianView = guaView(bian.upper, bian.lower, { moving });
  const bianRelation = wuxingRelation(
    bodyIsUpper ? bianView.upperInfo.element : bianView.lowerInfo.element,
    bodyIsUpper ? bianView.lowerInfo.element : bianView.upperInfo.element,
  );

  const yao = getYaoCi(upper, lower, moving);
  const yaoLabel = ['初', '二', '三', '四', '五', '六'][moving - 1];

  const hourNum = SHICHEN_NUM[ganzhi.hour.slice(-1)] ?? clock.hour + 1;

  return {
    castAt: formatClock(clock),
    clock,
    lunar,
    ganzhi,
    monthBranch,
    wuxing,
    wuxingText: wuxing.map((w) => `${w.element}${w.state}`).join('，'),
    method,
    methodDetail,
    ben: guaView(upper, lower, { moving }),
    hu: guaView(hu.upper, hu.lower),
    bian: bianView,
    body: { gua: bodyIsUpper ? '上卦' : '下卦', name: body.name, element: body.element },
    use: { gua: bodyIsUpper ? '下卦' : '上卦', name: use.name, element: use.element },
    relation,
    fortune,
    bianRelation: bianRelation.relation,
    bianFortune: bianRelation.fortune,
    dongyao: { index: moving, label: yaoLabel, name: yao.name, text: yao.text, verse: yao.verse, scripture: yao.text },
    yingqi: upper + lower + hourNum,
    upper,
    lower,
  };
}

function formatClock(clock) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${clock.year}-${clock.month}-${clock.day} ${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}`;
}

/** 取当前北京时间。 */
export function bjtNow() {
  const t = new Date(Date.now() + 8 * 3600 * 1000);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    second: t.getUTCSeconds(),
  };
}

/**
 * 解析 "YYYY-MM-DD HH:mm" 形式的北京时间；缺省为当前时间。
 * @returns {{year:number,month:number,day:number,hour:number,minute:number,second:number}}
 */
export function parseClock(input) {
  if (!input) return bjtNow();
  const text = String(input).trim();
  const m = text.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?/);
  if (!m) throw new Error(`无法识别的时间格式：${input}（请用 YYYY-MM-DD HH:mm）`);
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: m[4] === undefined ? 12 : Number(m[4]),
    minute: m[5] === undefined ? 0 : Number(m[5]),
    second: m[6] === undefined ? 0 : Number(m[6]),
  };
}

/**
 * 时间起卦（月日数用农历）：
 * 上卦 = (年支数 + 农历月 + 农历日) ÷ 8 取余
 * 下卦 = (年支数 + 农历月 + 农历日 + 时支数) ÷ 8 取余
 * 动爻 = (年支数 + 农历月 + 农历日 + 时支数) ÷ 6 取余
 * @param {{year:number,month:number,day:number,hour:number,minute:number,second:number}} [clock]
 * @param {string} [question]
 */
export function timeDivination(clock, question = '') {
  const c = clock || bjtNow();
  const lunar = solarToLunar(c.year, c.month, c.day);
  const yearZhi = ((lunar.lYear - 4) % 12 + 12) % 12 + 1;
  const { num: shichenNum } = getShichen(c.hour);

  const upper = mod8(yearZhi + lunar.lMonth + lunar.lDay);
  const lower = mod8(yearZhi + lunar.lMonth + lunar.lDay + shichenNum);
  const moving = mod6(yearZhi + lunar.lMonth + lunar.lDay + shichenNum);

  const lunarText = `${lunar.isLeap ? '闰' : ''}${lunarMonthName(lunar.lMonth)}${lunarDayName(lunar.lDay)}`;
  const result = buildResult(upper, lower, moving, '时间', `农历${lunarText}`, c, {
    year: lunar.lYear,
    month: lunar.lMonth,
    day: lunar.lDay,
    isLeap: lunar.isLeap,
    text: lunarText,
  });
  result.question = question;
  return result;
}

/**
 * 数字起卦（三位数 100-999）：
 * 上卦 = 百位 ÷ 8 取余
 * 下卦 = (十位 + 个位) ÷ 8 取余
 * 动爻 = (三位数字之和 + 当前时辰数) ÷ 6 取余
 * @param {number} number
 * @param {string} [question]
 * @param {{year:number,month:number,day:number,hour:number,minute:number,second:number}} [clock]
 */
export function numberDivination(number, question = '', clock = null) {
  const n = Number(number);
  if (!Number.isInteger(n) || n < 100 || n > 999) {
    throw new Error(`数字起卦需要传入三位整数（100-999），收到：${number}`);
  }
  const c = clock || bjtNow();
  const d1 = Math.floor(n / 100);
  const d2 = Math.floor(n / 10) % 10;
  const d3 = n % 10;

  const upper = mod8(d1);
  const lower = mod8(d2 + d3);
  const { num: shichenNum } = getShichen(c.hour);
  const moving = mod6(d1 + d2 + d3 + shichenNum);

  const result = buildResult(upper, lower, moving, '数字', String(n), c);
  result.question = question;
  return result;
}

/* ══════════════════════════════════════════════
 *  排盘文本
 * ══════════════════════════════════════════════ */

/** 生成完整排盘文本（与 skill 的 format_output 一致）。 */
export function formatChart(result) {
  const lines = [];
  lines.push(result.castAt);
  lines.push(`${result.ganzhi.year}年 ${result.ganzhi.month}月 ${result.ganzhi.day}日 ${result.ganzhi.hour}时`);
  lines.push(result.wuxingText);
  lines.push(result.methodDetail ? `起卦方式：${result.method}（${result.methodDetail}）` : `起卦方式：${result.method}`);
  if (result.question) lines.push(`问：${result.question}`);
  lines.push('');

  lines.push(`[主卦] ${result.ben.symbol} ${result.ben.fullName}（${result.relation}）`);
  lines.push(`        「${result.ben.scripture}」`);
  lines.push(`[互卦] 互见${result.hu.fullName}`);
  lines.push(`[变卦] ${result.bian.symbol} ${result.bian.fullName}（${result.bianRelation}）`);
  lines.push(`        「${result.bian.scripture}」`);
  const bodyState = WX_MONTH_STATE[result.monthBranch]?.[result.body.element] ?? '-';
  const useState = WX_MONTH_STATE[result.monthBranch]?.[result.use.element] ?? '-';
  // 体用紧跟在动爻之后，中间不留空行：卦身信息连成一块，读起来更整齐。
  lines.push(`[动爻] ${result.dongyao.name}爻动`);
  lines.push(`        「${result.dongyao.verse}」`);
  lines.push(
    `[体用] 体卦 ${result.body.name}（${result.body.element}，${bodyState}） · ` +
      `用卦 ${result.use.name}（${result.use.element}，${useState}） → ${result.relation}`,
  );
  return lines.join('\n');
}
