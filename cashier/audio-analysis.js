/* Dry-vocal activity measurement. No network requests or audio playback. */
((root) => {
  "use strict";
  const FRAME_SECONDS = 0.02;
  const MIN_ACTIVE_SECONDS = 0.06;
  const NORMALIZED_PEAK_DB = -6;

  async function normalizeBuffer(buffer, yieldToUI) {
    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) {
        peak = Math.max(peak, Math.abs(samples[i]));
        if (i % 800000 === 799999) await yieldToUI();
      }
    }
    // Silence has no peak to normalize. Avoid division by zero or NaN samples.
    if (peak === 0) return { originalPeakDb: null, normalizedPeakDb: null, gainDb: 0 };
    const originalPeakDb = 20 * Math.log10(peak);
    const gain = 10 ** (NORMALIZED_PEAK_DB / 20) / peak;
    // Use one gain for the whole file, preserving channel balance and quiet gaps.
    // This modifies only the decoded buffer, never the user's source file.
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) {
        samples[i] *= gain;
        if (i % 800000 === 799999) await yieldToUI();
      }
    }
    return { originalPeakDb, normalizedPeakDb: NORMALIZED_PEAK_DB, gainDb: NORMALIZED_PEAK_DB - originalPeakDb };
  }

  async function analyzeBuffer(buffer, yieldToUI = () => Promise.resolve()) {
    const normalization = await normalizeBuffer(buffer, yieldToUI);
    const frameSize = Math.max(1, Math.round(buffer.sampleRate * FRAME_SECONDS));
    const levels = new Float32Array(Math.ceil(buffer.length / frameSize));
    levels.fill(-Infinity);
    // Measure each channel separately: opposite-phase stereo must not cancel.
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let frame = 0; frame < levels.length; frame++) {
        const start = frame * frameSize;
        const end = Math.min(start + frameSize, samples.length);
        let sum = 0;
        let squares = 0;
        for (let i = start; i < end; i++) {
          sum += samples[i];
          squares += samples[i] * samples[i];
        }
        const count = end - start;
        // Remove DC offset before measuring energy.
        const power = Math.max(0, squares / count - (sum / count) ** 2);
        const db = power > 0 ? 10 * Math.log10(power) : -Infinity;
        levels[frame] = Math.max(levels[frame], db);
        if (frame % 2500 === 2499) await yieldToUI();
      }
    }
    return { levels, frameSeconds: frameSize / buffer.sampleRate, totalSeconds: buffer.length / buffer.sampleRate, normalization };
  }

  function activeSeconds(analysis, thresholdDb) {
    let total = 0;
    let run = 0;
    const finishRun = () => {
      // Ignore isolated clicks. Do not bridge silent gaps or add padding.
      if (run + 1e-9 >= MIN_ACTIVE_SECONDS) total += run;
      run = 0;
    };
    analysis.levels.forEach((db, frame) => {
      if (db >= thresholdDb) {
        run += Math.min(analysis.frameSeconds, analysis.totalSeconds - frame * analysis.frameSeconds);
      } else {
        finishRun();
      }
    });
    finishRun();
    return Math.min(total, analysis.totalSeconds);
  }

  function formatInput(seconds) {
    const centiseconds = Math.round(seconds * 100);
    const minutes = Math.floor(centiseconds / 6000);
    const remainder = centiseconds % 6000;
    return `${minutes}:${(remainder / 100).toFixed(2).padStart(5, "0")}`;
  }

  const api = { analyzeBuffer, activeSeconds, formatInput };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.DryVocalAnalysis = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
