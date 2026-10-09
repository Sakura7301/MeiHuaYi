/**
 * 公历 → 农历 转换（1900-2100）。
 *
 * 农历大小月/闰月压缩表为通用算法表（同 `solarlunar` 等实现所用，
 * 表数据源自公开的 1900-2100 农历数据）。梅花易数时间起卦必须以农历
 * 月、日、年支入算，故此处只实现「公历 → 农历」单向转换。
 */

/** 1900-2100 年农历闰月与大小月信息表。 */
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
  0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252, // 2090-2099
  0x0d520, // 2100
];

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
/** 1900-01-31 为农历 1900 年正月初一。 */
const BASE_UTC = Date.UTC(1900, 0, 31);
const DAY_MS = 86400000;

/** 该农历年闰几月，0 表示不闰。 */
function leapMonth(year) {
  return LUNAR_INFO[year - MIN_YEAR] & 0xf;
}

/** 该农历年闰月的天数。 */
function leapDays(year) {
  if (!leapMonth(year)) return 0;
  return LUNAR_INFO[year - MIN_YEAR] & 0x10000 ? 30 : 29;
}

/** 该农历年第 month 个月（1-12）的天数。 */
function monthDays(year, month) {
  return LUNAR_INFO[year - MIN_YEAR] & (0x10000 >> month) ? 30 : 29;
}

/** 该农历年的总天数。 */
function yearDays(year) {
  let sum = 348; // 12 个月各 29 天
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += LUNAR_INFO[year - MIN_YEAR] & i ? 1 : 0;
  return sum + leapDays(year);
}

/**
 * 公历转农历。
 * @param {number} year 公历年
 * @param {number} month 公历月 1-12
 * @param {number} day 公历日
 * @returns {{lYear:number,lMonth:number,lDay:number,isLeap:boolean}}
 */
export function solarToLunar(year, month, day) {
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new Error(`农历换算表仅覆盖 ${MIN_YEAR}-${MAX_YEAR} 年，收到 ${year} 年`);
  }
  let offset = Math.round((Date.UTC(year, month - 1, day) - BASE_UTC) / DAY_MS);

  let i;
  let temp = 0;
  for (i = MIN_YEAR; i <= MAX_YEAR && offset > 0; i++) {
    temp = yearDays(i);
    offset -= temp;
  }
  if (offset < 0) {
    offset += temp;
    i--;
  }
  const lYear = i;

  const leap = leapMonth(lYear);
  let isLeap = false;
  let j;
  for (j = 1; j < 13 && offset > 0; j++) {
    if (leap > 0 && j === leap + 1 && !isLeap) {
      --j;
      isLeap = true;
      temp = leapDays(lYear);
    } else {
      temp = monthDays(lYear, j);
    }
    if (isLeap && j === leap + 1) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && j === leap + 1) {
    if (isLeap) isLeap = false;
    else {
      isLeap = true;
      --j;
    }
  }
  if (offset < 0) {
    offset += temp;
    --j;
  }

  return { lYear, lMonth: j, lDay: offset + 1, isLeap };
}

/** 农历日的中文写法（初一…三十）。 */
const LUNAR_DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

const LUNAR_MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];

/** 农历月的中文写法。 */
export function lunarMonthName(month, isLeap = false) {
  return `${isLeap ? '闰' : ''}${LUNAR_MONTH_NAMES[month - 1] ?? month}月`;
}

/** 农历日的中文写法。 */
export function lunarDayName(day) {
  return LUNAR_DAY_NAMES[day - 1] ?? String(day);
}
