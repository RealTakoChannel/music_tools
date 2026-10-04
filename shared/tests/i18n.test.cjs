const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const catalog = require('../translations.js');
const { translate } = require('../i18n.js');
const project = path.resolve(__dirname, '../..');

test('every translation has Japanese and English text with matching placeholders', () => {
  const slots = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const [key, pair] of Object.entries(catalog.messages)) {
    assert.equal(pair.length, 2, key);
    for (const text of pair) {
      assert.ok(text.length, key);
      assert.deepEqual(slots(text), slots(key), key);
    }
  }
  assert.equal(translate('en', '检测到 {bpm} BPM', { bpm: 120 }), 'Detected 120 BPM');
  assert.equal(translate('invalid', '返回主界面'), '返回主界面');
  assert.equal(translate('en', '__proto__'), '__proto__');
});

test('all Chinese static text, labels and placeholders on the three pages are covered', () => {
  for (const page of ['index.html', 'bpmcalc/index.html', 'audiojoin/index.html']) {
    const html = fs.readFileSync(path.join(project, page), 'utf8');
    const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '');
    const strings = [
      ...[...markup.matchAll(/>([^<]+)</g)].map(m => m[1].trim()),
      ...[...markup.matchAll(/(?:aria-label|placeholder|content)="([^"]*)"/g)].map(m => m[1])
    ];
    for (const key of strings.filter(text => /\p{Script=Han}/u.test(text) && !['中文', '日本語'].includes(text))) {
      assert.ok(Object.hasOwn(catalog.messages, key), `${page}: ${key}`);
    }
    for (const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
  }
});

test('all literal audio validation errors have translations', () => {
  for (const file of ['audiojoin/wav-engine.js', 'bpmcalc/index.html']) {
    const source = fs.readFileSync(path.join(project, file), 'utf8');
    for (const match of source.matchAll(/new Error\(['"]([^'"]+)['"]\)/g)) {
      assert.ok(Object.hasOwn(catalog.messages, match[1]), `${file}: ${match[1]}`);
    }
  }
});

function setup({ saved = {}, blocked = false } = {}) {
  const storage = new Map(Object.entries(saved));
  function element(attributes = {}) {
    return { attributes, isConnected: true, textContent: '', value: 'custom.wav', dataset: {}, listeners: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      getAttribute(name) { return this.attributes[name] ?? null; },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      closest() { return null; }
    };
  }
  const parent = element(), staticNode = { nodeValue: '\n 返回主界面 ', parentElement: parent };
  const ignoredNode = { nodeValue: '返回主界面', parentElement: { closest: () => ({}) } };
  const placeholder = element({ placeholder: '默认使用第一个文件名' });
  const buttons = ['zh', 'ja', 'en'].map(language => { const button = element(); button.dataset.language = language; return button; });
  const nodes = [staticNode, ignoredNode];
  let cursor = 0;
  const document = { body: {}, title: '音频合并 · Music Tools', documentElement: {},
    createTreeWalker() { return { nextNode: () => nodes[cursor++] || null }; },
    querySelectorAll(selector) { return selector === '[data-language]' ? buttons : [placeholder]; }
  };
  const context = { ToolTranslations: catalog, document, NodeFilter: { SHOW_TEXT: 4 }, localStorage: {
    getItem(key) { if (blocked) throw new Error('blocked'); return storage.get(key); },
    setItem(key, value) { if (blocked) throw new Error('blocked'); storage.set(key, value); }
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../i18n.js'), 'utf8'), context);
  return { i18n: context.ToolI18n.create(), staticNode, ignoredNode, placeholder, document, buttons, storage, element };
}

test('language changes preserve inputs and dynamic parameters, and repaint existing messages', () => {
  const { i18n, staticNode, ignoredNode, placeholder, document, buttons, storage, element } = setup();
  const status = element();
  i18n.setText(status, '正在读取 {index} / {count}：{name}', { index: 1, count: 2, name: '<中文文件>.wav' });
  buttons[2].listeners.click();
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(document.title, 'Audio Joiner · Music Tools');
  assert.equal(staticNode.nodeValue, '\n Back to home ');
  assert.equal(ignoredNode.nodeValue, '返回主界面');
  assert.equal(placeholder.attributes.placeholder, 'Defaults to the first filename');
  assert.equal(placeholder.value, 'custom.wav');
  assert.equal(status.textContent, 'Reading 1 / 2: <中文文件>.wav');
  assert.equal(storage.get('music-tools-language'), 'en');
  i18n.apply('ja');
  assert.equal(status.textContent, '読み込み中 1 / 2：<中文文件>.wav');
  i18n.setText(status, '分析完成');
  i18n.apply('en');
  assert.equal(status.textContent, 'Analysis complete');
});

test('shared preferences take priority, legacy calculator preferences migrate, and blocked storage works', () => {
  assert.equal(setup({ saved: { 'music-tools-language': 'ja', 'cashier-language': 'en' } }).i18n.language, 'ja');
  assert.equal(setup({ saved: { 'cashier-language': 'en' } }).i18n.language, 'en');
  assert.equal(setup({ saved: { 'music-tools-language': 'invalid' } }).i18n.language, 'zh');
  const { buttons, i18n } = setup({ blocked: true });
  buttons[1].listeners.click();
  assert.equal(i18n.language, 'ja');
});
