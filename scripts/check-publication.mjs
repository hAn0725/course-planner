import { execFileSync } from 'node:child_process';

// Inspect the staged snapshot only. Never print matched values or file bodies.
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const files = git(['ls-files', '-z']).split('\0').filter(Boolean);
const secrets = Object.entries(process.env).filter(([key, value]) => /(?:API.*KEY|KEY.*API|ACCESS.*TOKEN|SECRET|PASSWORD)/i.test(key) && value?.length >= 12).map(([, value]) => value);
const privatePath = /(?:^|\/)(?:\.env(?!\.example$)|accounts|private|exports|backups|\.cache|node_modules|dist)(?:\/|$)|(?:usage-cache\.json|session-state\.dat|\.(?:har|pem|key|jsonl))$/i;
const sensitive = /\bsk-[a-z\d_-]{20,}\b|\b(?:ghp_|github_pat_)[a-z\d_]{20,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:C:[\\/]Users[\\/](?!Public\b|Default\b)[^\\/\s]+)/i;
const privateMarkers = (process.env.PUBLICATION_PRIVATE_MARKERS || '').split('|').filter(Boolean);
const findings = [];
for (const file of files) {
  if (privatePath.test(file)) { findings.push({ file, issue: 'private file' }); continue; }
  const raw = execFileSync('git', ['show', `:${file}`], { maxBuffer: 32 * 1024 * 1024 });
  const text = raw.toString('utf8');
  if (secrets.some(value => text.includes(value))) findings.push({ file, issue: 'environment secret' });
  if (privateMarkers.some(value => text.toLowerCase().includes(value.toLowerCase()))) findings.push({ file, issue: 'private marker' });
  if (!/\.(?:png|ico)$/i.test(file) && sensitive.test(text)) findings.push({ file, issue: 'sensitive marker' });
}
if (findings.length) { console.error(JSON.stringify({ files: files.length, findings }, null, 2)); process.exitCode = 1; }
else console.log(`Publication check passed: ${files.length} staged files; no matched private files, sensitive markers or environment secrets.`);
