/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { 
  Course, 
  AssignmentReminder, 
  NotificationLog, 
  ScheduleConflict, 
  DayOfWeek,
  AppSettings
} from './types';
import { findScheduleConflicts, getNextClassInfo, timeStringToMinutes } from './utils/dateUtils';
import { useTranslation } from './i18n/LanguageContext';
import { DEFAULT_ACADEMIC_CALENDAR, getWeekInfoForDate, getMeetingsForWeekAndDay } from './data/academicCalendar';

// Components
import { Header } from './components/Header';
import { NextClassBanner } from './components/NextClassBanner';
import { AcademicWeekSelector } from './components/AcademicWeekSelector';
import { WeekGrid } from './components/WeekGrid';
import { DayAgendaView } from './components/DayAgendaView';
import { toggleReminder } from './utils/reminderUtils';
import { useReminderEngine } from './hooks/useReminderEngine';

import { 
  BookOpen, 
  Clock, 
  GraduationCap, 
  Bell, 
  Sparkles,
  Upload,
  Plus,
  CalendarDays,
} from 'lucide-react';

const RegistrarImportModal = lazy(() => import('./components/RegistrarImportModal').then(module => ({ default: module.RegistrarImportModal })));
const RemindersPanel = lazy(() => import('./components/RemindersDrawer').then(module => ({ default: module.RemindersPanel })));
const CourseDetailModal = lazy(() => import('./components/CourseDetailModal').then(module => ({ default: module.CourseDetailModal })));
const CourseFormModal = lazy(() => import('./components/CourseFormModal').then(module => ({ default: module.CourseFormModal })));
const ConflictAlertModal = lazy(() => import('./components/ConflictAlertModal').then(module => ({ default: module.ConflictAlertModal })));

const STORAGE_KEYS = {
  COURSES: 'univ_course_schedule_courses_whut_v5',
  ASSIGNMENTS: 'univ_course_schedule_assignments_whut_v5',
  SETTINGS: 'univ_course_schedule_settings_whut_v5',
  NOTIFICATIONS: 'univ_course_schedule_notifications_whut_v5',
  TERMS: 'univ_course_schedule_terms_whut_v5',
};

const currentYear = new Date().getFullYear();
const DEFAULT_TERMS = [`${currentYear}-${currentYear + 1}-1 (${currentYear}秋季学期)`, `${currentYear}-${currentYear + 1}-2 (${currentYear + 1}春季学期)`, `Fall ${currentYear}`, `Spring ${currentYear + 1}`];

