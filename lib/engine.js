/**
 * 梅花易数排盘引擎。
 *
 * 移植自梅花易数 skill 的 `meihuayi.py`（作者 Sakura7301）：
 * 八卦定义、互卦/变卦、体用生克、五行旺衰、干支推算、时间起卦（农历）与数字起卦，
 * 外加进阶排盘——一字占、错卦、综卦、空亡（旬空）、神煞。
 *
 * ⚠️ 以下三处**有意偏离** Python 原版（原版有误或不合章法），改动前先看 README 的「验证」节：
 *   1. 综卦：按六爻整体反转计算。原版只把上下卦对调、不反转爻序，48/64 卦结果是错的。
 *   2. 空亡：由日柱**干支**定旬（干支组合唯一确定旬）。原版只看日支查表，60 日中 48 日不符真旬。
 *   3. 一字占 detail：卦符取自 `TRIGRAMS[].symbol`。原版把 ☰/☶ 写死，非乾/艮的卦会显示错符号。
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

/**
 * 「䷟ 雷风恒（体用比和）」/「雷风恒」→ { upper, lower }。
 * 拿 64 卦名反查，供老卦例补齐进阶盘字段时定位卦位用；认不出来返回 null。
 */
export function parseGuaPair(text) {
  const name = String(text || '')
    .replace(/^\S+\s+/, '') // 开头的卦符
    .replace(/（[^）]*）\s*$/, '') // （体用比和）之类
    .replace(/^互见/, '')
    .replace(/^习坎/, '坎') // 旧卦名正名
    .trim();
  if (!name) return null;
  for (let upper = 1; upper <= 8; upper++) {
    for (let lower = 1; lower <= 8; lower++) {
      if (getGuaFullName(upper, lower) === name) return { upper, lower };
    }
  }
  return null;
}

