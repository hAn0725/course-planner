import { AssignmentReminder } from '../types';

export function getAssignmentDueAt(assignment: AssignmentReminder): Date | null {
  const dueAt = new Date(`${assignment.dueDate}T${assignment.dueTime || '23:59'}:00`);
  return Number.isNaN(dueAt.getTime()) ? null : dueAt;
}

export function shouldTriggerAssignmentReminder(assignment: AssignmentReminder, now: Date): boolean {
  if (assignment.completed || assignment.notificationSent) return false;
  const dueAt = getAssignmentDueAt(assignment);
  if (!dueAt) return false;
  const minutesUntilDue = Math.ceil((dueAt.getTime() - now.getTime()) / 60_000);
  return minutesUntilDue >= 0 && minutesUntilDue <= assignment.reminderMinutesBefore;
}

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 重复事项完成本次后移动到下一次；跳过已过去的日期，避免补打卡。 */
export function toggleReminder(item: AssignmentReminder, now: Date): AssignmentReminder {
  if (item.completed || !item.repeat || item.repeat === 'none') return { ...item, completed: !item.completed };
  const next = getAssignmentDueAt(item);
  if (!next) return item;
  do {
    next.setDate(next.getDate() + (item.repeat === 'weekly' ? 7 : 1));
  } while (next <= now || (item.repeat === 'weekdays' && [0, 6].includes(next.getDay())));
  return { ...item, dueDate: localDate(next), notificationSent: false,
    completedDates: [...(item.completedDates || []), item.dueDate] };
}
