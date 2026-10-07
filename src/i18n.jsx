import { createContext, useContext, useEffect, useState } from 'react';
import '../shared/translations.js';
import '../shared/i18n.js';
import '../cashier/translations.js';
import { useToolActive } from './navigation';

const catalog = globalThis.ToolTranslations;
const cashier = globalThis.CashierI18n;
const preferences = globalThis.ToolI18n;
const Context = createContext(null);
export function translate(language, key, values = {}, scope = 'tools') {
  return scope === 'cashier' ? cashier.translate(language, key, values) : preferences.translate(language, key, values);
}
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => preferences.readLanguage());
  useEffect(() => {
    document.documentElement.lang = catalog.languageTags[language];
    preferences.saveLanguage(language);
    document.querySelector('meta[name="description"]')?.setAttribute('content', preferences.translate(language, '一组为音乐制作工作流打造的轻量实用工具。'));
  }, [language]);
  return <Context.Provider value={{ language, setLanguage }}>{children}</Context.Provider>;
}
export function useI18n(scope = 'tools') {
  const { language, setLanguage } = useContext(Context);
  return { language, setLanguage, t: (key, values) => translate(language, key, values, scope) };
}
export function usePageTitle(key, scope = 'tools') {
  const { t, language } = useI18n(scope);
  const active = useToolActive();
  useEffect(() => { if (active) document.title = t(key); }, [language, key, scope, active]);
}
