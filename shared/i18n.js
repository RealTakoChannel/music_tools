(function (root) {
  'use strict';
  const catalog = typeof module !== 'undefined' && module.exports ? require('./translations.js') : root.ToolTranslations;
  function translate(language, key, values = {}) {
    const pair = Object.hasOwn(catalog.messages, key) ? catalog.messages[key] : null;
    const template = pair && (language === 'ja' || language === 'en') ? pair[language === 'ja' ? 0 : 1] : key;
    return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  }
  function readLanguage(storage) {
    try {
      const local = storage ?? root.localStorage;
      const saved = local.getItem('music-tools-language') || local.getItem('cashier-language');
      return Object.hasOwn(catalog.languageTags, saved) ? saved : 'zh';
    } catch { return 'zh'; }
  }
  function saveLanguage(language, storage) {
    if (!Object.hasOwn(catalog.languageTags, language)) return;
    try {
      const local = storage ?? root.localStorage;
      local.setItem('music-tools-language', language);
      local.setItem('cashier-language', language);
    } catch { /* Persistence is optional; React keeps the current choice in memory. */ }
  }
  const api = { translate, readLanguage, saveLanguage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ToolI18n = api;
})(globalThis);
