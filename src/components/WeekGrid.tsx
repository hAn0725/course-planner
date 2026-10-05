import React, { useMemo, useState } from 'react';
import { 
  Course, 
  DayOfWeek, 
  MeetingSession, 
  ScheduleConflict 
} from '../types';
import { 
  WEEKDAYS, 
  ALL_DAYS, 
  timeStringToMinutes, 
  formatTimeDisplay, 
  jsDayToDayOfWeek 
} from '../utils/dateUtils';
import { 
  DEFAULT_ACADEMIC_CALENDAR,
  getDateForWeekAndDay,
  getDayAdjustment,
  getMeetingsForWeekAndDay,
  getWeekInfoForDate,
  DayMeetingResult,
  DEFAULT_CLASS_PERIODS,
  PERIOD_HEIGHT,
  BREAK_HEIGHT,
  getPeriodTopAndHeight
} from '../data/academicCalendar';
import { 
  MapPin, 
  AlertCircle, 
  Clock, 
  Calendar,
  Sparkles,
  ArrowRightLeft,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

interface WeekGridProps {
  courses: Course[];
  conflicts: ScheduleConflict[];
  showWeekends?: boolean;
  timeFormat?: '12h' | '24h';
  selectedWeek?: number;
  applyHolidayAdjustments?: boolean;
  onSelectCourse: (course: Course) => void;
  onAddCourseAtTime?: (day: DayOfWeek, startTime: string) => void;
}

export const WeekGrid: React.FC<WeekGridProps> = ({
  courses,
  conflicts,
  showWeekends = true,
  timeFormat = '24h',
  selectedWeek = 1,
  applyHolidayAdjustments = true,
  onSelectCourse,
  onAddCourseAtTime,
}) => {
  const { t } = useTranslation();
  const days: DayOfWeek[] = showWeekends ? ALL_DAYS : WEEKDAYS;
  
  // Total grid height follows the configured periods plus lunch and dinner breaks.
  const totalGridHeight = 13 * PERIOD_HEIGHT + 2 * BREAK_HEIGHT;

  const currentJsDay = new Date().getDay();
  const currentDayCode = jsDayToDayOfWeek(currentJsDay);
  // 今天所在的校历周：只有浏览的周与今天同一周时才高亮“今天”列
  const todayWeekNumber = getWeekInfoForDate(new Date())?.weekNumber;
  const isTodayColumn = (day: DayOfWeek) =>
    day === currentDayCode && typeof selectedWeek === 'number' && selectedWeek === todayWeekNumber;

  // Mobile viewing mode: 'all' or specific day 'M' | 'T' | 'W' | 'R' | 'F' | 'S' | 'U'
  const [mobileActiveDay, setMobileActiveDay] = useState<DayOfWeek | 'all'>('all');

  // Conflict session map
  const conflictSessionIds = useMemo(() => {
    const set = new Set<string>();
    conflicts.forEach(c => {
      set.add(c.session1.id);
      set.add(c.session2.id);
    });
    return set;
  }, [conflicts]);

  const getDayShortLabel = (day: DayOfWeek) => {
    switch (day) {
      case 'M': return '周一';
      case 'T': return '周二';
      case 'W': return '周三';
      case 'R': return '周四';
      case 'F': return '周五';
      case 'S': return '周六';
      case 'U': return '周日';
      default: return day;
    }
  };

  const getDayFullLabel = (day: DayOfWeek) => {
    switch (day) {
      case 'M': return '星期一';
      case 'T': return '星期二';
      case 'W': return '星期三';
      case 'R': return '星期四';
      case 'F': return '星期五';
      case 'S': return '星期六';
      case 'U': return '星期日';
      default: return day;
    }
  };

  // Compute meetings and adjustments per day for this week
  const dayDataMap = useMemo(() => {
    const map: Record<DayOfWeek, {
      dateStr: string | null;
      formattedDate: string;
      meetings: DayMeetingResult[];
      adjustment: ReturnType<typeof getDayAdjustment>;
    }> = {
      M: { dateStr: null, formattedDate: '', meetings: [], adjustment: null },
      T: { dateStr: null, formattedDate: '', meetings: [], adjustment: null },
      W: { dateStr: null, formattedDate: '', meetings: [], adjustment: null },
      R: { dateStr: null, formattedDate: '', meetings: [], adjustment: null },
      F: { dateStr: null, formattedDate: '', meetings: [], adjustment: null },
      S: { dateStr: null, formattedDate: '', meetings: [], adjustment: null },
      U: { dateStr: null, formattedDate: '', meetings: [], adjustment: null },
    };

    days.forEach(day => {
      const dateStr = typeof selectedWeek === 'number' ? getDateForWeekAndDay(selectedWeek, day) : null;
      let formattedDate = '';
      if (dateStr) {
        const parts = dateStr.split('-');
        formattedDate = `${parts[1]}.${parts[2]}`;
      }

      const res = getMeetingsForWeekAndDay(courses, selectedWeek, day, applyHolidayAdjustments);
      map[day] = {
        dateStr,
        formattedDate,
        meetings: res.meetings,
        adjustment: res.adjustment,
      };
    });

    return map;
  }, [courses, selectedWeek, days, applyHolidayAdjustments]);

  // 当周末列被隐藏、而本周的调休/停课安排恰好落在周末时，给出提示避免遗漏
  const hiddenAdjustment = useMemo(() => {
    if (!applyHolidayAdjustments || typeof selectedWeek !== 'number') return null;
    const visible = new Set<string>(days);
    for (const d of ALL_DAYS) {
      if (visible.has(d)) continue;
      const adj = getDayAdjustment(selectedWeek, d);
      if (adj) return adj;
    }
    return null;
  }, [applyHolidayAdjustments, selectedWeek, days]);

  // Maps start and end times to the configured class periods.
  const getPeriodBadge = (startTime: string, endTime: string) => {
    if (startTime === '08:00' && endTime === '09:35') return '1-2节';
    if (startTime === '08:00' && endTime === '08:45') return '第1节';
    if (startTime === '08:50' && endTime === '09:35') return '第2节';
    if (startTime === '09:55' && endTime === '11:30') return '3-4节';
    if (startTime === '09:55' && endTime === '12:20') return '3-5节';
    if (startTime === '09:55' && endTime === '10:40') return '第3节';
    if (startTime === '10:45' && endTime === '11:30') return '第4节';
    if (startTime === '11:35' && endTime === '12:20') return '第5节';
    if (startTime === '14:00' && endTime === '15:35') return '6-7节';
    if (startTime === '14:00' && endTime === '16:25') return '6-8节';
    if (startTime === '14:00' && endTime === '17:30') return '6-9节';
    if (startTime === '14:00' && endTime === '18:20') return '6-10节';
    if (startTime === '14:00' && endTime === '14:45') return '第6节';
    if (startTime === '14:50' && endTime === '15:35') return '第7节';
    if (startTime === '15:40' && endTime === '16:25') return '第8节';
    if (startTime === '16:45' && endTime === '17:30') return '第9节';
    if (startTime === '16:45' && endTime === '18:20') return '9-10节';
    if (startTime === '17:35' && endTime === '18:20') return '第10节';
    if (startTime === '19:00' && endTime === '21:25') return '11-13节';
    if (startTime === '19:00' && endTime === '20:35') return '11-12节';
    if (startTime === '19:00' && endTime === '19:45') return '第11节';
    if (startTime === '19:50' && endTime === '20:35') return '第12节';
    if (startTime === '20:40' && endTime === '21:25') return '第13节';
    return `${startTime}-${endTime}`;
  };

  // Determine grid template based on days count
  const gridColsClass = days.length === 7
    ? 'grid-cols-[54px_repeat(7,minmax(0,1fr))] sm:grid-cols-[62px_repeat(7,minmax(90px,1fr))] 2xl:grid-cols-[72px_repeat(7,minmax(105px,1fr))]'
    : 'grid-cols-[54px_repeat(5,minmax(0,1fr))] sm:grid-cols-[62px_repeat(5,minmax(110px,1fr))] 2xl:grid-cols-[72px_repeat(5,minmax(125px,1fr))]';

  // Calculate layout rows (Periods 1-5, lunch break, Periods 6-10, dinner break, Periods 11-13)
  const periodRows = useMemo(() => {
    const rows: Array<{
      type: 'period' | 'break';
      periodObj?: typeof DEFAULT_CLASS_PERIODS[0];
      label?: string;
      time?: string;
      top: number;
      height: number;
    }> = [];

    // Morning: Periods 1 to 5
    for (let p = 1; p <= 5; p++) {
      const pObj = DEFAULT_CLASS_PERIODS[p - 1];
      const top = (p - 1) * PERIOD_HEIGHT;
      rows.push({
        type: 'period',
        periodObj: pObj,
        label: pObj.name,
        time: pObj.timeRange,
        top,
        height: PERIOD_HEIGHT,
      });
    }

    // Lunch break: 12:20 - 14:00
    const lunchTop = 5 * PERIOD_HEIGHT;
    rows.push({
      type: 'break',
      label: '午休',
      time: '12:20 - 14:00',
      top: lunchTop,
      height: BREAK_HEIGHT,
    });

    // Afternoon: Periods 6 to 10
    const afternoonBase = 5 * PERIOD_HEIGHT + BREAK_HEIGHT;
    for (let p = 6; p <= 10; p++) {
      const pObj = DEFAULT_CLASS_PERIODS[p - 1];
      const top = afternoonBase + (p - 6) * PERIOD_HEIGHT;
      rows.push({
        type: 'period',
        periodObj: pObj,
        label: pObj.name,
        time: pObj.timeRange,
        top,
        height: PERIOD_HEIGHT,
      });
    }

    // Dinner break: 18:20 - 19:00
    const dinnerTop = afternoonBase + 5 * PERIOD_HEIGHT;
    rows.push({
      type: 'break',
      label: '晚休',
      time: '18:20 - 19:00',
      top: dinnerTop,
      height: BREAK_HEIGHT,
    });

    // Evening: Periods 11 to 13
    const eveningBase = dinnerTop + BREAK_HEIGHT;
    for (let p = 11; p <= 13; p++) {
      const pObj = DEFAULT_CLASS_PERIODS[p - 1];
      const top = eveningBase + (p - 11) * PERIOD_HEIGHT;
      rows.push({
        type: 'period',
        periodObj: pObj,
        label: pObj.name,
        time: pObj.timeRange,
        top,
        height: PERIOD_HEIGHT,
      });
    }

    return rows;
  }, []);

  return (
    <div className="week-grid-panel bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col">
      
      {/* 周末列隐藏但周末有调休/停课安排时的提示 */}
      {hiddenAdjustment && (
        <div
          className={`px-4 py-2.5 text-xs flex items-start sm:items-center gap-2 border-b ${
            hiddenAdjustment.type === 'makeup_class'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4 shrink-0" />
          <span>
            <b>{hiddenAdjustment.badgeText}</b>（{hiddenAdjustment.date}）：{hiddenAdjustment.description}
            {' '}当前视图隐藏了周末列，此安排未在表格中显示。
          </span>
        </div>
      )}

      {/* Mobile Day Switcher Tabs (Visible on screens < 768px) */}
      <div className="md:hidden p-2 bg-slate-50/90 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setMobileActiveDay('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
            mobileActiveDay === 'all'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          全部7天
        </button>

        {days.map(d => {
          const isSelected = mobileActiveDay === d;
          const info = dayDataMap[d];
          const hasMakeup = info.adjustment?.type === 'makeup_class';
          const count = info.meetings.length;

          return (
            <button
              key={d}
              onClick={() => setMobileActiveDay(d)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : hasMakeup
                  ? 'bg-amber-50 text-amber-900 border border-amber-300'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>{getDayShortLabel(d)}</span>
              {info.formattedDate && (
                <span className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                  {info.formattedDate}
                </span>
              )}
              {hasMakeup ? (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              ) : count > 0 ? (
                <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* SINGLE DAY VIEW on Mobile (when a specific day is clicked on phone) */}
      {mobileActiveDay !== 'all' && (
        <div className="md:hidden p-4 space-y-3">
          {/* Day Header Info */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {getDayFullLabel(mobileActiveDay)}
                </h3>
                {dayDataMap[mobileActiveDay].formattedDate && (
                  <span className="text-xs font-medium text-slate-500">
                    {dayDataMap[mobileActiveDay].formattedDate}
                  </span>
                )}
                {dayDataMap[mobileActiveDay].adjustment?.type === 'makeup_class' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    {dayDataMap[mobileActiveDay].adjustment?.badgeText}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => setMobileActiveDay('all')}
              className="text-xs text-blue-600 font-semibold px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100"
            >
              查看全周
            </button>
          </div>

          {/* Makeup banner if weekend makeup day */}
          {dayDataMap[mobileActiveDay].adjustment?.type === 'makeup_class' && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-900">
              <ArrowRightLeft className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{dayDataMap[mobileActiveDay].adjustment?.description}</span>
            </div>
          )}

          {/* Day Meetings Cards */}
          <div className="space-y-3">
            {dayDataMap[mobileActiveDay].meetings.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Calendar className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm">本日无课程安排</p>
                {onAddCourseAtTime && (
                  <button
                    onClick={() => onAddCourseAtTime(mobileActiveDay, '08:00')}
                    className="text-xs text-blue-600 font-semibold hover:underline"
                  >
                    + 添加课程 / 日程
                  </button>
                )}
              </div>
            ) : (
              dayDataMap[mobileActiveDay].meetings.map(({ course, session, isMakeupSession, makeupSourceNote }) => {
                const duration = timeStringToMinutes(session.endTime) - timeStringToMinutes(session.startTime);
                const periodLabel = getPeriodBadge(session.startTime, session.endTime);

                return (
                  <div
                    key={session.id}
                    onClick={() => onSelectCourse(course)}
                    className="p-4 rounded-2xl border bg-white shadow-2xs hover:shadow-xs transition-all cursor-pointer relative overflow-hidden"
                    style={{ borderLeftColor: course.color, borderLeftWidth: '5px' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                            {periodLabel}
                          </span>
                          <h4 className="text-base font-bold text-slate-900">
                            {course.name}
                          </h4>
                          {isMakeupSession && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              {makeupSourceNote || '调休补课'}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatTimeDisplay(session.startTime, timeFormat)} - {formatTimeDisplay(session.endTime, timeFormat)} ({duration}分钟)</span>
                          </div>
                          {session.location && (
                            <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                              <MapPin className="w-3.5 h-3.5 text-rose-500" />
                              <span>{session.location}</span>
                            </div>
                          )}
                          {course.instructor && (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                              <span>{course.instructor} · {course.section || '01班'}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="w-5 h-5 text-slate-400 self-center" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* FULL 7-DAY HORIZONTAL SCROLL GRID (Always rendered on Desktop/Tablet, conditional on Mobile) */}
      {mobileActiveDay === 'all' && (
        <div className="week-grid-scroll-hint md:hidden">
          <span>点上方日期看单日 · 左右滑动查看完整周表</span>
          <ChevronRight aria-hidden="true" size={13} />
        </div>
      )}
      <div className={`overflow-x-auto ${mobileActiveDay !== 'all' ? 'hidden md:block' : 'block'}`}>
        <div className="min-w-[700px] lg:min-w-full">
          
          {/* Header Row: Days with Dates */}
          <div className={`grid ${gridColsClass} border-b border-slate-200 bg-slate-50/90 sticky top-0 z-20`}>
            
            {/* Corner time header */}
            <div className="p-2 text-[11px] font-bold text-slate-500 text-center border-r border-slate-200 flex items-center justify-center sticky left-0 z-30 bg-slate-100/90">
              <span>节次</span>
            </div>

            {/* Day columns headers */}
            {days.map((day) => {
              const isToday = isTodayColumn(day);
              const isWeekend = day === 'S' || day === 'U';
              const info = dayDataMap[day];
              const isMakeupDay = info.adjustment?.type === 'makeup_class';
              const isHolidayDay = info.adjustment?.type === 'holiday_off';

              return (
                <div 
                  key={day}
                  className={`p-2 text-center border-r border-slate-200/70 last:border-r-0 transition-colors ${
                    isToday 
                      ? 'bg-blue-50/90' 
                    : isMakeupDay
                      ? 'bg-amber-50/70'
                      : isHolidayDay
                      ? 'bg-slate-100/90'
                      : isWeekend 
                      ? 'bg-slate-50/80'
                      : ''
                  }`}
                >
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <div className="flex items-center gap-1">
                      <span className={`text-xs sm:text-sm font-bold ${
                        isToday 
                          ? 'text-blue-700' 
                          : isMakeupDay
                          ? 'text-amber-800'
                          : isHolidayDay
                          ? 'text-slate-500'
                          : isWeekend 
                          ? 'text-slate-600'
                          : 'text-slate-800'
                      }`}>
                        {getDayShortLabel(day)}
                      </span>
                      {isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      )}
                    </div>

                    {/* Date display */}
                    <div className="flex items-center gap-1 flex-wrap justify-center">
                      {info.formattedDate && (
                        <span className={`numeric-data text-[10px] font-medium ${isToday ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                          {info.formattedDate}
                        </span>
                      )}

                      {/* Makeup Badge on Sunday/Saturday */}
                      {isMakeupDay && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          {info.adjustment?.badgeText}
                        </span>
                      )}
                      {isHolidayDay && (
                        <span
                          className="holiday-day-badge px-1.5 py-0.2 rounded text-[9px] font-semibold border"
                          title={info.adjustment?.title}
                        >
                          放假
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grid Body: Time gutter + Day Columns */}
          <div className="relative">
            <div className={`grid ${gridColsClass} relative`} style={{ height: `${totalGridHeight}px` }}>
              
              {/* Sticky Time Gutter Column on the left */}
              <div className="border-r border-slate-200 bg-slate-50/60 sticky left-0 z-20 shadow-2xs select-none">
                {periodRows.map((row, idx) => {
                  if (row.type === 'break') {
                    return (
                      <div
                        key={`break-${idx}`}
                        className="absolute left-0 right-0 border-t border-b border-slate-200/80 bg-slate-100/90 flex items-center justify-center text-[10px] font-bold text-slate-500"
                        style={{ top: `${row.top}px`, height: `${row.height}px` }}
                        title={row.time}
                      >
                        <span>{row.label}</span>
                      </div>
                    );
                  }

                  const pObj = row.periodObj!;

                  return (
                    <div
                      key={`period-${pObj.period}`}
                      className="absolute left-0 right-0 border-t border-slate-200/70 flex flex-col items-center justify-center px-0.5 text-center transition-colors"
                      style={{ top: `${row.top}px`, height: `${row.height}px` }}
                    >
                      <span className="numeric-data text-xs font-black text-slate-800 leading-none">
                        {pObj.period}
                      </span>
                      <span className="numeric-data text-[9px] font-medium text-slate-500 mt-1 leading-tight tracking-tighter scale-95">
                        {pObj.startTime}
                      </span>
                      <span className="numeric-data text-[9px] text-slate-400 leading-tight tracking-tighter scale-90">
                        {pObj.endTime}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Day Columns */}
              {days.map((day) => {
                const isToday = isTodayColumn(day);
                const isWeekend = day === 'S' || day === 'U';
                const info = dayDataMap[day];
                const isHolidayOff = info.adjustment?.type === 'holiday_off';
                const isMakeupDay = info.adjustment?.type === 'makeup_class';

                return (
                  <div
                    key={day}
                    className={`relative border-r border-slate-200/70 last:border-r-0 ${
                      isToday 
                        ? 'bg-blue-50/15' 
                        : isMakeupDay
                        ? 'bg-amber-50/20'
                        : isWeekend 
                        ? 'bg-slate-50/40' 
                        : 'bg-white'
                    }`}
                  >
                    {/* Period grid lines and Break Dividers */}
                    {periodRows.map((row, idx) => {
                      if (row.type === 'break') {
                        return (
                          <div
                            key={`col-break-${idx}`}
                            className="absolute left-0 right-0 border-t border-b border-slate-200/80 bg-slate-100/50 flex items-center justify-center"
                            style={{ top: `${row.top}px`, height: `${row.height}px` }}
                          >
                            <span className="text-[9px] text-slate-400 font-medium select-none">
                              {row.label} ({row.time})
                            </span>
                          </div>
                        );
                      }

                      const pObj = row.periodObj!;

                      return (
                        <div
                          key={`col-p-${pObj.period}`}
                          className="absolute left-0 right-0 border-t border-slate-100 hover:bg-blue-50/25 transition-colors cursor-pointer group"
                          style={{ top: `${row.top}px`, height: `${row.height}px` }}
                          onClick={() => {
                            if (onAddCourseAtTime && !isHolidayOff) {
                              onAddCourseAtTime(day, pObj.startTime);
                            }
                          }}
                          title={isHolidayOff ? '放假停课' : `点击在此节次 (${getDayShortLabel(day)} 第${pObj.period}节 ${pObj.startTime}) 添加课程`}
                        >
                          <span className="hidden group-hover:inline-block absolute left-2 top-1 text-[10px] font-semibold text-blue-600 bg-white/95 px-1.5 py-0.5 rounded shadow-2xs z-10">
                            + 第{pObj.period}节加课
                          </span>
                        </div>
                      );
                    })}

                    {/* Course meeting cards in this day (Left blank if holiday off!) */}
                    {!isHolidayOff && info.meetings.map(({ course, session, isMakeupSession, makeupSourceNote }) => {
                      const { top, height } = getPeriodTopAndHeight(session.startTime, session.endTime, PERIOD_HEIGHT, BREAK_HEIGHT);
                      const hasConflict = conflictSessionIds.has(session.id);
                      const periodBadge = getPeriodBadge(session.startTime, session.endTime);

                      return (
                        <div
                          key={session.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCourse(course);
                          }}
                    className={`course-block absolute left-1 right-1 rounded-xl p-1.5 sm:p-2 text-left cursor-pointer transition-all duration-150 hover:z-20 overflow-hidden shadow-2xs flex flex-col justify-between select-none ${
                            hasConflict 
                              ? 'ring-2 ring-amber-500 bg-amber-50/95 border-amber-300' 
                              : 'border'
                          }`}
                          style={{
                            top: `${top + 2}px`,
                            height: `${height - 4}px`,
                            backgroundColor: `${course.color}15`,
                            borderColor: course.color,
                            borderLeftWidth: '4px',
                          }}
                          title={`${course.name} (${session.startTime}-${session.endTime}) @ ${session.location || '未知地点'}`}
                        >
                          <div>
                            {/* Card Top: Period Badge / Make-up Tag */}
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span 
                                className="text-[9px] sm:text-[10px] font-extrabold px-1 rounded leading-none"
                                style={{ backgroundColor: `${course.color}30`, color: course.color }}
                              >
                                {periodBadge}
                              </span>
                              {isMakeupSession && (
                                <span className="text-[8px] font-bold px-1 rounded bg-amber-200 text-amber-900 leading-none">
                                  补课
                                </span>
                              )}
                              {hasConflict && (
                                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                              )}
                            </div>

                            {/* Course Name */}
                            <div 
                              className="font-bold text-[11px] sm:text-xs leading-tight line-clamp-2"
                              style={{ color: '#0F172A' }}
                            >
                              {course.name}
                            </div>
                          </div>

                          {/* Card Bottom: Location and Teacher */}
                          <div className="mt-1 space-y-0.5">
                            {session.location && (
                              <div className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-medium text-slate-700 truncate">
                                <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-500 shrink-0" />
                                <span className="truncate">{session.location}</span>
                              </div>
                            )}
                            
                            {height > 50 && course.instructor && (
                              <div className="text-[9px] text-slate-500 truncate hidden sm:block">
                                {course.instructor}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  </div>
                );
              })}

            </div>

          </div>

        </div>
      </div>

    </div>
  );
};

