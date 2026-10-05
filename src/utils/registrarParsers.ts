import { Course, CourseType, DayOfWeek, MeetingSession } from '../types';
import { getMeetingsForDate } from '../data/academicCalendar';

const COURSE_COLOR_PALETTE = [
  '#2563EB', // Blue
  '#059669', // Emerald
  '#7C3AED', // Violet
  '#D97706', // Amber
  '#DC2626', // Rose
  '#0891B2', // Cyan
  '#4F46E5', // Indigo
  '#EA580C', // Orange
  '#65A30D', // Lime
  '#DB2777', // Pink
];

export function getRandomCourseColor(index: number = 0): string {
  return COURSE_COLOR_PALETTE[index % COURSE_COLOR_PALETTE.length];
}

/**
 * Standardizes time strings like "9:00am", "09:30 AM", "14:15", "1:30 pm" to "HH:MM" 24h
 */
export function normalizeTimeTo24h(timeStr: string): string {
  if (!timeStr) return '09:00';
  const clean = timeStr.trim().toLowerCase();
  
  // Format like "13:45" or "09:30"
  const m24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = m24[2];
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  // Format like "9:30am", "9:30 am", "09:30 pm", "1:15pm", "11am", "2pm"
  const m12 = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = m12[2] || '00';
    const ampm = (m12[3] || '').toLowerCase();

    if (ampm.startsWith('p') && h < 12) h += 12;
    if (ampm.startsWith('a') && h === 12) h = 0;

    return `${String(h).padStart(2, '0')}:${m}`;
  }

  return '09:00';
}

/**
 * Parses day string abbreviations like "MWF", "TR", "M, W, F", "TTh", "TuTh", "Mon, Wed", "Tuesday/Thursday",
 * as well as Chinese weekday formats like "周一", "星期二", "礼拜三", "周一、周三", "星期四五"
 */
export function parseDaysString(daysStr: string): DayOfWeek[] {
  if (!daysStr) return ['M', 'W', 'F'];
  const clean = daysStr.trim();
  const days: DayOfWeek[] = [];

  // Chinese weekday mapping
  if (/周一|星期一|礼拜一|一(?=[\s,、\d节])/.test(clean)) days.push('M');
  if (/周二|星期二|礼拜二|二(?=[\s,、\d节])/.test(clean)) days.push('T');
  if (/周三|星期三|礼拜三|三(?=[\s,、\d节])/.test(clean)) days.push('W');
  if (/周四|星期四|礼拜四|四(?=[\s,、\d节])/.test(clean)) days.push('R');
  if (/周五|星期五|礼拜五|五(?=[\s,、\d节])/.test(clean)) days.push('F');
  if (/周六|星期六|礼拜六|六(?=[\s,、\d节])/.test(clean)) days.push('S');
  if (/周日|周天|星期日|星期天|礼拜天|天|日(?=[\s,、\d节])/.test(clean)) days.push('U');

  if (days.length > 0) {
    return days;
  }

  // Normalize common multi-char day patterns before single-letter mapping
  let normalized = clean
    .replace(/thursday|thurs|thu|th/gi, 'R')
    .replace(/tuesday|tues|tue|tu/gi, 'T')
    .replace(/monday|mon|mo/gi, 'M')
    .replace(/wednesday|wed|we/gi, 'W')
    .replace(/friday|fri|fr/gi, 'F')
    .replace(/saturday|sat|sa/gi, 'S')
    .replace(/sunday|sun|su/gi, 'U');

  // Strip punctuation/spaces
  normalized = normalized.toUpperCase();

  for (const char of normalized) {
    if (['M', 'T', 'W', 'R', 'F', 'S', 'U'].includes(char)) {
      if (!days.includes(char as DayOfWeek)) {
        days.push(char as DayOfWeek);
      }
    }
  }

  return days.length > 0 ? days : ['M', 'W', 'F'];
}

