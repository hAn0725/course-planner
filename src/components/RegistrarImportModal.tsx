import React, { useState } from 'react';
import { 
  Upload, 
  Sparkles, 
  FileText, 
  Building2, 
  Globe, 
  Check, 
  AlertCircle, 
  X, 
  RefreshCw
} from 'lucide-react';
import { Course, DayOfWeek, RegistrarPreset } from '../types';
import { 
  parseRegistrarRawText, 
  parseIcsCalendar, 
  getRandomCourseColor 
} from '../utils/registrarParsers';
import { 
  SAMPLE_REGISTRAR_PRESETS, 
  SAMPLE_REGISTRAR_RAW_PASTES 
} from '../data/sampleRegistrars';
import { formatTimeDisplay } from '../utils/dateUtils';
import { useTranslation } from '../i18n/LanguageContext';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';

interface RegistrarImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCourses: (courses: Course[], overwrite: boolean) => void;
  currentTerm: string;
}

export const RegistrarImportModal: React.FC<RegistrarImportModalProps> = ({
  isOpen,
  onClose,
  onImportCourses,
  currentTerm,
}) => {
  const { t } = useTranslation();
  const dialogRef = useDialogAccessibility<HTMLDivElement>(isOpen, onClose);
  const [activeTab, setActiveTab] = useState<'paste' | 'universities' | 'file' | 'portal'>('paste');
  const [rawText, setRawText] = useState('');
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [stagedCourses, setStagedCourses] = useState<Course[]>([]);
  const [overwriteExisting, setOverwriteExisting] = useState(true);

  // Portal sync mock state
  const [portalUniversity, setPortalUniversity] = useState('Ellucian Banner SIS');
  const [portalSyncStatus, setPortalSyncStatus] = useState<'idle' | 'syncing' | 'success'>('idle');

  if (!isOpen) return null;

  const handleParseText = async (customText?: string) => {
    const textToParse = customText !== undefined ? customText : rawText;
    if (!textToParse.trim()) {
      setParsingError(t('import.pasteFirst'));
      return;
    }

    setParsingError(null);

    // Local heuristic parser (no server / no AI needed)
    const localParsed = parseRegistrarRawText(textToParse, currentTerm);
    if (localParsed.length > 0) {
      setStagedCourses(localParsed);
    } else {
      setParsingError(t('import.cannotParse'));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      if (file.name.endsWith('.ics')) {
        const parsed = parseIcsCalendar(content, currentTerm);
        setStagedCourses(parsed);
      } else if (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt')) {
        const parsed = parseRegistrarRawText(content, currentTerm);
        setStagedCourses(parsed);
      } else if (file.name.endsWith('.json')) {
        try {
          const json = JSON.parse(content);
          if (Array.isArray(json)) {
            setStagedCourses(json);
          }
        } catch {
          setParsingError('Invalid JSON format.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSelectPreset = (preset: RegistrarPreset) => {
    const mapped: Course[] = preset.courses.map((c, i) => ({
      ...c,
      id: 'course_' + Math.random().toString(36).substring(2, 9),
      color: getRandomCourseColor(i),
      term: currentTerm,
      meetings: c.meetings.map(m => ({
        ...m,
        id: Math.random().toString(36).substring(2, 9),
      })),
    }));
    setStagedCourses(mapped);
  };

  const handleMockPortalSync = () => {
    setPortalSyncStatus('syncing');
    setTimeout(() => {
      const sample = SAMPLE_REGISTRAR_PRESETS[0];
      if (sample) handleSelectPreset(sample);
      setPortalSyncStatus('success');
    }, 1000);
  };

  const handleConfirmImport = () => {
    if (stagedCourses.length === 0) return;
    onImportCourses(stagedCourses, overwriteExisting);
    onClose();
  };

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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('import.title')} tabIndex={-1} className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {t('import.title')}
              </h2>
              <p className="text-xs text-slate-500">
                {t('import.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6 gap-6 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('paste')}
            className={`py-3.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'paste'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('import.tabPaste')}</span>
          </button>
          <button
            onClick={() => setActiveTab('universities')}
            className={`py-3.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'universities'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>{t('import.tabUniversities')}</span>
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`py-3.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'file'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{t('import.tabFile')}</span>
          </button>
          <button
            onClick={() => setActiveTab('portal')}
            className={`py-3.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'portal'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>{t('import.tabPortal')}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: Smart Copy-Paste */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>{t('import.pasteLabel')}</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">{t('import.trySample')}</span>
                  {SAMPLE_REGISTRAR_RAW_PASTES.map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setRawText(sample.text);
                        handleParseText(sample.text);
                      }}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border border-slate-200 cursor-pointer"
                      title={sample.title}
                    >
                      {sample.system}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste course schedule text here. Example:&#10;Course A (Code: DEMO-101)&#10;Monday 10:00 AM - 11:00 AM in Building 1, Room 101&#10;Instructor: Example Instructor&#10;Credits: 3"
                rows={6}
                className="w-full text-xs font-mono p-3.5 rounded-2xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              />

              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  {t('import.pasteDescription')}
                </p>
                <button
                  onClick={() => handleParseText()}
                  disabled={!rawText.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('import.parseBtn')}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: University Presets */}
          {activeTab === 'universities' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                {t('import.presetsDescription')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {SAMPLE_REGISTRAR_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/30 transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                          {preset.university}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 mt-1.5 group-hover:text-indigo-600 transition-colors">
                          {preset.department}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {preset.description}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-indigo-600 shrink-0 ml-2">
                        {preset.courses.length} {t('common.courses')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: File Upload */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center hover:border-indigo-400 transition-colors bg-slate-50/50">
                <input
                  type="file"
                  id="registrar-file-input"
                  accept=".ics,.csv,.tsv,.txt,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="registrar-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">
                    {t('import.uploadTitle')}
                  </span>
                  <span className="text-xs text-slate-400">
                    {t('import.uploadSubtitle')}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 4: Portal import guidance */}
          {activeTab === 'portal' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">从教务平台导入</h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        此页面不会连接或上传教务账号。请复制课表文本，或使用“粘贴”和“文件导入”。
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleMockPortalSync}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-2xs shrink-0 cursor-pointer"
                  >
                    载入演示课表
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900">{t('import.portalTitle')}</h3>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">{t('import.portalProviderLabel')}</label>
                  <select
                    value={portalUniversity}
                    onChange={(e) => setPortalUniversity(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="generic">通用教务平台</option>
                    <option value="banner">Ellucian Banner SIS</option>
                    <option value="workday">Workday Student Portal</option>
                    <option value="peoplesoft">Oracle PeopleSoft Campus Solutions</option>
                    <option value="canvas">Canvas LMS</option>
                  </select>
                </div>
                <button
                  onClick={handleMockPortalSync}
                  disabled={portalSyncStatus === 'syncing'}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  {portalSyncStatus === 'syncing' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t('import.syncingBtn')}</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>{t('import.syncBtn')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Parsing Error Display */}
          {parsingError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{parsingError}</span>
            </div>
          )}

          {/* STAGED COURSES PREVIEW TABLE */}
          {stagedCourses.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {t('import.previewTitle', { count: stagedCourses.length })}
                  </h3>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={overwriteExisting}
                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{t('import.replaceExisting')}</span>
                </label>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-3">{t('common.course')}</th>
                      <th className="p-3">{t('common.title')}</th>
                      <th className="p-3">{t('common.instructor')}</th>
                      <th className="p-3">{t('common.daysAndTimes')}</th>
                      <th className="p-3">{t('common.location')}</th>
                      <th className="p-3">{t('common.units')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stagedCourses.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-bold text-slate-900 whitespace-nowrap flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                          {c.code}
                        </td>
                        <td className="p-3 text-slate-700 font-medium">{c.name}</td>
                        <td className="p-3 text-slate-500">{c.instructor || 'TBD'}</td>
                        <td className="p-3 text-slate-700 font-medium">
                          {c.meetings.map((m, idx) => (
                            <div key={idx} className="whitespace-nowrap">
                              <span className="font-bold text-indigo-700 mr-1">{getDayShortLabel(m.day)}</span>
                              {formatTimeDisplay(m.startTime, '12h')} – {formatTimeDisplay(m.endTime, '12h')} ({m.type})
                            </div>
                          ))}
                        </td>
                        <td className="p-3 text-slate-500">
                          {c.meetings.map(m => m.location).filter(Boolean).join(', ') || 'Campus'}
                        </td>
                        <td className="p-3 font-semibold text-slate-800">{c.credits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            {t('common.cancel')}
          </button>
          
          <button
            onClick={handleConfirmImport}
            disabled={stagedCourses.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-xs cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{t('import.confirmImport', { count: stagedCourses.length })}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
