// Read-only integration check. No model completions, credentials or balances are printed.
import { CodexClient, normalizeAccount, normalizeQuota } from '../src/usage/codex';
import { CodexScanner } from '../src/usage/scanner';
import { BalanceService } from '../src/usage/balances';
import path from 'node:path';

const client = new CodexClient();
try {
  const results = await client.read();
  console.log('Codex quota:', results.quota.status === 'fulfilled' ? normalizeQuota(results.quota.value).state : 'unavailable');
  console.log('Codex account:', results.account.status === 'fulfilled' ? (normalizeAccount(results.account.value).lifetimeTokens === null ? 'null summary' : 'ready') : 'unavailable');
  if (results.quota.status === 'rejected') console.log('quota category:', results.quota.reason?.message);
  if (results.account.status === 'rejected') console.log('account category:', results.account.reason?.message);
} catch (e) { console.log('Codex connection:', (e as Error).message); }
finally { await client.close(); }
const local = await new CodexScanner().read('all', 'Asia/Shanghai');
console.log('Codex local:', local.state, 'model categories:', local.models.length, 'daily buckets:', local.daily.length);
const balances = new BalanceService(path.resolve('.cache/usage-live'), () => {});
try { await balances.refresh(true); for (const b of balances.snapshot()) console.log(b.provider, b.state, 'currencies:', b.amounts.map(a => a.currency).join(',')); }
finally { await balances.close(); }
