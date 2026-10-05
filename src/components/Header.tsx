import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  List,
  Menu,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import { Course, ScheduleConflict } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { CampusLinks } from './CampusLinks';
import { TermSelector } from './TermSelector';

interface HeaderProps {
  courses: Course[];
  conflicts: ScheduleConflict[];
  viewMode: 'grid' | 'agenda';
  setViewMode: (mode: 'grid' | 'agenda') => void;
  activeTerm: string;
  setActiveTerm: (term: string) => void;
  terms: string[];
  onOpenAddCourse: () => void;
  onOpenImport: () => void;
  onOpenConflicts: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  courses,
  conflicts,
  viewMode,
  setViewMode,
  activeTerm,
  setActiveTerm,
  terms,
  onOpenAddCourse,
  onOpenImport,
  onOpenConflicts,
}) => {
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const totalCredits = courses.reduce((sum, course) => sum + (course.credits || 0), 0);

  const runFromMobileMenu = (action: () => void) => {
    action();
    setIsMobileMenuOpen(false);
  };

  return (
    <aside className={`study-sidebar ${isMobileMenuOpen ? 'is-mobile-open' : ''}`} aria-label="课程表导航">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <img className="sidebar-brand-mark" src="/app-icon.svg" alt="" width="42" height="42" />
          <div className="sidebar-brand-copy">
            <h1>{t('header.appTitle')}</h1>
            <span>STUDY DESK</span>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-mobile-toggle"
          aria-label={isMobileMenuOpen ? '收起导航' : '展开导航'}
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen(open => !open)}
        >
          {isMobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>

      <div className="sidebar-content">
        <label className="sidebar-term-label" htmlFor="active-term-select">当前学期</label>
        <div className="sidebar-term-control">
          <TermSelector terms={terms} activeTerm={activeTerm} onSelect={setActiveTerm} />
          <span><BookOpen size={13} />{courses.length} 门 · {totalCredits} 学分</span>
        </div>

        <nav className="sidebar-navigation" aria-label="学习空间">
          <p className="sidebar-section-label">学习空间</p>
          <button
            type="button"
            className={`sidebar-nav-item ${viewMode === 'grid' ? 'is-active' : ''}`}
            aria-pressed={viewMode === 'grid'}
            onClick={() => runFromMobileMenu(() => setViewMode('grid'))}
          >
            <CalendarDays size={17} />
            <span>周课表</span>
            <span className="sidebar-nav-meta">W</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-item ${viewMode === 'agenda' ? 'is-active' : ''}`}
            aria-pressed={viewMode === 'agenda'}
            onClick={() => runFromMobileMenu(() => setViewMode('agenda'))}
          >
            <List size={17} />
            <span>每日安排</span>
          </button>
        </nav>

        <div className="sidebar-actions">
          <button type="button" className="sidebar-primary-action" onClick={() => runFromMobileMenu(onOpenAddCourse)}>
            <Plus size={16} />
            <span>{t('header.addCourse')}</span>
          </button>
          <button type="button" className="sidebar-secondary-action" onClick={() => runFromMobileMenu(onOpenImport)}>
            <Upload size={15} />
            <span>导入课表</span>
          </button>
        </div>

        <CampusLinks />

        <div className="sidebar-bottom">
          <button
            type="button"
            onClick={() => runFromMobileMenu(onOpenConflicts)}
            className={`sidebar-conflict ${conflicts.length > 0 ? 'has-conflicts' : ''}`}
          >
            <AlertTriangle size={15} />
            <span>{conflicts.length > 0 ? `${conflicts.length} 项课程冲突` : '课程冲突检查'}</span>
            <span className="sidebar-conflict-status">{conflicts.length > 0 ? '查看' : '正常'}</span>
          </button>
          <div className="sidebar-language">
            <span>{t('common.language')}</span>
            <LanguageSelector />
          </div>
        </div>
      </div>
    </aside>
  );
};
