import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Save,
  BookOpen
} from 'lucide-react';
import { Course, CourseType, DayOfWeek, MeetingSession } from '../types';
import { ALL_DAYS } from '../utils/dateUtils';
import { getRandomCourseColor } from '../utils/registrarParsers';
import { useTranslation } from '../i18n/LanguageContext';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';

const PALETTE = [
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

interface CourseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveCourse: (course: Course) => void;
  initialCourse?: Course | null;
  defaultDay?: DayOfWeek;
  defaultStartTime?: string;
  activeTerm: string;
  draftMode?: boolean;
}

export const CourseFormModal: React.FC<CourseFormModalProps> = ({
  isOpen,
  onClose,
  onSaveCourse,
  initialCourse,
  defaultDay,
  defaultStartTime,
  activeTerm,
  draftMode = false,
}) => {
  const { t } = useTranslation();
  const dialogRef = useDialogAccessibility<HTMLDivElement>(isOpen, onClose);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [section, setSection] = useState('01班');
  const [crn, setCrn] = useState('');
  const [weeks, setWeeks] = useState('1-16周');
  const [instructor, setInstructor] = useState('');
  const [credits, setCredits] = useState(3.5);
  const [color, setColor] = useState(PALETTE[0]);
  const [term, setTerm] = useState(activeTerm);
  const [syllabusNotes, setSyllabusNotes] = useState('');
  const [officeHours, setOfficeHours] = useState('');
  const [virtualLink, setVirtualLink] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderLeadTimeMinutes, setReminderLeadTimeMinutes] = useState(15);
  const [meetings, setMeetings] = useState<MeetingSession[]>([]);

  useEffect(() => {
    if (initialCourse) {
      setCode(initialCourse.code || '');
      setName(initialCourse.name || '');
      setSection(initialCourse.section || '01班');
      setCrn(initialCourse.crn || '');
      setWeeks(draftMode ? (initialCourse.weeks ?? '') : (initialCourse.weeks || '1-16周'));
      setInstructor(initialCourse.instructor || '');
      setCredits(draftMode ? (initialCourse.credits ?? 0) : (initialCourse.credits || 3.5));
      setColor(initialCourse.color || PALETTE[0]);
      setTerm(initialCourse.term || activeTerm);
      setSyllabusNotes(initialCourse.syllabusNotes || '');
      setOfficeHours(initialCourse.officeHours || '');
      setVirtualLink(initialCourse.virtualLink || '');
      setReminderEnabled(initialCourse.reminderEnabled !== undefined ? initialCourse.reminderEnabled : true);
      setReminderLeadTimeMinutes(initialCourse.reminderLeadTimeMinutes || 15);
      setMeetings(initialCourse.meetings || []);
    } else {
      setCode('');
      setName('');
      setSection('01班');
      setCrn('');
      setWeeks('1-16周');
      setInstructor('');
      setCredits(3.5);
      setColor(getRandomCourseColor(Math.floor(Math.random() * PALETTE.length)));
      setTerm(activeTerm);
      setSyllabusNotes('');
      setOfficeHours('');
      setVirtualLink('');
      setReminderEnabled(true);
      setReminderLeadTimeMinutes(15);
      
      const start = defaultStartTime || '08:00';
      const [h, m] = start.split(':').map(Number);
      const endH = h + 1;
      const endM = (m + 35) % 60;
      const endFormatted = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      setMeetings([
        {
          id: Math.random().toString(36).substring(2, 9),
          day: defaultDay || 'M',
          startTime: start,
          endTime: endFormatted,
          location: '教学楼',
          type: 'lecture',
        }
      ]);
    }
  }, [initialCourse, isOpen, defaultDay, defaultStartTime, activeTerm]);

  if (!isOpen) return null;

  const handleAddSession = () => {
    setMeetings([
      ...meetings,
      {
        id: Math.random().toString(36).substring(2, 9),
        day: 'W',
        startTime: meetings[0]?.startTime || '09:55',
        endTime: meetings[0]?.endTime || '12:20',
        location: meetings[0]?.location || '教学楼',
        type: 'lecture',
      }
    ]);
  };

  const handleRemoveSession = (id: string) => {
    setMeetings(meetings.filter(m => m.id !== id));
  };

  const handleSessionChange = (id: string, field: keyof MeetingSession, value: unknown) => {
    setMeetings(meetings.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const courseToSave: Course = {
      schedulePending: initialCourse?.schedulePending && !meetings.length,
      scheduleVerified: initialCourse?.scheduleVerified,
      scheduleRevision: initialCourse?.scheduleRevision,
      id: initialCourse ? initialCourse.id : 'course_' + Math.random().toString(36).substring(2, 9),
      code: code.trim(),
      name: name.trim(),
      section: section.trim() || '01班',
      crn: crn.trim() || undefined,
      weeks: draftMode ? weeks.trim() : (weeks.trim() || '1-16周'),
      instructor: instructor.trim() || undefined,
      credits: draftMode ? Number(credits) || 0 : Number(credits) || 3.5,
      color,
      term,
      syllabusNotes: syllabusNotes.trim() || undefined,
      officeHours: officeHours.trim() || undefined,
      virtualLink: virtualLink.trim() || undefined,
      reminderEnabled,
      reminderLeadTimeMinutes,
      meetings,
    };

    onSaveCourse(courseToSave);
    onClose();
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
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={initialCourse ? t('courseModal.editTitle') : t('courseModal.addNewTitle')} tabIndex={-1} className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
              style={{ backgroundColor: color }}
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {initialCourse ? '编辑课程' : '添加新课程'}
              </h2>
              <p className="text-xs text-slate-500">配置课程名称、周次、上课时间与上课地点</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          
          {/* Row 1: Course Name (Primary) & Weeks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">
                课程名称 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="例如：课程名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                上课周次
              </label>
              <input
                type="text"
                placeholder="如：1-16周、10-17周"
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          {/* Row 2: Section, Credits, Term */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">教学班 / 班级</label>
              <input
                type="text"
                placeholder="01班 / 02班"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">学分</label>
              <input
                type="number"
                min="0"
                max="12"
                step="0.5"
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">学期</label>
              <input
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          {/* Row 3: Instructor & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">任课教师</label>
              <input
                type="text"
                placeholder="例如：陈老师、教学组"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">上课简注 / 实验要求</label>
              <input
                type="text"
                placeholder="例如：需携带实验报告册、第3-5节"
                value={syllabusNotes}
                onChange={(e) => setSyllabusNotes(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          {/* Color Palette */}
          <div>
            <label className="font-bold text-slate-700 block mb-1.5">课表主题色彩</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PALETTE.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-xl transition-all cursor-pointer ${
                    color === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Sessions List */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">上课时间与教室安排</h4>
                <p className="text-[11px] text-slate-500">支持周一至周日全周时段配置</p>
              </div>
              <button
                type="button"
                onClick={handleAddSession}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>增加上课时段</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {meetings.map((m) => (
                <div 
                  key={m.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-2.5"
                >
                  {/* Day Picker */}
                  <select
                    value={m.day}
                    onChange={(e) => handleSessionChange(m.id, 'day', e.target.value as DayOfWeek)}
                    className="p-2 rounded-xl border border-slate-300 font-bold bg-white text-slate-800"
                  >
                    {ALL_DAYS.map((d) => (
                      <option key={d} value={d}>
                        {getDayFullLabel(d)}
                      </option>
                    ))}
                  </select>

                  {/* Time Range */}
                  <div className="flex items-center gap-1.5 flex-1">
                    <input
                      type="time"
                      value={m.startTime}
                      onChange={(e) => handleSessionChange(m.id, 'startTime', e.target.value)}
                      className="p-2 rounded-xl border border-slate-300 font-mono bg-white"
                    />
                    <span className="text-slate-400 font-bold">至</span>
                    <input
                      type="time"
                      value={m.endTime}
                      onChange={(e) => handleSessionChange(m.id, 'endTime', e.target.value)}
                      className="p-2 rounded-xl border border-slate-300 font-mono bg-white"
                    />
                  </div>

                  {/* Location */}
                  <input
                    type="text"
                    placeholder="教学地点 (如: 教学楼 101)"
                    value={m.location}
                    onChange={(e) => handleSessionChange(m.id, 'location', e.target.value)}
                    className="p-2 rounded-xl border border-slate-300 flex-1 bg-white"
                  />

                  {/* Type */}
                  <select
                    value={m.type}
                    onChange={(e) => handleSessionChange(m.id, 'type', e.target.value as CourseType)}
                    className="p-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="lecture">理论课</option>
                    <option value="lab">实验课</option>
                    <option value="studio">体育/实训</option>
                    <option value="discussion">研讨/答疑</option>
                  </select>

                  {/* Delete Button */}
                  <label className="text-xs text-slate-600">此时段周次
                    <input aria-label="此时段周次" value={m.weeks || ''} placeholder={weeks} onChange={e => handleSessionChange(m.id, 'weeks', e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 mt-1" />
                  </label>
                  {meetings.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSession(m.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reminder Toggle */}
          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/80 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-900 block">开启上课闹钟与提醒</span>
              <p className="text-[11px] text-slate-500">上课前发出声音及通知提醒</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={reminderLeadTimeMinutes}
                onChange={(e) => setReminderLeadTimeMinutes(Number(e.target.value))}
                disabled={!reminderEnabled}
                className="p-1.5 rounded-xl border border-slate-300 bg-white text-xs disabled:opacity-50"
              >
                <option value={10}>提前 10 分钟</option>
                <option value={15}>提前 15 分钟</option>
                <option value={20}>提前 20 分钟</option>
                <option value={30}>提前 30 分钟</option>
              </select>
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>保存课程</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
