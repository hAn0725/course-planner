import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { getMeetingsForDate } from '../data/academicCalendar';
import { AssignmentReminder, Course, NotificationLog } from '../types';
import { timeStringToMinutes } from '../utils/dateUtils';
import { getAssignmentDueAt, shouldTriggerAssignmentReminder } from '../utils/reminderUtils';

interface ReminderEngineOptions {
  courses: Course[];
  assignments: AssignmentReminder[];
  browserNotifications: boolean;
  setAssignments: Dispatch<SetStateAction<AssignmentReminder[]>>;
  setNotificationsLog: Dispatch<SetStateAction<NotificationLog[]>>;
  classReminderLabel: string;
  assignmentReminderLabel: string;
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

function showDesktopNotification(enabled: boolean, title: string, body: string) {
  if (enabled && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

export function useReminderEngine({
  courses,
  assignments,
  browserNotifications,
  setAssignments,
  setNotificationsLog,
  classReminderLabel,
  assignmentReminderLabel,
}: ReminderEngineOptions): Date {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const triggeredAlarmsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      setCurrentTime(now);
      const newLogs: NotificationLog[] = [];

      const nowMin = now.getHours() * 60 + now.getMinutes();
      for (const { course, session } of getMeetingsForDate(courses, now).meetings) {
        if (!course.reminderEnabled) continue;
        const lead = course.reminderLeadTimeMinutes || 15;
        const startMin = timeStringToMinutes(session.startTime);
        const diff = startMin - nowMin;
        const alarmKey = `class_${course.id}_${session.id}_${now.toDateString()}_${startMin}`;
        if (diff < 0 || diff > lead || triggeredAlarmsRef.current.has(alarmKey)) continue;

        triggeredAlarmsRef.current.add(alarmKey);
        const title = `${classReminderLabel}: ${course.name}`;
        const body = `${session.startTime} · ${session.location}`;
        newLogs.push({
          id: createId('notification'),
          title,
          message: body,
          timestamp: now.getTime(),
          type: 'class_reminder',
          read: false,
        });
        showDesktopNotification(browserNotifications, title, body);
      }

      const notifiedAssignmentIds: string[] = [];
      for (const assignment of assignments) {
        if (!shouldTriggerAssignmentReminder(assignment, now)) continue;
        const dueAt = getAssignmentDueAt(assignment)!;
        const alarmKey = `assignment_${assignment.id}_${dueAt.getTime()}`;
        if (triggeredAlarmsRef.current.has(alarmKey)) continue;

        triggeredAlarmsRef.current.add(alarmKey);
        notifiedAssignmentIds.push(assignment.id);
        const title = `${assignmentReminderLabel}: ${assignment.title}`;
        const courseName = courses.find(course => course.id === assignment.courseId)?.name;
        const body = `${courseName ? `${courseName} · ` : ''}${assignment.dueDate} ${assignment.dueTime}`;
        newLogs.push({
          id: createId('notification'),
          title,
          message: body,
          timestamp: now.getTime(),
          type: 'assignment_reminder',
          read: false,
        });
        showDesktopNotification(browserNotifications, title, body);
      }

      if (notifiedAssignmentIds.length > 0) {
        const notified = new Set(notifiedAssignmentIds);
        setAssignments(previous => previous.map(assignment =>
          notified.has(assignment.id) ? { ...assignment, notificationSent: true } : assignment
        ));
      }
      if (newLogs.length > 0) {
        setNotificationsLog(previous => [...newLogs, ...previous].slice(0, 50));
      }
    };

    checkReminders();
    const timer = window.setInterval(checkReminders, 10_000);
    return () => window.clearInterval(timer);
  }, [
    assignmentReminderLabel,
    assignments,
    browserNotifications,
    classReminderLabel,
    courses,
    setAssignments,
    setNotificationsLog,
  ]);

  return currentTime;
}
