export function parseTime(value) {
  const input = value.trim();
  if (!input) return { value: 0 };
  const precise = input.match(/^(\d+):(\d{1,2}(?:\.\d{1,2})?)$/);
  if (precise) {
    const minutes = Number(precise[1]), seconds = Number(precise[2]);
    if (!Number.isFinite(minutes + seconds / 60)) return { error: 'timeRange' };
    if (seconds >= 60) return { error: 'secondsRange' };
    return { value: minutes + seconds / 60 };
  }
  const match = input.match(/^(\d+)(?:[.:](\d{0,2}))?$/);
  if (!match) return { error: 'timeFormat' };
  const minutes = Number(match[1]);
  if (!Number.isFinite(minutes)) return { error: 'timeRange' };
  const seconds = Number(match[2]?.length === 1 ? `${match[2]}0` : match[2] || '0');
  if (seconds >= 60) return { error: 'secondsRange' };
  return { value: minutes + seconds / 60 };
}
export function autoPriceMode(value) {
  const time = parseTime(value);
  const price = Number((time.value * 30).toFixed(2));
  return !time.error && time.value > 0 && Number.isFinite(price) ? price >= 70 ? 'full' : price < 20 ? 'twenty' : 'time' : 'time';
}
export function calculatePrice(lead, harmony, mode, round) {
  const left = parseTime(lead), right = parseTime(harmony);
  const leadError = mode === 'time' ? left.error : undefined;
  const leadPrice = mode === 'full' ? 70 : mode === 'twenty' ? 20 : left.value * 30;
  const harmonyPrice = right.value * 20;
  const original = Number((leadPrice + harmonyPrice).toFixed(2));
  return { leadPrice, harmonyPrice, leadError, harmonyError: right.error, error: leadError || right.error, original, total: round ? Math.floor(original / 5) * 5 : original };
}
export function normalizeBpm(detected, lower) {
  if (!Number.isFinite(detected) || !Number.isFinite(lower) || detected <= 0 || lower <= 0 || !Number.isFinite(lower * 2)) return null;
  const log = Math.log2(detected) - Math.log2(lower);
  return lower * 2 ** (((log % 1) + 1) % 1);
}
