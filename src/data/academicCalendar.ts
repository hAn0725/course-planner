import { DayOfWeek, Course, MeetingSession } from '../types';

export interface AcademicWeekInfo {
  weekNumber: number;
  label: string;
  chineseNumeral: string;
  startDate: string;
  endDate: string;
  dateRangeText: string;
  holidayText?: string;
  isHolidayWeek?: boolean;
  notes?: string;
  adjustmentSummary?: string;
}

export interface DayScheduleAdjustment {
  date: string;
  weekNumber: number;
  day: DayOfWeek;
  type: 'holiday_off' | 'makeup_class' | 'exam_week' | 'normal';
  title: string;
  badgeText: string;
  badgeType: 'holiday' | 'makeup' | 'exam' | 'info';
  timetableSourceDay?: DayOfWeek;
  description: string;
  makeupForDate?: string;
  sourceWeekNumber?: number;
}

function asDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function asShortDate(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

const weekNumerals = ['预', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '考', '假'];
const firstDayOfSeptember = new Date(new Date().getFullYear(), 8, 1);
const firstTeachingMonday = new Date(firstDayOfSeptember);
firstTeachingMonday.setDate(firstDayOfSeptember.getDate() + ((8 - firstDayOfSeptember.getDay()) % 7));
const termStart = new Date(firstTeachingMonday);
termStart.setDate(firstTeachingMonday.getDate() - 7);

export const DEFAULT_ACADEMIC_CALENDAR: AcademicWeekInfo[] = Array.from({ length: 21 }, (_, weekNumber) => {
  const start = new Date(termStart);
  start.setDate(termStart.getDate() + weekNumber * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + (weekNumber === 20 ? 41 : 6));
  const label = weekNumber === 0 ? '预备周' : weekNumber === 20 ? '假期' : weekNumber === 19 ? '第19周（考试）' : `第${weekNumber}周`;
  return {
    weekNumber,
    label,
    chineseNumeral: weekNumerals[weekNumber] || String(weekNumber),
    startDate: asDateString(start),
    endDate: asDateString(end),
    dateRangeText: `${asShortDate(start)} - ${asShortDate(end)}`,
    ...(weekNumber === 20 ? { isHolidayWeek: true, holidayText: '学期假期', notes: '本学期结束' } : {}),
  };
});

// The generic calendar includes an exam week but no institution-specific holiday or make-up dates.
const examWeek = DEFAULT_ACADEMIC_CALENDAR[19];
const examDayOffsets: Array<[DayOfWeek, number]> = [['M', 0], ['T', 1], ['W', 2], ['R', 3], ['F', 4]];
export const DEFAULT_DAY_ADJUSTMENTS: Record<string, DayScheduleAdjustment> = Object.fromEntries(
  examDayOffsets.map(([day, offset]) => {
    const date = new Date(`${examWeek.startDate}T00:00:00`);
    date.setDate(date.getDate() + offset);
    const dateKey = asDateString(date);
    return [dateKey, {
      date: dateKey,
      weekNumber: 19,
      day,
      type: 'exam_week',
      title: '考试周',
      badgeText: '考试',
      badgeType: 'exam',
      description: '常规课程暂停',
    }];
  }),
);
/**
 * Helper to get date string "YYYY-MM-DD" for a specific week number and day of week.
 */
export function getDateForWeekAndDay(weekNumber: number, day: DayOfWeek): string | null {
  const weekInfo = DEFAULT_ACADEMIC_CALENDAR.find(w => w.weekNumber === weekNumber);
  if (!weekInfo || !weekInfo.startDate) return null;

  const [y, m, d] = weekInfo.startDate.split('-').map(Number);
  const startObj = new Date(y, m - 1, d);

  const dayIndexMap: Record<DayOfWeek, number> = {
    M: 0, T: 1, W: 2, R: 3, F: 4, S: 5, U: 6
  };
  const offset = dayIndexMap[day] ?? 0;
  
  const targetDate = new Date(startObj);
  targetDate.setDate(startObj.getDate() + offset);

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns any special day adjustment for a given week and day.
 */
export function getDayAdjustment(weekNumber: number | 'all', day: DayOfWeek): DayScheduleAdjustment | null {
  if (typeof weekNumber !== 'number') return null;
  const dateStr = getDateForWeekAndDay(weekNumber, day);
  if (!dateStr) return null;
  return DEFAULT_DAY_ADJUSTMENTS[dateStr] || null;
}

/**
 * Parses week expressions like "1-16周", "10-17周", "7-14周", "1-14周", "14-17周", "9-16周", or "1,3,5周"
 * and returns true if targetWeek falls within the parsed range.
 */
export function isCourseActiveInWeek(courseWeeksStr: string | undefined, targetWeek: number): boolean {
  // 预备周(第0周)尚未开课，任何课程都不显示
  if (targetWeek === 0) return false;
  if (targetWeek === 20) return false; // Winter break
  // 未标注周次的课程默认整个学期有效
  if (!courseWeeksStr) return true;

  const clean = courseWeeksStr.replace(/周/g, '').trim();

  // Pattern: "1-16", "10-17", "7-14"
  const rangeMatch = clean.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    return targetWeek >= start && targetWeek <= end;
  }

  // Comma separated e.g. "1,2,3,4"
  const parts = clean.split(/[,，]/);
  for (const part of parts) {
    const subRange = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (subRange) {
      const s = parseInt(subRange[1], 10);
      const e = parseInt(subRange[2], 10);
      if (targetWeek >= s && targetWeek <= e) return true;
    } else {
      const num = parseInt(part.trim(), 10);
      if (num === targetWeek) return true;
    }
  }

  return false;
}

export interface DayMeetingResult {
  course: Course;
  session: MeetingSession;
  isMakeupSession?: boolean;
  makeupSourceNote?: string;
  isSuspended?: boolean;
  suspensionReason?: string;
}

/**
 * Returns the meetings scheduled for a day after applying any configured date adjustments.
 */
export function getMeetingsForWeekAndDay(
  courses: Course[],
  weekNumber: number | 'all',
  day: DayOfWeek,
  applyHolidayAdjustments: boolean = true
): {
  meetings: DayMeetingResult[];
  adjustment: DayScheduleAdjustment | null;
} {
  // 已确认的教务时段直接按实际周次执行，不再次调休。
  if (courses.some(c => c.scheduleVerified)) {
    const remaining = getMeetingsForWeekAndDay(courses.filter(c => !c.scheduleVerified), weekNumber, day, applyHolidayAdjustments);
    const exact = courses.filter(c => c.scheduleVerified).flatMap(c => c.meetings
      .filter(m => m.day === day && (typeof weekNumber !== 'number' || (isCourseActiveInWeek(c.weeks, weekNumber) && isCourseActiveInWeek(m.weeks ?? c.weeks, weekNumber))))
      .map(session => ({ course: c, session, isMakeupSession: remaining.adjustment?.type === 'makeup_class' })));
    return { meetings: [...remaining.meetings, ...exact], adjustment: exact.length && remaining.adjustment?.type !== 'makeup_class' ? null : remaining.adjustment };
  }
  // If 'all' weeks or adjustments disabled: standard logic
  if (typeof weekNumber !== 'number' || !applyHolidayAdjustments) {
    const filteredCourses = typeof weekNumber === 'number'
      ? courses.filter(c => isCourseActiveInWeek(c.weeks, weekNumber))
      : courses;

    const list: DayMeetingResult[] = [];
    filteredCourses.forEach(c => {
      c.meetings.forEach(m => {
        if (m.day === day && (typeof weekNumber !== 'number' || isCourseActiveInWeek(m.weeks ?? c.weeks, weekNumber))) {
          list.push({ course: c, session: m });
        }
      });
    });
    return { meetings: list, adjustment: null };
  }

  // Check if this day has calendar adjustments
  const adjustment = getDayAdjustment(weekNumber, day);

  // Active courses in this week
  const weekCourses = courses.filter(c => isCourseActiveInWeek(c.weeks, weekNumber));

  if (!adjustment) {
    // Normal day
    const list: DayMeetingResult[] = [];
    weekCourses.forEach(c => {
      c.meetings.forEach(m => {
        if (m.day === day && (typeof weekNumber !== 'number' || isCourseActiveInWeek(m.weeks ?? c.weeks, weekNumber))) {
          list.push({ course: c, session: m });
        }
      });
    });
    return { meetings: list, adjustment: null };
  }

  // 1. If it's a holiday off or exam week
  if (adjustment.type === 'holiday_off' || adjustment.type === 'exam_week') {
    // Return empty active meetings (or empty with adjustment info)
    return { meetings: [], adjustment };
  }

  // 2. If it's a makeup class day on weekend
  if (adjustment.type === 'makeup_class' && adjustment.timetableSourceDay) {
    const sourceDay = adjustment.timetableSourceDay;
    // 补课应执行“被补日期”所在周的课程范围（如 9.27 补第5周周二的课）
    const sourceWeek = adjustment.sourceWeekNumber ?? weekNumber;
    const sourceWeekCourses = courses.filter(c => isCourseActiveInWeek(c.weeks, sourceWeek));
    const list: DayMeetingResult[] = [];

    sourceWeekCourses.forEach(c => {
      c.meetings.forEach(m => {
        if (m.day === sourceDay && isCourseActiveInWeek(m.weeks ?? c.weeks, sourceWeek)) {
          list.push({
            course: c,
            session: {
              ...m,
              id: `${m.id}_makeup_${day}`,
              day: day, // mapped to this weekend day
            },
            isMakeupSession: true,
            makeupSourceNote: adjustment.makeupForDate || `调休补周${sourceDay}课表`,
          });
        }
      });
    });

    return { meetings: list, adjustment };
  }

  // Default fallback
  const list: DayMeetingResult[] = [];
  weekCourses.forEach(c => {
    c.meetings.forEach(m => {
      if (m.day === day && (typeof weekNumber !== 'number' || isCourseActiveInWeek(m.weeks ?? c.weeks, weekNumber))) {
        list.push({ course: c, session: m });
      }
    });
  });
  return { meetings: list, adjustment };
}

/* ============================================================
 * 日期感知（Date-aware）查询
 * ============================================================ */

function localJsDayToDayOfWeek(jsDay: number): DayOfWeek {
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

/** 将 Date 格式化为本地时区的 "YYYY-MM-DD"（避免 toISOString 的 UTC 偏移问题） */
export function getDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Returns the academic week containing a date, or null outside the configured term. */
export function getWeekInfoForDate(date: Date): AcademicWeekInfo | null {
  const dateStr = getDateString(date);
  for (const week of DEFAULT_ACADEMIC_CALENDAR) {
    if (week.startDate && week.endDate && dateStr >= week.startDate && dateStr <= week.endDate) {
      return week;
    }
  }
  return null;
}

/** Returns any date-specific schedule adjustment. */
export function getDayAdjustmentForDate(date: Date): DayScheduleAdjustment | null {
  return DEFAULT_DAY_ADJUSTMENTS[getDateString(date)] || null;
}

export interface DateMeetingsResult {
  dateStr: string; // "YYYY-MM-DD"
  day: DayOfWeek;
  weekInfo: AcademicWeekInfo | null;
  adjustment: DayScheduleAdjustment | null;
  /** Meetings for the date after week filtering and any configured adjustments. */
  meetings: DayMeetingResult[];
  inCalendar: boolean;
}

/**
 * Returns a day's meetings after applying the term week and configured adjustments.
 */
export function getMeetingsForDate(courses: Course[], date: Date): DateMeetingsResult {
  const dateStr = getDateString(date);
  const day = localJsDayToDayOfWeek(date.getDay());
  const weekInfo = getWeekInfoForDate(date);

  if (!weekInfo) {
    // 日期超出校历（开学前 / 寒假结束后）：视为无课
    return { dateStr, day, weekInfo: null, adjustment: null, meetings: [], inCalendar: false };
  }

  const adjustment = DEFAULT_DAY_ADJUSTMENTS[dateStr] || null;
  const { meetings } = getMeetingsForWeekAndDay(courses, weekInfo.weekNumber, day, true);
  return { dateStr, day, weekInfo, adjustment, meetings, inCalendar: true };
}

export interface SchedulePeriod {
  period: number;
  name: string;
  shortName: string;
  startTime: string;
  endTime: string;
  timeRange: string;
  section: 'morning' | 'afternoon' | 'evening';
  sectionName: string;
}

export const DEFAULT_CLASS_PERIODS: SchedulePeriod[] = [
  { period: 1, name: '第1节', shortName: '1', startTime: '08:00', endTime: '08:45', timeRange: '08:00-08:45', section: 'morning', sectionName: '上午' },
  { period: 2, name: '第2节', shortName: '2', startTime: '08:50', endTime: '09:35', timeRange: '08:50-09:35', section: 'morning', sectionName: '上午' },
  { period: 3, name: '第3节', shortName: '3', startTime: '09:55', endTime: '10:40', timeRange: '09:55-10:40', section: 'morning', sectionName: '上午' },
  { period: 4, name: '第4节', shortName: '4', startTime: '10:45', endTime: '11:30', timeRange: '10:45-11:30', section: 'morning', sectionName: '上午' },
  { period: 5, name: '第5节', shortName: '5', startTime: '11:35', endTime: '12:20', timeRange: '11:35-12:20', section: 'morning', sectionName: '上午' },
  { period: 6, name: '第6节', shortName: '6', startTime: '14:00', endTime: '14:45', timeRange: '14:00-14:45', section: 'afternoon', sectionName: '下午' },
  { period: 7, name: '第7节', shortName: '7', startTime: '14:50', endTime: '15:35', timeRange: '14:50-15:35', section: 'afternoon', sectionName: '下午' },
  { period: 8, name: '第8节', shortName: '8', startTime: '15:40', endTime: '16:25', timeRange: '15:40-16:25', section: 'afternoon', sectionName: '下午' },
  { period: 9, name: '第9节', shortName: '9', startTime: '16:45', endTime: '17:30', timeRange: '16:45-17:30', section: 'afternoon', sectionName: '下午' },
  { period: 10, name: '第10节', shortName: '10', startTime: '17:35', endTime: '18:20', timeRange: '17:35-18:20', section: 'afternoon', sectionName: '下午' },
  { period: 11, name: '第11节', shortName: '11', startTime: '19:00', endTime: '19:45', timeRange: '19:00-19:45', section: 'evening', sectionName: '晚上' },
  { period: 12, name: '第12节', shortName: '12', startTime: '19:50', endTime: '20:35', timeRange: '19:50-20:35', section: 'evening', sectionName: '晚上' },
  { period: 13, name: '第13节', shortName: '13', startTime: '20:40', endTime: '21:25', timeRange: '20:40-21:25', section: 'evening', sectionName: '晚上' },
];

export const PERIOD_HEIGHT = 56;
export const BREAK_HEIGHT = 20;

export function getPeriodTopAndHeight(
  startTime: string,
  endTime: string,
  periodHeight: number = PERIOD_HEIGHT,
  breakHeight: number = BREAK_HEIGHT
): { top: number; height: number } {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMin = (sh || 0) * 60 + (sm || 0);
  const endMin = (eh || 0) * 60 + (em || 0);

  function minutesToY(mins: number): number {
    if (mins <= 480) return 0; // <= 08:00
    if (mins <= 525) { // Period 1: 08:00 - 08:45
      return ((mins - 480) / 45) * periodHeight;
    }
    if (mins <= 530) { // 08:45 - 08:50 recess
      return periodHeight;
    }
    if (mins <= 575) { // Period 2: 08:50 - 09:35
      return periodHeight + ((mins - 530) / 45) * periodHeight;
    }
    if (mins <= 595) { // 09:35 - 09:55 recess
      return 2 * periodHeight;
    }
    if (mins <= 640) { // Period 3: 09:55 - 10:40
      return 2 * periodHeight + ((mins - 595) / 45) * periodHeight;
    }
    if (mins <= 645) { // 10:40 - 10:45 recess
      return 3 * periodHeight;
    }
    if (mins <= 690) { // Period 4: 10:45 - 11:30
      return 3 * periodHeight + ((mins - 645) / 45) * periodHeight;
    }
    if (mins <= 695) { // 11:30 - 11:35 recess
      return 4 * periodHeight;
    }
    if (mins <= 740) { // Period 5: 11:35 - 12:20
      return 4 * periodHeight + ((mins - 695) / 45) * periodHeight;
    }
    if (mins <= 840) { // Lunch break 12:20 - 14:00
      return 5 * periodHeight + ((mins - 740) / 100) * breakHeight;
    }
    const afternoonBase = 5 * periodHeight + breakHeight;
    if (mins <= 885) { // Period 6: 14:00 - 14:45
      return afternoonBase + ((mins - 840) / 45) * periodHeight;
    }
    if (mins <= 890) { // 14:45 - 14:50 recess
      return afternoonBase + periodHeight;
    }
    if (mins <= 935) { // Period 7: 14:50 - 15:35
      return afternoonBase + periodHeight + ((mins - 890) / 45) * periodHeight;
    }
    if (mins <= 940) { // 15:35 - 15:40 recess
      return afternoonBase + 2 * periodHeight;
    }
    if (mins <= 985) { // Period 8: 15:40 - 16:25
      return afternoonBase + 2 * periodHeight + ((mins - 940) / 45) * periodHeight;
    }
    if (mins <= 1005) { // 16:25 - 16:45 recess
      return afternoonBase + 3 * periodHeight;
    }
    if (mins <= 1050) { // Period 9: 16:45 - 17:30
      return afternoonBase + 3 * periodHeight + ((mins - 1005) / 45) * periodHeight;
    }
    if (mins <= 1055) { // 17:30 - 17:35 recess
      return afternoonBase + 4 * periodHeight;
    }
    if (mins <= 1100) { // Period 10: 17:35 - 18:20
      return afternoonBase + 4 * periodHeight + ((mins - 1055) / 45) * periodHeight;
    }
    if (mins <= 1140) { // Dinner break 18:20 - 19:00
      return afternoonBase + 5 * periodHeight + ((mins - 1100) / 40) * breakHeight;
    }
    const eveningBase = 5 * periodHeight + breakHeight + 5 * periodHeight + breakHeight;
    if (mins <= 1185) { // Period 11: 19:00 - 19:45
      return eveningBase + ((mins - 1140) / 45) * periodHeight;
    }
    if (mins <= 1190) { // 19:45 - 19:50 recess
      return eveningBase + periodHeight;
    }
    if (mins <= 1235) { // Period 12: 19:50 - 20:35
      return eveningBase + periodHeight + ((mins - 1190) / 45) * periodHeight;
    }
    if (mins <= 1240) { // 20:35 - 20:40 recess
      return eveningBase + 2 * periodHeight;
    }
    if (mins <= 1285) { // Period 13: 20:40 - 21:25
      return eveningBase + 2 * periodHeight + ((mins - 1240) / 45) * periodHeight;
    }
    return eveningBase + 3 * periodHeight;
  }

  const topY = minutesToY(startMin);
  const endY = minutesToY(endMin);
  const calculatedHeight = Math.max(endY - topY, periodHeight);

  return {
    top: Math.round(topY),
    height: Math.round(calculatedHeight),
  };
}
