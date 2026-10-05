import React from 'react';
import { 
  AlertTriangle, 
  X, 
  Clock, 
  MapPin, 
  CheckCircle2
} from 'lucide-react';
import { Course, DayOfWeek, ScheduleConflict } from '../types';
import { formatTimeDisplay } from '../utils/dateUtils';
import { useTranslation } from '../i18n/LanguageContext';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';

interface ConflictAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: ScheduleConflict[];
  onSelectCourse: (course: Course) => void;
  timeFormat?: '12h' | '24h';
}

export const ConflictAlertModal: React.FC<ConflictAlertModalProps> = ({
  isOpen,
  onClose,
  conflicts,
  onSelectCourse,
  timeFormat = '12h',
}) => {
  const { t } = useTranslation();
  const dialogRef = useDialogAccessibility<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

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
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('conflicts.title')} tabIndex={-1} className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-amber-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-950">{t('conflicts.title')}</h2>
              <p className="text-xs text-amber-800">
                {t('conflicts.subtitle', { count: conflicts.length })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-amber-800 hover:text-amber-950 rounded-xl hover:bg-amber-100 transition-colors cursor-pointer"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[60vh]">
          {conflicts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-slate-800">{t('conflicts.noConflicts')}</p>
              <p className="text-slate-500 text-[11px] mt-0.5">{t('conflicts.noConflictsSubtitle')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-600">
                {t('conflicts.explanation')}
              </p>

              {conflicts.map((conflict, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-3"
                >
                  <div className="flex items-center justify-between text-amber-900 font-bold">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      {getDayFullLabel(conflict.day)} {t('conflicts.overlapMin', { min: conflict.overlapDurationMinutes })}
                    </span>
                  </div>

                  {/* Conflicting pair */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    
                    {/* Course 1 */}
                    <div 
                      onClick={() => {
                        onSelectCourse(conflict.course1);
                        onClose();
                      }}
                      className="p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-500 cursor-pointer shadow-2xs transition-all"
                    >
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: conflict.course1.color }} />
                        {conflict.course1.code}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">{conflict.course1.name}</div>
                      <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatTimeDisplay(conflict.session1.startTime, timeFormat)} – {formatTimeDisplay(conflict.session1.endTime, timeFormat)}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {conflict.session1.location}
                      </div>
                    </div>

                    {/* Course 2 */}
                    <div 
                      onClick={() => {
                        onSelectCourse(conflict.course2);
                        onClose();
                      }}
                      className="p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-500 cursor-pointer shadow-2xs transition-all"
                    >
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: conflict.course2.color }} />
                        {conflict.course2.code}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">{conflict.course2.name}</div>
                      <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatTimeDisplay(conflict.session2.startTime, timeFormat)} – {formatTimeDisplay(conflict.session2.endTime, timeFormat)}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {conflict.session2.location}
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200/60 cursor-pointer"
          >
            {t('common.close')}
          </button>
        </div>

      </div>
    </div>
  );
};
