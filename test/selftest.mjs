#!/usr/bin/env node
/**
 * 零依赖自测：`node test/selftest.mjs`。
 *
 * 覆盖：农历换算的日期边界、错综卦对合、空亡旬空、384 组手动排盘、
 * 设置持久化，以及跨进程并发写入（两个写者同时改同一份存档）。
 *
 * 同一个文件也是并发用例的子进程入口：设置 MHY_WORKER=1 与 MHY_DATA_DIR
 * 时它只负责往指定目录写若干条卦例，然后退出。
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lunarDayName, lunarMonthName, solarToLunar } from '../lib/lunar.js';
import { getCuogua, getKongwang, getZonggua, manualDivination } from '../lib/engine.js';
import { createJournal } from '../lib/store.js';

const SELF = fileURLToPath(import.meta.url);

/* ── 子进程模式：并发用例的两个写者 ─────────── */
if (process.env.MHY_WORKER === '1') {
  const journal = createJournal({ dataDir: process.env.MHY_DATA_DIR });
  const count = Number(process.env.MHY_WORKER_COUNT || 25);
  for (let i = 0; i < count; i++) {
    journal.saveRecord({
      question: `并发用例 ${process.pid}-${i}`,
      method: '手动',
      params: '',
      pattern: {},
    });
  }
  process.exit(0);
}

let passed = 0;
/** @param {string} name @param {() => void | Promise<void>} fn */
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

/* ── 1. 农历换算边界 ─────────────────────── */
console.log('\n农历换算');

await test('1900-01-01 早于农历表基点时明确报错（旧版会返回 lYear=1899 的脏数据）', () => {
  assert.throws(() => solarToLunar(1900, 1, 1), /1900-01-31/);
  assert.throws(() => solarToLunar(1900, 1, 30), /1900-01-31/);
});

await test('1900-01-31 = 农历庚子年正月初一', () => {
  assert.deepEqual(solarToLunar(1900, 1, 31), { lYear: 1900, lMonth: 1, lDay: 1, isLeap: false });
});

await test('2026-11-06 = 农历丙午年九月廿八', () => {
  const r = solarToLunar(2026, 11, 6);
  assert.equal(r.lYear, 2026);
  assert.equal(r.lMonth, 9);
  assert.equal(r.lDay, 28);
  assert.equal(r.isLeap, false);
  assert.equal(lunarMonthName(r.lMonth, r.isLeap), '九月');
  assert.equal(lunarDayName(r.lDay), '廿八');
});

await test('2100-12-31 仍在表内且落在合法农历月日', () => {
  const r = solarToLunar(2100, 12, 31);
  assert.equal(r.lYear, 2100);
  assert.ok(r.lMonth >= 1 && r.lMonth <= 12, `lMonth=${r.lMonth}`);
  assert.ok(r.lDay >= 1 && r.lDay <= 30, `lDay=${r.lDay}`);
});

await test('不存在的日期、越界月份与非整数都报错', () => {
  assert.throws(() => solarToLunar(2026, 2, 30), /不存在/);
  assert.throws(() => solarToLunar(2026, 13, 1), /不合法/);
  assert.throws(() => solarToLunar(2026, 0, 10), /不合法/);
  assert.throws(() => solarToLunar(2026, 1, 1.5), /整数/);
  assert.throws(() => solarToLunar(1899, 12, 31), /1900-2100/);
});

/* ── 2. 错综卦对合 ───────────────────────── */
console.log('\n错综卦');

await test('错卦：64 卦逐一取反两次，全部还原', () => {
  for (let upper = 1; upper <= 8; upper++) {
    for (let lower = 1; lower <= 8; lower++) {
      const cuo = getCuogua(upper, lower);
      const back = getCuogua(cuo.upper, cuo.lower);
      assert.equal(back.upper, upper, `上卦 ${upper}/${lower}`);
      assert.equal(back.lower, lower, `下卦 ${upper}/${lower}`);
    }
  }
});

await test('综卦：64 卦上下颠倒两次全部还原，且恰有 8 卦自身不动', () => {
  let fixed = 0;
  for (let upper = 1; upper <= 8; upper++) {
    for (let lower = 1; lower <= 8; lower++) {
      const zong = getZonggua(upper, lower);
      const back = getZonggua(zong.upper, zong.lower);
      assert.equal(back.upper, upper, `上卦 ${upper}/${lower}`);
      assert.equal(back.lower, lower, `下卦 ${upper}/${lower}`);
      if (zong.fixed) fixed++;
    }
  }
  assert.equal(fixed, 8, '乾/坤/颐/大过/坎/离/中孚/小过 这 8 卦覆卦不动');
});

