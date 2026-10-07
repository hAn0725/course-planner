import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChartNoAxesCombined, Clock3, Link2, LoaderCircle, RefreshCw, Wallet } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { PROVIDERS, type Provider, type UsageOverview, type UsageRange, type UsageScope } from '../usage/types';

const names: Record<Provider, string> = { deepseek: 'DeepSeek', qwen: 'Qwen', mimo: 'MiMo', glm: 'GLM' };
const urls: Record<Provider, string> = { deepseek: 'https://platform.deepseek.com/usage', qwen: 'https://billing-cost.console.aliyun.com/home', mimo: 'https://platform.xiaomimimo.com/console/balance', glm: 'https://open.bigmodel.cn/finance-center/finance/overview' };
export function UsagePage() {
  const { t, language } = useTranslation();
  const label = (key: string) => t(`usage.${key}`);
  const [data, setData] = useState<UsageOverview | null>(null);
  const [range, setRange] = useState<UsageRange>('all');
  const [scope, setScope] = useState<UsageScope>('account');
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState<Provider | null>(null);
  const [error, setError] = useState('');
  const [expandedRanks, setExpandedRanks] = useState<Record<string, boolean>>({});
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const load = useCallback(async (force = false, poll = false, provider?: Provider) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    if (!poll) { setBusy(true); setError(''); }
    try {
      const params = { range, scope, timezone, ...(poll ? { poll: '1' } : {}), ...(provider ? { provider } : {}) };
      const response = await fetch(force ? '/api/usage/refresh' : `/api/usage/overview?${new URLSearchParams(params)}`, force ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params), signal: controller.signal } : { signal: controller.signal });
      if (!response.ok) throw new Error();
      const value = await response.json();
      if (!Array.isArray(value.balances) || !Array.isArray(value.quota?.windows) || !value.stats || value.stats.scope !== scope || value.range !== range) throw new Error();
      if (!controller.signal.aborted && mounted.current) setData(value);
    } catch { if (!controller.signal.aborted && mounted.current) setError('failed'); }
    finally { if (request.current === controller && mounted.current) setBusy(false); }
  }, [range, scope, timezone]);
  useEffect(() => {
    mounted.current = true; void load();
    const refreshVisible = () => { if (!document.hidden) void load(); };
    const interval = setInterval(refreshVisible, 60_000);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => { mounted.current = false; request.current?.abort(); clearInterval(interval); document.removeEventListener('visibilitychange', refreshVisible); };
  }, [load]);
  const loginOpen = data?.balances.some(b => b.state === 'login_open');
  useEffect(() => { if (!data?.refreshing) return; const timer = setInterval(() => { if (!document.hidden) void load(false, true); }, 1000); return () => clearInterval(timer); }, [data?.refreshing, load]);
  useEffect(() => { if (!loginOpen) return; const timer = setInterval(() => { if (!document.hidden) void load(); }, 5000); return () => clearInterval(timer); }, [loginOpen, load]);
  const connect = async (provider: Provider) => {
    setConnecting(provider); setError('');
    try {
      const response = await fetch(`/api/usage/accounts/${provider}/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error();
      if (mounted.current) await load();
    } catch { if (mounted.current) setError('browserFailed'); }
    finally { if (mounted.current) setConnecting(null); }
  };
  const format = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(n);
  const time = (n: number | null) => n ? new Intl.DateTimeFormat(language, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(n) : label('never');
  const windowName = (n: number | null) => n == null ? '' : n >= 1440 && n % 1440 === 0 ? `${n / 1440} ${label('days')}` : n >= 60 && n % 60 === 0 ? `${n / 60} ${label('hours')}` : `${n} ${label('minutes')}`;
  const stats = data?.stats.scope === scope && data?.range === range ? data.stats : null;
  const bars = stats?.daily.slice(-30) || [];
  const maximum = Math.max(1, ...bars.map(b => b.tokens));
  const rankName = (name: string) => name === 'Unknown model' ? label('unknownModel') : name === 'Unknown project' ? label('unknownProject') : name;
  const ranks = (title: string, rows: Array<{ name: string; tokens: number }>) => <div className="usage-rank"><h4>{label(title)}</h4>{rows.length ? <ol>{(expandedRanks[title] ? rows : rows.slice(0, 5)).map(row => <li key={row.name}><span title={rankName(row.name)}>{rankName(row.name)}</span><strong>{format(row.tokens)}</strong></li>)}</ol> : <p className="usage-note">{label('empty')}</p>}{rows.length > 5 && <button className="usage-text-button usage-rank-expand" aria-expanded={!!expandedRanks[title]} onClick={() => setExpandedRanks(old => ({ ...old, [title]: !old[title] }))}>{label(expandedRanks[title] ? 'collapse' : 'expand')}</button>}</div>;
  return <section className="usage-page" aria-labelledby="usage-page-title">
    <div className="usage-page-heading"><div><h2 id="usage-page-title">{label('title')}</h2><p>{label('subtitle')}</p></div><button className="usage-button usage-refresh" onClick={() => void load(true)} disabled={busy || !!connecting || !!data?.refreshing}><RefreshCw size={15} className={busy || data?.refreshing ? 'usage-spin' : ''} />{label(busy || data?.refreshing ? 'refreshing' : 'refresh')}</button></div>
    {error && <p className="usage-error" role="alert">{label(error)}</p>}
    <div className="usage-panel usage-balances"><div className="usage-section-title"><Wallet size={17} /><h3>{label('balances')}</h3></div><div className="usage-balance-grid">
      {PROVIDERS.map(provider => {
        const balance = data?.balances.find(b => b.provider === provider);
        const state = balance?.state;
        return <article className="usage-balance" key={provider}>
          <div className="usage-provider-heading"><strong>{names[provider]}</strong><div className="usage-provider-actions"><button className="usage-text-button" aria-label={`${names[provider]} ${label('refresh')}`} title={`${names[provider]} ${label('refresh')}`} disabled={busy || !!balance?.refreshing || state === 'login_open'} onClick={() => void load(true, false, provider)}><RefreshCw size={14} className={balance?.refreshing ? 'usage-spin' : ''} /></button><a href={urls[provider]} target="_blank" rel="noopener noreferrer" aria-label={`${names[provider]} ${label('openConsole')}`}><ArrowUpRight size={14} /></a></div></div>
          <span className="usage-provider-caption">{provider === 'qwen' ? balance?.amounts.some(a => a.kind === 'available_credit') ? label('qwenCredit') : label('qwenAccount') : label('funds')}</span>
          {balance?.amounts.length ? balance.amounts.map(amount => <div key={amount.currency}><div className="usage-money"><span>{amount.currency === 'CNY' ? '¥' : '$'}</span><strong>{new Intl.NumberFormat(language, { maximumFractionDigits: 6, minimumFractionDigits: 2 }).format(Number(amount.total))}</strong></div><div className="usage-balance-parts">{amount.granted != null && <span>{label('granted')} {amount.granted}</span>}{amount.toppedUp != null && <span>{label('toppedUp')} {amount.toppedUp}</span>}</div></div>) : <div className="usage-money is-empty">{data ? label('unavailable') : '—'}</div>}
          <p className={`usage-state ${state === 'ready' ? 'is-ready' : ''}`} role="status"><span />{balance?.refreshing ? label('refreshing') : state ? label(state) : label('pending')}</p>
          {balance?.issue && balance.state === 'stale' && <p className="usage-note">{label('readIssue')}：{label(balance.issue)}</p>}
          <p className="usage-timestamp">{balance?.observedAt ? `${label('updated')} ${time(balance.observedAt)}` : label('never')}</p>
          {balance?.state === 'stale' && balance.checkedAt && <p className="usage-timestamp">{label('checked')} {time(balance.checkedAt)}</p>}
          {provider !== 'deepseek' && <button className="usage-button usage-connect" disabled={!!connecting || !!balance?.refreshing || state === 'login_open'} onClick={() => void connect(provider)}>{connecting === provider ? <LoaderCircle size={13} className="usage-spin" /> : state === 'ready' ? <Check size={13} /> : <Link2 size={13} />}{label(state === 'ready' || state === 'stale' ? 'reconnect' : 'connect')}</button>}
          {state === 'missing_key' && <p className="usage-note">{label('apiHint')}</p>}
        </article>;
      })}
    </div>{loginOpen ? <p className="usage-login-hint" role="status">{label('loginHint')}</p> : <p className="usage-note usage-balance-hint">{label('consoleHint')}</p>}</div>
    <div className="usage-panel"><div className="usage-section-title"><Clock3 size={17} /><h3>{label('quota')}</h3>{data?.quota.plan && <span className="usage-plan">{data.quota.plan}</span>}</div>
      {data?.quota.windows.length ? <div className="usage-quota-grid">{data.quota.windows.map(w => <div className="usage-quota" key={`${w.id}:${w.kind}`}><div className="usage-quota-heading"><span>{w.name}</span><span>{windowName(w.windowMinutes)}</span></div><p><strong>{w.remainingPercent}%</strong><span>{label('remaining')}</span></p><div className="usage-meter" role="progressbar" aria-label={`${w.name} ${windowName(w.windowMinutes)} ${label('remaining')}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={w.remainingPercent}><span style={{ width: `${w.remainingPercent}%` }} /></div><span className="usage-note">{label('resets')} {w.resetsAt ? time(w.resetsAt) : '—'}</span></div>)}</div> : <p className="usage-empty-inline">{busy ? label('pending') : label('noQuota')}</p>}
      {data?.quota.state === 'stale' && <p className="usage-error">{label('stale')} · {label(data.quota.issue || 'unavailable')}</p>}
      <p className="usage-note usage-quota-foot">{label('creditsNote')}{data?.quota.observedAt ? ` · ${label('updated')} ${time(data.quota.observedAt)}` : ''}</p>
    </div>
    <div className="usage-panel usage-statistics"><div className="usage-section-title"><ChartNoAxesCombined size={17} /><h3>{label('tokens')}</h3></div>
      <div className="usage-stat-controls"><div className="usage-segment" role="group" aria-label={label('tokens')}>{(['account', 'local'] as const).map(s => <button aria-pressed={scope === s} key={s} onClick={() => setScope(s)}>{label(s)}</button>)}</div><div className="usage-ranges" role="group" aria-label={label('coverage')}>{([['today', 'today'], ['7', 'seven'], ['30', 'thirty'], ['all', 'all']] as const).map(([r, key]) => <button aria-pressed={range === r} key={r} onClick={() => setRange(r)}>{label(key)}</button>)}</div></div>
      <p className="usage-note">{label(scope === 'account' ? 'sourceAccount' : 'sourceLocal')}</p>
      <div className="usage-token-summary"><div><span>{label('total')}</span><strong>{format(stats?.total)}</strong></div>{scope === 'account' ? <div><span>{label('peak')}</span><strong>{format(stats?.peakDailyTokens)}</strong></div> : <div><span>{label('sessions')}</span><strong>{format(stats?.sessionCount)}</strong></div>}</div>
      {stats?.state === 'stale' && <p className="usage-error">{label('stale')} · {label(stats.issue || 'unavailable')}</p>}
      {scope === 'account' && stats?.total === null && <p className="usage-empty-inline">{range !== 'all' && stats.firstDate ? label('periodMissing') : label('unavailable')} <button className="usage-text-button" onClick={() => setScope('local')}>{label('fallback')}</button></p>}
      {stats?.details && <><div className="usage-token-details">{(['input', 'cached', 'output', 'reasoning'] as const).map(key => <div key={key}><span>{label(key)}</span><strong>{format(stats.details![key])}</strong></div>)}</div><p className="usage-note">{label('subset')}</p></>}
      <div className="usage-chart-heading"><h4>{label('trend')}</h4>{stats?.firstDate && <span>{label('coverage')} {stats.firstDate} — {stats.lastDate}</span>}</div>
      {stats?.detailsIncomplete && <p className="usage-note">{label('partialDetails')}</p>}
      {bars.length ? <><div className="usage-chart" role="img" aria-label={`${label('trend')}: ${bars.map(b => `${b.date}: ${format(b.tokens)}`).join('; ')}`}>{bars.map(b => <div key={b.date} className="usage-chart-column" title={`${b.date} · ${format(b.tokens)} Token`}><div className="usage-chart-track"><span style={{ height: `${Math.max(b.tokens ? 2 : 0, b.tokens / maximum * 100)}%` }} /></div></div>)}</div><div className="usage-chart-axis" data-single={bars.length === 1}>{[bars[0], bars.length > 2 ? bars[Math.floor(bars.length / 2)] : null, bars.length > 1 ? bars.at(-1) : null].filter(Boolean).map(b => <span key={b.date} title={b.date}>{b.date.slice(5)}</span>)}</div>{stats!.daily.length > 30 && <p className="usage-note">{label('recordsNote')}</p>}</> : <div className="usage-chart-empty">{busy && !stats ? label('pending') : stats?.total === null ? label('unavailable') : label('empty')}</div>}
      {scope === 'local' && stats && <div className="usage-rank-grid">{ranks('models', stats.models)}{ranks('projects', stats.projects)}</div>}
      <p className="usage-note usage-stat-foot">{label('scopeHint')}{stats?.observedAt ? ` · ${label('updated')} ${time(stats.observedAt)}` : ''}</p>
    </div>
  </section>;
}
