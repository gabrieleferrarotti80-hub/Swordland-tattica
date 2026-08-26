// src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationIT from './locales/it.json';
import translationEN from './locales/en.json';
import translationPL from './locales/pl.json'; // 🇵🇱 Polacco
import translationFR from './locales/fr.json'; // 🇫🇷 Francese
import translationDE from './locales/de.json'; // 🇦🇹 Austriaco / Tedesco

const resources = {
  it: { translation: translationIT },
  en: { translation: translationEN },
  pl: { translation: translationPL },
  fr: { translation: translationFR },
  'de': { translation: translationDE } // Aggiunta la lingua austriaca
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;