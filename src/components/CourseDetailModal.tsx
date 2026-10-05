import React from 'react';
import { 
  X, 
  Clock, 
  MapPin, 
  User, 
  Trash2, 
  Edit3, 
  Bell, 
  Calendar,
  CalendarDays
} from 'lucide-react';
import { Course, DayOfWeek } from '../types';
import { formatTimeDisplay } from '../utils/dateUtils';
import { useTranslation } from '../i18n/LanguageContext';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';

interface CourseDetailModalProps {
  course: Course | null;
  isOpen: boolean;
  onClose: () => void;
  onEditCourse: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
  onAddAssignmentForCourse: (course: Course) => void;
  timeFormat?: '12h' | '24h';
}

export const CourseDetailModal: React.FC<CourseDetailModalProps> = ({
  course,
  isOpen,
  onClose,
  onEditCourse,
  onDeleteCourse,
  onAddAssignmentForCourse,
  timeFormat = '24h',
}) => {
  const { t } = useTranslation();
  const dialogRef = useDialogAccessibility<HTMLDivElement>(isOpen, onClose);

  if (!isOpen || !course) return null;

  const getDayShortLabel = (day: DayOfWeek) => {
    switch (day) {
      case 'M': return t('days.mon');
      case 'T': return t('days.tue');
      case 'W': return t('days.wed');
      case 'R': return t('days.thu');
      case 'F': return t('days.fri');
      case 'S': return t('days.sat');
      case 'U': return t('days.sun');
      default: return day;
    }
  };

  const getDayFullLabel = (day: DayOfWeek) => {
    switch (day) {
      case 'M': return t('days.monday');
      case 'T': return t('days.tuesday');
      case 'W': return t('days.wednesday');
      case 'R': return t('days.thursday');
      case 'F': return t('days.friday');
      case 'S': return t('days.saturday');
      case 'U': return t('days.sunday');
      default: return day;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={course?.name || t('common.course')} tabIndex={-1} className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with Course Color Banner */}
        <div 
          className="p-6 text-white relative flex flex-col justify-between"
          style={{ backgroundColor: course.color || '#2563EB' }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors cursor-pointer"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/85 flex-wrap">
            <span>{course.term}</span>
            {course.weeks && <span className="bg-white/20 px-2 py-0.5 rounded-full">• 上课周次: {course.weeks}</span>}
            {course.section && <span>• {course.section}</span>}
            <span>• {course.credits} 学分</span>
          </div>

          <h2 className="text-2xl font-black tracking-tight mt-2">
            {course.name}
          </h2>
          {course.code && !/^\d{8,}$/.test(course.code) && (
            <p className="text-sm font-medium text-white/80 mt-0.5">
              {course.code}
            </p>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {/* Meeting Schedule List */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>每周上课与地点安排</span>
            </h4>
            <div className="space-y-2">
              {course.meetings.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0">
                      {getDayShortLabel(m.day)}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{getDayFullLabel(m.day)}</span><span className="text-xs text-slate-500">{m.weeks || course.weeks}</span>
                        <span className="px-1.5 py-0.2 rounded-md bg-white border border-slate-200 text-[10px] font-semibold text-slate-600 uppercase">
                          {m.type === 'lab' ? '实验' : m.type === 'studio' ? '体育' : '讲授'}
                        </span>
                      </div>
                      <div className="text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatTimeDisplay(m.startTime, timeFormat)} – {formatTimeDisplay(m.endTime, timeFormat)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="flex items-center gap-1 text-slate-700 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {m.location}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Instructor & Office Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">任课教师</span>
              <span className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {course.instructor || '待定教师'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">周次安排</span>
              <span className="text-xs font-bold text-slate-800 mt-1 block">
                {course.weeks || '全学期'}
              </span>
            </div>
          </div>

          {/* Syllabus / Notes if present */}
          {course.syllabusNotes && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                课程说明与作息节次
              </span>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                {course.syllabusNotes}
              </p>
            </div>
          )}

          {/* Reminder Status */}
          <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/70 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold text-blue-950">上课提醒通知</span>
                <p className="text-[11px] text-blue-800/80">
                  {course.reminderEnabled 
                    ? `提前 ${course.reminderLeadTimeMinutes} 分钟发出上课与地点提示`
                    : '已关闭上课提醒'}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Actions */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={() => {
              onDeleteCourse(course.id);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-100/60 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>删除课程</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onAddAssignmentForCourse(course);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>添加作业/实验</span>
            </button>

            <button
              onClick={() => {
                onEditCourse(course);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>编辑课程</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