/* ── 3. 空亡（旬空）──────────────────────── */
console.log('\n空亡');

await test('按日柱定旬：甲申旬空午未', () => {
  const r = getKongwang('甲申');
  assert.equal(r.xun, '甲申旬');
  assert.deepEqual(r.kong, ['午', '未']);
});

await test('六十甲子分六旬、每旬 10 日，且同一地支分属 5 个不同旬', () => {
  const GAN = '甲乙丙丁戊己庚辛壬癸';
  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  const perXun = new Map();
  const perZhi = new Map();
  for (let i = 0; i < 60; i++) {
    const r = getKongwang(GAN[i % 10] + ZHI[i % 12]);
    assert.ok(r, `第 ${i} 个日柱应有旬空`);
    perXun.set(r.xun, (perXun.get(r.xun) || 0) + 1);
    const zhi = ZHI[i % 12];
    perZhi.set(zhi, (perZhi.get(zhi) || 0) + 1);
  }
  assert.equal(perXun.size, 6);
  for (const [, n] of perXun) assert.equal(n, 10);
  for (const [, n] of perZhi) assert.equal(n, 5);
});

/* ── 4. 384 组手动排盘 ───────────────────── */
console.log('\n排盘');

await test('手动起卦 384 组（8 × 8 × 6）全部产出完整卦象与体用关系', () => {
  const relations = new Set(['体生用', '用生体', '体克用', '用克体', '体用比和']);
  let n = 0;
  for (let upper = 1; upper <= 8; upper++) {
    for (let lower = 1; lower <= 8; lower++) {
      for (let moving = 1; moving <= 6; moving++) {
        const r = manualDivination(upper, lower, moving, '自测');
        assert.equal(r.ben.pattern.length, 6);
        assert.equal(r.dongyao.index, moving);
        assert.ok(r.hu && r.bian && r.cuogua && r.zonggua, '主/互/变/错/综 齐备');
        assert.ok(relations.has(r.relation), `体用关系异常：${r.relation}`);
        assert.ok(Array.isArray(r.kongwang?.kong) && r.kongwang.kong.length === 2);
        assert.equal(r.shensha.length, 5);
        n++;
      }
    }
  }
  assert.equal(n, 384);
});

/* ── 5. 存储与并发 ───────────────────────── */
console.log('\n存储');

await test('设置默认值与更新后跨实例可见', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mhy-settings-'));
  try {
    const a = createJournal({ dataDir: dir });
    assert.deepEqual(a.getSettings(), { fontScale: 1, autoNote: true });
    a.updateSettings({ fontScale: 1.5, autoNote: false });
    const b = createJournal({ dataDir: dir });
    assert.deepEqual(b.getSettings(), { fontScale: 1.5, autoNote: false });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

await test('删除卦例不会连带删除学习笔记，孤例笔记单独计数', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mhy-delete-'));
  try {
    const j = createJournal({ dataDir: dir });
    const id = j.saveRecord({ question: '删卦例', method: '手动', params: '', pattern: {} });
    j.addNote({ recordId: id, correct: true, questionType: '自测' });
    const r = j.deleteRecords([id]);
    assert.equal(r.deleted, 1);
    assert.equal(r.orphanedNotes, 1);
    assert.equal(j.listNotes().length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** @param {string} dir @param {number} count */
function runWorker(dir, count) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SELF], {
      env: { ...process.env, MHY_WORKER: '1', MHY_DATA_DIR: dir, MHY_WORKER_COUNT: String(count) },
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`写者进程退出码 ${code}`))));
  });
}

await test('跨进程并发写入：两个写者各写 25 条，最终 50 条且编号连续无覆盖', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mhy-lock-'));
  try {
    await Promise.all([runWorker(dir, 25), runWorker(dir, 25)]);
    const rows = createJournal({ dataDir: dir }).listRecords();
    assert.equal(rows.length, 50, '两个写者的 50 条都应保留');
    assert.deepEqual(
      rows.map((r) => r.id).sort((x, y) => x - y),
      Array.from({ length: 50 }, (_, i) => i + 1),
      '编号应为 1..50，说明没有读到旧 seq',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\n${passed} 项检查全部通过。`);
