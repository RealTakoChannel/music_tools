import { useEffect, useRef, useState } from 'react';
import { vocals, yieldToUI } from '../lib/audio.mjs';

export function useVocalGroup(threshold, onInput) {
  const group = useRef({ entries: [], pending: [], busy: false, manual: false, autoFilled: false, error: null });
  const [state, setState] = useState(group.current);
  const alive = useRef(true), thresholdRef = useRef(threshold), inputRef = useRef(onInput);
  thresholdRef.current = threshold; inputRef.current = onInput;
  useEffect(() => () => { alive.current = false; group.current.pending = []; }, []);
  const total = () => group.current.entries.reduce((sum, entry) => sum + (entry.analysis ? vocals.activeSeconds(entry.analysis, thresholdRef.current) : 0), 0);
  const publish = () => { if (alive.current) setState({ ...group.current, entries: [...group.current.entries] }); };
  function refill() {
    group.current.manual = false; group.current.autoFilled = true;
    inputRef.current(vocals.formatInput(total())); publish();
  }
  async function addFiles(files) {
    if (!files.length) return;
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) { group.current.error = 'browserUnsupported'; publish(); return; }
    group.current.error = null;
    const entries = files.map(file => ({ id: crypto.randomUUID(), name: file.name, file }));
    group.current.entries.push(...entries); group.current.pending.push(...entries);
    if (group.current.busy) { publish(); return; }
    group.current.busy = true; publish(); let success = false;
    try {
      while (group.current.pending.length && alive.current) {
        const entry = group.current.pending.shift();
        try {
          if (!entry.file.size) throw new Error('empty');
          const context = new Offline(1, 1, 16000);
          const buffer = await context.decodeAudioData(await entry.file.arrayBuffer());
          entry.analysis = await vocals.analyzeBuffer(buffer, yieldToUI); success = true;
        } catch { entry.error = entry.file.size === 0 ? 'emptyFile' : 'unreadableFile'; }
        delete entry.file;
        publish(); await yieldToUI();
      }
    } finally {
      group.current.busy = false;
      if (alive.current) { if (success) refill(); else publish(); }
    }
  }
  function remove(id) {
    if (group.current.busy) return;
    group.current.entries = group.current.entries.filter(entry => entry.id !== id); refill();
  }
  function clear() {
    if (group.current.busy) return;
    group.current.entries = []; group.current.error = null; refill();
  }
  function markManual() { group.current.manual = true; publish(); }
  return { ...state, addFiles, remove, clear, refill, markManual, total: total() };
}
