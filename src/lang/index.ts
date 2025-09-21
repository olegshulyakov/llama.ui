import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import i18n, {
  fallbackLanguage,
  supportedLanguages,
  type SupportedLanguage,
} from '../i18n';
import en from './en.json';

export type LanguageResource = typeof en;

const fallbackResource: LanguageResource = en;

const getResourceBundle = (language: string): LanguageResource | undefined => {
  try {
    return i18n.getResourceBundle(language, 'translation') as
      | LanguageResource
      | undefined;
  } catch (error) {
    console.warn(
      `Missing translation bundle for language "${language}".`,
      error
    );
    return undefined;
  }
};

export const useLang = () => {
  const { i18n: i18nextInstance, t } = useTranslation();

  const lang = useMemo<LanguageResource>(() => {
    const bundle =
      getResourceBundle(i18nextInstance.language) ??
      getResourceBundle(fallbackLanguage) ??
      fallbackResource;

    return bundle;
  }, [i18nextInstance.language]);

  return { lang, t, i18n: i18nextInstance };
};

export { supportedLanguages, type SupportedLanguage };
