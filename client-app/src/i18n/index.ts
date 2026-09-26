import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import bn from './locales/bn.json';
import en from './locales/en.json';
import { isSupportedLanguage } from './languages';

const STORAGE_KEY = 'sn-lang';
const savedRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const saved = isSupportedLanguage(savedRaw) ? savedRaw : null;
if (savedRaw && !saved && typeof localStorage !== 'undefined') {
  localStorage.setItem(STORAGE_KEY, 'en');
}

void i18n.use(initReactI18next).init({
  resources: {
    bn: { translation: bn },
    en: { translation: en },
  },
  lng: saved || 'en',
  fallbackLng: 'en',
  supportedLngs: ['bn', 'en'],
  nonExplicitSupportedLngs: true,
  interpolation: { escapeValue: false },
  returnNull: false,
  saveMissing: false,
  missingKeyHandler: (languages, _namespace, key) => {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] missing "${key}" for ${languages.join(', ')}`);
    }
  },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
  document.documentElement.lang = lng;
});

document.documentElement.lang = i18n.language;

export default i18n;
