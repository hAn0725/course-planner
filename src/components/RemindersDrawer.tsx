import React, { useState } from 'react';
import { 
  Bell, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Calendar, Search, Repeat, Pencil
} from 'lucide-react';
import { AssignmentReminder, AssignmentType, Course, PriorityLevel, NotificationLog } from '../types';
import { localDate } from '../utils/reminderUtils';
import { formatTimeDisplay } from '../utils/dateUtils';
import { useTranslation } from '../i18n/LanguageContext';
import { ReminderSelect } from './ReminderSelect';

/** 新建截止项表单：可选的提前提醒时长（分钟 → i18n key） */
const REMINDER_LEAD_OPTIONS: Array<{ value: number; leadKey: string }> = [
  { value: 60, leadKey: 'h1' },
  { value: 360, leadKey: 'h6' },
  { value: 1440, leadKey: 'd1' },
  { value: 2880, leadKey: 'd2' },
  { value: 10080, leadKey: 'w1' },
];

/** 提前提醒时长的本地化文案（如 “提前 24 小时 (1天)”） */
function leadTimeTextFactory(t: (key: string) => string) {
  const map: Record<number, string> = { 5: 'm5', 10: 'm10', 15: 'm15', 30: 'm30', 60: 'h1', 360: 'h6', 1440: 'd1', 2880: 'd2', 10080: 'w1' };
  return (minutes: number): string => {
    if (minutes === 0) return '准时提醒';
    const key = map[minutes];
    if (key) return t(`reminders.leadOptions.${key}`);
    return minutes >= 1440 ? `提前 ${minutes / 1440} 天` : `提前 ${minutes / 60} 小时`;
  };
}

interface RemindersPanelProps {
  courses: Course[];
  assignments: AssignmentReminder[];
  onAddAssignment: (assignment: Omit<AssignmentReminder, 'id'>) => void;
  onUpdateAssignment: (assignment: AssignmentReminder) => void;
  onToggleAssignment: (id: string) => void;
  onDeleteAssignment: (id: string) => void;
  browserNotifications: boolean;
  onRequestBrowserNotifications: () => void;
  notificationsLog: NotificationLog[];
  onClearNotificationLog: () => void;
  defaultLeadTime: number;
  setDefaultLeadTime: (minutes: number) => void;
}

