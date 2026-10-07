import { ui, cx } from '../ui/styles';
import { useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { AnimatedValue, Dropzone, FileRow, Hero, Notice, Panel } from '../components';
import { useI18n, usePageTitle } from '../i18n';
import { useVocalGroup } from '../hooks/useVocalGroup';
import { autoPriceMode, calculatePrice } from '../lib/pricing.mjs';
import { vocals } from '../lib/audio.mjs';
function VocalPanel({ kind, group, time, onTime, price, error, children, threshold }) {
  const { t } = useI18n('cashier');
  const lead = kind === 'lead',
    prefix = lead ? 'left' : 'right';
  const secondsLabel = (value) => `${value.toFixed(2)} ${t('secondsUnit')}`;
  const success = group.entries.filter((entry) => entry.analysis).length;
  const failed = group.entries.filter((entry) => entry.error).length;
  const status = group.error
    ? t(group.error)
    : group.busy
      ? t('analyzingFiles', {
          count: group.entries.filter((entry) => !entry.analysis && !entry.error).length,
        })
      : !group.entries.length
        ? t('noFiles')
        : t('filesSummary', {
            count: success,
            duration: secondsLabel(group.total),
          }) +
          (failed
            ? t('failedFiles', {
                count: failed,
              })
            : '') +
          t(group.manual ? 'manualTime' : group.autoFilled ? 'autoFilled' : 'inputUnchanged');
  return (
    <Panel>
      <div className={cx('section-head', ui.sectionHead)}>
        <h2>{t(lead ? 'leadSection' : 'harmonySection')}</h2>
        <span>{t(lead ? 'leadRate' : 'harmonyRate')}</span>
      </div>
      <Dropzone
        id={`${prefix}FileInput`}
        onFiles={group.addFiles}
        disabled={group.busy}
        title={t(lead ? 'leadUpload' : 'harmonyUpload')}
        hint={t('chooseFiles')}
      />
      <p className={cx('hint', ui.hint)}>{t('uploadHint')}</p>
      <ul
        className={cx('file-list', ui.fileList)}
        id={`${prefix}FileList`}
        aria-label={t(lead ? 'leadFiles' : 'harmonyFiles')}
      >
        <AnimatePresence initial={false}>
          {group.entries.map((entry) => {
            const active = entry.analysis ? vocals.activeSeconds(entry.analysis, threshold) : 0;
            return (
              <FileRow key={entry.id}>
                <div className={cx('file-info', ui.fileInfo)}>
                  <strong className={cx('file-name', ui.fileName)} title={entry.name}>
                    {entry.name}
                  </strong>
                  <span
                    className={`file-meta text-[10px] leading-[1.6] text-quiet ${entry.error ? 'error text-danger!' : ''}`}
                  >
                    {entry.analysis
                      ? t('fileDuration', {
                          active: secondsLabel(active),
                          total: secondsLabel(entry.analysis.totalSeconds),
                        }) + (active === 0 ? t('noVoice') : '')
                      : t(entry.error || 'analyzing')}
                  </span>
                </div>
                <button
                  disabled={group.busy}
                  aria-label={t('removeAria', {
                    name: entry.name,
                  })}
                  onClick={() => group.remove(entry.id)}
                >
                  ×
                </button>
              </FileRow>
            );
          })}
        </AnimatePresence>
      </ul>
      <Notice message={status} error={!!group.error} />
      {!!group.entries.length && (
        <div className={cx('inline-actions', ui.inlineActions)}>
          <button disabled={group.busy || !success} onClick={() => group.refill()}>
            {t('refill')}
          </button>
          <button disabled={group.busy} onClick={group.clear}>
            {t('clear')}
          </button>
        </div>
      )}
      <label htmlFor={`${prefix}Input`}>{t('timeLabel')}</label>
      <input
        id={`${prefix}Input`}
        inputMode="decimal"
        autoComplete="off"
        value={time}
        placeholder={t('timePlaceholder')}
        aria-invalid={!!error}
        aria-describedby={error ? `${prefix}TimeError` : undefined}
        onChange={(event) => {
          group.markManual();
          onTime(event.target.value);
        }}
      />
      {error && (
        <p className="error text-danger!" id={`${prefix}TimeError`}>
          {t(error)}
        </p>
      )}
      {children}
      <div className="price-line mt-6 flex items-baseline justify-between gap-3.5 border-t border-line pt-6 [&>span:first-child]:text-xs [&>span:first-child]:text-muted [&>span:last-child]:text-[28px] [&>span:last-child]:font-bold [&>span:last-child]:tabular-nums">
        <span>{t(lead ? 'leadPrice' : 'harmonyPrice')}</span>
        <AnimatedValue
          id={`${prefix}Result`}
          className={error ? 'error text-danger!' : ''}
          value={error ? t(error) : `¥ ${Number(price.toFixed(2))}`}
        />
      </div>
    </Panel>
  );
}
export default function Cashier() {
  const { t } = useI18n('cashier');
  const [lead, setLead] = useState(''),
    [harmony, setHarmony] = useState('');
  const [threshold, setThreshold] = useState(-60),
    [mode, setMode] = useState('time'),
    [round, setRound] = useState(true);
  const lastLead = useRef('');
  const updateLead = useCallback((value) => {
    if (value.trim() !== lastLead.current) {
      lastLead.current = value.trim();
      setMode(autoPriceMode(value));
    }
    setLead(value);
  }, []);
  const left = useVocalGroup(threshold, updateLead),
    right = useVocalGroup(threshold, setHarmony);

  const price = calculatePrice(lead, harmony, mode, round);
  usePageTitle('title', 'cashier');
  return (
    <>
      <Hero eyebrow={t('kicker')} title={t('heading')} description={t('formula')} />
      <p className="intro-note mb-5 text-xs leading-[1.85] text-muted">{t('audioHelp')}</p>
      <details>
        <summary>{t('thresholdSummary')}</summary>
        <label htmlFor="silenceThreshold">
          {t('thresholdLabel')} {threshold} dBFS
        </label>
        <input
          id="silenceThreshold"
          type="range"
          min="-70"
          max="-20"
          step="1"
          value={threshold}
          onChange={(event) => {
            const value = Number(event.target.value);
            setThreshold(value);
            left.refill(value);
            right.refill(value);
          }}
        />
        <p>{t('thresholdHint')}</p>
      </details>
      <div className={cx('two-column', ui.twoColumn)}>
        <VocalPanel
          kind="lead"
          group={left}
          time={lead}
          onTime={updateLead}
          threshold={threshold}
          price={price.leadPrice}
          error={price.leadError}
        >
          <div className={cx('price-options', ui.priceOptions)}>
            <label>
              <input
                type="checkbox"
                id="leftFixedPrice"
                checked={mode === 'full'}
                onChange={(event) => setMode(event.target.checked ? 'full' : 'time')}
              />
              {t('fullPrice')}
            </label>
            <label>
              <input
                type="checkbox"
                id="leftTwentyPrice"
                checked={mode === 'twenty'}
                onChange={(event) => setMode(event.target.checked ? 'twenty' : 'time')}
              />
              {t('twentyPrice')}
            </label>
          </div>
          <p className={cx('hint', ui.hint)}>{t('autoPriceHint')}</p>
        </VocalPanel>
        <VocalPanel
          kind="harmony"
          group={right}
          time={harmony}
          onTime={setHarmony}
          threshold={threshold}
          price={price.harmonyPrice}
          error={price.harmonyError}
        />
      </div>
      <Panel className={cx('total-card', ui.resultCard)}>
        <div>
          <div className={cx('eyebrow', ui.eyebrow)}>{t('total')}</div>
          <AnimatedValue
            id="totalResult"
            className={`big-result text-[clamp(38px,6vw,62px)] leading-[1.15] font-[750] tracking-[-.05em] text-[#cbbdff] tabular-nums [&_small]:ml-3 [&_small]:text-sm [&_small]:font-medium [&_small]:tracking-normal [&_small]:text-quiet ${price.error ? 'error text-danger!' : ''}`}
            value={price.error ? t('fixInput') : `¥ ${price.total}`}
          />
          {!price.error && round && price.total !== price.original && (
            <p className={cx('hint', ui.hint)}>
              {t('originalPrice')} ¥ {price.original}
            </p>
          )}
        </div>
        <label className={cx('toggle', ui.toggle)}>
          <input
            id="roundTotalToggle"
            type="checkbox"
            checked={round}
            onChange={(event) => setRound(event.target.checked)}
          />
          {t('roundTotal')}
        </label>
      </Panel>
    </>
  );
}
