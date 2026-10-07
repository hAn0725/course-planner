// Accounting helpers adapted from follow-your-codex (MIT); see THIRD_PARTY_NOTICES.md.
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { dateKey, emptyStats, rangeDates, type TokenStats, type TokenUsage, type UsageRange } from './types';

const FIELDS: Array<keyof TokenUsage> = ['input', 'cached', 'output', 'reasoning', 'total'];
export const zero = (): TokenUsage => ({ input: 0, cached: 0, output: 0, reasoning: 0, total: 0 });
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
export function readUsage(v: any): TokenUsage | null {
  if (!v || typeof v !== 'object') return null;
  const input = number(v.input_tokens), output = number(v.output_tokens);
  const value = { input, output, cached: number(v.cached_input_tokens ?? v.input_tokens_details?.cached_tokens), reasoning: number(v.reasoning_output_tokens ?? v.output_tokens_details?.reasoning_tokens), total: typeof v.total_tokens === 'number' && Number.isFinite(v.total_tokens) && v.total_tokens >= 0 ? v.total_tokens : input + output };
  return FIELDS.some(k => value[k] > 0) ? value : null;
}
export function delta(current: TokenUsage, previous: TokenUsage) {
  return Object.fromEntries(FIELDS.map(k => [k, Math.max(0, current[k] - previous[k])])) as unknown as TokenUsage;
}
const add = (target: TokenUsage, value: TokenUsage) => { for (const k of FIELDS) target[k] += value[k]; };
interface Event { timestamp: number; model: string; project: string; usage: TokenUsage; fingerprint: string }
export interface ParsedSession { id: string; parent: string | null; events: Event[]; malformed: number }
const label = (v: unknown, fallback: string) => typeof v === 'string' && v.trim() ? v.slice(0, 200) : fallback;
const projectName = (v: unknown) => typeof v === 'string' ? label(v.replace(/[\\/]+$/, '').split(/[\\/]/).pop(), 'Unknown project') : 'Unknown project';

export class SessionParser {
  result: ParsedSession;
  private previous: TokenUsage | null = null;
  private project = 'Unknown project';
  private model = 'Unknown model';
  private seen = new Set<string>();
  constructor(id: string) { this.result = { id, parent: null, events: [], malformed: 0 }; }
  line(line: string) {
    // Avoid parsing conversation and tool records. Nothing from those records is retained.
    if (!/"type"\s*:\s*"(?:session_meta|turn_context|event_msg)"/.test(line)) return;
    let record: any; try { record = JSON.parse(line); } catch { this.result.malformed++; return; }
    const p = record?.payload; if (!p || typeof p !== 'object') return;
    if (record.type === 'session_meta') {
      this.result.id = label(p.id, this.result.id);
      this.result.parent = typeof p.forked_from_id === 'string' ? p.forked_from_id : typeof p.parent_thread_id === 'string' ? p.parent_thread_id : null;
      if (p.cwd) this.project = projectName(p.cwd); return;
    }
    if (record.type === 'turn_context') { if (p.model) this.model = label(p.model, 'Unknown model'); if (p.cwd) this.project = projectName(p.cwd); return; }
    if (record.type !== 'event_msg' || p.type !== 'token_count' || !p.info) return;
    if (p.model) this.model = label(p.model, 'Unknown model');
    const timestamp = Date.parse(record.timestamp); if (!Number.isFinite(timestamp)) return;
    const current = readUsage(p.info.total_token_usage), last = readUsage(p.info.last_token_usage);
    const usage = current && this.previous ? current.total < this.previous.total ? last || current : delta(current, this.previous) : last || current;
    if (current) this.previous = current;
    if (!usage || !FIELDS.some(k => usage[k] > 0)) return;
    const fingerprint = createHash('sha256').update(JSON.stringify([timestamp, this.model, this.project, current, last])).digest('hex');
    if (this.seen.has(fingerprint)) return;
    this.seen.add(fingerprint);
    this.result.events.push({ timestamp, model: this.model, project: this.project, usage, fingerprint });
  }
}
export function parseSessionText(text: string, id = 'session'): ParsedSession { const parser = new SessionParser(id); for (const line of text.split(/\r?\n/)) parser.line(line); return parser.result; }

