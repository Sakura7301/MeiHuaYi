/**
 * Web 路由：界面点击起卦的宿主入口。
 *
 * 只做「解析请求 → 调用 operations → 序列化响应」，不含任何业务逻辑，
 * 因此界面与 Agent 工具的结果必然一致。
 *
 * 唯一例外是「反馈后自动建笔记」：界面保存反馈时，这里会通过
 * sessionController.prompt 往当前会话投一条消息，把 AI 直接唤醒去建笔记——
 * 否则 AI 要等用户下一次开口才知道，等于没有自动化。
 */
import { createOperations } from './operations.js';

const MAX_BODY = 64 * 1024;

/** 路由路径（界面按同源相对路径请求）。 */
export const ROUTE_PATH = '/meihuayi/api';

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}

/**
 * 同源判定：挡住别的网页驱动本接口。
 * 浏览器总会带上 Origin（含同源请求），缺失 Origin 说明调用方不是页面；
 * 而跨站页面一定带 Origin 且与 Host 不同，因此这个比较足以拦住 CSRF。
 */
function sameOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > MAX_BODY) throw new Error('请求体过大');
    chunks.push(buf);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/**
 * @param {ReturnType<import('./store.js').createJournal>} journal
 */
export function createRouteHandler(journal, options = {}) {
  const ops = createOperations(journal);

  return async function handle(req, res) {
    if (!sameOrigin(req)) {
      sendJson(res, 403, { ok: false, error: '拒绝跨站请求' });
      return;
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: '请使用 POST' });
      return;
    }

    let body;
    try {
      body = await readJson(req);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: `请求体解析失败：${error.message}` });
      return;
    }

    /**
     * 反馈保存后，若「反馈后自动建笔记」为开且拿到了 sessionId，
     * 就往该会话投一条消息把 AI 唤醒，让它立刻建笔记。
     * 投递失败不影响反馈本身的保存结果（只记在返回值里）。
     */
    async function wakeForNote(input, result) {
      try {
        const autoNote = journal.getSettings().autoNote;
        if (!autoNote) return;
        const sessionId = input.sessionId;
        if (!sessionId || typeof options.wakeAgent !== 'function') return;
        const lines = [
          '【梅花易数 · 自动任务：用户刚在界面保存了反馈】',
          `卦例 #${input.id} 的反馈已保存：`,
          `- 实际结果：${input.result || '（未填写）'}`,
          `- 判断：${input.correct ? '✅ 正确' : '❌ 错误'}`,
          input.reason ? `- 原因：${input.reason}` : null,
          input.xiangAnalysis ? `- 取象分析：${input.xiangAnalysis}` : null,
          '',
          `请立即调用 meihuayi_journal（action="note"）为 #${input.id} 建立学习笔记：`,
          'recordId、correct、question_type、reason_analysis、lesson、improvement 都要填，内容要具体实用。',
          '建好后用一句话告诉用户笔记已建立即可，不要重复展示排盘。',
        ].filter((x) => x !== null);
        const sent = await options.wakeAgent({ sessionId, text: lines.join('\n') });
        if (sent && sent.ok === false) result.wake = sent.reason || 'failed';
      } catch (error) {
        result.wake = error instanceof Error ? error.message : String(error);
      }
    }

    const call = {
      cast: () => ops.cast(body),
      now: () => ops.now(),
      records: () => ops.records(body),
      detail: () => ops.detail(body),
      update: () => ops.saveAnalysis(body),
      feedback: async () => {
        const result = ops.feedback(body);
        if (result.ok) await wakeForNote(body, result);
        return result;
      },
      summary: () => ops.summary(body),
      delete: () => ops.removeRecords(body),
      notes: () => ops.notes(body),
      note_stats: () => ops.noteStats(),
      settings: () => ops.settings(body),
      reference: () => ops.reference(body),
    }[body.action];

    if (!call) {
      sendJson(res, 400, { ok: false, error: `未知 action：${body.action}` });
      return;
    }

    try {
      const result = await call();
      // 详情/列表类响应可能很大，界面只需要文本与原始数据。
      sendJson(res, result.ok === false ? 400 : 200, result);
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  };
}
