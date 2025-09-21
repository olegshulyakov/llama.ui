import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './lang/en.json';
import fr from './lang/fr.json';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
} as const;

export type SupportedLanguage = keyof typeof resources;

export const fallbackLanguage: SupportedLanguage = 'en';

export const supportedLanguages = Object.keys(resources) as SupportedLanguage[];

const isSupportedLanguage = (value: unknown): value is SupportedLanguage =>
  typeof value === 'string' &&
  supportedLanguages.includes(value as SupportedLanguage);

const requestedLanguage = (() => {
  if (typeof __APP_LANG__ === 'string' && isSupportedLanguage(__APP_LANG__)) {
    return __APP_LANG__;
  }

  return undefined;
})();

const buildLanguage: SupportedLanguage = requestedLanguage ?? fallbackLanguage;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: buildLanguage,
    fallbackLng: fallbackLanguage,
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  });
}

i18n.on('languageChanged', (language) => {
  if (!isSupportedLanguage(language)) {
    void i18n.changeLanguage(fallbackLanguage);
  }
});

export default i18n;
