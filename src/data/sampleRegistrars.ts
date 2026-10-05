import { RegistrarPreset } from '../types';

// Fictional example data for the import preview. Real schedules are entered or imported locally.
export const SAMPLE_REGISTRAR_PRESETS: RegistrarPreset[] = [
  {
    id: 'generic_example',
    university: '通用示例',
    department: '演示课表',
    term: '示例学期',
    description: '虚构的示例课程，仅用于预览导入效果。',
    courses: [
      {
        code: 'DEMO-101',
        name: '示例课程',
        section: '01班',
        credits: 3,
        color: '#2563EB',
        term: '示例学期',
        weeks: '1-16周',
        instructor: '示例教师',
        meetings: [
          {
            id: 'demo_meeting_1',
            day: 'M',
            startTime: '09:55',
            endTime: '11:30',
            location: '教学楼 101',
            type: 'lecture',
          },
        ],
        syllabusNotes: '虚构的演示安排。',
        reminderEnabled: true,
        reminderLeadTimeMinutes: 15,
      },
    ],
  },
];

export const SAMPLE_REGISTRAR_RAW_PASTES = [
  {
    title: '通用示例课表',
    system: '示例数据',
    text: `课程: 示例课程 [3学分]
课程代码: DEMO-101 | 教学班: 01班
上课时间: 星期一 09:55-11:30
上课地点: 教学楼 101
周次: 1-16周`,
  },
];

export function migrateVerifiedCourses<T>(saved: T[]): T[] {
  return saved;
}

export const INITIAL_SAMPLE_ASSIGNMENTS = [];
