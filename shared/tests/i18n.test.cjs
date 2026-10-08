const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../translations.js');
const cashier = require('../../cashier/translations.js');
const { translate, readLanguage, saveLanguage } = require('../i18n.js');
const project = path.resolve(__dirname, '../..');
const slots = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

test('all tool and cashier translations have matching keys and placeholders', () => {
  for (const [key, pair] of Object.entries(catalog.messages)) {
    assert.equal(pair.length, 2, key);
    for (const text of pair) { assert.ok(text.length, key); assert.deepEqual(slots(text), slots(key), key); }
  }
  for (const language of ['ja','en']) {
    assert.deepEqual(Object.keys(cashier.messages[language]).sort(), Object.keys(cashier.messages.zh).sort());
    for (const [key, value] of Object.entries(cashier.messages.zh)) assert.deepEqual(slots(cashier.messages[language][key]), slots(value), key);
  }
});
test('React literal tool labels and audio errors are covered by translations', () => {
  for (const file of ['src/components.jsx', 'src/GitHubStar.jsx', 'src/pages/Home.jsx', 'src/pages/Tempo.jsx', 'src/pages/AudioJoiner.jsx']) {
    const source = fs.readFileSync(path.join(project, file), 'utf8');
    for (const match of source.matchAll(/\bt\(['"]([^'"\n]+)['"]/g)) {
      const key = match[1].replace(/\\n/g, '\n');
      if (/\p{Script=Han}/u.test(key)) assert.ok(Object.hasOwn(catalog.messages, key), `${file}: ${key}`);
    }
  }
  for (const file of ['audiojoin/wav-engine.js', 'src/lib/tempo.mjs']) {
    const source = fs.readFileSync(path.join(project, file), 'utf8');
    for (const match of source.matchAll(/new Error\(['"]([^'"]+)['"]\)/g)) assert.ok(Object.hasOwn(catalog.messages, match[1]), `${file}: ${match[1]}`);
  }
});
test('translations handle dynamic parameters and unknown keys', () => {
  assert.equal(translate('en', '检测到 {bpm} BPM', { bpm: 120 }), 'Detected 120 BPM');
  assert.equal(translate('invalid', '返回主界面'), '返回主界面');
  assert.equal(translate('en', '__proto__'), '__proto__');
  assert.equal(translate('en', '正在读取 {index} / {count}：{name}', { index: 1, count: 2, name: '<中文文件>.wav' }), 'Reading 1 / 2: <中文文件>.wav');
});
test('shared preference takes priority and legacy calculator preference is restored', () => {
  const storage = values => ({ getItem: key => values[key] });
  assert.equal(readLanguage(storage({ 'music-tools-language': 'ja', 'cashier-language': 'en' })), 'ja');
  assert.equal(readLanguage(storage({ 'cashier-language': 'en' })), 'en');
  assert.equal(readLanguage(storage({ 'music-tools-language': 'invalid' })), 'zh');
  const saved = new Map();
  saveLanguage('ja', { setItem: (key, value) => saved.set(key, value) });
  assert.equal(saved.get('music-tools-language'), 'ja');
  assert.equal(saved.get('cashier-language'), 'ja');
});
test('blocked local storage does not prevent language switching', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal(readLanguage(blocked), 'zh');
  assert.doesNotThrow(() => saveLanguage('en', blocked));
  assert.equal(translate('en', '返回主界面'), 'Back to home');
});
