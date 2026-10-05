import React from 'react';
import { 
  Clock, 
  MapPin, 
  User, 
  CheckCircle2, 
  Bell, 
  ExternalLink,
  ArrowRight,
  ArrowRightLeft
} from 'lucide-react';
import { Course } from '../types';
import { CurrentOrNextClassInfo, formatTimeDisplay } from '../utils/dateUtils';
import { useTranslation } from '../i18n/LanguageContext';

interface NextClassBannerProps {
  classInfo: CurrentOrNextClassInfo;
  timeFormat: '12h' | '24h';
  onSelectCourse: (course: Course) => void;
}

export const NextClassBanner: React.FC<NextClassBannerProps> = ({
  classInfo,
  timeFormat,
  onSelectCourse,
}) => {
  const { t } = useTranslation();
  const { status, course, session, timeUntilMinutes, minutesRemainingInClass, dayName, dayOffset, isMakeup, makeupNote } = classInfo;

  if (status === 'none' || !course || !session) {
    return (
      <div className="next-class-banner" data-current="false">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{t('banner.noUpcomingTitle')}</p>
            <p className="text-xs text-slate-500">{t('banner.noUpcomingSubtitle')}</p>
          </div>
        </div>
      </div>
    );
  }

  const isCurrent = status === 'in_progress';

  // 将 dayName 英文标记映射为当前语言的星期文案（Today/明天已在上方逻辑中处理）
  const DAY_NAME_TO_I18N: Record<string, string> = {
    Monday: 'days.monday',
    Tuesday: 'days.tuesday',
    Wednesday: 'days.wednesday',
    Thursday: 'days.thursday',
    Friday: 'days.friday',
    Saturday: 'days.saturday',
    Sunday: 'days.sunday',
  };
  const futureDayLabel =
    dayOffset === 1
      ? t('common.tomorrow')
      : t(DAY_NAME_TO_I18N[dayName] || 'days.monday');

  return (
    <div className={`next-class-banner rounded-xl border transition-all p-3.5 sm:p-4 shadow-2xs ${
      isCurrent 
        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
        : 'bg-gradient-to-r from-blue-50/80 to-indigo-50/70 border-blue-200/80 text-slate-900'
    }`} data-current={isCurrent ? 'true' : 'false'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Left Side: Status pill & details */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isCurrent ? 'bg-emerald-600 text-white shadow-xs' : 'bg-blue-600 text-white shadow-xs'
          }`}>
            <Clock className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                isCurrent 
                  ? 'bg-emerald-200 text-emerald-900' 
                  : 'bg-blue-200/70 text-blue-900'
              }`}>
                {isCurrent ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                    {t('banner.inSessionNow')}
                  </>
                ) : (
                  <>
                    <Bell className="w-3 h-3" />
                        {dayOffset === 0 
                          ? `${t('banner.upcomingIn')} ${timeUntilMinutes > 60 ? `${Math.floor(timeUntilMinutes / 60)}${t('common.hr')} ${timeUntilMinutes % 60}${t('common.min')}` : `${timeUntilMinutes} ${t('common.min')}`}`
                          : `${futureDayLabel} • ${formatTimeDisplay(session.startTime, timeFormat)}`}
                  </>
                )}
              </span>

              <span 
                className="font-bold text-sm sm:text-base text-slate-900 hover:text-blue-700 cursor-pointer flex items-center gap-1.5"
                onClick={() => onSelectCourse(course)}
              >
                <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: course.color }} />
                <span>{course.name}</span>
                {course.weeks && (
                  <span className="text-[11px] font-normal text-slate-500 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200/60">
                    {course.weeks}
                  </span>
                )}
                {isMakeup && makeupNote && (
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                    <ArrowRightLeft className="w-3 h-3" />
                    {makeupNote}
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-600">
              <span className="numeric-data flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formatTimeDisplay(session.startTime, timeFormat)} – {formatTimeDisplay(session.endTime, timeFormat)}
                {isCurrent && minutesRemainingInClass !== undefined && (
                  <span className="font-semibold text-emerald-700">({minutesRemainingInClass} {t('common.min')} {t('banner.remaining')})</span>
                )}
              </span>

              <span className="flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {session.location}
              </span>

              {course.instructor && (
                <span className="flex items-center gap-1 hidden sm:inline-flex">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {course.instructor}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Quick Action buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {course.virtualLink && (
            <a
              href={course.virtualLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 transition-colors shadow-2xs"
            >
              <span>{t('banner.joinClass')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <button
            onClick={() => onSelectCourse(course)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer"
          >
            <span>{t('banner.courseDetails')}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>

      </div>
    </div>
  );
};

