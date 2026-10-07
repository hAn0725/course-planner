import { Router } from 'express';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BalanceService, decimal, emptyBalance } from './balances';
import { CodexClient, accountStats, normalizeAccount, normalizeQuota, type AccountUsage } from './codex';
import { CodexScanner } from './scanner';
import { PROVIDERS, type BalanceCard, type CodexQuota, type DataState, type Provider, type UsageRange, type UsageScope } from './types';

const errorState = (e: any): DataState => ['timeout', 'no_cli', 'invalid_data'].includes(e?.message) ? e.message : 'unavailable';
const timestamp = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
const userDataRoot = () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'StudyDesk');
export class UsageService {
  balances!: BalanceService;
  private client = new CodexClient();
  private scanner: CodexScanner;
  private quota: CodexQuota = { state: 'unavailable', issue: null, observedAt: null, windows: [], plan: null };
  private account: AccountUsage | null = null;
  private accountIssue: DataState | null = null;
  private checked = 0;
  private codexJob: Promise<void> | null = null;
  private saving: Promise<void> = Promise.resolve();
  private initialized: Promise<void>;
  constructor(private root = userDataRoot(), codexHome?: string) {
    this.scanner = new CodexScanner(codexHome);
    this.initialized = this.load();
  }
  private async load() {
    let cards: BalanceCard[] = [];
    try {
      const cache = JSON.parse(await readFile(path.join(this.root, 'usage-cache.json'), 'utf8'));
      if (cache.version === 1) {
        cards = PROVIDERS.map(provider => {
          const b = cache.balances?.find((v: any) => v.provider === provider);
          if (!b || !Array.isArray(b.amounts) || b.amounts.length > 5) return emptyBalance(provider);
          const amounts = b.amounts.filter((a: any) => ['CNY', 'USD'].includes(a?.currency) && decimal(a.total) !== null).map((a: any) => ({ currency: a.currency, total: decimal(a.total)!, granted: decimal(a.granted), toppedUp: decimal(a.toppedUp), kind: a.kind === 'available_credit' ? 'available_credit' as const : 'balance' as const }));
          return { ...emptyBalance(provider), amounts, observedAt: timestamp(b.observedAt) };
        });
        if (cache.account) {
          this.account = normalizeAccount({ summary: { lifetimeTokens: cache.account.lifetimeTokens, peakDailyTokens: cache.account.peakDailyTokens }, dailyUsageBuckets: cache.account.daily?.map((d: any) => ({ startDate: d.date, tokens: d.tokens })) }, timestamp(cache.account.observedAt) || Date.now());
          this.accountIssue = 'unavailable';
        }
        if (cache.quota) {
          // Revalidate through the same wire normalizer, never trust persisted percentages.
          const grouped: Record<string, any> = Object.create(null);
          for (const w of cache.quota.windows || []) {
            if (!['primary', 'secondary'].includes(w.kind) || typeof w.id !== 'string' || w.id === '__proto__') continue;
            grouped[w.id] ||= { limitName: w.name, planType: cache.quota.plan };
            grouped[w.id][w.kind] = { usedPercent: typeof w.remainingPercent === 'number' ? 100 - w.remainingPercent : null, windowDurationMins: w.windowMinutes, resetsAt: w.resetsAt === null ? null : w.resetsAt / 1000 };
          }
          const q = normalizeQuota({ rateLimitsByLimitId: grouped }, timestamp(cache.quota.observedAt) || Date.now());
          if (q.windows.length) this.quota = { ...q, state: 'stale', issue: 'unavailable' };
        }
      }
    } catch { /* Missing/corrupt private cache is not a zero balance. */ }
    this.balances = new BalanceService(this.root, () => this.save(), cards);
  }
  private save() {
    const value = JSON.stringify({ version: 1, balances: this.balances?.snapshot() || [], quota: this.quota, account: this.account });
    this.saving = this.saving.catch(() => {}).then(async () => {
      await mkdir(this.root, { recursive: true });
      const file = path.join(this.root, 'usage-cache.json'); await writeFile(`${file}.tmp`, value, { mode: 0o600 }); await rename(`${file}.tmp`, file);
    }).catch(() => { /* A read result can still be shown if private cache cannot be written. */ });
  }
  private async refreshCodex(force: boolean) {
    if (this.codexJob) return this.codexJob;
    if (!force && this.checked && Date.now() - this.checked < 60_000) return;
    this.codexJob = (async () => {
      try {
        const result = await this.client.read();
        if (result.quota.status === 'fulfilled') {
          const q = normalizeQuota(result.quota.value);
          this.quota = q.state === 'ready' ? q : { ...this.quota, state: this.quota.windows.length ? 'stale' : 'unavailable', issue: 'invalid_data' };
        } else this.quota = { ...this.quota, state: this.quota.windows.length ? 'stale' : errorState(result.quota.reason), issue: errorState(result.quota.reason) };
        if (result.account.status === 'fulfilled') {
          try { this.account = normalizeAccount(result.account.value); this.accountIssue = null; } catch (e) { this.accountIssue = errorState(e); }
        } else this.accountIssue = errorState(result.account.reason);
      } catch (e) {
        const issue = errorState(e); this.quota = { ...this.quota, state: this.quota.windows.length ? 'stale' : issue, issue }; this.accountIssue = issue;
      } finally { this.checked = Date.now(); this.save(); }
    })().finally(() => { this.codexJob = null; });
    return this.codexJob;
  }
  async overview(range: UsageRange, scope: UsageScope, timezone: string, force = false, background = false, poll = false, provider?: Provider) {
    await this.initialized;
    const refresh = poll ? Promise.resolve() : Promise.all([this.balances.refresh(force, provider), provider ? Promise.resolve() : this.refreshCodex(force)]);
    if (background) void refresh.catch(() => {}); else await refresh;
    const local = scope === 'local' ? await this.scanner.read(range, timezone, force && !provider) : null;
    const balances = this.balances.snapshot();
    return { balances, quota: this.quota, stats: scope === 'local' ? local! : accountStats(this.account, range, timezone, this.accountIssue), range, timezone, refreshing: balances.some(b => b.refreshing) || !!this.codexJob };
  }
  async connect(provider: Exclude<Provider, 'deepseek'>) { await this.initialized; await this.balances.connect(provider); }
  async close() { await this.client.close(); await this.initialized; await this.balances.close(); await this.saving; }
}

