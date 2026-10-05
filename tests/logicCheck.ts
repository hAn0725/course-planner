import { Course } from '../src/types';
import { DEFAULT_ACADEMIC_CALENDAR, getMeetingsForDate, getMeetingsForWeekAndDay, getWeekInfoForDate, isCourseActiveInWeek } from '../src/data/academicCalendar';
import { findScheduleConflicts } from '../src/utils/dateUtils';
import { shouldTriggerAssignmentReminder, toggleReminder } from '../src/utils/reminderUtils';

const exampleCourse: Course = {
  id: 'example-course',
  code: 'DEMO-101',
  name: '示例课程',
  section: '01班',
  credits: 3,
  color: '#2563EB',
  term: '2026-2027-1',
  weeks: '1-16周',
  instructor: '示例教师',
  meetings: [{ id: 'example-meeting', day: 'M', startTime: '09:55', endTime: '11:30', location: '教学楼 101', type: 'lecture' }],
  reminderEnabled: true,
  reminderLeadTimeMinutes: 15,
};

let pass = 0;
let fail = 0;
function check(name: string, condition: boolean) {
  if (condition) { pass++; console.log(`  OK  ${name}`); }
  else { fail++; console.log(`  FAIL: ${name}`); }
}
function date(value: string, time = '12:00') {
  const [year, month, day] = value.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

console.log('--- Generic academic calendar ---');
const preparationWeekStart = DEFAULT_ACADEMIC_CALENDAR[0].startDate;
const firstTeachingWeekStart = DEFAULT_ACADEMIC_CALENDAR[1].startDate;
const examWeekStart = DEFAULT_ACADEMIC_CALENDAR[19].startDate;
const breakStart = DEFAULT_ACADEMIC_CALENDAR[20].startDate;
check('Preparation week is represented', getWeekInfoForDate(date(preparationWeekStart))?.weekNumber === 0);
check('First teaching week is represented', getWeekInfoForDate(date(firstTeachingWeekStart))?.weekNumber === 1);
check('Dates outside the term are excluded', getWeekInfoForDate(date('2099-03-01')) === null);
check('A scheduled meeting appears on its weekday', getMeetingsForDate([exampleCourse], date(firstTeachingWeekStart)).meetings.length === 1);
check('Preparation week has no meetings', getMeetingsForDate([exampleCourse], date(preparationWeekStart)).meetings.length === 0);
check('Week view matches date view', getMeetingsForWeekAndDay([exampleCourse], 1, 'M').meetings.length === 1);
check('Exam week suppresses routine meetings', getMeetingsForDate([{ ...exampleCourse, weeks: undefined }], date(examWeekStart)).meetings.length === 0);
check('Break weeks contain no regular meetings', getMeetingsForDate([exampleCourse], date(breakStart)).meetings.length === 0);

console.log('--- Week ranges and conflicts ---');
check('Preparation week is inactive', !isCourseActiveInWeek('1-16周', 0));
check('Included week is active', isCourseActiveInWeek('1-16周', 5));
check('Excluded week is inactive', !isCourseActiveInWeek('10-16周', 5));
check('Comma-separated weeks are parsed', isCourseActiveInWeek('1,3,5周', 3));
const onDay = (id: string, weeks: string): Course => ({
  ...exampleCourse,
  id,
  weeks,
  meetings: [{ ...exampleCourse.meetings[0], id: `${id}-meeting` }],
});
check('Non-overlapping weekly sessions do not conflict', findScheduleConflicts([onDay('first-half', '1-8周'), onDay('second-half', '9-16周')]).length === 0);
check('Overlapping weekly sessions report a conflict', findScheduleConflicts([onDay('first', '1-8周'), onDay('second', '8-16周')]).length === 1);

console.log('--- Reminder behavior ---');
const reminderBase = {
  id: 'example-reminder',
  courseId: exampleCourse.id,
  title: '示例待办',
  type: 'assignment' as const,
  dueDate: '2026-09-08',
  dueTime: '12:00',
  completed: false,
  priority: 'medium' as const,
  reminderMinutesBefore: 60,
};
check('Reminder triggers inside its lead-time window', shouldTriggerAssignmentReminder(reminderBase, date('2026-09-08', '11:30')));
check('Reminder stays quiet before its lead-time window', !shouldTriggerAssignmentReminder(reminderBase, date('2026-09-08', '10:30')));
check('Completed reminders stay quiet', !shouldTriggerAssignmentReminder({ ...reminderBase, completed: true }, date('2026-09-08', '11:30')));
const daily = toggleReminder({ ...reminderBase, repeat: 'daily', notificationSent: true }, date('2026-09-08', '12:00'));
check('Completing a daily reminder schedules the next day', daily.dueDate === '2026-09-09' && !daily.notificationSent);
const weekday = toggleReminder({ ...reminderBase, dueDate: '2026-09-11', repeat: 'weekdays' }, date('2026-09-11'));
check('Weekday reminders skip the weekend', weekday.dueDate === '2026-09-14');

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
