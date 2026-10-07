import { chromium, type BrowserContext, type Page } from 'playwright-core';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { loadPrivateState, savePrivateState } from './privateState';
import { PROVIDERS, type BalanceAmount, type BalanceCard, type DataState, type Provider } from './types';

export const CONSOLES = {
  qwen: { url: 'https://billing-cost.console.aliyun.com/home', hosts: ['aliyun.com', 'alipay.com', 'taobao.com'] },
  mimo: { url: 'https://platform.xiaomimimo.com/console/balance', hosts: ['xiaomimimo.com', 'xiaomi.com', 'mi.com', 'accounts.google.com'] },
  glm: { url: 'https://open.bigmodel.cn/finance-center/finance/overview', hosts: ['bigmodel.cn', 'zhipuai.cn'] },
};
export const emptyBalance = (provider: Provider): BalanceCard => ({ provider, state: provider === 'deepseek' ? 'missing_key' : 'needs_login', amounts: [], observedAt: null, checkedAt: null, issue: null });
export const BALANCE_REFRESH_MS = 60_000;
export function allowedConsoleUrl(provider: Exclude<Provider, 'deepseek'>, value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' && CONSOLES[provider].hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)); } catch { return false; }
}
export async function waitForBalance<T>(read: () => Promise<T>, pause: () => Promise<void>, attempts = 12): Promise<T> {
  const deadline = Date.now() + 15_000;
  for (let i = 0; ; i++) {
    try { return await read(); } catch (e) { if (i >= attempts - 1 || Date.now() >= deadline) throw e; await pause(); }
  }
}
export function decimal(v: unknown): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const text = String(v).replace(/,/g, '').trim();
  return /^-?\d+(?:\.\d+)?$/.test(text) && Number.isFinite(Number(text)) && text.length <= 40 ? text : null;
}
export function deepseekBalance(raw: any): BalanceAmount[] {
  if (!Array.isArray(raw?.balance_infos) || !raw.balance_infos.length) throw new Error('invalid_data');
  return raw.balance_infos.map((v: any) => {
    const total = decimal(v.total_balance);
    if (total === null || !['CNY', 'USD'].includes(v.currency)) throw new Error('invalid_data');
    return { currency: v.currency, total, granted: decimal(v.granted_balance), toppedUp: decimal(v.topped_up_balance) };
  });
}
// The official finance console uses this report's balance in CNY. Do not read
// its initial DOM placeholder (balance || 0) before this request completes.
export function glmConsoleBalance(raw: any): BalanceAmount[] {
  const total = decimal(raw?.data?.balance);
  if (total === null) throw new Error('invalid_data');
  return [{ currency: 'CNY', total, granted: null, toppedUp: null, kind: 'balance' }];
}

