import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { LanguageCode, LanguageInfo, Translations } from './types';
import { en } from './translations/en';
import { zhCN } from './translations/zhCN';
import { zhTW } from './translations/zhTW';
import { es } from './translations/es';
import { fr } from './translations/fr';
import { de } from './translations/de';
import { ja } from './translations/ja';
import { ko } from './translations/ko';
import { pt } from './translations/pt';
import { it } from './translations/it';
import { ar } from './translations/ar';
import { hi } from './translations/hi';
import { ru } from './translations/ru';

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', englishName: 'English', flag: '🇺🇸', dir: 'ltr' },
  { code: 'zh-CN', name: '简体中文', englishName: 'Chinese (Simplified)', flag: '🇨🇳', dir: 'ltr' },
  { code: 'zh-TW', name: '繁體中文', englishName: 'Chinese (Traditional)', flag: '🇹🇼', dir: 'ltr' },
  { code: 'es', name: 'Español', englishName: 'Spanish', flag: '🇪🇸', dir: 'ltr' },
  { code: 'fr', name: 'Français', englishName: 'French', flag: '🇫🇷', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', englishName: 'German', flag: '🇩🇪', dir: 'ltr' },
  { code: 'ja', name: '日本語', englishName: 'Japanese', flag: '🇯🇵', dir: 'ltr' },
  { code: 'ko', name: '한국어', englishName: 'Korean', flag: '🇰🇷', dir: 'ltr' },
  { code: 'pt', name: 'Português', englishName: 'Portuguese', flag: '🇧🇷', dir: 'ltr' },
  { code: 'it', name: 'Italiano', englishName: 'Italian', flag: '🇮🇹', dir: 'ltr' },
  { code: 'ru', name: 'Русский', englishName: 'Russian', flag: '🇷🇺', dir: 'ltr' },
  { code: 'ar', name: 'العربية', englishName: 'Arabic', flag: '🇸🇦', dir: 'rtl' },
  { code: 'hi', name: 'हिन्दी', englishName: 'Hindi', flag: '🇮🇳', dir: 'ltr' },
];

const TRANSLATIONS_MAP: Record<LanguageCode, Translations> = {
  'en': en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'es': es,
  'fr': fr,
  'de': de,
  'ja': ja,
  'ko': ko,
  'pt': pt,
  'it': it,
  'ru': ru,
  'ar': ar,
  'hi': hi,
};

const STORAGE_KEY = 'univ_course_schedule_lang_v1';

function detectUserLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
      return saved as LanguageCode;
    }

    const browserLang = (navigator.language || (navigator as { userLanguage?: string }).userLanguage || '').toLowerCase();
    
    if (browserLang.startsWith('zh-tw') || browserLang.startsWith('zh-hk') || browserLang.startsWith('zh-hant')) {
      return 'zh-TW';
    }
    if (browserLang.startsWith('zh')) {
      return 'zh-CN';
    }
    if (browserLang.startsWith('es')) return 'es';
    if (browserLang.startsWith('fr')) return 'fr';
    if (browserLang.startsWith('de')) return 'de';
    if (browserLang.startsWith('ja')) return 'ja';
    if (browserLang.startsWith('ko')) return 'ko';
    if (browserLang.startsWith('pt')) return 'pt';
    if (browserLang.startsWith('it')) return 'it';
    if (browserLang.startsWith('ru')) return 'ru';
    if (browserLang.startsWith('ar')) return 'ar';
    if (browserLang.startsWith('hi')) return 'hi';
  } catch (e) {
    console.warn('Could not read user language:', e);
  }
  return 'en';
}

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  currentLanguageInfo: LanguageInfo;
  languages: LanguageInfo[];
  dir: 'ltr' | 'rtl';
  t: (keyPath: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(detectUserLanguage);

  const setLanguage = (newLang: LanguageCode) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch (e) {
      console.warn('Could not save language choice:', e);
    }
  };

  const currentLanguageInfo = useMemo(() => {
    return SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];
  }, [language]);

  // Keep HTML document lang & dir in sync
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = currentLanguageInfo.dir;
  }, [language, currentLanguageInfo]);

  const currentTranslations = useMemo(() => {
    return TRANSLATIONS_MAP[language] || en;
  }, [language]);

  const t = useMemo(() => {
    return (keyPath: string, params?: Record<string, string | number>): string => {
      const keys = keyPath.split('.');
      
      // Look up in active translations
      let current: unknown = currentTranslations;
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = (current as Record<string, unknown>)[k];
        } else {
          current = undefined;
          break;
        }
      }

      // Fallback to English if not found
      if (typeof current !== 'string') {
        let fallback: unknown = en;
        for (const k of keys) {
          if (fallback && typeof fallback === 'object' && k in fallback) {
            fallback = (fallback as Record<string, unknown>)[k];
          } else {
            fallback = undefined;
            break;
          }
        }
        current = typeof fallback === 'string' ? fallback : keyPath;
      }

      let text = current as string;
      if (params) {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        });
      }
      return text;
    };
  }, [currentTranslations]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        currentLanguageInfo,
        languages: SUPPORTED_LANGUAGES,
        dir: currentLanguageInfo.dir,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
