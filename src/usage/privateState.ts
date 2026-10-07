import { spawn } from 'node:child_process';
import { readFile, writeFile, rename } from 'node:fs/promises';

// Use the current Windows user's DPAPI. Secrets go through stdin, never command
// arguments, logs, API responses or the repository. Other platforms use mode 0600.
async function protect(input: string, decrypt: boolean): Promise<string> {
  const script = `Add-Type -AssemblyName System.Security; $s=[Console]::In.ReadToEnd(); $b=${decrypt ? '[Convert]::FromBase64String($s)' : '[Text.Encoding]::UTF8.GetBytes($s)'}; $r=[Security.Cryptography.ProtectedData]::${decrypt ? 'Unprotect' : 'Protect'}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write(${decrypt ? '[Text.Encoding]::UTF8.GetString($r)' : '[Convert]::ToBase64String($r)'})`;
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    let output = '', settled = false;
    const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(output); };
    const timer = setTimeout(() => { child.kill(); finish(new Error('private_state')); }, 8000);
    child.stdout.setEncoding('utf8'); child.stdout.on('data', (chunk: string) => { output += chunk; if (output.length > 8_000_000) { child.kill(); finish(new Error('private_state')); } });
    child.on('error', () => finish(new Error('private_state')));
    child.on('close', code => finish(code === 0 ? undefined : new Error('private_state')));
    child.stdin.on('error', () => finish(new Error('private_state'))); child.stdin.end(input);
  });
}
export async function savePrivateState(file: string, state: unknown) {
  const raw = JSON.stringify(state);
  if (raw.length > 4_000_000) throw new Error('private_state');
  const value = JSON.stringify({ version: 1, format: process.platform === 'win32' ? 'dpapi' : 'json', value: process.platform === 'win32' ? await protect(raw, false) : raw });
  await writeFile(`${file}.tmp`, value, { mode: 0o600 }); await rename(`${file}.tmp`, file);
}
export async function loadPrivateState(file: string): Promise<any> {
  const raw = await readFile(file, 'utf8'); if (raw.length > 8_000_000) throw new Error('private_state');
  const data = JSON.parse(raw);
  if (data.version !== 1 || typeof data.value !== 'string' || !['dpapi', 'json'].includes(data.format)) throw new Error('private_state');
  if (process.platform === 'win32' && data.format !== 'dpapi') throw new Error('private_state');
  return JSON.parse(data.format === 'dpapi' ? await protect(data.value, true) : data.value);
}