export const RemindersPanel: React.FC<RemindersPanelProps> = ({
  courses,
  assignments,
  onAddAssignment,
  onToggleAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
  browserNotifications,
  onRequestBrowserNotifications,
  notificationsLog,
  onClearNotificationLog,
  defaultLeadTime,
  setDefaultLeadTime,
}) => {
  const { t } = useTranslation();
  const leadTimeText = leadTimeTextFactory(t);
  const [activeTab, setActiveTab] = useState<'assignments' | 'settings' | 'history'>('assignments');
  const [filterType, setFilterType] = useState<string>('pending');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state for course work, personal tasks, competitions, and events.
  const [newTitle, setNewTitle] = useState('');
  const [newCourseId, setNewCourseId] = useState('');
  const [newType, setNewType] = useState<AssignmentType>('assignment');
  const [newDueDate, setNewDueDate] = useState(localDate(new Date()));
  const [newDueTime, setNewDueTime] = useState('23:59');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('medium');
  const [newReminderLead, setNewReminderLead] = useState(1440); // 24 hours
  const [newNotes, setNewNotes] = useState('');

  const [repeat, setRepeat] = useState<AssignmentReminder['repeat']>('none');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const data: Omit<AssignmentReminder, 'id'> = {
      repeat,
      courseId: newCourseId || undefined,
      title: newTitle.trim(),
      type: newType,
      dueDate: newDueDate,
      dueTime: newDueTime,
      completed: false,
      priority: newPriority,
      reminderMinutesBefore: newReminderLead,
      notes: newNotes.trim() || undefined,
    };
    if (editingId) {
      const existing = assignments.find(a => a.id === editingId)!;
      onUpdateAssignment({ ...existing, ...data, id: editingId, completed: existing.completed, notificationSent: false });
    } else onAddAssignment(data);
    setEditingId(null);
    setRepeat('none');

    setNewTitle('');
    setNewCourseId('');
    setNewType('assignment');
    setNewNotes('');
    setShowAddForm(false);
  };

  const today = localDate(new Date());
  const matchesFilter = (a: AssignmentReminder, filter: string) => {
    if (filter === 'today') return !a.completed && a.dueDate <= today;
    if (filter === 'scheduled') return !a.completed && a.dueDate > today;
    if (filter === 'daily') return !a.completed && (a.repeat === 'daily' || a.repeat === 'weekdays');
    if (filter === 'pending') return !a.completed;
    if (filter === 'completed') return a.completed;
    if (filter === 'exams') return !a.completed && ['midterm', 'final', 'quiz'].includes(a.type);
    return true;
  };
  const filteredAssignments = assignments.filter(a => matchesFilter(a, filterType) &&
    `${a.title} ${a.notes || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(a.completed) - Number(b.completed) || `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`));
  const edit = (a: AssignmentReminder) => {
    setEditingId(a.id); setNewTitle(a.title); setNewCourseId(a.courseId || '');
    setNewType(a.type); setNewDueDate(a.dueDate); setNewDueTime(a.dueTime);
    setNewPriority(a.priority); setNewReminderLead(a.reminderMinutesBefore);
    setNewNotes(a.notes || ''); setRepeat(a.repeat || 'none'); setShowAddForm(true);
  };

  const getCourseForAssignment = (courseId?: string) => {
    if (!courseId) return undefined;
    // 优先按 id 精确匹配；再按课程代码匹配（空代码不能匹配任何内容，否则会错配到第一门课）
    return courses.find(c => c.id === courseId)
      ?? courses.find(c => !!c.code && courseId.includes(c.code));
  };

  return (
    <section id="reminders-panel" aria-labelledby="reminders-panel-title" className="reminders-panel">
        
        {/* Header */}
        <div className="reminders-panel-header">
          <div className="flex items-center gap-3">
            <div className="reminders-panel-mark">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 id="reminders-panel-title" className="text-base font-bold text-slate-900">{t('reminders.title')}</h2>
              <p className="text-xs text-slate-500">{t('reminders.subtitle')}</p>
            </div>
          </div>
          <span className="reminders-total-badge">{assignments.filter(a => !a.completed).length} 待完成</span>
        </div>

        {/* Tab Navigation */}
        <div role="tablist" aria-label={t('reminders.title')} className="reminders-tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'assignments'}
            onClick={() => setActiveTab('assignments')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'assignments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{t('reminders.tabAssignments')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {assignments.filter(a => !a.completed).length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{t('reminders.tabSettings')}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{t('reminders.tabHistory')}</span>
            {notificationsLog.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-blue-600" />
            )}
          </button>
        </div>

        {/* Body Content */}
        <div className="reminders-panel-body">

          {/* TAB 1: ASSIGNMENTS & EXAMS */}
          {activeTab === 'assignments' && (
            <div className="reminders-content space-y-4">
              
              <label className="flex items-center gap-2 bg-slate-200/60 rounded-xl px-3 py-2.5 text-slate-500">
                <Search size={16} /><input aria-label="搜索提醒事项" placeholder="搜索提醒事项" value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent outline-none w-full text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                {([['today','今天'],['scheduled','计划'],['pending','全部待办'],['daily','每日']] as const).map(([key,label]) => (
                  <button key={key} onClick={() => setFilterType(key)} aria-pressed={filterType === key}
                    className={`text-left p-4 rounded-2xl border transition-colors ${filterType === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200/60 hover:border-blue-300'}`}>
                    <div className="flex justify-between items-center mb-2"><Calendar size={20}/><span className="text-2xl font-semibold">{assignments.filter(a => matchesFilter(a,key)).length}</span></div>
                    <span className="text-sm font-semibold">{label}</span>
                  </button>
                ))}
              </div>
              {/* Top controls: Filter & Add button */}
              <div className="reminders-filter-controls flex items-center justify-between gap-2">
                <div className="reminders-filter-chips flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                    }`}
                  >
                    {t('common.all')}
                  </button>
                  <button
                    onClick={() => setFilterType('pending')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      filterType === 'pending' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                    }`}
                  >
                    {t('reminders.pending')}
                  </button>
                  <button
                    onClick={() => setFilterType('exams')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      filterType === 'exams' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                    }`}
                  >
                    {t('reminders.exams')}
                  </button>
                  <button
                    onClick={() => setFilterType('completed')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      filterType === 'completed' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                    }`}
                  >
                    {t('reminders.done')}
                  </button>
                </div>

                  <button
                    onClick={() => { setEditingId(null); setNewTitle(''); setNewNotes(''); setNewCourseId(''); setNewType('assignment'); setNewDueDate(localDate(new Date())); setNewDueTime('23:59'); setNewPriority('medium'); setNewReminderLead(1440); setRepeat('none'); setShowAddForm(!showAddForm); }}
                    className="reminders-add-button inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                    aria-expanded={showAddForm}
                  >
                  <Plus className={`w-3.5 h-3.5 transition-transform duration-200 ${showAddForm ? 'rotate-45' : ''}`} />
                  <span>{showAddForm ? t('common.close') : t('reminders.addDeadlineBtn')}</span>
                </button>
              </div>

              {/* Add Assignment Form Drawer */}
              {showAddForm && (
                <form onSubmit={handleCreateAssignment} className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40 space-y-3">
                  <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">{editingId ? '编辑提醒事项' : t('reminders.newDeadlineTitle')}</h4>
                  
                  <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">{t('reminders.titleInputLabel')}</label>
                    <input
                      type="text"
                      required
                      placeholder={t('reminders.titleInputPlaceholder')}
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">{t('reminders.courseSelectLabel')}</label>
                    <ReminderSelect
                      value={newCourseId}
                      onChange={setNewCourseId}
                      ariaLabel={t('reminders.courseSelectLabel')}
                      searchable
                      options={[
                        { value: '', label: t('reminders.noCourseAssociation') },
                        ...courses.map(course => ({
                          value: course.id,
                          label: course.code ? `${course.code} – ${course.name}` : course.name,
                        })),
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">{t('reminders.typeLabel')}</label>
                      <ReminderSelect
                        value={newType}
                        onChange={value => setNewType(value as AssignmentType)}
                        ariaLabel={t('reminders.typeLabel')}
                        options={[
                          { value: 'assignment', label: t('reminders.types.assignment') },
                          { value: 'midterm', label: t('reminders.types.midterm') },
                          { value: 'final', label: t('reminders.types.final') },
                          { value: 'quiz', label: t('reminders.types.quiz') },
                          { value: 'project', label: t('reminders.types.project') },
                          { value: 'reading', label: t('reminders.types.reading') },
                          { value: 'other', label: t('reminders.types.other') },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">{t('reminders.priorityLabel')}</label>
                      <ReminderSelect
                        value={newPriority}
                        onChange={value => setNewPriority(value as PriorityLevel)}
                        ariaLabel={t('reminders.priorityLabel')}
                        options={[
                          { value: 'urgent', label: t('reminders.urgent') },
                          { value: 'medium', label: t('reminders.medium') },
                          { value: 'low', label: t('reminders.low') },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">{t('reminders.dueDateLabel')}</label>
                      <input
                        type="date"
                        required
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">{t('reminders.dueTimeLabel')}</label>
                      <input
                        type="time"
                        required
                        value={newDueTime}
                        onChange={(e) => setNewDueTime(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">{t('reminders.leadTimeLabel')}</label>
                      <ReminderSelect
                        value={String(newReminderLead)}
                        onChange={value => setNewReminderLead(Number(value))}
                        ariaLabel={t('reminders.leadTimeLabel')}
                        options={[
                          { value: '0', label: '准时提醒' },
                          { value: '15', label: '提前15分钟' },
                          ...REMINDER_LEAD_OPTIONS.map(({ value, leadKey }) => ({ value: String(value), label: t(`reminders.leadOptions.${leadKey}`) })),
                        ]}
                      />
                    </div>
                    <label className="text-[11px] font-bold text-slate-700">重复
                      <ReminderSelect
                        value={repeat}
                        onChange={value => setRepeat(value as AssignmentReminder['repeat'])}
                        ariaLabel="重复"
                        options={[
                          { value: 'none', label: '不重复' },
                          { value: 'daily', label: '每天' },
                          { value: 'weekdays', label: '每个工作日（周一至周五）' },
                          { value: 'weekly', label: '每周' },
                        ]}
                      />
                    </label>
                  </div>

                  <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">{t('reminders.notesInputLabel')}</label>
                      <textarea
                        rows={2}
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        placeholder={t('reminders.notesPlaceholder')}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>

                  <p className="text-[10px] text-slate-400">重复事项完成后，自动安排下一次。</p>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/50 cursor-pointer"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-xs cursor-pointer"
                    >
                      {t('reminders.saveDeadline')}
                    </button>
                  </div>
                </form>
              )}

              {/* Assignment List */}
              {filteredAssignments.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">{t('reminders.noDeadlines')}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t('reminders.noDeadlinesSubtext')}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredAssignments.map((a) => {
                    const course = getCourseForAssignment(a.courseId);
                    return (
                      <div
                        key={a.id}
                        className={`reminder-item transition-all flex items-start justify-between gap-3 ${
                          a.completed
                            ? 'bg-slate-50/80 border-slate-200 opacity-60'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            aria-label={`完成状态：${a.title}`} aria-pressed={a.completed}
                            onClick={() => onToggleAssignment(a.id)}
                            className="mt-0.5 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                          >
                            {a.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-300 hover:text-blue-500" />
                            )}
                          </button>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-bold ${a.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                {a.title}
                              </span>

                              {course && (
                                <span 
                                  className="text-[10px] font-bold px-2 py-0.2 rounded-md"
                                  style={{ 
                                    backgroundColor: course.color ? `${course.color}15` : '#2563EB15',
                                    color: course.color || '#2563EB' 
                                  }}
                                >
                                  {course.name}
                                </span>
                              )}

                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-md ${
                                a.priority === 'urgent'
                                  ? 'bg-rose-100 text-rose-800'
                                  : a.priority === 'medium'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {t(`reminders.${a.priority}`)}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                              <span className="numeric-data flex items-center gap-1 font-medium">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {a.dueDate} {formatTimeDisplay(a.dueTime, '24h')}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {leadTimeText(a.reminderMinutesBefore)}
                              </span>
                            </div>

                            {!a.completed && a.dueDate < today && <p className="text-xs text-rose-600 mt-1">已逾期</p>}
                            {a.repeat && a.repeat !== 'none' && <p className="flex items-center gap-1 text-xs text-blue-600 mt-1"><Repeat size={12}/>{a.repeat === 'daily' ? '每天' : a.repeat === 'weekly' ? '每周' : '工作日'} · 已完成 {a.completedDates?.length || 0} 次</p>}
                            {a.notes && (
                              <p className="text-[11px] text-slate-600 mt-1 italic">
                                {a.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <button aria-label={`编辑 ${a.title}`} onClick={() => edit(a)} className="p-1.5 text-slate-400 hover:text-blue-600"><Pencil size={16}/></button>
                        <button
                          onClick={() => onDeleteAssignment(a.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* TAB 2: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              
              {/* Class Lead Time */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{t('reminders.classLeadTimeTitle')}</h4>
                    <p className="text-[11px] text-slate-500">{t('reminders.classLeadTimeSubtitle')}</p>
                  </div>
                </div>
                <ReminderSelect
                  value={String(defaultLeadTime)}
                  onChange={value => setDefaultLeadTime(Number(value))}
                  ariaLabel={t('reminders.classLeadTimeTitle')}
                  options={[
                    { value: '5', label: t('reminders.leadOptions.m5') },
                    { value: '10', label: t('reminders.leadOptions.m10') },
                    { value: '15', label: t('reminders.leadOptions.m15') },
                    { value: '30', label: t('reminders.leadOptions.m30') },
                    { value: '60', label: t('reminders.leadOptions.h1') },
                  ]}
                />
              </div>

              {/* Browser Desktop Notifications */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Bell className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{t('reminders.desktopNotificationTitle')}</h4>
                      <p className="text-[11px] text-slate-500">{t('reminders.desktopNotificationSubtitle')}</p>
                    </div>
                  </div>
                  <button
                    onClick={onRequestBrowserNotifications}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      browserNotifications
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {browserNotifications ? t('common.enabled') : t('common.enable')}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: ALERT HISTORY LOG */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t('reminders.alertHistoryTitle')}</h4>
                {notificationsLog.length > 0 && (
                  <button
                    onClick={onClearNotificationLog}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
                  >
                    {t('reminders.clearHistory')}
                  </button>
                )}
              </div>

              {notificationsLog.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  {t('reminders.noAlertsLogged')}
                </div>
              ) : (
                <div className="space-y-2">
                  {notificationsLog.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs flex items-start gap-2.5"
                    >
                      <Bell className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{log.title}</div>
                        <div className="text-slate-600 text-[11px] mt-0.5">{log.message}</div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

    </section>
  );
};