export default function App() {
  const { t } = useTranslation();

  // 1. Core State
  const [terms] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TERMS);
      return saved ? JSON.parse(saved) : DEFAULT_TERMS;
    } catch {
      return DEFAULT_TERMS;
    }
  });

  const [activeTerm, setActiveTerm] = useState<string>(() => {
    return terms[0] || DEFAULT_TERMS[0];
  });

  const [courses, setCourses] = useState<Course[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COURSES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch {
      return [];
    }
  });

  const [assignments, setAssignments] = useState<AssignmentReminder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch {
      return [];
    }
  });

  const [notificationsLog, setNotificationsLog] = useState<NotificationLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const defaults: AppSettings = {
      timeFormat: '24h',
      startHour: 8,
      endHour: 22,
      showWeekends: true,
      browserNotifications: false,
      activeTerm: DEFAULT_TERMS[0],
      themeAccent: '#2563EB',
      defaultClassReminderLeadTime: 15,
    };
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {}
    return defaults;
  });

  // Week selection: 默认定位到今天所在的校历周（预备周/教学周/寒假）
  const [selectedWeek, setSelectedWeek] = useState<number>(() => {
    return getWeekInfoForDate(new Date())?.weekNumber ?? 1;
  });
  const [viewMode, setViewMode] = useState<'grid' | 'agenda'>('grid');
  const [applyHolidayAdjustments, setApplyHolidayAdjustments] = useState<boolean>(true);

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isConflictsModalOpen, setIsConflictsModalOpen] = useState(false);
  const [isCourseFormOpen, setIsCourseFormOpen] = useState(false);
  const [isCourseDetailOpen, setIsCourseDetailOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  
  // Quick Add at Time slot
  const [addSlotDefaults, setAddSlotDefaults] = useState<{ day?: DayOfWeek; startTime?: string }>({});

  // 2. Persistence sync
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
    } catch (e) {
      console.warn('LocalStorage save courses error:', e);
    }
  }, [courses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
    } catch (e) {
      console.warn('LocalStorage save assignments error:', e);
    }
  }, [assignments]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notificationsLog));
    } catch (e) {
      console.warn('LocalStorage save notifications error:', e);
    }
  }, [notificationsLog]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('LocalStorage save settings error:', e);
    }
  }, [settings]);

  // 3. Clock, class reminders and assignment deadline reminders
  const currentTime = useReminderEngine({
    courses,
    assignments,
    browserNotifications: settings.browserNotifications,
    setAssignments,
    setNotificationsLog,
    classReminderLabel: t('courseDetail.remindersTitle'),
    assignmentReminderLabel: t('reminders.tabAssignments'),
  });

  // 3.5 心跳保活：让服务端知道网页还开着；关闭网页后服务端自动停止（见 server.ts 看门狗）
  useEffect(() => {
    let stopped = false;
    const beat = () => {
      if (!stopped) fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, 4000);
    const onVisible = () => {
      // 从后台切回时立即补一次心跳（后台标签页浏览器会放慢定时器）
      if (document.visibilityState === 'visible') beat();
    };
    const bye = () => {
      try { navigator.sendBeacon('/api/bye'); } catch { /* ignore */ }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', bye);
    window.addEventListener('beforeunload', bye);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', bye);
      window.removeEventListener('beforeunload', bye);
    };
  }, []);

  // 4. Filter courses by active term
  const termCourses = useMemo(() => {
    return courses.filter(c => !c.term || c.term === activeTerm);
  }, [courses, activeTerm]);

  // 5. Calculate conflicts
  const conflicts: ScheduleConflict[] = useMemo(() => {
    return findScheduleConflicts(termCourses);
  }, [termCourses]);

  // 6. Calculate Next Class info
  const nextClassInfo = useMemo(() => {
    return getNextClassInfo(termCourses, currentTime);
  }, [termCourses, currentTime]);

  // Handlers
  const handleImportCourses = (imported: Course[], overwrite: boolean) => {
    if (overwrite) {
      setCourses(imported);
    } else {
      setCourses(prev => [...prev, ...imported]);
    }
  };

  const handleSaveCourse = (course: Course) => {
    setCourses(prev => {
      const idx = prev.findIndex(c => c.id === course.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = course;
        return next;
      }
      return [...prev, course];
    });
  };

  const handleDeleteCourse = (courseId: string) => {
    setCourses(prev => prev.filter(c => c.id !== courseId));
    setAssignments(prev => prev.filter(assignment => assignment.courseId !== courseId));
    if (selectedCourse?.id === courseId) {
      setSelectedCourse(null);
      setIsCourseDetailOpen(false);
    }
  };

  const handleAddAssignment = (assignmentData: Omit<AssignmentReminder, 'id'>) => {
    const newAsg: AssignmentReminder = {
      ...assignmentData,
      id: 'asg_' + Math.random().toString(36).substring(2, 9),
    };
    setAssignments(prev => [newAsg, ...prev]);
  };

  const handleToggleAssignment = (id: string) => {
    setAssignments(prev => prev.map(a => a.id === id ? toggleReminder(a, new Date()) : a));
  };

  const handleDeleteAssignment = (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const handleRequestBrowserNotifications = async () => {
    if (!('Notification' in window)) {
      alert('您的浏览器不支持桌面通知。');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setSettings(prev => ({ ...prev, browserNotifications: true }));
      new Notification('课程与提醒', {
        body: '上课及作业提醒桌面通知已开启！',
      });
    } else {
      setSettings(prev => ({ ...prev, browserNotifications: false }));
    }
  };

  const focusReminders = () => {
    document.getElementById('reminders-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const totalCredits = termCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
  const pendingAssignmentsCount = assignments.filter(a => !a.completed).length;
  const selectedWeekInfo = DEFAULT_ACADEMIC_CALENDAR.find(w => w.weekNumber === selectedWeek);
  const currentCalendarWeek = getWeekInfoForDate(currentTime)?.weekNumber ?? null;
  const todayLabel = new Intl.DateTimeFormat('zh-CN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(currentTime);

  return (
    <div className="app-shell">
      
      {/* 1. Header Navigation & Main Actions */}
      <Header
        courses={termCourses}
        conflicts={conflicts}
        viewMode={viewMode}
        setViewMode={setViewMode}
        activeTerm={activeTerm}
        setActiveTerm={setActiveTerm}
        terms={terms}
        onOpenAddCourse={() => {
          setEditingCourse(null);
          setAddSlotDefaults({});
          setIsCourseFormOpen(true);
        }}
        onOpenImport={() => setIsImportModalOpen(true)}
        onOpenConflicts={() => setIsConflictsModalOpen(true)}
      />

      {/* 2. Main Content Container */}
      <div className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <p className="workspace-breadcrumb">学习空间 <span>/</span> 个人规划</p>
            <h1>课程安排</h1>
          </div>
          <div className="workspace-date-block">
            <span className="workspace-date-label">今天</span>
            <strong>{todayLabel}</strong>
            <span className="workspace-date-divider" />
            <span>{selectedWeekInfo?.label || `第 ${selectedWeek} 周`}</span>
          </div>
        </header>

      <main className="planner-layout">
        <section className="schedule-column" aria-labelledby="schedule-section-title">
        <div className="schedule-section-heading">
          <div>
            <p className="schedule-section-eyebrow">本学期</p>
            <h2 id="schedule-section-title">课程表</h2>
          </div>
          <span>{selectedWeekInfo?.label || `第 ${selectedWeek} 周`} · {selectedWeekInfo?.dateRangeText}</span>
        </div>

        {/* Academic planner overview */}
        <div className="profile-banner rounded-2xl sm:rounded-3xl p-4 sm:p-5 border relative overflow-hidden">
          <div className="profile-banner-layout relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            <div className="profile-banner-info space-y-1.5">
              <div className="profile-banner-tags flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="profile-tag profile-tag-primary px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold">
                  个人学习空间
                </span>
                <span className="profile-tag px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold">
                  2026—2027 学年 · 第 1 学期
                </span>
                <span className="profile-tag px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold">
                  19 个教学周
                </span>
              </div>
              
              <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <span>课程与提醒</span>
                <span className="text-xs sm:text-sm font-normal text-slate-500">按自己的节奏安排学习</span>
              </h2>
              
              <p className="profile-summary text-xs text-slate-500 leading-relaxed max-w-3xl">
                课表已同步更新 · {termCourses.filter(course => course.meetings.length > 0).length} 门有固定时段，{termCourses.filter(course => course.meetings.length === 0).length} 门时间待定
              </p>
            </div>

            {/* Unscheduled Course Notice */}
            <div className="profile-note p-3 rounded-2xl border text-xs shrink-0 md:max-w-xs">
              <div className="font-bold text-blue-700 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>集中实践 / 时间待定课程</span>
              </div>
              <div className="font-medium text-sm">导入或添加你的课程</div>
              <div className="text-[11px] text-slate-500 mt-0.5">课程与提醒数据只保存在当前浏览器</div>
            </div>
          </div>
        </div>

        {/* Academic Week Switching Bar (第1周、第2周、第3周...调休放假标注) */}
        <AcademicWeekSelector
          selectedWeek={selectedWeek}
          onSelectWeek={setSelectedWeek}
          courses={termCourses}
          currentWeek={currentCalendarWeek}
        />

        {/* Next Class Live Countdown Banner */}
        <NextClassBanner
          classInfo={nextClassInfo}
          timeFormat={settings.timeFormat}
          onSelectCourse={(course) => {
            setSelectedCourse(course);
            setIsCourseDetailOpen(true);
          }}
        />

        {/* Empty State / Schedule Grid / Agenda View */}
        {termCourses.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 sm:p-16 text-center shadow-xs">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-2xs">
              <GraduationCap className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{t('emptyState.noCoursesTitle', { term: activeTerm })}</h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
              {t('emptyState.noCoursesSubtitle')}
            </p>
            <div className="flex items-center justify-center flex-wrap gap-2.5 sm:gap-3">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <Sparkles className="w-3 h-3" />
                <span>{t('emptyState.importButton')}</span>
              </button>
              <button
                onClick={() => {
                  setEditingCourse(null);
                  setAddSlotDefaults({});
                  setIsCourseFormOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('emptyState.addManuallyButton')}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <WeekGrid
                courses={termCourses}
                conflicts={conflicts}
                showWeekends={settings.showWeekends}
                timeFormat={settings.timeFormat}
                selectedWeek={selectedWeek}
                applyHolidayAdjustments={applyHolidayAdjustments}
                onSelectCourse={(course) => {
                  setSelectedCourse(course);
                  setIsCourseDetailOpen(true);
                }}
                onAddCourseAtTime={(day, startTime) => {
                  setEditingCourse(null);
                  setAddSlotDefaults({ day, startTime });
                  setIsCourseFormOpen(true);
                }}
              />
            ) : (
              <DayAgendaView
                courses={termCourses}
                assignments={assignments}
                timeFormat={settings.timeFormat}
                showWeekends={settings.showWeekends}
                selectedWeek={selectedWeek}
                applyHolidayAdjustments={applyHolidayAdjustments}
                onSelectCourse={(course) => {
                  setSelectedCourse(course);
                  setIsCourseDetailOpen(true);
                }}
                onToggleAssignment={handleToggleAssignment}
              />
            )}
          </>
        )}

        {/* Academic Summary & Workload Metrics Bar */}
        {termCourses.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 pt-2">
            
            {/* Metric 1: Total Enrolled Units */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('metrics.enrolledUnits')}</span>
                <BookOpen className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {totalCredits} <span className="text-xs font-semibold text-slate-400">学分</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                修读 {termCourses.length} 门课程
              </p>
            </div>

            {/* Metric 2: Weekly In-Class Hours */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('metrics.weeklyHours')}</span>
                <Clock className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {((['M','T','W','R','F','S','U'] as DayOfWeek[]).flatMap(day => getMeetingsForWeekAndDay(termCourses, selectedWeek, day, applyHolidayAdjustments).meetings)
                  .reduce((sum, { session }) => sum + timeStringToMinutes(session.endTime) - timeStringToMinutes(session.startTime), 0) / 60).toFixed(1)} <span className="text-xs font-semibold text-slate-400">小时/周</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                理论/实验/体育
              </p>
            </div>

            {/* Metric 3: Academic Week Progress */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">周次</span>
                <CalendarDays className="w-4 h-4 text-violet-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {selectedWeekInfo?.label || `第 ${selectedWeek} 周`}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                {selectedWeekInfo
                  ? selectedWeekInfo.weekNumber >= 1 && selectedWeekInfo.weekNumber <= 19
                    ? `教学周 ${selectedWeekInfo.weekNumber}/19 · ${selectedWeekInfo.dateRangeText}`
                    : `${selectedWeekInfo.dateRangeText}`
                  : `教学周 ${selectedWeek}/19`}
              </p>
            </div>

            {/* Metric 4: Deadlines & Milestones */}
            <button
              type="button"
              onClick={focusReminders}
              className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:border-blue-300 transition-colors cursor-pointer group text-left"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('metrics.activeDeadlines')}</span>
                <Bell className="w-4 h-4 text-amber-500 group-hover:text-blue-600 transition-colors" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 flex items-center justify-between">
                <span>{pendingAssignmentsCount} <span className="text-xs font-semibold text-slate-400">项待办</span></span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-blue-600 font-semibold mt-0.5 truncate group-hover:underline">
                {t('metrics.viewDeadlineSchedule')}
              </p>
            </button>

          </div>
        )}
        </section>

        <aside className="reminders-column" aria-label="提醒事项">
          <Suspense fallback={<div className="reminders-loading">正在载入提醒事项…</div>}>
            <RemindersPanel
              courses={termCourses}
              assignments={assignments}
              onAddAssignment={handleAddAssignment}
              onUpdateAssignment={updated => setAssignments(prev => prev.map(a => a.id === updated.id ? updated : a))}
              onToggleAssignment={handleToggleAssignment}
              onDeleteAssignment={handleDeleteAssignment}
              browserNotifications={settings.browserNotifications}
              onRequestBrowserNotifications={handleRequestBrowserNotifications}
              notificationsLog={notificationsLog}
              onClearNotificationLog={() => setNotificationsLog([])}
              defaultLeadTime={settings.defaultClassReminderLeadTime}
              setDefaultLeadTime={minutes => {
                setSettings(previous => ({ ...previous, defaultClassReminderLeadTime: minutes }));
                setCourses(previous => previous.map(course => ({ ...course, reminderLeadTimeMinutes: minutes })));
              }}
            />
          </Suspense>
        </aside>
      </main>

      {/* 3. Modals */}
      <Suspense fallback={null}>

      {/* Registrar Import Modal */}
      <RegistrarImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportCourses={handleImportCourses}
        currentTerm={activeTerm}
      />

      {/* Course Detail Modal */}
      <CourseDetailModal
        course={selectedCourse}
        isOpen={isCourseDetailOpen}
        onClose={() => {
          setIsCourseDetailOpen(false);
          setSelectedCourse(null);
        }}
        onEditCourse={(course) => {
          setEditingCourse(course);
          setIsCourseFormOpen(true);
        }}
        onDeleteCourse={handleDeleteCourse}
        onAddAssignmentForCourse={() => {
          setIsCourseDetailOpen(false);
          window.setTimeout(focusReminders, 80);
        }}
        timeFormat={settings.timeFormat}
      />

      {/* Course Add/Edit Modal */}
      <CourseFormModal
        isOpen={isCourseFormOpen}
        onClose={() => {
          setIsCourseFormOpen(false);
          setEditingCourse(null);
          setAddSlotDefaults({});
        }}
        onSaveCourse={handleSaveCourse}
        initialCourse={editingCourse}
        defaultDay={addSlotDefaults.day}
        defaultStartTime={addSlotDefaults.startTime}
        activeTerm={activeTerm}
      />

      {/* Schedule Conflict Alert Modal */}
      <ConflictAlertModal
        isOpen={isConflictsModalOpen}
        onClose={() => setIsConflictsModalOpen(false)}
        conflicts={conflicts}
        onSelectCourse={(course) => {
          setSelectedCourse(course);
          setIsCourseDetailOpen(true);
        }}
        timeFormat={settings.timeFormat}
      />
      </Suspense>

      {/* Desktop Footer */}
      <footer className="app-footer py-4 mt-auto hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-slate-700">课程表与学习计划</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={focusReminders}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              闹钟与提醒设置
            </button>
          </div>
        </div>
      </footer>
      </div>

    </div>
  );
}
