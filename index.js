/**
 * 梅花易数卜卦插件 —— Host 半边。
 *
 * 装配三件事，全部注册在插件自身的 fiber 上，卸载即回收：
 *  1. Agent 工具（`meihuayi_cast` / `meihuayi_journal` / `meihuayi_reference`）——聊天卜卦；
 *  2. Web 路由 `/meihuayi/api` —— 界面点击卜卦；
 *  3. Harness 运行时技能 `meihuayi` —— 把原 skill 的断卦方法论带进上下文。
 *
 * 计算与存储都在 `lib/` 中，Host 与 Client 共用同一份实现（见 `lib/operations.js`）。
 */
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createJournal } from './lib/store.js';
import { createOperations } from './lib/operations.js';
import { createTools } from './lib/tools.js';
import { ROUTE_PATH, createRouteHandler } from './lib/routes.js';
import { REFERENCES, SKILL_BODY } from './lib/protocol.js';

export const name = 'meihuayi';

/** 宿主半边版本；会写进装配日志，用来确认线上加载的是哪一版代码。 */
export const HOST_VERSION = '1.0.2';

/**
 * 把装配过程中的异常写进插件数据目录，便于在没有宿主日志时排查。
 * @param {{dir: string}} journal
 * @param {string} message
 */
function diagnose(journal, message) {
  try {
    if (!existsSync(journal.dir)) mkdirSync(journal.dir, { recursive: true });
    appendFileSync(join(journal.dir, 'diagnostics.log'), `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch {
    /* 诊断本身失败不能影响插件 */
  }
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{dataDir?: string, registerSkill?: boolean, enableTools?: boolean, enableUi?: boolean}} [config]
 */
export function apply(ctx, config = {}) {
  const journal = createJournal(config);
  const ops = createOperations(journal);

  diagnose(journal, `apply() 开始 · 宿主 v${HOST_VERSION} · 卦例库 ${journal.file}`);
  ctx.logger?.info?.(`[meihuayi] 卦例库：${journal.file}`);

  /* ── 1. Agent 工具 ───────────────────────── */
  if (config.enableTools !== false) {
    ctx.inject(['tools'], (scope) => {
      diagnose(journal, `tools 注入回调触发 · tools 服务=${typeof scope.tools}`);
      let tools;
      try {
        tools = createTools(ops);
      } catch (error) {
        diagnose(journal, `createTools 抛错：${error?.message ?? error}`);
        return;
      }
      for (const tool of tools) {
        try {
          scope.effect(() => scope.tools.register(tool), `meihuayi: tool ${tool.name}`);
          diagnose(journal, `已注册工具 ${tool.name}`);
        } catch (error) {
          diagnose(journal, `注册工具 ${tool.name} 失败：${error?.message ?? error}`);
        }
      }
    });
  }

  /* ── 2. Web 路由（界面点击起卦）───────────── */
  if (config.enableUi !== false) {
    ctx.inject(['webServer'], (scope) => {
      const handler = createRouteHandler(journal, {
        // 反馈后自动建笔记：插件直接唤醒当前会话的 Agent（web 客户端用的同一个接口）。
        wakeAgent: async ({ sessionId, text }) => {
          const controller = ctx.get('sessionController');
          if (!controller || typeof controller.prompt !== 'function') {
            diagnose(journal, '唤醒失败：sessionController 不可用');
            return { ok: false, reason: 'sessionController 不可用' };
          }
          await controller.prompt(
            {
              requestId: `meihuayi-note-${Date.now()}`,
              sessionId,
              mode: 'queue',
              content: [{ type: 'text', text }],
            },
            // 这个接口要求真实 AbortSignal（内部会调 signal.throwIfAborted），不能传 undefined
            new AbortController().signal,
          );
          diagnose(journal, `已唤醒会话 ${sessionId} 建立学习笔记`);
          return { ok: true };
        },
      });
      scope.effect(
        () => scope.webServer.register({ kind: 'exact', path: ROUTE_PATH, handler }),
        'meihuayi: web route',
      );
    });
  }

  /* ── 3. 运行时技能（断卦方法论）───────────── */
  if (config.registerSkill !== false) {
    ctx.inject(['skills'], (scope) => {
      scope.effect(
        () =>
          scope.skills.register({
            name: 'meihuayi',
            description:
              '梅花易数卜卦：时间起卦、数字起卦、排盘与断卦方法论（三要十应、体用生克、结构化推断），以及卦例库与学习笔记。',
            whenToUse:
              '用户想占卜、算卦、起卦、问吉凶祸福、测一件事的成败，或要求查询/复盘历史卦例时使用。',
            content: SKILL_BODY,
            source: 'runtime',
            provider: 'meihuayi',
            invocation: { modelInvocable: true, userInvocable: true },
            resourceBase: {
              kind: 'directory',
              path: new URL('./data/', import.meta.url).pathname,
            },
            metadata: {
              emoji: '☯️',
              version: '1.0.0',
              references: Object.values(REFERENCES).map((r) => r.label),
            },
          }),
        'meihuayi: runtime skill',
      );
    });
  }
}
