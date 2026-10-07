import { createContext, useCallback, useContext, useEffect } from 'react';
import '../shared/translations.js';
import '../shared/i18n.js';
import '../cashier/translations.js';
import { useToolActive } from './navigation';

export const LanguageContext = createContext(null);
export const preferences = globalThis.ToolI18n;
export const catalog = globalThis.ToolTranslations;
export function translate(language, key, values = {}, scope = 'tools') {
  return scope === 'cashier'
    ? globalThis.CashierI18n.translate(language, key, values)
    : preferences.translate(language, key, values);
}
export function useI18n(scope = 'tools') {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useI18n requires LanguageProvider');
  const { language, setLanguage } = context;
  const t = useCallback(
    (key, values) => translate(language, key, values, scope),
    [language, scope],
  );
  return { language, setLanguage, t };
}
export function usePageTitle(key, scope = 'tools') {
  const { t } = useI18n(scope);
  const active = useToolActive();
  useEffect(() => {
    if (active) document.title = t(key);
  }, [t, key, active]);
}
