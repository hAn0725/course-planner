import React, { useRef, useEffect } from 'react';
import { 
  AcademicWeekInfo, 
  DEFAULT_ACADEMIC_CALENDAR,
  isCourseActiveInWeek 
} from '../data/academicCalendar';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Sparkles,
  Info,
  Layers,
  ArrowRightLeft,
  CalendarCheck2
} from 'lucide-react';
import { Course } from '../types';

interface AcademicWeekSelectorProps {
  selectedWeek: number;
  onSelectWeek: (week: number) => void;
  courses: Course[];
  /** 今天所在的校历周（用于“回到本周”快捷按钮） */
  currentWeek?: number | null;
}

export const AcademicWeekSelector: React.FC<AcademicWeekSelectorProps> = ({
  selectedWeek,
  onSelectWeek,
  courses,
  currentWeek,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentWeekInfo: AcademicWeekInfo | undefined = DEFAULT_ACADEMIC_CALENDAR.find(w => w.weekNumber === selectedWeek);

  const activeCoursesCount = courses.filter(c => c.meetings.some(m => isCourseActiveInWeek(m.weeks ?? c.weeks, selectedWeek))).length;

  const handlePrevWeek = () => {
    if (selectedWeek > 0) {
      onSelectWeek(selectedWeek - 1);
    }
  };

  const handleNextWeek = () => {
    if (selectedWeek < 20) {
      onSelectWeek(selectedWeek + 1);
    }
  };

  // Scroll active button into view horizontally on mobile
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeBtn = scrollContainerRef.current.querySelector(`[data-week="${selectedWeek}"]`) as HTMLElement;
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedWeek]);

  return (
    <div className="academic-week-selector bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs p-3.5 sm:p-5 space-y-3.5 sm:space-y-4">
      
      {/* Top Row: Week Title, Date Range, Holiday Info, Prev/Next Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Current Week Header */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm sm:text-base shadow-xs shrink-0">
            {selectedWeek === 0 ? (
              '预'
            ) : selectedWeek === 20 ? (
              '假'
            ) : (
              `${selectedWeek}`
            )}
          </div>
          
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {currentWeekInfo?.label || `第${selectedWeek}周`} ({currentWeekInfo?.chineseNumeral || ''})
              </h3>
              
              {currentWeekInfo?.holidayText && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-50 text-slate-500 border border-slate-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                  <span className="truncate max-w-[170px] sm:max-w-none">{currentWeekInfo.holidayText}</span>
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 flex-wrap">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="numeric-data truncate">
                {currentWeekInfo?.startDate} 至 {currentWeekInfo?.endDate} · 本周开课 {activeCoursesCount} 门
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Navigation Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 self-start sm:self-auto flex-wrap w-full sm:w-auto justify-between sm:justify-end">
          
          {/* Quick Dropdown on Mobile */}
          <select
            value={selectedWeek}
            onChange={(e) => {
              onSelectWeek(parseInt(e.target.value, 10));
            }}
            className="sm:hidden w-full max-w-[220px] min-w-0 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5"
            aria-label="快速跳转周次"
          >
            {DEFAULT_ACADEMIC_CALENDAR.map((w) => (
              <option key={w.weekNumber} value={w.weekNumber}>
                {w.label} ({w.dateRangeText}) {w.holidayText ? `· ${w.holidayText}` : ''}
              </option>
            ))}
          </select>

          <div className="hidden sm:flex items-center gap-1.5">
            {typeof currentWeek === 'number' && currentWeek !== selectedWeek && (
              <button
                onClick={() => onSelectWeek(currentWeek)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
              >
                回到本周
              </button>
            )}
            <button
              onClick={() => onSelectWeek(1)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedWeek === 1
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              第1周 (开学)
            </button>
          </div>

          {/* Prev/Next arrows */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200/80">
            <button
              onClick={handlePrevWeek}
              disabled={selectedWeek === 0}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="上一周"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-700 px-2 min-w-[50px] text-center select-none">
              {currentWeekInfo?.label}
            </span>
            <button
              onClick={handleNextWeek}
              disabled={selectedWeek === 20}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="下一周"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Week Timeline Pills Navigation (0 = 预备周, 1..19 = 教学周, 20 = 寒假) */}
      <div className="pt-2 border-t border-slate-100">
        <div 
          ref={scrollContainerRef}
          className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-200 scroll-smooth touch-pan-x"
        >
          {DEFAULT_ACADEMIC_CALENDAR.map((w) => {
            const isSelected = selectedWeek === w.weekNumber;
            const hasHoliday = !!w.isHolidayWeek;

            return (
              <button
                key={w.weekNumber}
                data-week={w.weekNumber}
                onClick={() => onSelectWeek(w.weekNumber)}
                className={`group relative px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all flex flex-col items-center gap-0.5 cursor-pointer snap-center min-w-[58px] ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs font-bold ring-2 ring-blue-400 ring-offset-1'

                    : 'bg-slate-50 text-slate-700 border border-slate-200/70 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>{w.label}</span>
                  {hasHoliday && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  )}
                </div>
                <span className={`numeric-data text-[10px] font-normal leading-none ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                  {w.dateRangeText}
                </span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
};
