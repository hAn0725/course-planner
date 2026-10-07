export const STORAGE_KEYS = Object.fromEntries(['courses', 'assignments', 'settings', 'notifications', 'terms'].map(name => [name.toUpperCase(), `study_desk_${name}_v1`])) as Record<'COURSES' | 'ASSIGNMENTS' | 'SETTINGS' | 'NOTIFICATIONS' | 'TERMS', string>;

// Keep earlier browser data without publishing an institution-specific key.
// The old entry remains as a backup; an existing new entry always wins.
export function readStoredValue(storage: Storage, key: string): string | null {
  const current = storage.getItem(key);
  if (current !== null) return current;
  const name = /^study_desk_(courses|assignments|settings|notifications|terms)_v1$/.exec(key)?.[1];
  if (!name) return null;
  const pattern = new RegExp(`^univ_course_schedule_${name}_[a-z0-9]+_v5$`);
  const candidates: string[] = [];
  for (let i = 0; i < storage.length; i++) { const oldKey = storage.key(i); if (oldKey && pattern.test(oldKey)) candidates.push(oldKey); }
  if (candidates.length !== 1) return null;
  const saved = storage.getItem(candidates[0]);
  if (saved !== null) { try { storage.setItem(key, saved); } catch { /* Read old data even when storage is full. */ } }
  return saved;
}
