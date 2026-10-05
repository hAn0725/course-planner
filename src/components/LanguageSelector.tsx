import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown, Search } from 'lucide-react';
import { useTranslation, SUPPORTED_LANGUAGES } from '../i18n/LanguageContext';
import { LanguageCode } from '../i18n/types';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, currentLanguageInfo, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredLanguages = SUPPORTED_LANGUAGES.filter(
    (lang) =>
      lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs hover:border-slate-300 transition-all cursor-pointer select-none"
        title={t('common.selectLanguage')}
        aria-label={t('common.selectLanguage')}
      >
        <span className="text-sm leading-none">{currentLanguageInfo.flag}</span>
        <span className="hidden sm:inline font-medium text-slate-800">{currentLanguageInfo.name}</span>
        <span className="sm:hidden font-mono uppercase text-[11px] font-bold text-slate-700">
          {currentLanguageInfo.code.split('-')[0]}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header & Search */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common.selectLanguage')}
                className="w-full text-xs bg-transparent border-none focus:outline-hidden text-slate-800 placeholder-slate-400"
                autoFocus
              />
            </div>
          </div>

          {/* Language List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {filteredLanguages.map((lang) => {
              const isSelected = lang.code === language;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-blue-50/80 text-blue-700 font-bold'
                      : 'hover:bg-slate-100 text-slate-700 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base leading-none shrink-0">{lang.flag}</span>
                    <div>
                      <div className="leading-tight">{lang.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal leading-tight">
                        {lang.englishName}
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                </button>
              );
            })}

            {filteredLanguages.length === 0 && (
              <div className="py-4 text-center text-xs text-slate-400">
                No languages found
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
};
