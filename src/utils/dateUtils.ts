import { Course, DayOfWeek, MeetingSession, ScheduleConflict } from '../types';
import { getMeetingsForDate, isCourseActiveInWeek } from '../data/academicCalendar';

export const DAYS_MAP: Record<DayOfWeek, { label: string; full: string; index: number }> = {
  M: { label: 'Mon', full: 'Monday', index: 1 },
  T: { label: 'Tue', full: 'Tuesday', index: 2 },
  W: { label: 'Wed', full: 'Wednesday', index: 3 },
  R: { label: 'Thu', full: 'Thursday', index: 4 },
  F: { label: 'Fri', full: 'Friday', index: 5 },
  S: { label: 'Sat', full: 'Saturday', index: 6 },
  U: { label: 'Sun', full: 'Sunday', index: 0 },
};

export const WEEKDAYS: DayOfWeek[] = ['M', 'T', 'W', 'R', 'F'];
export const ALL_DAYS: DayOfWeek[] = ['M', 'T', 'W', 'R', 'F', 'S', 'U'];

export function jsDayToDayOfWeek(jsDay: number): DayOfWeek {
  // jsDay: 0 is Sunday, 1 is Monday ... 6 is Saturday
  switch (jsDay) {
    case 0: return 'U';
    case 1: return 'M';
    case 2: return 'T';
    case 3: return 'W';
    case 4: return 'R';
    case 5: return 'F';
    case 6: return 'S';
    default: return 'M';
  }
}

export function dayOfWeekToJsDay(day: DayOfWeek): number {
  switch (day) {
    case 'U': return 0;
    case 'M': return 1;
    case 'T': return 2;
    case 'W': return 3;
    case 'R': return 4;
    case 'F': return 5;
    case 'S': return 6;
  }
}

export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const mins = parseInt(parts[1], 10) || 0;
  return hours * 60 + mins;
}

export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function formatTimeDisplay(timeStr: string, format: '12h' | '24h' | string = '12h'): string {
  if (!timeStr) return '';
  if (format === '24h') return timeStr;
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export function formatTimeRange(startTime: string, endTime: string, format: '12h' | '24h' = '12h'): string {
  return `${formatTimeDisplay(startTime, format)} – ${formatTimeDisplay(endTime, format)}`;
}

export function calculateCourseDurationMinutes(startTime: string, endTime: string): number {
  return Math.max(0, timeStringToMinutes(endTime) - timeStringToMinutes(startTime));
}

export function findScheduleConflicts(courses: Course[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      const c1 = courses[i];
      const c2 = courses[j];

      // 分段教学课程即使星期和时间相同，只要周次不重叠就不应被标记为冲突。
      const activeWeeksOverlap = Array.from({ length: 19 }, (_, index) => index + 1)
        .some(week => isCourseActiveInWeek(c1.weeks, week) && isCourseActiveInWeek(c2.weeks, week));
      if (!activeWeeksOverlap) continue;

      for (const s1 of c1.meetings) {
        for (const s2 of c2.meetings) {
          if (s1.day === s2.day && Array.from({ length: 19 }, (_, i) => i + 1).some(w => isCourseActiveInWeek(s1.weeks ?? c1.weeks, w) && isCourseActiveInWeek(s2.weeks ?? c2.weeks, w))) {
            const start1 = timeStringToMinutes(s1.startTime);
            const end1 = timeStringToMinutes(s1.endTime);
            const start2 = timeStringToMinutes(s2.startTime);
            const end2 = timeStringToMinutes(s2.endTime);

            // Overlap check
            const overlapStart = Math.max(start1, start2);
            const overlapEnd = Math.min(end1, end2);

            if (overlapStart < overlapEnd) {
              conflicts.push({
                course1: c1,
                session1: s1,
                course2: c2,
                session2: s2,
                day: s1.day,
                overlapDurationMinutes: overlapEnd - overlapStart,
              });
            }
          }
        }
      }
    }
  }

  return conflicts;
}

export interface CurrentOrNextClassInfo {
  status: 'in_progress' | 'upcoming_today' | 'upcoming_future' | 'none';
  course: Course | null;
  session: MeetingSession | null;
  timeUntilMinutes: number;
  minutesRemainingInClass?: number;
  dayName: string;
  /** 相对 referenceDate 的天数偏移：0=今天, 1=明天, ... */
  dayOffset: number;
  /** 上课日期 "YYYY-MM-DD" */
  dateStr?: string;
  /** 是否为调休补课日上的课 */
  isMakeup?: boolean;
  /** 调休补课说明（如 “补10月6日(周二)课表”） */
  makeupNote?: string;
}

const DAY_OFFSET = 13; // 最多向后查找两周，覆盖国庆长假等连续假期

export function getNextClassInfo(courses: Course[], referenceDate: Date = new Date()): CurrentOrNextClassInfo {
  if (!courses.length) {
    return { status: 'none', course: null, session: null, timeUntilMinutes: 0, dayName: '', dayOffset: 0 };
  }

  const nowMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();

  // 逐日查找（日期感知）：自动跳过预备周、假期停课日、考试周与寒假，
  // 调休补课日会返回被补日期的课表（含补课标记）。
  for (let offset = 0; offset <= DAY_OFFSET; offset++) {
    const dayDate = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() + offset
    );
    const res = getMeetingsForDate(courses, dayDate);
    if (!res.meetings.length) continue;

    const sorted = [...res.meetings].sort(
      (a, b) => timeStringToMinutes(a.session.startTime) - timeStringToMinutes(b.session.startTime)
    );

    const dayName =
      offset === 0
        ? 'Today'
        : offset === 1
        ? 'Tomorrow'
        : DAYS_MAP[res.day].full;

    const common = {
      dayName,
      dayOffset: offset,
      dateStr: res.dateStr,
    };

    if (offset === 0) {
      // 1. 现在正在上的课
      for (const { course, session, isMakeupSession, makeupSourceNote } of sorted) {
        const start = timeStringToMinutes(session.startTime);
        const end = timeStringToMinutes(session.endTime);
        if (nowMinutes >= start && nowMinutes < end) {
          return {
            status: 'in_progress',
            course,
            session,
            timeUntilMinutes: 0,
            minutesRemainingInClass: end - nowMinutes,
            isMakeup: isMakeupSession,
            makeupNote: makeupSourceNote,
            ...common,
          };
        }
      }
      // 2. 今天稍后要上的课
      for (const { course, session, isMakeupSession, makeupSourceNote } of sorted) {
        const start = timeStringToMinutes(session.startTime);
        if (start > nowMinutes) {
          return {
            status: 'upcoming_today',
            course,
            session,
            timeUntilMinutes: start - nowMinutes,
            isMakeup: isMakeupSession,
            makeupNote: makeupSourceNote,
            ...common,
          };
        }
      }
      // 今天没了，继续看后面几天
      continue;
    }

    // 3. 未来几天最早的一节课
    const { course, session, isMakeupSession, makeupSourceNote } = sorted[0];
    const start = timeStringToMinutes(session.startTime);
    return {
      status: 'upcoming_future',
      course,
      session,
      timeUntilMinutes: offset * 24 * 60 - nowMinutes + start,
      isMakeup: isMakeupSession,
      makeupNote: makeupSourceNote,
      ...common,
    };
  }

  return { status: 'none', course: null, session: null, timeUntilMinutes: 0, dayName: '', dayOffset: 0 };
}