/** 「九三，不恒其德…」/「上九，…」/「初六，…」→ 动爻 1-6；认不出来返回 null。 */
export function parseYaoIndex(text) {
  const pos = { 初: 1, 二: 2, 三: 3, 四: 4, 五: 5, 上: 6 };
  for (const ch of String(text || '').slice(0, 2)) if (pos[ch]) return pos[ch];
  return null;
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

const mod8 = (n) => (mod(n, 8) === 0 ? 8 : mod(n, 8));
const mod6 = (n) => (mod(n, 6) === 0 ? 6 : mod(n, 6));

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

/* ══════════════════════════════════════════════
 *  进阶排盘：错卦 / 综卦 / 空亡 / 神煞 / 一字占
 * ══════════════════════════════════════════════ */

/**
 * 八卦的方位地支（后天八卦）：判空亡时看体卦 / 用卦落在哪个地支。
 * 乾居西北＝戌亥，震居东＝卯，巽居东南＝辰巳，坎居北＝子，
 * 离居南＝午，艮居东北＝丑寅，兑居西＝酉，坤居西南＝未申。
 */
export const TRIGRAM_DIZHI = {
  乾: ['戌', '亥'], 兑: ['酉'], 离: ['午'], 震: ['卯'],
  巽: ['辰', '巳'], 坎: ['子'], 艮: ['寅', '丑'], 坤: ['申', '未'],
};

const patternOf = (upper, lower) =>
  [...TRIGRAMS[lower].lines, ...TRIGRAMS[upper].lines].map((l) => l === 'yang');
const linesOf = (bits) => bits.map((b) => (b ? 'yang' : 'yin'));

/** 错卦（旁通卦）：六爻全翻，阳变阴、阴变阳。 */
export function getCuogua(upper, lower) {
  const pattern = patternOf(upper, lower).map((b) => !b);
  const cuoLower = findTrigram(linesOf(pattern.slice(0, 3)));
  const cuoUpper = findTrigram(linesOf(pattern.slice(3, 6)));
  return { upper: cuoUpper, lower: cuoLower, pattern };
}

/**
 * 综卦（覆卦）：整卦上下颠倒 180°。
 * ⚠️ 必须同时倒转爻序——只把上下卦对调是错的
 * （乾/坤/坎/离这类对称卦看不出差别，震/艮/巽/兑就会错）。
 */
export function getZonggua(upper, lower) {
  const pattern = [...patternOf(upper, lower)].reverse();
  const zongLower = findTrigram(linesOf(pattern.slice(0, 3)));
  const zongUpper = findTrigram(linesOf(pattern.slice(3, 6)));
  return { upper: zongUpper, lower: zongLower, pattern, fixed: zongUpper === upper && zongLower === lower };
}

/**
 * 空亡（旬空）：由**日柱**（天干＋地支）定旬，取该旬缺的两个地支。
 * ⚠️ 空亡不能只看日支：六十甲子里每个地支都出现在 5 个不同的旬中
 * （同为「辰」日，甲辰旬空寅卯、甲寅旬空子丑、甲子旬空戌亥）。
 */
export function getKongwang(dayGanZhi) {
  const gan = dayGanZhi.slice(0, 1);
  const zhi = dayGanZhi.slice(1, 2);
  const gi = GAN.indexOf(gan);
  const zi = ZHI.indexOf(zhi);
  if (gi < 0 || zi < 0) return null;
  const start = mod(zi - gi + 10, 12);
  return {
    xun: '甲' + ZHI[mod(zi - gi, 12)] + '旬',
    kong: [ZHI[start], ZHI[(start + 1) % 12]],
  };
}

/**
 * 神煞表：天乙贵人按日干，其余按日支三合局。
 *
 * 天乙贵人口诀（与源 skill `meihuayi.py` 的 guiren_map、原 SKILL.md 一致）：
 *   甲戊丑未，乙己子申，丙丁亥酉，壬癸巳卯，庚辛寅午。
 * ⚠️ 命理另通行「甲戊庚牛羊，六辛逢马虎」一说（庚归丑未、辛取午寅），
 *    本插件**不采用**：庚日用寅午。换用哪一套会直接改变庚日的命中结果，
 *    修改前请先确认，并同步 README 的「天乙贵人对口诀」与断卦技巧文档。
 */
const TIANYI = {
  甲: ['丑', '未'], 戊: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['巳', '卯'], 癸: ['巳', '卯'],
  庚: ['寅', '午'], 辛: ['寅', '午'],
};
const TAOHUA = { 申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子' };
const YIMA = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
const JIESHA = { 申: '巳', 子: '巳', 辰: '巳', 寅: '亥', 午: '亥', 戌: '亥', 巳: '寅', 酉: '寅', 丑: '寅', 亥: '申', 卯: '申', 未: '申' };
const ZAISHA = { 申: '午', 子: '午', 辰: '午', 寅: '子', 午: '子', 戌: '子', 巳: '卯', 酉: '卯', 丑: '卯', 亥: '酉', 卯: '酉', 未: '酉' };

/** 神煞：以日柱为基准，标出体卦 / 用卦方位地支是否命中。 */
export function getShensha(dayGanZhi, bodyName, useName) {
  const gan = dayGanZhi.slice(0, 1);
  const zhi = dayGanZhi.slice(1, 2);
  const rows = [
    { name: '天乙贵人', zhis: TIANYI[gan] || [] },
    { name: '桃花', zhis: TAOHUA[zhi] ? [TAOHUA[zhi]] : [] },
    { name: '驿马', zhis: YIMA[zhi] ? [YIMA[zhi]] : [] },
    { name: '劫煞', zhis: JIESHA[zhi] ? [JIESHA[zhi]] : [] },
    { name: '灾煞', zhis: ZAISHA[zhi] ? [ZAISHA[zhi]] : [] },
  ];
  const hitOf = (zhis, guaName, tag) =>
    (TRIGRAM_DIZHI[guaName] || []).filter((z) => zhis.includes(z)).map((z) => `${tag}${guaName}(${z})`);
  return rows.map((r) => {
    const hits = [...hitOf(r.zhis, bodyName, '体'), ...hitOf(r.zhis, useName, '用')];
    return { name: r.name, zhis: r.zhis, hits, text: hits.length ? hits.join('、') : '未中' };
  });
}

/**
 * 一字占（测字法）：以一字拆出的两部分笔画起卦。
 * AI 负责拆字并数笔画，此处只做八卦数学：
 * 上卦 = 上画数 % 8，下卦 = 下画数 % 8，动爻 = (上 + 下) % 6。
 */
export function charDivination(upperStrokes, lowerStrokes, question = '', clock = null) {
  const up = Number(upperStrokes);
  const lo = Number(lowerStrokes);
  if (!Number.isInteger(up) || !Number.isInteger(lo) || up <= 0 || lo <= 0) {
    throw new Error('一字占需要两个正整数：上画数、下画数');
  }
  const c = clock || bjtNow();
  const upper = mod8(up);
  const lower = mod8(lo);
  const moving = mod6(up + lo);
  const detail = `上${up}画(${TRIGRAMS[upper].name}${TRIGRAMS[upper].symbol}) 下${lo}画(${TRIGRAMS[lower].name}${TRIGRAMS[lower].symbol})`;
  const result = buildResult(upper, lower, moving, '一字占', detail, c, null);
  if (question) result.question = question;
  return result;
}

/**
 * 手动起卦：由使用者直接指定上卦、下卦与动爻（六十四卦 × 六爻任意组合）。
 *
 * 上/下卦用先天八卦序（1 乾 2 兑 3 离 4 震 5 巽 6 坎 7 艮 8 坤），
 * 动爻 1-6（初二三四五上）。起卦之后的两阶段流程与时间/数字/一字占完全相同。
 */
export function manualDivination(upper, lower, moving, question = '', clock = null) {
  const up = Number(upper);
  const lo = Number(lower);
  const mv = Number(moving);
  const bad = (what, value, max) => `手动起卦的${what}需要 1-${max} 的整数，收到 ${JSON.stringify(value)}。`;
  if (!Number.isInteger(up) || up < 1 || up > 8) throw new Error(bad('上卦', upper, 8));
  if (!Number.isInteger(lo) || lo < 1 || lo > 8) throw new Error(bad('下卦', lower, 8));
  if (!Number.isInteger(mv) || mv < 1 || mv > 6) throw new Error(bad('动爻', moving, 6));
  const c = clock || bjtNow();
  const detail =
    `上卦${TRIGRAMS[up].name}${TRIGRAMS[up].symbol} 下卦${TRIGRAMS[lo].name}${TRIGRAMS[lo].symbol} ` +
    `${['初', '二', '三', '四', '五', '上'][mv - 1]}爻动`;
  const result = buildResult(up, lo, mv, '手动', detail, c, null);
  if (question) result.question = question;
  return result;
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

  const cuo = getCuogua(upper, lower);
  const zong = getZonggua(upper, lower);
  const kong = getKongwang(ganzhi.day);
  const kongCheck = (kongZhis, guaName, monthZhi) => {
    const zhis = TRIGRAM_DIZHI[guaName] || [];
    const hit = zhis.filter((z) => kongZhis.includes(z));
    if (!hit.length) return { gua: guaName, zhis, hit, text: `${guaName}(${zhis.join(',')}) 不逢空` };
    const parts = hit.map((z) => (z === monthZhi ? `${z}假空（月令${z}填实）` : `${z}真空`));
    return { gua: guaName, zhis, hit, text: `${guaName}(${zhis.join(',')}) 逢空 → ${parts.join('、')}` };
  };

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
    cuogua: guaView(cuo.upper, cuo.lower),
    zonggua: guaView(zong.upper, zong.lower),
    zongguaFixed: zong.fixed,
    kongwang: kong
      ? {
          ...kong,
          body: kongCheck(kong.kong, body.name, monthBranch),
          use: kongCheck(kong.kong, use.name, monthBranch),
        }
      : null,
    shensha: getShensha(ganzhi.day, body.name, use.name),
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
  lines.push('');
  // 错卦/综卦只给结果，不带「六爻全翻」「上下颠倒」这类说明——取用规则在断卦方法论里。
  lines.push(`[错卦] ${result.cuogua.symbol} ${result.cuogua.fullName}`);
  lines.push(
    result.zongguaFixed
      ? `[综卦] 覆卦不动（${result.zonggua.fullName}）`
      : `[综卦] ${result.zonggua.symbol} ${result.zonggua.fullName}`,
  );
  if (result.kongwang) {
    lines.push(`[空亡] 日空 ${result.kongwang.kong.join('')}（${result.kongwang.xun}）`);
    lines.push(`        ${result.kongwang.body.text} · ${result.kongwang.use.text}`);
  }
  lines.push(`[神煞] 以日柱 ${result.ganzhi.day} 为基准`);
  for (const row of result.shensha) {
    lines.push(`        ${row.name}（${row.zhis.join(',')}）→ ${row.text === '未中' ? '未中' : '命中 ' + row.text}`);
  }
  return lines.join('\n');
}
