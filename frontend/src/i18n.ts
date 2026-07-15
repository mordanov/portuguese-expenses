import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enTranslation from './locales/en/translation.json'
import ruTranslation from './locales/ru/translation.json'
import ptTranslation from './locales/pt/translation.json'
import frTranslation from './locales/fr/translation.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      ru: { translation: ruTranslation },
      pt: { translation: ptTranslation },
      fr: { translation: frTranslation },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ru', 'pt', 'fr'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV
      ? (lngs, ns, key) => {
          console.warn(`[i18n] Missing key: ${ns}:${key} for languages: ${lngs.join(', ')}`)
        }
      : undefined,
  })

export default i18n
