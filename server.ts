import express from 'express';
import path from 'path';
import { exec } from 'child_process';
import { createServer as createViteServer } from 'vite';
import { aiRouter } from './src/ai/server';
import { usageRouter, usageService } from './src/usage/server';

const app = express();
const PORT = Number(process.env.SCHEDULE_PORT) || 3000;

/* ============================================================
 * 网页关闭自动停止（心跳看门狗）
 * ------------------------------------------------------------
 * 网页每 4 秒 POST /api/heartbeat，证明“网页还开着”：
 * 1. 页面关闭/刷新时经 navigator.sendBeacon 发 /api/bye，
 *    服务端宽限 5 秒（容忍页面刷新、多标签）没有新心跳就停止；
 * 2. 若浏览器被整体关闭（来不及发 bye），靠心跳超时兜底：
 *    超过 100 秒没有任何心跳即停止。阈值必须大于 60 秒，
 *    因为标签页在后台时浏览器会把定时器放慢到约 1 次/分钟；
 * 3. 若启动后 120 秒内从未收到任何心跳（比如自动打开的网页
 *    被立刻关掉），同样自动停止。
 * ============================================================ */
const HEARTBEAT_LAPSE_MS = 100_000;
const BYE_GRACE_MS = 5_000;
const FIRST_BEAT_TIMEOUT_MS = 120_000;

const startedAt = Date.now();
let lastBeatAt = 0; // 0 表示从未收到心跳
let byeTimer: NodeJS.Timeout | null = null;

function openBrowser() {
  // 设 SCHEDULE_NO_OPEN=1 可跳过（用于测试/CI）
  if (process.platform === 'win32' && process.env.SCHEDULE_NO_OPEN !== '1') {
    exec(`start "" http://localhost:${PORT}`, { windowsHide: true });
  }
}

function shutdown(reason: string) {
  console.log(`\n${reason}`);
  console.log('课程表已停止，本窗口将自动关闭。');
  void usageService.close().finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 30_000).unref();
}

process.once('SIGINT', () => shutdown('正在关闭课程表。'));
process.once('SIGTERM', () => shutdown('正在关闭课程表。'));

app.use(express.json({ limit: '10mb' }));
app.use('/api/ai', aiRouter);
app.use('/api/usage', usageRouter);

// 页面心跳：网页每 4 秒调用一次
app.post('/api/heartbeat', (_req, res) => {
  lastBeatAt = Date.now();
  if (byeTimer) {
    clearTimeout(byeTimer);
    byeTimer = null; // 有新心跳（页面刷新或还有其他标签页），取消关闭
  }
  res.json({ ok: true });
});

// 页面关闭/刷新时的“再见”信号：宽限 5 秒后自动停止
app.post('/api/bye', (_req, res) => {
  res.json({ ok: true });
  if (!byeTimer) {
    byeTimer = setTimeout(() => {
      byeTimer = null;
      shutdown('检测到课程表网页已关闭，自动停止服务。');
    }, BYE_GRACE_MS);
  }
});

// Health Check API
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

async function isAlreadyRunning(): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

async function startServer() {
  // 先探测 3000 端口：课程表已在运行就直接打开网页退出，
  // 避免重复启动带来的 HMR 端口占用报错
  if (await isAlreadyRunning()) {
    console.log(`Port ${PORT} is in use - the schedule app is already running. Opening the page...`);
    openBrowser();
    setTimeout(() => process.exit(0), 800);
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`University Course Schedule server running at http://127.0.0.1:${PORT}`);
    openBrowser();
    startWatchdog();
  });

  // 端口被占用 = 课程表大概率已经在运行：帮用户打开网页后正常退出
  server.on('error', (err: Error) => {
    if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      console.log(`Port ${PORT} is already in use - the schedule app is probably already running.`);
      openBrowser();
      process.exit(0);
    }
    console.error('Server failed to start:', err);
    process.exit(1);
  });
}

function startWatchdog() {
  setInterval(() => {
    const now = Date.now();
    if (lastBeatAt === 0) {
      if (now - startedAt > FIRST_BEAT_TIMEOUT_MS) {
        shutdown('一直没有网页连接，自动停止服务。');
      }
      return;
    }
    if (now - lastBeatAt > HEARTBEAT_LAPSE_MS) {
      shutdown('检测到课程表网页已关闭（或浏览器已退出），自动停止服务。');
    }
  }, 5_000);
}

startServer();