export function createUsageRouter(service: UsageService) {
  const router = Router();
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const host = req.get('host'), origin = req.get('origin');
    if (!host || !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) || (origin && origin !== `http://${host}` && origin !== `https://${host}`)) { res.status(403).json({ code: 'origin' }); return; }
    next();
  });
  const read = async (req: any, res: any, force: boolean) => {
    const input = req.method === 'GET' ? req.query : req.body || {};
    const range = input.range ?? 'all', scope = input.scope ?? 'account', timezone = input.timezone ?? 'Asia/Shanghai';
    const provider = force ? input.provider : undefined, poll = req.method === 'GET' && input.poll === '1';
    try {
      if (!['today', '7', '30', 'all'].includes(range) || !['account', 'local'].includes(scope) || typeof timezone !== 'string' || timezone.length > 100) throw new Error();
      new Intl.DateTimeFormat('en', { timeZone: timezone });
      if (provider !== undefined && !PROVIDERS.includes(provider)) throw new Error();
    } catch { res.status(400).json({ code: 'invalid_request' }); return; }
    try { res.json(await service.overview(range, scope, timezone, force, true, poll, provider)); } catch { res.status(503).json({ code: 'unavailable' }); }
  };
  router.get('/overview', (req, res) => { void read(req, res, false); });
  router.post('/refresh', (req, res) => { void read(req, res, true); });
  router.post('/accounts/:provider/connect', async (req, res) => {
    const provider = req.params.provider;
    if (!['qwen', 'mimo', 'glm'].includes(provider)) { res.status(400).json({ code: 'invalid_request' }); return; }
    try { await service.connect(provider as Exclude<Provider, 'deepseek'>); res.json({ state: 'login_open' }); }
    catch { res.status(503).json({ code: 'browser_unavailable' }); }
  });
  return router;
}
export const usageService = new UsageService();
export const usageRouter = createUsageRouter(usageService);
