// Anonymous browser smoke check: no credentials, login actions or paid requests.
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { BalanceService } from '../src/usage/balances';

const root = path.resolve('.cache/usage-browser-check');
for (const provider of ['qwen', 'mimo', 'glm']) await mkdir(path.join(root, 'accounts', provider), { recursive: true });
const service = new BalanceService(root, () => {});
try {
  await service.refresh(true);
  for (const b of service.snapshot().filter(b => b.provider !== 'deepseek')) {
    assert.equal(b.amounts.length, 0, 'An anonymous console must not yield a balance');
    console.log(b.provider, b.state);
  }
} finally {
  await service.close(); assert.ok(root.startsWith(path.resolve('.cache') + path.sep)); await rm(root, { recursive: true, force: true });
}