// Read a value only when it is attached to a balance label and an explicit currency.
// A marketing price, credit count or unrelated invoice amount must never become a balance.
export function parseConsoleBalance(text: string, provider: Exclude<Provider, 'deepseek'>): BalanceAmount[] {
  const labels = provider === 'qwen' ? ['现金余额', '账户可用余额', '可用余额', '账户余额', '账户可用额度'] : ['账户余额', '总余额', '可用余额', 'Account Balance', 'Available Balance', 'Total Balance', ...(provider === 'mimo' ? ['余额', 'Balance'] : ['当前余额', 'Current Balance'])];
  const escaped = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const label of labels) {
    const candidates = new Map<string, BalanceAmount>();
    // MiMo's current amount heading is simply “余额 / Balance”. Anchor that
    // heading to a line so “现金余额”, “Bonus Balance” and credit limits cannot match.
    const prefix = label === '余额' || label === 'Balance' ? '^\\s*' : '';
    const pattern = new RegExp(`${prefix}${escaped(label)}\\s*(?:[（(]\\s*(人民币|元|CNY|USD|美元)\\s*[）)])?\\s*[:：]?\\s*(?:(¥|￥|\\$|CNY|USD|人民币|RMB)\\s*)?(-?\\d[\\d,]*(?:\\.\\d+)?)\\s*(元|美元|CNY|USD|人民币|RMB)?`, 'gim');
    for (const match of text.matchAll(pattern)) {
      const unit = match[1] || match[2] || match[4]; if (!unit) continue;
      const total = decimal(match[3]); if (total === null) continue;
      const currency = /\$|USD|美元/i.test(unit) ? 'USD' : 'CNY';
      candidates.set(`${currency}:${total}`, { currency, total, granted: null, toppedUp: null, kind: label === '账户可用额度' ? 'available_credit' : 'balance' });
    }
    // Multiple different matches for one label are ambiguous; do not guess which account.
    if (candidates.size === 1) return [...candidates.values()];
    if (candidates.size > 1 && provider !== 'qwen') throw new Error('invalid_data');
    // Alibaba may show several separate cash accounts. Do not pick one; try its
    // explicitly labelled account-wide available funds instead.
  }
  throw new Error('invalid_data');
}
const safeState = (error: any): DataState => ['needs_login', 'timeout', 'invalid_data', 'missing_key'].includes(error?.message) ? error.message : 'unavailable';
export class BalanceService {
  private values = new Map<Provider, BalanceCard>();
  private jobs = new Map<Provider, Promise<void>>();
  private contexts = new Map<Provider, BrowserContext>();
  private loginTimers = new Map<Provider, NodeJS.Timeout>();
  private closing = false;
  private savedStates = new Map<Provider, string>();
  private glmReports = new WeakMap<Page, Promise<BalanceAmount[] | null>>();
  private glmRequest: { url: string; headers: Record<string, string> } | null = null;
  constructor(private root: string, private onChange: () => void, initial: BalanceCard[] = []) {
    for (const provider of PROVIDERS) {
      const saved = initial.find(v => v.provider === provider);
      this.values.set(provider, saved?.amounts.length ? { ...saved, state: 'stale', issue: null, checkedAt: null } : emptyBalance(provider));
    }
  }
  snapshot() { return PROVIDERS.map(p => ({ ...this.values.get(p)!, refreshing: this.jobs.has(p) })); }
  private success(provider: Provider, amounts: BalanceAmount[]) {
    this.values.set(provider, { provider, amounts, state: 'ready', observedAt: Date.now(), checkedAt: Date.now(), issue: null }); this.onChange();
  }
  private failure(provider: Provider, issue: DataState) {
    const old = this.values.get(provider)!;
    this.values.set(provider, { ...old, state: old.amounts.length ? 'stale' : issue, issue, checkedAt: Date.now() }); this.onChange();
  }
  private async launch(provider: Exclude<Provider, 'deepseek'>, headless: boolean) {
    const profile = path.join(this.root, 'accounts', provider); await mkdir(profile, { recursive: true });
    const context = await chromium.launchPersistentContext(profile, { channel: 'msedge', headless, acceptDownloads: false, viewport: { width: 1100, height: 780 }, args: ['--no-first-run'], timeout: 20_000 });
    if (this.closing) { await context.close(); throw new Error('unavailable'); }
    await context.route('**/*', async route => {
      const request = route.request();
      if (request.isNavigationRequest()) {
        if (!allowedConsoleUrl(provider, request.url())) { await route.abort(); return; }
      }
      if (headless && ['image', 'font', 'media'].includes(request.resourceType())) { await route.abort(); return; }
      await route.continue();
    });
    try {
      const saved = await loadPrivateState(path.join(profile, 'session-state.dat'));
      if (Array.isArray(saved.cookies) && Array.isArray(saved.origins) && saved.cookies.every((c: any) => allowedConsoleUrl(provider, `https://${String(c.domain).replace(/^\./, '')}`)) && saved.origins.every((o: any) => allowedConsoleUrl(provider, o.origin))) {
        await context.setStorageState({ cookies: saved.cookies, origins: saved.origins });
        const sessions = Array.isArray(saved.sessions) ? saved.sessions.filter((s: any) => allowedConsoleUrl(provider, s.origin) && Array.isArray(s.entries)) : [];
        await context.addInitScript((sessions: any[]) => {
          const session = sessions.find(s => s.origin === location.origin);
          if (session) for (const [key, value] of session.entries) if (typeof key === 'string' && typeof value === 'string' && sessionStorage.getItem(key) === null) sessionStorage.setItem(key, value);
        }, sessions);
      }
    } catch { /* Older profiles still work; missing/expired state requires user login. */ }
    if (provider === 'glm') {
      const observe = (page: Page) => page.on('response', response => {
        const url = new URL(response.url());
        if (!allowedConsoleUrl('glm', response.url()) || !url.pathname.endsWith('/biz/account/query-customer-account-report')) return;
        this.glmReports.set(page, (async () => {
          if (!response.ok()) return null;
          let timer: NodeJS.Timeout | undefined;
          try {
            const raw = await Promise.race([response.json(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 8000); })]);
            const amounts = glmConsoleBalance(raw);
            if (response.request().method() === 'GET' && url.hostname === 'open.bigmodel.cn' && url.pathname === '/api/biz/account/query-customer-account-report' && !url.search) {
              const source = await response.request().allHeaders();
              const headers: Record<string, string> = {};
              for (const key of ['authorization', 'bigmodel-organization', 'bigmodel-project', 'accept-language', 'set-language']) if (source[key]) headers[key] = source[key];
              this.glmRequest = { url: url.href, headers };
            }
            return amounts;
          } catch { return null; } finally { clearTimeout(timer); }
        })());
      });
      context.pages().forEach(observe); context.on('page', observe);
    }
    this.contexts.set(provider, context);
    context.on('close', () => { if (this.contexts.get(provider) === context) { this.contexts.delete(provider); if (provider === 'glm') this.glmRequest = null; } });
    return context;
  }
  private async saveSession(provider: Exclude<Provider, 'deepseek'>, context: BrowserContext) {
    const state = await context.storageState();
    const sessions = [];
    for (const page of context.pages()) {
      if (!allowedConsoleUrl(provider, page.url())) continue;
      try { sessions.push(await page.evaluate(() => ({ origin: location.origin, entries: Object.entries(sessionStorage) }))); } catch { /* Closing popup. */ }
    }
    const value = { cookies: state.cookies.filter(c => allowedConsoleUrl(provider, `https://${c.domain.replace(/^\./, '')}`)), origins: state.origins.filter(o => allowedConsoleUrl(provider, o.origin)), sessions };
    const raw = JSON.stringify(value); if (this.savedStates.get(provider) === raw) return;
    await savePrivateState(path.join(this.root, 'accounts', provider, 'session-state.dat'), value); this.savedStates.set(provider, raw);
  }
  private async readPage(provider: Exclude<Provider, 'deepseek'>, page: Page) {
    const url = new URL(page.url()), host = url.hostname;
    const consoleHost = CONSOLES[provider].hosts[0];
    if (host !== consoleHost && !host.endsWith(`.${consoleHost}`)) throw new Error('needs_login');
    // Generic balance headings are only trusted on the actual MiMo balance page.
    if (provider === 'mimo' && url.pathname.replace(/\/$/, '') !== '/console/balance' && !/^#\/console\/balance(?:[/?]|$)/.test(url.hash)) throw new Error('needs_login');
    let text = '';
    // Balance panels may be rendered inside a same-origin iframe on Alibaba's console.
    for (const frame of page.frames()) {
      try {
        const frameHost = new URL(frame.url()).hostname;
        if (frameHost !== consoleHost && !frameHost.endsWith(`.${consoleHost}`)) continue;
        if (provider === 'qwen' && !['billing-cost.console.aliyun.com', 'usercenter2.aliyun.com', 'usercenter.aliyun.com'].includes(frameHost)) continue;
        text += '\n' + (await frame.locator('body').innerText({ timeout: 3000 })).slice(0, 150_000);
      } catch { /* Loading/cross-origin login frames are not inspected. */ }
    }
    try {
      if (provider === 'glm') {
        const report = await this.glmReports.get(page);
        if (!report) throw new Error('invalid_data');
        return report;
      }
      return parseConsoleBalance(text, provider);
    } catch (e) {
      if (/验证码|扫码登录|密码登录|登录账号|请登录|立即登录|用户登录|登录.{0,3}注册|Sign in|Log in|安全验证|人机验证/i.test(text) || /\/(?:login|signin|authorize)(?:\/|\?|#|$)/i.test(page.url())) throw new Error('needs_login');
      throw e;
    }
  }
  private async update(provider: Provider) {
    if (this.closing) return;
    let context: BrowserContext | undefined;
    try {
      if (provider === 'deepseek') {
        const key = process.env.DEEPSEEK_API_KEY; if (!key) throw new Error('missing_key');
        const response = await fetch('https://api.deepseek.com/user/balance', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(12_000) });
        if (!response.ok) throw new Error(response.status === 401 ? 'missing_key' : 'unavailable');
        this.success(provider, deepseekBalance(await response.json())); return;
      }
      context = this.contexts.get(provider);
      if (!context) {
        if (!existsSync(path.join(this.root, 'accounts', provider))) throw new Error('needs_login');
        context = await this.launch(provider, true);
      }
      if (this.loginTimers.has(provider)) return;
      // Reuse the exact read-only report request observed in the official console.
      // Authentication headers stay in memory and are sent only to this fixed URL.
      if (provider === 'glm' && this.glmRequest) {
        let response;
        try {
          response = await context.request.get(this.glmRequest.url, { headers: this.glmRequest.headers, timeout: 6000, maxRedirects: 0 });
          if (response.ok()) { const amounts = glmConsoleBalance(await response.json()); this.success(provider, amounts); return; }
        } catch { /* Fall back to the console to renew its session. */ }
        finally { await response?.dispose().catch(() => {}); }
        this.glmRequest = null;
      }
      const page = context.pages()[0] || await context.newPage();
      // Navigate on every read, including reused contexts: an old SPA DOM is not
      // evidence of a fresh server balance. The route handler disables HTTP cache.
      this.glmReports.delete(page);
      await page.goto(CONSOLES[provider].url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      const amounts = await waitForBalance(() => this.readPage(provider as Exclude<Provider, 'deepseek'>, page), () => page.waitForTimeout(1000));
      await this.saveSession(provider, context).catch(() => {}); this.success(provider, amounts);
    } catch (e) { this.failure(provider, (e as Error).name === 'TimeoutError' ? 'timeout' : safeState(e)); }
  }
  private enqueue(provider: Provider, task: () => Promise<void>) {
    const existing = this.jobs.get(provider); if (existing) return existing;
    const promise = task().finally(() => this.jobs.delete(provider)); this.jobs.set(provider, promise); return promise;
  }
  async refresh(force = false, selected?: Provider) {
    await Promise.all((selected ? [selected] : PROVIDERS).map(provider => {
      const last = this.values.get(provider)?.checkedAt;
      return !force && last && Date.now() - last < BALANCE_REFRESH_MS ? Promise.resolve() : this.enqueue(provider, () => this.update(provider));
    }));
  }
  async connect(provider: Exclude<Provider, 'deepseek'>) {
    if (this.closing) throw new Error('unavailable');
    if (this.jobs.has(provider)) await this.jobs.get(provider);
    if (this.loginTimers.has(provider)) return;
    await this.enqueue(provider, async () => {
      await this.contexts.get(provider)?.close().catch(() => {});
      const context = await this.launch(provider, false);
      const page = context.pages()[0] || await context.newPage();
      this.values.set(provider, { ...this.values.get(provider)!, state: 'login_open', issue: null }); this.onChange();
      let polling = false;
      const timer = setInterval(async () => {
        if (polling || this.closing) return; polling = true;
        try {
          for (const p of context.pages()) {
            try {
              const amounts = await this.readPage(provider, p); await this.saveSession(provider, context); this.success(provider, amounts);
              clearInterval(timer); this.loginTimers.delete(provider); this.contexts.delete(provider);
              await context.close(); return;
            } catch { /* Wait for the user to finish login and open their balance panel. */ }
          }
        } finally { polling = false; }
      }, 5000);
      this.loginTimers.set(provider, timer);
      const deadline = setTimeout(() => { clearInterval(timer); this.loginTimers.delete(provider); this.contexts.delete(provider); this.failure(provider, 'needs_login'); void context.close().catch(() => {}); }, 10 * 60_000);
      context.on('close', () => { clearInterval(timer); clearTimeout(deadline); this.loginTimers.delete(provider); this.contexts.delete(provider); if (this.values.get(provider)?.state === 'login_open') this.failure(provider, 'needs_login'); });
      await page.goto(CONSOLES[provider].url, { waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => { /* Leave visible window open for user recovery. */ });
    });
  }
  async close() {
    this.closing = true;
    for (const timer of this.loginTimers.values()) clearInterval(timer);
    this.loginTimers.clear(); await Promise.all([...this.contexts.values()].map(c => c.close().catch(() => {}))); this.contexts.clear();
    await Promise.allSettled([...this.jobs.values()]);
  }
}