/**
 * Maps class periods to standard start/end times for course imports.
 * 1-2节: 08:00-09:35, 3-4节: 10:05-11:40, 5-6节: 14:00-15:35, 7-8节: 15:55-17:30, 9-11节: 18:30-20:55
 */
export function getTimesForChinesePeriod(periodStr: string): { startTime: string; endTime: string } {
  const pMatch = periodStr.match(/(?:第)?(\d{1,2})(?:[-~至到](\d{1,2}))?节?/);
  if (!pMatch) return { startTime: '08:00', endTime: '09:35' };

  const startPeriod = parseInt(pMatch[1], 10);
  const endPeriod = pMatch[2] ? parseInt(pMatch[2], 10) : startPeriod;

  const periodTimeMap: Record<number, { start: string; end: string }> = {
    1: { start: '08:00', end: '08:45' },
    2: { start: '08:50', end: '09:35' },
    3: { start: '10:05', end: '10:50' },
    4: { start: '10:55', end: '11:40' },
    5: { start: '14:00', end: '14:45' },
    6: { start: '14:50', end: '15:35' },
    7: { start: '15:55', end: '16:40' },
    8: { start: '16:45', end: '17:30' },
    9: { start: '18:30', end: '19:15' },
    10: { start: '19:20', end: '20:05' },
    11: { start: '20:10', end: '20:55' },
    12: { start: '21:00', end: '21:45' },
  };

  const start = periodTimeMap[startPeriod]?.start || '08:00';
  const end = periodTimeMap[endPeriod]?.end || (endPeriod === 2 ? '09:35' : endPeriod === 4 ? '11:40' : endPeriod === 6 ? '15:35' : endPeriod === 8 ? '17:30' : endPeriod >= 10 ? '20:55' : '09:35');

  return { startTime: start, endTime: end };
}

/**
 * Heuristic Local / Offline Registrar Parser.
 * Can parse common student-information systems, university registrar exports, and syllabus text blocks.
 */
