export type Provider = 'deepseek' | 'qwen' | 'mimo' | 'glm';
export type UsageRange = 'today' | '7' | '30' | 'all';
export type UsageScope = 'account' | 'local';
export type DataState = 'ready' | 'stale' | 'missing_key' | 'needs_login' | 'login_open' | 'unavailable' | 'timeout' | 'invalid_data' | 'no_cli';
export interface BalanceAmount { currency: string; total: string; granted: string | null; toppedUp: string | null; kind?: 'balance' | 'available_credit' }
export interface BalanceCard { provider: Provider; state: DataState; amounts: BalanceAmount[]; observedAt: number | null; checkedAt: number | null; issue: DataState | null; refreshing?: boolean }
export interface TokenUsage { input: number; cached: number; output: number; reasoning: number; total: number }
export interface DailyTokens { date: string; tokens: number }
export interface TokenStats {
  scope: UsageScope; state: DataState; issue: DataState | null; observedAt: number | null;
  total: number | null; details: TokenUsage | null; daily: DailyTokens[];
  models: Array<{ name: string; tokens: number }>; projects: Array<{ name: string; tokens: number }>;
  firstDate: string | null; lastDate: string | null; sessionCount: number | null;
  lifetimeTokens: number | null; peakDailyTokens: number | null;
  detailsIncomplete?: boolean;
}
export interface QuotaWindow { id: string; name: string; kind: 'primary' | 'secondary'; remainingPercent: number; windowMinutes: number | null; resetsAt: number | null }
export interface CodexQuota { state: DataState; issue: DataState | null; observedAt: number | null; windows: QuotaWindow[]; plan: string | null }
export interface UsageOverview { balances: BalanceCard[]; quota: CodexQuota; stats: TokenStats; range: UsageRange; timezone: string; refreshing?: boolean }
export const PROVIDERS: Provider[] = ['deepseek', 'qwen', 'mimo', 'glm'];
export function emptyStats(scope: UsageScope): TokenStats { return { scope, state: 'unavailable', issue: null, observedAt: null, total: null, details: null, daily: [], models: [], projects: [], firstDate: null, lastDate: null, sessionCount: null, lifetimeTokens: null, peakDailyTokens: null }; }
export function dateKey(timestamp: number, timezone: string, formatter?: Intl.DateTimeFormat) {
  const parts = (formatter || new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })).formatToParts(timestamp);
  const p = (type: string) => parts.find(part => part.type === type)?.value;
  return `${p('year')}-${p('month')}-${p('day')}`;
}
export function rangeDates(range: UsageRange, timezone: string, now = Date.now()) {
  const end = dateKey(now, timezone);
  if (range === 'all') return { start: '0000-01-01', end };
  const d = new Date(`${end}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - (range === 'today' ? 0 : Number(range) - 1));
  return { start: d.toISOString().slice(0, 10), end };
}
