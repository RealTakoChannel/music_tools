(function (root) {
  'use strict';
  const catalog = typeof module !== 'undefined' && module.exports ? require('./translations.js') : root.ToolTranslations;
  function translate(language, key, values = {}) {
    const pair = Object.hasOwn(catalog.messages, key) ? catalog.messages[key] : null;
    const template = pair && (language === 'ja' || language === 'en') ? pair[language === 'ja' ? 0 : 1] : key;
    return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  }
  function create() {
    let language = 'zh';
    try {
      const saved = root.localStorage.getItem('music-tools-language') || root.localStorage.getItem('cashier-language');
      if (Object.hasOwn(catalog.languageTags, saved)) language = saved;
    } catch (_) { /* Local files and restricted storage still support switching. */ }
    const textNodes = [], attributes = [], bindings = new Map(), listeners = new Set();
    // Capture only the original static markup. Uploaded names and user input are never translated.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement.closest('script, style, [data-language]')) continue;
      const key = node.nodeValue.trim();
      if (Object.hasOwn(catalog.messages, key)) {
        const prefix = node.nodeValue.match(/^\s*/)[0], suffix = node.nodeValue.match(/\s*$/)[0];
        textNodes.push({ node, key, prefix, suffix });
      }
    }
    document.querySelectorAll('[aria-label], [placeholder], [title], meta[name="description"]').forEach(element => {
      for (const name of ['aria-label', 'placeholder', 'title', 'content']) {
        const key = element.getAttribute(name);
        if (Object.hasOwn(catalog.messages, key)) attributes.push({ element, name, key });
      }
    });
    const titleKey = document.title;
    const t = (key, values) => translate(language, key, values);
    function paintBinding(element, binding) {
      const values = typeof binding.values === 'function' ? binding.values() : binding.values;
      if (binding.attribute) element.setAttribute(binding.attribute, t(binding.key, values));
      else element.textContent = t(binding.key, values);
    }
    function setText(element, key, values = {}) {
      const binding = { key, values };
      bindings.set(element, binding); paintBinding(element, binding);
    }
    function setAttribute(element, attribute, key, values = {}) {
      // Attribute bindings are primarily for the packaged desktop title/navigation.
      attributes.push({ element, name: attribute, key, values });
      element.setAttribute(attribute, t(key, values));
    }
    function apply(nextLanguage) {
      if (!Object.hasOwn(catalog.languageTags, nextLanguage)) return;
      language = nextLanguage;
      document.documentElement.lang = catalog.languageTags[language];
      document.title = t(titleKey);
      textNodes.forEach(({ node, key, prefix, suffix }) => { node.nodeValue = prefix + t(key) + suffix; });
      attributes.forEach(({ element, name, key, values }) => element.setAttribute(name, t(key, values)));
      for (const [element, binding] of bindings) {
        if (!element.isConnected) bindings.delete(element);
        else paintBinding(element, binding);
      }
      document.querySelectorAll('[data-language]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.language === language));
      });
      listeners.forEach(listener => listener(language));
    }
    document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
      apply(button.dataset.language);
      try { root.localStorage.setItem('music-tools-language', language); } catch (_) { /* Optional persistence. */ }
    }));
    apply(language);
    return { t, setText, setAttribute, apply, onChange: listener => listeners.add(listener), get language() { return language; } };
  }
  const api = { translate, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ToolI18n = api;
})(globalThis);
