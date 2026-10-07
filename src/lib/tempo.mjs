export async function estimateBpm(
  audioBuffer,
  yieldToUI = () => new Promise((resolve) => setTimeout(resolve, 0)),
) {
  if (audioBuffer.duration < 5) throw new Error('音频过短，请使用至少 5 秒的片段');

  const sampleRate = audioBuffer.sampleRate;
  const startSeconds = audioBuffer.duration > 30 ? Math.min(5, audioBuffer.duration * 0.05) : 0;
  const analysisSeconds = Math.min(180, audioBuffer.duration - startSeconds);
  const startSample = Math.floor(startSeconds * sampleRate);
  const endSample = Math.min(
    audioBuffer.length,
    Math.floor((startSeconds + analysisSeconds) * sampleRate),
  );
  const envelopeRate = 100;
  const hopSize = Math.max(1, Math.round(sampleRate / envelopeRate));
  const frameSize = hopSize * 2;
  const frameCount = Math.floor((endSample - startSample - frameSize) / hopSize);
  if (frameCount < envelopeRate * 4) throw new Error('可分析的有效音频过短');

  const channelCount = Math.min(2, audioBuffer.numberOfChannels);
  const channels = [];
  for (let channel = 0; channel < channelCount; channel += 1)
    channels.push(audioBuffer.getChannelData(channel));

  const energy = new Float32Array(frameCount);
  let totalEnergy = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const offset = startSample + frame * hopSize;
    let sum = 0;
    let samples = 0;
    for (let channel = 0; channel < channelCount; channel += 1) {
      const data = channels[channel];
      for (let sample = offset; sample < offset + frameSize; sample += 2) {
        const value = data[sample] || 0;
        sum += value * value;
        samples += 1;
      }
    }
    energy[frame] = Math.sqrt(sum / Math.max(1, samples));
    totalEnergy += energy[frame];
    if (frame > 0 && frame % 5000 === 0) await yieldToUI();
  }
  if (totalEnergy / frameCount < 0.0001) throw new Error('音频音量过低，无法识别稳定节拍');

  const onset = new Float32Array(frameCount);
  let movingAverage = energy[0];
  let onsetMean = 0;
  for (let index = 1; index < frameCount; index += 1) {
    movingAverage = movingAverage * 0.94 + energy[index] * 0.06;
    onset[index] = Math.max(0, energy[index] - movingAverage);
    onsetMean += onset[index];
  }
  onsetMean /= frameCount;

  let onsetVariance = 0;
  for (let index = 0; index < frameCount; index += 1) {
    const difference = onset[index] - onsetMean;
    onsetVariance += difference * difference;
  }
  const onsetDeviation = Math.sqrt(onsetVariance / frameCount);
  const onsetThreshold = onsetMean + onsetDeviation * 0.35;
  let onsetStrength = 0;
  for (let index = 0; index < frameCount; index += 1) {
    onset[index] = Math.max(0, onset[index] - onsetThreshold);
    onsetStrength += onset[index];
  }
  if (onsetStrength <= 0.0001) throw new Error('未检测到足够清晰的节拍瞬态');

  const minimumBpm = 55;
  const maximumBpm = 220;
  const minimumLag = Math.floor((envelopeRate * 60) / maximumBpm);
  const maximumLag = Math.ceil((envelopeRate * 60) / minimumBpm);
  const correlations = new Float64Array(maximumLag + 1);
  const scores = new Float64Array(maximumLag + 1);

  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let product = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let index = lag; index < frameCount; index += 1) {
      const left = onset[index];
      const right = onset[index - lag];
      product += left * right;
      leftEnergy += left * left;
      rightEnergy += right * right;
    }
    correlations[lag] = product / Math.sqrt(leftEnergy * rightEnergy + 1e-12);
  }

  let bestLag = minimumLag;
  let bestScore = -Infinity;
  let scoreTotal = 0;
  let scoreCount = 0;
  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let score = correlations[lag];
    if (lag * 2 <= maximumLag) score += correlations[lag * 2] * 0.45;
    const halfLag = Math.round(lag / 2);
    if (halfLag >= minimumLag) score += correlations[halfLag] * 0.12;
    const candidateBpm = (envelopeRate * 60) / lag;
    if (candidateBpm < 65 || candidateBpm > 190) score *= 0.94;
    scores[lag] = score;
    scoreTotal += score;
    scoreCount += 1;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (!Number.isFinite(bestScore) || bestScore < 0.025)
    throw new Error('未检测到稳定 BPM，请尝试节拍更清晰的片段');

  let refinedLag = bestLag;
  if (bestLag > minimumLag && bestLag < maximumLag) {
    const previous = scores[bestLag - 1];
    const current = scores[bestLag];
    const next = scores[bestLag + 1];
    const denominator = previous - 2 * current + next;
    if (Math.abs(denominator) > 1e-9)
      refinedLag += Math.max(-0.5, Math.min(0.5, (0.5 * (previous - next)) / denominator));
  }

  const bpm = (envelopeRate * 60) / refinedLag;
  const averageScore = scoreTotal / Math.max(1, scoreCount);
  const prominence = (bestScore - averageScore) / Math.max(bestScore, 1e-9);
  const periodicity = correlations[bestLag];
  const confidence =
    prominence > 0.55 && periodicity > 0.12
      ? '高置信度'
      : prominence > 0.32 && periodicity > 0.055
        ? '中等置信度'
        : '低置信度';

  return { bpm, confidence, analysisSeconds };
}