export function parseRegistrarRawText(text: string, term: string = 'Fall 2026'): Course[] {
  if (!text || !text.trim()) return [];

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const courses: Course[] = [];

  let currentCourse: Partial<Course> | null = null;
  let colorIdx = 0;

  // Regex patterns
  const englishCourseCodeRegex = /\b([A-Z]{2,5}\s*(?:CS|EE|ME|BIO|CHEM|MATH|PHYS|ECON|HIST|ENG|ART|STAT|PHIL|PSYCH|SOC|BUS|MGMT|INFO|DATA)?\s*\d{1,4}[A-Z]?)\b/i;
  const chineseCourseHeaderRegex = /(?:课程名称|课程|课名|【课程】)[:：\s]*([^\s\[\]\(\)\n,，|]+)/i;
  const chineseStandaloneCourseRegex = /^([\u4e00-\u9fa5A-Za-z0-9\(\)\（\）\+\-\·\.]+)\s*(?:\[|（|\()?(?:(\d(?:\.\d)?)\s*(?:学分|学时|credits?|units?))?/i;
  
  const timeRangeRegex = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|–|~|至|到|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const chinesePeriodRegex = /(?:第)?(\d{1,2})(?:[-~至到](\d{1,2}))?节/;
  const daysRegex = /\b(MWF|TR|TTH|M-W-F|T-R|MON|TUE|WED|THU|FRI|M|T|W|R|F|MW|WF|TuTh)\b|(周一|周二|周三|周四|周五|周六|周日|周天|星期一|星期二|星期三|星期四|星期五|星期六|星期日|星期天)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for course code / course name match
    const engCodeMatch = line.match(englishCourseCodeRegex);
    const chnHeaderMatch = line.match(chineseCourseHeaderRegex);
    const crnMatch = line.match(/(?:CRN|Ref#|Class Nbr|Nbr|ID|课序号|课程代码)[:：\s]*([A-Za-z0-9\-_]{3,12})/i);
    const creditMatch = line.match(/(?:Credits?|Units?|Hrs|学分|学时)[:：\s]*(\d(?:\.\d)?)/i) || line.match(/\[(\d(?:\.\d)?)\s*学分\]/i);

    // Look for lines that declare a new course
    const isEnglishCourseHeader = engCodeMatch && (
      line.includes(' - ') || 
      line.includes(': ') || 
      line.toUpperCase().includes('LEC') ||
      line.toUpperCase().includes('SECTION') ||
      engCodeMatch.index === 0
    );

    const isChineseCourseHeader = chnHeaderMatch || (
      line.startsWith('课程:') || 
      line.startsWith('课程：') ||
      (line.includes('学分') && !line.includes('已选') && !line.includes('总学分') && (line.includes('周') || line.includes('节') || line.includes('教师') || line.includes('地点')))
    );

    if (isEnglishCourseHeader || isChineseCourseHeader || (engCodeMatch && !currentCourse)) {
      if (currentCourse && (currentCourse.code || currentCourse.name) && currentCourse.meetings && currentCourse.meetings.length > 0) {
        courses.push(finalizeCourse(currentCourse, colorIdx++, term));
      }

      let extractedCode = 'COURSE ' + (colorIdx + 1);
      let title = 'Course';

      if (chnHeaderMatch) {
        title = chnHeaderMatch[1].trim();
        extractedCode = crnMatch ? crnMatch[1] : (title.length <= 6 ? title : `COURSE-${colorIdx + 1}`);
      } else if (isChineseCourseHeader) {
        const standMatch = line.match(chineseStandaloneCourseRegex);
        if (standMatch && standMatch[1] && !standMatch[1].includes('时间') && !standMatch[1].includes('地点')) {
          title = standMatch[1].replace(/^(课程|课名)[:：]/, '').trim();
          extractedCode = crnMatch ? crnMatch[1] : (title.length <= 6 ? title : `COURSE-${colorIdx + 1}`);
        }
      } else if (engCodeMatch) {
        extractedCode = engCodeMatch[1].toUpperCase();
        title = extractedCode;
        if (line.includes(' - ')) {
          const parts = line.split(' - ');
          title = parts[1]?.trim() || extractedCode;
        } else if (line.includes(': ')) {
          const parts = line.split(': ');
          title = parts[1]?.trim() || extractedCode;
        } else if (i + 1 < lines.length && !lines[i + 1].match(timeRangeRegex) && !lines[i + 1].match(englishCourseCodeRegex)) {
          title = lines[i + 1];
        }
      }

      currentCourse = {
        code: extractedCode,
        name: title.replace(/\b(LEC|LAB|DIS)\s*\d{1,3}\b/i, '').trim() || extractedCode,
        section: line.match(/(?:Sec|Section|班级|教学班|教学班号)\s*[:：#]?\s*([A-Za-z0-9\-_]+)/i)?.[1] || '01',
        crn: crnMatch ? crnMatch[1] : undefined,
        credits: creditMatch ? parseFloat(creditMatch[1]) : 3.5,
        meetings: [],
        reminderEnabled: true,
        reminderLeadTimeMinutes: 15,
      };
    }

    // Look for meeting times in line or sublines
    const timeMatch = line.match(timeRangeRegex);
    const chnPeriodMatch = line.match(chinesePeriodRegex);
    const dayMatch = line.match(daysRegex);

    if ((timeMatch || chnPeriodMatch || dayMatch) && currentCourse) {
      let startTime = '08:00';
      let endTime = '09:35';

      if (timeMatch) {
        startTime = normalizeTimeTo24h(timeMatch[1]);
        endTime = normalizeTimeTo24h(timeMatch[2]);
      } else if (chnPeriodMatch) {
        const periodTimes = getTimesForChinesePeriod(chnPeriodMatch[0]);
        startTime = periodTimes.startTime;
        endTime = periodTimes.endTime;
      }

      // Check for day specification
      const days: DayOfWeek[] = dayMatch ? parseDaysString(dayMatch[0]) : (['M', 'W', 'F'] as DayOfWeek[]);

      // Check for location
      const locMatch = line.match(/(?:Room|Bldg|Building|Hall|Aud|Center|Rm|Location|地点|上课地点|教室)[:：\s]+([^,;\n|]+)/i) ||
                        line.match(/([\u4e00-\u9fa5A-Za-z0-9\-_]+(?:教学楼|主楼|附楼|楼|馆|报告厅|机房|实验室|中心|\d{3,4}[A-Za-z]?))/);
      const location = locMatch ? locMatch[1].trim() : '教学楼';

      // Check for type
      let type: CourseType = 'lecture';
      if (/lab|实验|上机|机房/i.test(line)) type = 'lab';
      else if (/dis|discussion|研讨|讨论/i.test(line)) type = 'discussion';
      else if (/sem|seminar|讲座/i.test(line)) type = 'seminar';
      else if (/studio|实习|实训/i.test(line)) type = 'studio';

      for (const d of days) {
        currentCourse.meetings = currentCourse.meetings || [];
        // Avoid duplicate meeting for same day & time
        if (!currentCourse.meetings.some(m => m.day === d && m.startTime === startTime)) {
          currentCourse.meetings.push({
            id: Math.random().toString(36).substring(2, 9),
            day: d,
            startTime,
            endTime,
            location,
            type,
          });
        }
      }
    }

    // Instructor detection
    const profMatch = line.match(/(?:Instructor|Professor|Prof|Faculty|Taught by|教师|任课教师|主讲教师|主讲|任课老师|老师)[:：\s]+([\u4e00-\u9fa5A-Za-z\s,\.-]+)/i);
    if (profMatch && currentCourse) {
      currentCourse.instructor = profMatch[1].replace(/\[.*?\]|\(.*?\)|\（.*?\）/, '').trim();
    }

    // Location standalone line detection
    const directLocMatch = line.match(/^(?:地点|上课地点|教室)[:：\s]+(.+)$/i);
    if (directLocMatch && currentCourse && currentCourse.meetings && currentCourse.meetings.length > 0) {
      currentCourse.meetings.forEach(m => {
        if (m.location === '教学楼' || m.location === 'Campus Room') {
          m.location = directLocMatch[1].trim();
        }
      });
    }

    // Notes or weeks detection
    const weekMatch = line.match(/(?:周次|周数|weeks?)[:：\s]*([^,;\n]+)/i) || line.match(/\[(\d+[-~至到]\d+周(?:.*?))\]/);
    if (weekMatch && currentCourse) {
      const rawWeeks = (weekMatch[1] || weekMatch[0]).trim();
      currentCourse.syllabusNotes = (currentCourse.syllabusNotes ? currentCourse.syllabusNotes + ' | ' : '') + `周次: ${rawWeeks}`;
      // 将识别到的周次写入 weeks 字段，使导入的课程同样支持按周次过滤/跳过假期
      const weeksNorm = rawWeeks.match(/\d+\s*[-~至到]\s*\d+\s*周?/);
      if (weeksNorm && !currentCourse.weeks) {
        currentCourse.weeks = weeksNorm[0].replace(/\s+/g, '').replace(/周$/, '') + '周';
      }
    }
  }

  if (currentCourse && (currentCourse.code || currentCourse.name) && currentCourse.meetings && currentCourse.meetings.length > 0) {
    courses.push(finalizeCourse(currentCourse, colorIdx++, term));
  }

  // Fallback: If heuristic parser found nothing because text was structured as a tab-separated table
  if (courses.length === 0 && text.includes('\t')) {
    return parseTabSeparatedTable(text, term);
  }

  return courses;
}

function finalizeCourse(partial: Partial<Course>, colorIndex: number, term: string): Course {
  return {
    id: 'course_' + Math.random().toString(36).substring(2, 9),
    code: partial.code || 'COURSE',
    name: partial.name || partial.code || 'University Course',
    section: partial.section || '01',
    crn: partial.crn || undefined,
    instructor: partial.instructor || 'TBD',
    credits: partial.credits || 3,
    color: partial.color || getRandomCourseColor(colorIndex),
    term: partial.term || term,
    meetings: (partial.meetings && partial.meetings.length > 0) ? partial.meetings : [
      {
        id: Math.random().toString(36).substring(2, 9),
        day: 'M',
        startTime: '10:00',
        endTime: '11:30',
        location: 'Campus Hall',
        type: 'lecture',
      }
    ],
    syllabusNotes: partial.syllabusNotes || '',
    examInfo: partial.examInfo || '',
    virtualLink: partial.virtualLink || '',
    officeHours: partial.officeHours || '',
    reminderEnabled: partial.reminderEnabled !== undefined ? partial.reminderEnabled : true,
    reminderLeadTimeMinutes: partial.reminderLeadTimeMinutes || 15,
  };
}

/**
 * Tab-separated or CSV Registrar Table Parser
 */
export function parseTabSeparatedTable(text: string, term: string = 'Fall 2026'): Course[] {
  const rows = text.split(/\r?\n/).map(r => r.split('\t').map(c => c.trim())).filter(r => r.length >= 3);
  const courses: Course[] = [];
  let colorIdx = 0;

  for (const row of rows) {
    // Attempt to map columns: Code, Name, Days, Times, Room, Instructor
    const code = row[0];
    if (!code || /course|crn|code|subject/i.test(code)) continue;

    const name = row[1] || code;
    const daysStr = row.find(c => /^(MWF|TR|TTH|MW|WF|M|T|W|R|F)$/i.test(c)) || 'MWF';
    const timeStr = row.find(c => /\d{1,2}:\d{2}/.test(c)) || '09:00 - 10:30 AM';
    const room = row.find(c => /hall|bldg|room|\d{3}/i.test(c) && c !== code && c !== timeStr) || 'Main Quad';
    const instructor = row.find(c => /prof|dr\.|^[A-Z][a-z]+ [A-Z][a-z]+$/.test(c) && c !== name) || 'Staff';

    const timeMatch = timeStr.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|–|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    const start = timeMatch ? normalizeTimeTo24h(timeMatch[1]) : '10:00';
    const end = timeMatch ? normalizeTimeTo24h(timeMatch[2]) : '11:15';
    const days = parseDaysString(daysStr);

    courses.push({
      id: 'course_' + Math.random().toString(36).substring(2, 9),
      code,
      name,
      section: '001',
      instructor,
      credits: 3,
      color: getRandomCourseColor(colorIdx++),
      term,
      meetings: days.map(d => ({
        id: Math.random().toString(36).substring(2, 9),
        day: d,
        startTime: start,
        endTime: end,
        location: room,
        type: 'lecture',
      })),
      reminderEnabled: true,
      reminderLeadTimeMinutes: 15,
    });
  }

  return courses;
}

/**
 * Standard iCalendar (.ics) Parser
 */
export function parseIcsCalendar(icsContent: string, term: string = 'Fall 2026'): Course[] {
  if (!icsContent) return [];
  const events: { summary: string; location: string; start: string; end: string; rrule: string; description: string }[] = [];
  
  const lines = icsContent.split(/\r?\n/);
  let currentEvent: Record<string, string> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (currentEvent) {
        events.push({
          summary: currentEvent['SUMMARY'] || 'Course Event',
          location: currentEvent['LOCATION'] || 'Classroom',
          start: currentEvent['DTSTART'] || '',
          end: currentEvent['DTEND'] || '',
          rrule: currentEvent['RRULE'] || '',
          description: currentEvent['DESCRIPTION'] || '',
        });
      }
      currentEvent = null;
    } else if (currentEvent) {
      const idx = line.indexOf(':');
      if (idx > -1) {
        const key = line.substring(0, idx).split(';')[0].toUpperCase();
        const value = line.substring(idx + 1);
        currentEvent[key] = value;
      }
    }
  }

  const courseMap = new Map<string, Course>();
  let colorIdx = 0;

  for (const ev of events) {
    const summary = ev.summary;
    // Try extract course code and name
    const codeMatch = summary.match(/\b([A-Z]{2,5}\s*\d{1,4}[A-Z]?)\b/i);
    const code = codeMatch ? codeMatch[1].toUpperCase() : summary.substring(0, 10);
    const name = summary.replace(code, '').replace(/^[:\s-]+/, '').trim() || summary;

    // Parse time from DTSTART / DTEND (e.g. 20260901T093000Z or TZID=...:20260901T093000)
    let startTime = '09:00';
    let endTime = '10:15';

    const parseIcsTime = (timeStr: string) => {
      const tIdx = timeStr.indexOf('T');
      if (tIdx > -1) {
        const timePart = timeStr.substring(tIdx + 1, tIdx + 5);
        return `${timePart.substring(0, 2)}:${timePart.substring(2, 4)}`;
      }
      return '09:00';
    };

    if (ev.start) startTime = parseIcsTime(ev.start);
    if (ev.end) endTime = parseIcsTime(ev.end);

    // Days from RRULE (e.g. RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR)
    let days: DayOfWeek[] = ['M', 'W', 'F'];
    const bydayMatch = ev.rrule.match(/BYDAY=([A-Z,]+)/i);
    if (bydayMatch) {
      const bydays = bydayMatch[1].split(',');
      days = bydays.map(b => {
        const cleanB = b.substring(0, 2).toUpperCase();
        if (cleanB === 'MO') return 'M';
        if (cleanB === 'TU') return 'T';
        if (cleanB === 'WE') return 'W';
        if (cleanB === 'TH') return 'R';
        if (cleanB === 'FR') return 'F';
        if (cleanB === 'SA') return 'S';
        if (cleanB === 'SU') return 'U';
        return 'M';
      }) as DayOfWeek[];
    }

    if (!courseMap.has(code)) {
      courseMap.set(code, {
        id: 'course_' + Math.random().toString(36).substring(2, 9),
        code,
        name,
        section: '001',
        credits: 3,
        color: getRandomCourseColor(colorIdx++),
        term,
        meetings: [],
        syllabusNotes: ev.description,
        reminderEnabled: true,
        reminderLeadTimeMinutes: 15,
      });
    }

    const course = courseMap.get(code)!;
    for (const d of days) {
      if (!course.meetings.some(m => m.day === d && m.startTime === startTime)) {
        course.meetings.push({
          id: Math.random().toString(36).substring(2, 9),
          day: d,
          startTime,
          endTime,
          location: ev.location,
          type: /lab/i.test(summary) ? 'lab' : /discussion/i.test(summary) ? 'discussion' : 'lecture',
        });
      }
    }
  }

  return Array.from(courseMap.values());
}

/**
 * Generate iCalendar (.ics) export string with recurring weekly events and VALARM notification triggers
 */
export function generateIcsSchedule(courses: Course[], termName: string = 'Fall 2026'): string {
  const dayToIcsCode: Record<DayOfWeek, { code: string; jsDayOffset: number }> = {
    M: { code: 'MO', jsDayOffset: 0 },
    T: { code: 'TU', jsDayOffset: 1 },
    W: { code: 'WE', jsDayOffset: 2 },
    R: { code: 'TH', jsDayOffset: 3 },
    F: { code: 'FR', jsDayOffset: 4 },
    S: { code: 'SA', jsDayOffset: 5 },
    U: { code: 'SU', jsDayOffset: 6 },
  };

  // 逐日导出：复用校历逻辑（getMeetingsForDate），导出的日历与应用内完全一致——
  // 自动跳过预备周/法定假期停课日/考试周/寒假，并包含调休补课日（如 9.27 周日上周二课）。
  // 使用 RRULE + 错误起始日/统一截止日的旧写法已废弃。
  const calendarStart = new Date(2026, 7, 31); // 校历第一天 2026-08-31
  const calendarEnd = new Date(2027, 1, 28);   // 校历最后一天 2027-02-28

  const pad = (n: number) => String(n).padStart(2, '0');
  const stampNow = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//University Course Schedule Planner//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${termName} 课程表`,
    'X-WR-TIMEZONE:Asia/Shanghai',
  ];

  let eventCount = 0;
  for (let dt = new Date(calendarStart); dt <= calendarEnd; dt.setDate(dt.getDate() + 1)) {
    const date = new Date(dt);
    const res = getMeetingsForDate(courses, date);
    if (!res.meetings.length) continue;

    const y = date.getFullYear();
    const mo = pad(date.getMonth() + 1);
    const da = pad(date.getDate());
    const datePrefix = `${y}${mo}${da}`;

    for (const { course, session, isMakeupSession, makeupSourceNote } of res.meetings) {
      const dayInfo = dayToIcsCode[session.day];
      const startClean = session.startTime.replace(':', '') + '00';
      const endClean = session.endTime.replace(':', '') + '00';
      const uid = `${course.id}-${session.id}-${datePrefix}@course-planner.local`;
      const summary = `${course.name}${course.section ? ` (${course.section})` : ''} - ${session.startTime}`;
      const descriptionParts = [
        `Instructor: ${course.instructor || 'TBD'}`,
        `Credits: ${course.credits}`,
        `Section: ${course.section || '01'}`,
      ];
      if (course.weeks) descriptionParts.push(`Weeks: ${course.weeks}`);
      if (isMakeupSession) descriptionParts.push(`调休补课: ${makeupSourceNote || '按调休安排上课'}`);

      ics.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stampNow}`,
        `DTSTART:${datePrefix}T${startClean}`,
        `DTEND:${datePrefix}T${endClean}`,
        `SUMMARY:${summary}`,
        `LOCATION:${session.location}`,
        `DESCRIPTION:${descriptionParts.join('\\n')}`,
        'STATUS:CONFIRMED',
      );

      // Add VALARM if reminders enabled
      if (course.reminderEnabled) {
        ics.push(
          'BEGIN:VALARM',
          `TRIGGER:-PT${course.reminderLeadTimeMinutes}M`,
          'ACTION:DISPLAY',
          `DESCRIPTION:Reminder: ${course.name} starts in ${course.reminderLeadTimeMinutes} minutes!`,
          'END:VALARM'
        );
      }

      ics.push('END:VEVENT');
      eventCount++;
    }
  }

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

/**
 * Generate CSV export
 */
export function generateCsvSchedule(courses: Course[]): string {
  const headers = ['Course Code', 'Course Name', 'Section', 'CRN', 'Credits', 'Instructor', 'Day', 'Start Time', 'End Time', 'Location', 'Session Type', 'Reminder Lead Min'];
  const rows: string[][] = [headers];

  for (const c of courses) {
    for (const m of c.meetings) {
      rows.push([
        `"${c.code}"`,
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.section || ''}"`,
        `"${c.crn || ''}"`,
        `${c.credits}`,
        `"${(c.instructor || '').replace(/"/g, '""')}"`,
        `"${m.day}"`,
        `"${m.startTime}"`,
        `"${m.endTime}"`,
        `"${m.location.replace(/"/g, '""')}"`,
        `"${m.type}"`,
        `${c.reminderLeadTimeMinutes}`,
      ]);
    }
  }

  return rows.map(r => r.join(',')).join('\n');
}
