import { ui, cx } from '../ui/styles';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AnimatedValue, Dropzone, Hero, Notice, Panel } from '../components';
import { useI18n, usePageTitle } from '../i18n';
import { estimateBpm } from '../lib/tempo.mjs';
import { normalizeBpm } from '../lib/pricing.mjs';
import { timeLabel, yieldToUI } from '../lib/audio.mjs';
import { useToolActive } from '../navigation';
const corrections = [
  [0.5, '÷ 2', '检测结果偏快一倍'],
  [2, '× 2', '检测结果偏慢一倍'],
  [2 / 3, '× 2/3', '三连音 / 偏快 1.5 倍'],
  [1.5, '× 3/2', '偏慢 1.5 倍'],
];
const format = (value) => (Number.isFinite(value) ? value.toFixed(1) : '—');
export default function Tempo() {
  const { t } = useI18n();
  const active = useToolActive();
  const reduce = useReducedMotion();
  const [detected, setDetected] = useState(''),
    [lower, setLower] = useState('100');
  const [taps, setTaps] = useState([]),
    [tapBpm, setTapBpm] = useState(null);
  const [status, setStatus] = useState(null),
    [result, setResult] = useState(null);
  const [toast, setToast] = useState(null),
    [busy, setBusy] = useState(false),
    [fileName, setFileName] = useState('');
  const tapTimes = useRef([]),
    run = useRef(0),
    toastTimer = useRef(null),
    mounted = useRef(true);
  const value = Number(detected),
    minimum = Number(lower),
    mapped = normalizeBpm(value, minimum);
  const valid = Number.isFinite(value) && value > 0;
  usePageTitle('BPM 错误修正工具 · Music Tools');
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      run.current = -1;
      clearTimeout(toastTimer.current);
    };
  }, []);
  const tap = useCallback(() => {
    const now = performance.now(),
      last = tapTimes.current.at(-1);
    if (last !== undefined && now - last < 100) return;
    const next =
      last === undefined || now - last > 2500 ? [now] : [...tapTimes.current, now].slice(-8);
    tapTimes.current = next;
    setTaps(next);
    if (next.length < 2) {
      setTapBpm(null);
      return;
    }
    const bpm = (60000 * (next.length - 1)) / (next.at(-1) - next[0]);
    setTapBpm(bpm);
    setDetected(bpm.toFixed(1));
  }, []);
  useEffect(() => {
    if (!active) return;
    const keydown = (event) => {
      if (
        event.code !== 'Space' ||
        event.repeat ||
        event.target.closest(
          'input, textarea, select, button, a, [contenteditable="true"], [role="button"]',
        )
      )
        return;
      event.preventDefault();
      tap();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [tap, active]);
  function showToast(key, values) {
    if (!mounted.current) return;
    clearTimeout(toastTimer.current);
    setToast({
      key,
      values,
    });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }
  async function analyze(files) {
    const file = files[0];
    if (!file) return;
    const id = ++run.current;
    setResult(null);
    setFileName(file.name);
    if (file.size > 250 * 1024 * 1024) {
      setBusy(false);
      setStatus({
        key: '文件超过 250 MB，请选择较短或压缩后的音频',
        error: true,
      });
      return;
    }
    setBusy(true);
    setStatus({
      key: '正在读取音频…',
    });
    let context;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('当前浏览器不支持音频分析');
      context = new Audio();
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      if (id !== run.current) return;
      setStatus({
        key: '正在分析节拍…',
      });
      await yieldToUI();
      const found = await estimateBpm(buffer);
      if (id !== run.current) return;
      setResult(found);
      setDetected(found.bpm.toFixed(1));
      setStatus({
        key: '已分析 {duration}，结果已填入 BPM 输入框。',
        values: {
          duration: timeLabel(found.analysisSeconds),
        },
      });
    } catch (error) {
      if (id === run.current)
        setStatus({
          key: Object.hasOwn(globalThis.ToolTranslations.messages, error.message)
            ? error.message
            : '无法读取音频，请换用浏览器支持的格式。',
          error: true,
        });
    } finally {
      if (context) await context.close().catch(() => {});
      if (id === run.current && mounted.current) setBusy(false);
    }
  }
  async function copy() {
    if (mapped === null) return;
    const text = format(mapped);
    try {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        try {
          if (!document.execCommand('copy')) throw new Error('copy');
        } finally {
          area.remove();
        }
      }
      showToast('已复制 {bpm} BPM', {
        bpm: text,
      });
    } catch {
      showToast('无法复制，请手动选择结果。');
    }
  }
  return (
    <>
      <Hero
        eyebrow={t('Tempo Utility')}
        title={t('BPM 修正工具')}
        description={t(
          '修正 Half-Time、Double-Time 与 1.5 倍曲速识别，并支持 Tap Tempo 实时测速。',
        )}
      />
      <Panel className="mt-5">
        <Dropzone
          id="audioFileInput"
          multiple={false}
          disabled={busy}
          onFiles={analyze}
          title={fileName || t('拖入音频，自动分析 BPM')}
          hint={t('或点击选择文件 · 支持 MP3、WAV、M4A、FLAC、OGG 等浏览器可解码格式')}
        />
        <Notice
          message={
            status ? t(status.key, status.values) : t('建议使用节拍清晰、长度超过 10 秒的音频。')
          }
          error={status?.error}
        />
        {result && (
          <div className="analysis-result flex items-center gap-[15px] pt-2.5 text-xs text-muted [&_strong]:text-[22px] [&_strong]:text-accent">
            <strong>{format(result.bpm)} BPM</strong>
            <span>{t(result.confidence)}</span>
          </div>
        )}
      </Panel>
      <div className={cx('two-column', ui.twoColumn)}>
        <Panel className="mt-5">
          <h2>{t('BPM 输入')}</h2>
          <div className={cx('input-grid', ui.inputGrid)}>
            <div>
              <label htmlFor="detectedBpm">{t('测出的 BPM')}</label>
              <input
                id="detectedBpm"
                type="number"
                inputMode="decimal"
                min="0.1"
                step=".1"
                value={detected}
                placeholder={t('例如 105.0')}
                onChange={(event) => setDetected(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="lowerBound">{t('目标区间下限 L')}</label>
              <input
                id="lowerBound"
                type="number"
                inputMode="decimal"
                min="0.1"
                step=".1"
                value={lower}
                onChange={(event) => setLower(event.target.value)}
              />
            </div>
          </div>
          <p className={cx('hint', ui.hint)}>
            {t('自动归一化目标区间：')}{' '}
            {minimum > 0 && Number.isFinite(minimum * 2)
              ? `${format(minimum)} – ${format(minimum * 2)} BPM`
              : '—'}
          </p>
        </Panel>
        <Panel className="mt-5">
          <div className={cx('section-head', ui.sectionHead)}>
            <h2>Tap Tempo</h2>
            <div className={cx('inline-actions', ui.inlineActions)}>
              <span className={cx('hint', ui.hint)}>
                {t('{count} 次打拍', {
                  count: taps.length,
                })}
              </span>
              <button
                id="resetTapButton"
                disabled={!taps.length}
                onClick={() => {
                  tapTimes.current = [];
                  setTaps([]);
                  setTapBpm(null);
                  showToast('Tap Tempo 已重置');
                }}
              >
                {t('重置')}
              </button>
            </div>
          </div>
          <motion.button
            id="tapButton"
            className="tap-button flex w-full flex-col items-center gap-[9px] rounded-[13px] border-[#9b7cff40] bg-[#9b7cff08] p-4 [&_strong]:text-[26px] [&_strong]:tracking-[.12em] [&_strong]:text-accent [&>span]:text-[11px] [&>span]:text-quiet [&_b]:min-h-5 [&_b]:text-[15px]"
            onClick={tap}
            whileTap={
              reduce
                ? undefined
                : {
                    scale: 0.97,
                  }
            }
            aria-label={t('点击或按空格键打拍测速')}
          >
            <strong>TAP</strong>
            <span>
              {t('点击或按')} {t('空格键')} {t('打拍')}
            </span>
            <b id="tapBpm">
              {tapBpm ? `${format(tapBpm)} BPM` : t(taps.length ? '继续打拍…' : '等待打拍')}
            </b>
          </motion.button>
        </Panel>
      </div>
      <Panel className={cx('tempo-result', ui.resultCard)}>
        <div>
          <div className={cx('eyebrow', ui.eyebrow)}>{t('映射后的真实 BPM')}</div>
          <div className={cx('big-result', ui.bigResult)}>
            <AnimatedValue id="normalizedBpm" value={mapped === null ? '—' : format(mapped)} />
            <small>BPM</small>
          </div>
          <p className={cx('hint', ui.hint)}>
            {mapped === null
              ? t('输入检测到的 BPM 后自动计算。')
              : t('{bpm} BPM 已映射到 {lower} – {upper} BPM 区间。', {
                  bpm: format(value),
                  lower: format(minimum),
                  upper: format(minimum * 2),
                })}
          </p>
        </div>
        <button
          className={cx('primary', ui.primary)}
          id="copyButton"
          disabled={mapped === null}
          onClick={copy}
        >
          {t('复制结果')}
        </button>
      </Panel>
      <Panel className="mt-5">
        <div className={cx('section-head', ui.sectionHead)}>
          <h2>{t('倍率快捷修正')}</h2>
          <span>{t('点击卡片可套用结果')}</span>
        </div>
        <div className="corrections grid grid-cols-2 gap-3 sm:grid-cols-4">
          {corrections.map(([factor, label, text]) => (
            <motion.button
              key={factor}
              className="correction flex flex-col items-start gap-2.5 bg-[#0b0e1559] p-[18px] text-left [&_strong]:text-[23px] [&_strong]:text-accent [&>span]:text-[10px] [&>span]:text-quiet [&_b]:text-lg [&_small]:text-[10px] [&_small]:font-normal [&_small]:text-quiet"
              data-factor={factor}
              disabled={!valid || !Number.isFinite(value * factor)}
              whileTap={{
                scale: 0.97,
              }}
              onClick={() => {
                setDetected(format(value * factor));
                showToast('已套用修正结果');
              }}
            >
              <strong>{label}</strong>
              <span>{t(text)}</span>
              <b>
                {valid ? format(value * factor) : '—'} <small>BPM</small>
              </b>
            </motion.button>
          ))}
        </div>
      </Panel>
      <details>
        <summary>{t('自动归一化')}</summary>
        <p className="formula-code font-mono wrap-anywhere">
          B_real = L × 2^(log₂(B_detected / L) mod 1)
        </p>
        <p>{t('通过八度式 ×2 / ÷2 对数映射，将任意正数 BPM 折叠到 [L, 2L) 区间内。')}</p>
        <p>
          {t('Tap Tempo 使用最近的打拍间隔进行平均，以减少单次点击误差。')}{' '}
          {t('停顿较长时间后再次点击会自动开始新一轮测速。')}
        </p>
      </details>
      <Notice message={toast ? t(toast.key, toast.values) : ''} />
    </>
  );
}
