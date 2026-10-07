import { useEffect, useReducer, useRef } from 'react';
import { vocals, yieldToUI } from '../lib/audio.mjs';
import { initialVocalGroup, vocalGroupReducer } from '../lib/vocal-group.mjs';

const totalSeconds = (entries, threshold) =>
  entries.reduce(
    (sum, entry) => sum + (entry.analysis ? vocals.activeSeconds(entry.analysis, threshold) : 0),
    0,
  );

export function useVocalGroup(threshold, onInput) {
  const [state, dispatch] = useReducer(vocalGroupReducer, initialVocalGroup);
  // Refs coordinate asynchronous work only; rendering uses immutable reducer state.
  const working = useRef(initialVocalGroup),
    queue = useRef([]),
    alive = useRef(false);
  const latest = useRef({ threshold, onInput });
  useEffect(() => {
    latest.current = { threshold, onInput };
  }, [threshold, onInput]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      queue.current = [];
    };
  }, []);
  function send(action) {
    if (!alive.current) return;
    working.current = vocalGroupReducer(working.current, action);
    dispatch(action);
  }
  function refill(nextThreshold = latest.current.threshold) {
    send({ type: 'refill' });
    latest.current.onInput(
      vocals.formatInput(totalSeconds(working.current.entries, nextThreshold)),
    );
  }
  async function addFiles(files) {
    if (!files.length) return;
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) {
      send({ type: 'error', error: 'browserUnsupported' });
      return;
    }
    const jobs = files.map((file) => ({ id: crypto.randomUUID(), name: file.name, file }));
    const running = working.current.busy;
    queue.current.push(...jobs);
    send({ type: 'add', entries: jobs.map(({ id, name }) => ({ id, name })) });
    if (running) return;
    let success = false;
    try {
      while (queue.current.length && alive.current) {
        const job = queue.current.shift();
        let result;
        try {
          if (!job.file.size) throw new Error('empty');
          const context = new Offline(1, 1, 16000);
          const buffer = await context.decodeAudioData(await job.file.arrayBuffer());
          if (!alive.current) return;
          result = { analysis: await vocals.analyzeBuffer(buffer, yieldToUI) };
          success = true;
        } catch {
          result = { error: job.file.size === 0 ? 'emptyFile' : 'unreadableFile' };
        }
        send({ type: 'resolve', id: job.id, result });
        await yieldToUI();
      }
    } finally {
      if (alive.current) {
        send({ type: 'finish' });
        if (success) refill();
      }
    }
  }
  function remove(id) {
    if (working.current.busy) return;
    send({ type: 'remove', id });
    refill();
  }
  function clear() {
    if (working.current.busy) return;
    send({ type: 'clear' });
    refill();
  }
  function markManual() {
    send({ type: 'manual' });
  }
  return {
    ...state,
    addFiles,
    remove,
    clear,
    refill,
    markManual,
    total: totalSeconds(state.entries, threshold),
  };
}