export function aggregateSessions(sessions: ParsedSession[], range: UsageRange, timezone: string, now = Date.now()): TokenStats {
  // The same session can temporarily exist in both the current and archive directories.
  const unique = new Map<string, ParsedSession>();
  for (const s of sessions) { if ((unique.get(s.id)?.events.length ?? -1) < s.events.length) unique.set(s.id, s); }
  const fingerprints = new Map([...unique].map(([id, s]) => [id, new Set(s.events.map(e => e.fingerprint))]));
  const { start, end } = rangeDates(range, timezone, now);
  const totals = zero(), daily = new Map<string, number>(), models = new Map<string, number>(), projects = new Map<string, number>(), active = new Set<string>();
  let detailsIncomplete = false;
  let firstDate: string | null = null, lastDate: string | null = null;
  const formatter = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  for (const s of unique.values()) {
    const inherited = new Set<string>(), visited = new Set<string>(); let parent = s.parent;
    while (parent && !visited.has(parent)) { visited.add(parent); for (const f of fingerprints.get(parent) || []) inherited.add(f); parent = unique.get(parent)?.parent || null; }
    for (const e of s.events) {
      if (inherited.has(e.fingerprint)) continue;
      const date = dateKey(e.timestamp, timezone, formatter);
      if (firstDate === null || date < firstDate) firstDate = date;
      if (lastDate === null || date > lastDate) lastDate = date;
      if (date < start || date > end) continue;
      if (e.usage.total !== e.usage.input + e.usage.output) detailsIncomplete = true;
      add(totals, e.usage); active.add(s.id);
      daily.set(date, (daily.get(date) || 0) + e.usage.total);
      models.set(e.model, (models.get(e.model) || 0) + e.usage.total);
      projects.set(e.project, (projects.get(e.project) || 0) + e.usage.total);
    }
  }
  const rank = (m: Map<string, number>) => [...m].map(([name, tokens]) => ({ name, tokens })).sort((a, b) => b.tokens - a.tokens).slice(0, 20);
  return { ...emptyStats('local'), state: 'ready', observedAt: now, total: totals.total, details: totals, detailsIncomplete, daily: [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, tokens]) => ({ date, tokens })), models: rank(models), projects: rank(projects), firstDate, lastDate, sessionCount: active.size };
}

export class CodexScanner {
  private cache = new Map<string, { size: number; mtime: number; parsed: ParsedSession }>();
  private scanning: Promise<ParsedSession[]> | null = null;
  private checked = 0;
  private available = false;
  private failed = false;
  constructor(private home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')) {}
  private async files(root: string): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    return (await Promise.all(entries.map(e => e.isDirectory() ? this.files(path.join(root, e.name)) : e.isFile() && e.name.endsWith('.jsonl') ? [path.join(root, e.name)] : []))).flat();
  }
  private async scan(): Promise<ParsedSession[]> {
    const roots = ['sessions', 'archived_sessions'].map(d => path.join(this.home, d));
    this.available = (await Promise.all(roots.map(root => stat(root).then(s => s.isDirectory()).catch(() => false)))).some(Boolean);
    const files = (await Promise.all(roots.map(r => this.files(r)))).flat(); const seen = new Set(files);
    this.failed = false;
    // Bound open handles. Only changed files are reparsed, one line at a time.
    for (const file of files) {
      try {
        const s = await stat(file), old = this.cache.get(file);
        if (old?.size === s.size && old.mtime === s.mtimeMs) continue;
        const parser = new SessionParser(path.basename(file, '.jsonl'));
        const reader = createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
        for await (const line of reader) parser.line(line);
        this.cache.set(file, { size: s.size, mtime: s.mtimeMs, parsed: parser.result });
      } catch { this.failed = true; /* Keep a previous successful parse if the file is temporarily locked. */ }
    }
    for (const key of this.cache.keys()) if (!seen.has(key)) this.cache.delete(key);
    this.checked = Date.now(); return [...this.cache.values()].map(v => v.parsed);
  }
  async read(range: UsageRange, timezone: string, force = false) {
    if (!this.scanning && (force || !this.checked || Date.now() - this.checked > 60_000)) this.scanning = this.scan().finally(() => { this.scanning = null; });
    const sessions = this.scanning ? await this.scanning : [...this.cache.values()].map(v => v.parsed);
    if (!this.available || (this.failed && !sessions.length)) return emptyStats('local');
    const result = aggregateSessions(sessions, range, timezone);
    return this.failed ? { ...result, state: 'stale' as const, issue: 'unavailable' as const } : result;
  }
}
