import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emptyStats, rangeDates, type CodexQuota, type DataState, type DailyTokens, type TokenStats, type UsageRange } from './types';

const numeric = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
export function normalizeQuota(raw: any, now = Date.now()): CodexQuota {
  const windows: CodexQuota['windows'] = []; let plan: string | null = null;
  const grouped = raw?.rateLimitsByLimitId;
  const entries = grouped && typeof grouped === 'object' && !Array.isArray(grouped) && Object.keys(grouped).length ? Object.entries(grouped) : [['codex', raw?.rateLimits]];
  for (const [id, value] of entries) {
    const s = value as any; if (!s || typeof s !== 'object') continue;
    if (typeof s.planType === 'string') plan = s.planType.slice(0, 60);
    for (const kind of ['primary', 'secondary'] as const) {
      const w = s[kind]; if (numeric(w?.usedPercent) === null) continue;
      windows.push({ id: String(id).slice(0, 100), name: typeof s.limitName === 'string' ? s.limitName.slice(0, 100) : String(id).slice(0, 100), kind, remainingPercent: Math.max(0, Math.min(100, 100 - w.usedPercent)), windowMinutes: numeric(w.windowDurationMins), resetsAt: numeric(w.resetsAt) === null ? null : w.resetsAt * 1000 });
    }
  }
  return { state: windows.length ? 'ready' : 'unavailable', issue: null, observedAt: windows.length ? now : null, windows, plan };
}
export interface AccountUsage { lifetimeTokens: number | null; peakDailyTokens: number | null; daily: DailyTokens[] | null; observedAt: number }
export function normalizeAccount(raw: any, now = Date.now()): AccountUsage {
  if (!raw?.summary || typeof raw.summary !== 'object') throw new Error('invalid_data');
  if (Array.isArray(raw.dailyUsageBuckets) && raw.dailyUsageBuckets.some((b: any) => !/^\d{4}-\d{2}-\d{2}$/.test(b?.startDate) || !Number.isSafeInteger(b.tokens) || b.tokens < 0)) throw new Error('invalid_data');
  const daily = Array.isArray(raw.dailyUsageBuckets) ? raw.dailyUsageBuckets.map((b: any) => ({ date: b.startDate, tokens: b.tokens })) : null;
  // Duplicate date buckets are invalid rather than silently double counted.
  if (daily && new Set(daily.map(b => b.date)).size !== daily.length) throw new Error('invalid_data');
  return { lifetimeTokens: numeric(raw.summary.lifetimeTokens), peakDailyTokens: numeric(raw.summary.peakDailyTokens), daily: daily?.sort((a, b) => a.date.localeCompare(b.date)) ?? null, observedAt: now };
}
export function accountStats(data: AccountUsage | null, range: UsageRange, timezone: string, issue: DataState | null): TokenStats {
  if (!data) return { ...emptyStats('account'), issue };
  const dates = rangeDates(range, timezone);
  const daily = data.daily?.filter(b => b.date >= dates.start && b.date <= dates.end) || [];
  // A requested period outside the available buckets is unknown, not zero.
  const covered = data.daily?.length && dates.start >= data.daily[0].date && dates.end <= data.daily.at(-1)!.date;
  const total = range === 'all' ? data.lifetimeTokens : covered ? daily.reduce((sum, b) => sum + b.tokens, 0) : null;
  return { ...emptyStats('account'), state: issue ? 'stale' : total !== null || daily.length ? 'ready' : 'unavailable', issue, observedAt: data.observedAt, total, daily, firstDate: data.daily?.[0]?.date || null, lastDate: data.daily?.at(-1)?.date || null, lifetimeTokens: data.lifetimeTokens, peakDailyTokens: data.peakDailyTokens };
}

export function findCli(): { command: string; args: string[] } | null {
  const override = process.env.SCHEDULE_CODEX_CLI;
  const npm = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  const candidates = [override, npm].filter(Boolean) as string[];
  for (const file of candidates) if (existsSync(file)) {
    if (!file.endsWith('.js')) return { command: file, args: [] };
    // Launch the Windows binary directly so the npm shim cannot leave an orphan child.
    if (process.platform === 'win32') {
      const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
      const triple = arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
      let vendor = path.join(path.dirname(file), '..', 'vendor');
      try { vendor = path.join(path.dirname(createRequire(path.resolve(file)).resolve(`@openai/codex-win32-${arch}/package.json`)), 'vendor'); } catch { /* Older npm distributions embed vendor directly. */ }
      const binary = path.join(vendor, triple, 'bin', 'codex.exe');
      if (existsSync(binary)) return { command: binary, args: [] };
    }
    return { command: process.execPath, args: [file] };
  }
  return process.platform === 'win32' ? null : { command: 'codex', args: [] };
}

export class CodexClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private started: Promise<void> | null = null;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private seq = 0;
  private closed = false;
  private usesShim = false;
  private request(method: string, params: unknown): Promise<any> {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('timeout')); this.stopChild(); }, 20_000);
      this.pending.set(id, { resolve, reject, timer });
      this.child?.stdin.write(`${JSON.stringify({ id, method, params })}\n`, error => { if (error) { const p = this.pending.get(id); if (p) { clearTimeout(p.timer); this.pending.delete(id); p.reject(new Error('unavailable')); } } });
    });
  }
  private stopChild() {
    const child = this.child; this.child = null; this.started = null;
    if (child && child.exitCode === null && child.signalCode === null) {
      if (process.platform === 'win32' && this.usesShim && child.pid) {
        try { execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 3000 }); } catch { child.kill(); }
      } else child.kill();
    }
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('unavailable')); }
    this.pending.clear();
  }
  private async start() {
    if (this.closed) throw new Error('unavailable');
    if (this.started) return this.started;
    const cli = findCli(); if (!cli) throw new Error('no_cli');
    this.usesShim = cli.args.length > 0;
    this.started = (async () => {
      const child = spawn(cli.command, [...cli.args, 'app-server', '--listen', 'stdio://'], { windowsHide: true, stdio: 'pipe', cwd: os.homedir() });
      this.child = child; let buffer = '';
      child.stderr.on('data', () => { /* Do not expose CLI diagnostics or account details. */ });
      child.on('error', () => this.stopChild());
      child.on('exit', () => { if (this.child === child) this.stopChild(); });
      child.stdout.on('data', chunk => {
        buffer += chunk.toString(); if (buffer.length > 4_000_000) { this.stopChild(); return; }
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
          let m: any; try { m = JSON.parse(line); } catch { continue; }
          const p = this.pending.get(m.id); if (!p) continue;
          clearTimeout(p.timer); this.pending.delete(m.id);
          if (m.error) p.reject(new Error(m.error.code === -32601 ? 'unavailable' : 'unavailable')); else p.resolve(m.result);
        }
      });
      await this.request('initialize', { clientInfo: { name: 'study_desk_usage', title: 'Study Desk usage', version: '1.0.0' }, capabilities: { experimentalApi: true } });
      child.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`);
    })().catch(error => { this.stopChild(); throw error; });
    return this.started;
  }
  async read() {
    await this.start();
    const [quota, account] = await Promise.allSettled([this.request('account/rateLimits/read', null), this.request('account/usage/read', null)]);
    return { quota, account };
  }
  async close() { this.closed = true; this.stopChild(); }
}
