// Compatibility bridge: these tested engines also run in standalone Node tests.
import '../../audiojoin/wav-engine.js';
import '../../cashier/audio-analysis.js';
export const wav = globalThis.WavJoiner;
export const vocals = globalThis.DryVocalAnalysis;
export const yieldToUI = () => new Promise((resolve) => setTimeout(resolve, 0));
export const sizeLabel = (bytes) => {
  const unit = bytes < 1024 ? 0 : bytes < 1024 ** 2 ? 1 : bytes < 1024 ** 3 ? 2 : 3;
  return `${(bytes / 1024 ** unit).toFixed(unit > 1 ? 2 : 0)} ${['B', 'KB', 'MB', 'GB'][unit]}`;
};
export const timeLabel = (seconds) => {
  const ms = Math.round(seconds * 1000),
    sec = Math.floor(ms / 1000);
  const hours = Math.floor(sec / 3600);
  return `${hours ? `${String(hours).padStart(2, '0')}:` : ''}${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};
const filenameOrder = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
export function compareByFilename(a, b) {
  const order = filenameOrder.compare(a.file.name, b.file.name);
  return order || (a.file.name < b.file.name ? -1 : a.file.name > b.file.name ? 1 : 0);
}
export function outputFilename(entered, fallback = 'joined-audio') {
  const safe = Array.from(entered.trim() || fallback, (char) =>
    char.charCodeAt(0) < 32 ? '_' : char,
  ).join('');
  const name =
    safe
      .replace(/\.wav$/i, '')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/[. ]+$/, '') || fallback;
  return `${/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? '_' : ''}${name}.wav`;
}
