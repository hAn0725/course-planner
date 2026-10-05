export type DayOfWeek = 'M' | 'T' | 'W' | 'R' | 'F' | 'S' | 'U';

export type CourseType = 'lecture' | 'lab' | 'discussion' | 'seminar' | 'studio' | 'office_hours' | 'other';

export interface MeetingSession {
  weeks?: string;
  id: string;
  day: DayOfWeek;
  startTime: string; // "HH:MM" in 24h e.g. "09:30"
  endTime: string;   // "HH:MM" in 24h e.g. "10:45"
  location: string;  // e.g. "Wheeler Hall 102"
  buildingCode?: string;
  type: CourseType;
}

export interface Course {
  scheduleVerified?: boolean;
  scheduleRevision?: number;
  id: string;
  code: string;           // e.g. "" or "CS 189"
  name: string;           // e.g. "Course A"
  section?: string;        // e.g. "01班"
  crn?: string;            // Course Reference Number
  instructor?: string;    // e.g. "Prof. Jennifer Listgarten"
  credits: number;        // e.g. 4
  color: string;          // hex code e.g. "#3B82F6"
  term: string;           // e.g. "2026-2027-1"
  weeks?: string;         // e.g. "1-16周", "10-17周", "7-14周"
  meetings: MeetingSession[];
  syllabusNotes?: string;
  examInfo?: string;
  virtualLink?: string;
  officeHours?: string;
  reminderEnabled: boolean;
  reminderLeadTimeMinutes: number; // e.g. 10, 15, 30, 60
}

export type AssignmentType = 'assignment' | 'midterm' | 'final' | 'quiz' | 'project' | 'reading' | 'other';
export type PriorityLevel = 'urgent' | 'medium' | 'low';

export interface AssignmentReminder {
  id: string;
  /** Optional: personal events and other tasks do not need to be tied to a course. */
  courseId?: string;
  title: string;
  type: AssignmentType;
  dueDate: string; // "YYYY-MM-DD"
  dueTime: string; // "HH:MM"
  completed: boolean;
  priority: PriorityLevel;
  reminderMinutesBefore: number; // e.g. 60, 1440 (1 day), 2880 (2 days)
  notes?: string;
  notificationSent?: boolean;
  repeat?: 'none' | 'daily' | 'weekdays' | 'weekly';
  completedDates?: string[];
}

export interface NotificationLog {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  type: 'class_reminder' | 'assignment_reminder' | 'conflict_alert' | 'system';
  read: boolean;
}

export interface ScheduleConflict {
  course1: Course;
  session1: MeetingSession;
  course2: Course;
  session2: MeetingSession;
  day: DayOfWeek;
  overlapDurationMinutes: number;
}

export interface AppSettings {
  timeFormat: '12h' | '24h';
  startHour: number; // 7, 8, etc.
  endHour: number;   // 20, 21, 22
  showWeekends: boolean;
  browserNotifications: boolean;
  activeTerm: string;
  themeAccent: string;
  defaultClassReminderLeadTime: number;
}

export interface RegistrarPreset {
  id: string;
  university: string;
  department: string;
  term: string;
  description: string;
  courses: Omit<Course, 'id'>[];
}
