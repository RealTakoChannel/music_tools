import { useEffect, useMemo, useState } from 'react';
import { LanguageContext, catalog, preferences } from '../i18n';

export default function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => preferences.readLanguage());
  const value = useMemo(() => ({ language, setLanguage }), [language]);
  useEffect(() => {
    document.documentElement.lang = catalog.languageTags[language];
    preferences.saveLanguage(language);
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        preferences.translate(language, '一组为音乐制作工作流打造的轻量实用工具。'),
      );
  }, [language]);
  return <LanguageContext value={value}>{children}</LanguageContext>;
}
