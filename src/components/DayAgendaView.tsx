import React, { useState } from 'react';
import { 
  Course, 
  DayOfWeek, 
  AssignmentReminder 
} from '../types';
import { 
  WEEKDAYS, 
  ALL_DAYS, 
  timeStringToMinutes, 
  formatTimeDisplay, 
  calculateCourseDurationMinutes,
  jsDayToDayOfWeek 
} from '../utils/dateUtils';
import { 
  Clock, 
  MapPin, 
  User, 
  Calendar as CalendarIcon, 
  ChevronRight,
  Sparkles,
  ArrowRightLeft,
  BookOpen
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { 
  getDateForWeekAndDay, 
  getMeetingsForWeekAndDay,
  getWeekInfoForDate,
  DEFAULT_ACADEMIC_CALENDAR
} from '../data/academicCalendar';

interface DayAgendaViewProps {
  courses: Course[];
  assignments: AssignmentReminder[];
  timeFormat?: '12h' | '24h';
  showWeekends?: boolean;
  selectedWeek?: number;
  applyHolidayAdjustments?: boolean;
  onSelectCourse: (course: Course) => void;
  onToggleAssignment: (assignmentId: string) => void;
}

export const DayAgendaView: React.FC<DayAgendaViewProps> = ({
  courses,
  timeFormat = '24h',
  showWeekends = true,
  selectedWeek = 1,
  applyHolidayAdjustments = true,
  onSelectCourse,
}) => {
  const { t } = useTranslation();
  const currentDayCode = jsDayToDayOfWeek(new Date().getDay());
  // 今天所在的校历周：只有浏览的周与今天同一周时才标记“今天”
  const todayWeekNumber = getWeekInfoForDate(new Date())?.weekNumber;
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(currentDayCode);
  const days: DayOfWeek[] = showWeekends ? ALL_DAYS : WEEKDAYS;

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
      case 'M': return '星期一 (Monday)';
      case 'T': return '星期二 (Tuesday)';
      case 'W': return '星期三 (Wednesday)';
      case 'R': return '星期四 (Thursday)';
      case 'F': return '星期五 (Friday)';
      case 'S': return '星期六 (Saturday)';
      case 'U': return '星期日 (Sunday)';
      default: return day;
    }
  };

  // Get date for the current selected day
  const selectedDateStr = typeof selectedWeek === 'number'
    ? getDateForWeekAndDay(selectedWeek, selectedDay)
    : null;

  // Get meetings and adjustment info for this day
  const { meetings: daySessions, adjustment } = getMeetingsForWeekAndDay(
    courses,
    selectedWeek,
    selectedDay,
    applyHolidayAdjustments
  );

  // Sort day sessions by start time
  daySessions.sort((a, b) => {
    return timeStringToMinutes(a.session.startTime) - timeStringToMinutes(b.session.startTime);
  });

  const getPeriodBadge = (startTime: string, endTime: string) => {
    if (startTime === '08:00') return '第1-2节 (08:00-09:35)';
    if (startTime === '09:55' && endTime === '11:30') return '第3-4节 (09:55-11:30)';
    if (startTime === '09:55' && endTime === '12:20') return '第3-5节 (09:55-12:20)';
    if (startTime === '14:00' && endTime === '15:35') return '第6-7节 (14:00-15:35)';
    if (startTime === '14:00' && endTime === '16:25') return '第6-8节 (14:00-16:25)';
    if (startTime === '14:00' && endTime === '17:30') return '第6-9节 (14:00-17:30)';
    if (startTime === '16:45') return '第9-10节 (16:45-18:20)';
    if (startTime === '19:00') return '第11-13节 (19:00-21:25)';
    return `${startTime} - ${endTime}`;
  };

  return (
    <div className="agenda-panel bg-white border border-slate-200/90 rounded-2xl shadow-xs p-3.5 sm:p-6">
      
      {/* Day Selector Pills with Weekend and Holiday Badges */}
      <div className="flex items-center gap-1.5 sm:gap-2 pb-4 sm:pb-5 border-b border-slate-100 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
        {days.map((day) => {
          const isSelected = day === selectedDay;
          const isToday = day === currentDayCode && typeof selectedWeek === 'number' && selectedWeek === todayWeekNumber;
          const isWeekend = day === 'S' || day === 'U';

          const dayRes = getMeetingsForWeekAndDay(courses, selectedWeek, day, applyHolidayAdjustments);
          const count = dayRes.meetings.length;
          const isHolidayOff = dayRes.adjustment?.type === 'holiday_off';
          const isMakeupDay = dayRes.adjustment?.type === 'makeup_class';

          // Formatted date string
          const dStr = typeof selectedWeek === 'number' ? getDateForWeekAndDay(selectedWeek, day) : null;
          const shortDate = dStr ? dStr.split('-').slice(1).join('.') : '';

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex flex-col items-center gap-0.5 shrink-0 cursor-pointer snap-center min-w-[62px] ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isHolidayOff
                  ? 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                  : isMakeupDay
                  ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                  : isToday
                  ? 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                  : isWeekend
                  ? 'bg-amber-50/40 text-amber-900 border border-amber-200/50 hover:bg-amber-100/50'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-1">
                <span>{getDayShortLabel(day)}</span>
                {isToday && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-600'}`} />
                )}
                {isHolidayOff && !isSelected && (
                  <span className="text-[9px] text-slate-500 font-bold">假</span>
                )}
                {isMakeupDay && !isSelected && (
                  <span className="text-[9px] text-amber-600 font-bold">补</span>
                )}
              </div>
              <span className={`text-[10px] font-normal leading-none ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                {shortDate || `${count}节`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Day Overview Header */}
      <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {getDayFullLabel(selectedDay)}
            </h3>
            {selectedDateStr && (
              <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                {selectedDateStr}
              </span>
            )}
            {adjustment && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                adjustment.type === 'holiday_off'
                  ? 'bg-slate-100 text-slate-700 border border-slate-200'
                  : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}>
                {adjustment.title}
              </span>
            )}
          </div>
          {adjustment?.description && (
            <p className="text-xs text-slate-500 mt-1">
              {adjustment.description}
            </p>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          {adjustment?.type === 'holiday_off' ? (
            <span className="text-slate-600 font-bold">放假停课</span>
          ) : (
            <span>共 {daySessions.length} 个上课时段</span>
          )}
        </div>
      </div>

      {/* Makeup Schedule Notice */}
      {adjustment?.type === 'makeup_class' && (
        <div className="my-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
          <ArrowRightLeft className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">【调休补课日程提示】：</span>
            <span>{adjustment.description}</span>
          </div>
        </div>
      )}

      {/* Day Sessions List */}
      <div className="mt-4 space-y-3.5">
        {daySessions.length === 0 ? (
          <div className="p-10 text-center text-slate-400 space-y-2">
            <CalendarIcon className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-medium text-slate-600">本日暂无课程安排</p>
            <p className="text-xs text-slate-400">可以安排自习、实验预习或图书馆阅览</p>
          </div>
        ) : (
          daySessions.map(({ course, session, isMakeupSession, makeupSourceNote }) => {
            const duration = calculateCourseDurationMinutes(session.startTime, session.endTime);
            const periodString = getPeriodBadge(session.startTime, session.endTime);

            return (
              <div
                key={session.id}
                onClick={() => onSelectCourse(course)}
                className="group relative bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer overflow-hidden"
                style={{ borderLeftColor: course.color, borderLeftWidth: '6px' }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  
                  {/* Left Column: Period Badge, Course Name, Details */}
                  <div className="space-y-2">
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <span 
                        className="px-2.5 py-0.5 rounded-lg text-xs font-bold"
                        style={{ backgroundColor: `${course.color}20`, color: course.color }}
                      >
                        {periodString}
                      </span>

                      {isMakeupSession && (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          {makeupSourceNote || '调休补课'}
                        </span>
                      )}

                      {course.weeks && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                          {course.weeks}
                        </span>
                      )}
                    </div>

                    <h4 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {course.name}
                    </h4>

                    {/* Metadata Strip: Time, Location, Instructor */}
                    <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{formatTimeDisplay(session.startTime, timeFormat)} - {formatTimeDisplay(session.endTime, timeFormat)} ({duration}分钟)</span>
                      </div>

                      {session.location && (
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <MapPin className="w-4 h-4 text-rose-500" />
                          <span>{session.location}</span>
                        </div>
                      )}

                      {course.instructor && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <User className="w-4 h-4 text-slate-400" />
                          <span>{course.instructor}</span>
                        </div>
                      )}
                    </div>

                    {/* Syllabus Notes snippet if available */}
                    {course.syllabusNotes && (
                      <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
                        {course.syllabusNotes}
                      </p>
                    )}

                  </div>

                  {/* Right Column: Arrow Trigger */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="text-xs font-bold text-blue-600 hidden sm:inline group-hover:translate-x-0.5 transition-transform">
                      课程详情
                    </span>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
