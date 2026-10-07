import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { AnimatedValue, Dropzone, FileRow, Hero, Notice, Panel } from '../components';
import { useI18n, usePageTitle } from '../i18n';
import { useVocalGroup } from '../hooks/useVocalGroup';
import { autoPriceMode, calculatePrice } from '../lib/pricing.mjs';
import { vocals } from '../lib/audio.mjs';

function VocalPanel({ kind, group, time, onTime, price, error, children, threshold }) {
  const { t } = useI18n('cashier');
  const lead = kind === 'lead', prefix = lead ? 'left' : 'right';
  const secondsLabel = value => `${value.toFixed(2)} ${t('secondsUnit')}`;
  const success = group.entries.filter(entry => entry.analysis).length;
  const failed = group.entries.filter(entry => entry.error).length;
  const status = group.error ? t(group.error) : group.busy ? t('analyzingFiles', { count: group.entries.filter(entry => !entry.analysis && !entry.error).length })
    : !group.entries.length ? t('noFiles') : t('filesSummary', { count: success, duration: secondsLabel(group.total) }) + (failed ? t('failedFiles', { count: failed }) : '') + t(group.manual ? 'manualTime' : group.autoFilled ? 'autoFilled' : 'inputUnchanged');
  return <Panel><div className="section-head"><h2>{t(lead ? 'leadSection' : 'harmonySection')}</h2><span>{t(lead ? 'leadRate' : 'harmonyRate')}</span></div>
    <Dropzone id={`${prefix}FileInput`} onFiles={group.addFiles} disabled={group.busy} title={t(lead ? 'leadUpload' : 'harmonyUpload')} hint={t('chooseFiles')}/><p className="hint">{t('uploadHint')}</p>
    <ul className="file-list" id={`${prefix}FileList`} aria-label={t(lead ? 'leadFiles' : 'harmonyFiles')}><AnimatePresence initial={false}>{group.entries.map(entry => {
      const active = entry.analysis ? vocals.activeSeconds(entry.analysis, threshold) : 0;
      return <FileRow key={entry.id}><div className="file-info"><strong className="file-name" title={entry.name}>{entry.name}</strong><span className={`file-meta ${entry.error ? 'error' : ''}`}>{entry.analysis ? t('fileDuration', { active: secondsLabel(active), total: secondsLabel(entry.analysis.totalSeconds) }) + (active === 0 ? t('noVoice') : '') : t(entry.error || 'analyzing')}</span></div><button disabled={group.busy} aria-label={t('removeAria', { name: entry.name })} onClick={() => group.remove(entry.id)}>×</button></FileRow>;
    })}</AnimatePresence></ul>
    <Notice message={status} error={!!group.error}/>
    {!!group.entries.length && <div className="inline-actions"><button disabled={group.busy || !success} onClick={group.refill}>{t('refill')}</button><button disabled={group.busy} onClick={group.clear}>{t('clear')}</button></div>}
    <label htmlFor={`${prefix}Input`}>{t('timeLabel')}</label><input id={`${prefix}Input`} inputMode="decimal" autoComplete="off" value={time} placeholder={t('timePlaceholder')} aria-invalid={!!error} aria-describedby={error ? `${prefix}TimeError` : undefined} onChange={event => { group.markManual(); onTime(event.target.value); }}/>
    {error && <p className="error" id={`${prefix}TimeError`}>{t(error)}</p>}{children}
    <div className="price-line"><span>{t(lead ? 'leadPrice' : 'harmonyPrice')}</span><AnimatedValue id={`${prefix}Result`} className={error ? 'error' : ''} value={error ? t(error) : `¥ ${Number(price.toFixed(2))}`}/></div>
  </Panel>;
}
export default function Cashier() {
  const { t } = useI18n('cashier');
  const [lead, setLead] = useState(''), [harmony, setHarmony] = useState('');
  const [threshold, setThreshold] = useState(-60), [mode, setMode] = useState('time'), [round, setRound] = useState(true);
  const lastLead = useRef('');
  function updateLead(value) {
    if (value.trim() !== lastLead.current) { lastLead.current = value.trim(); setMode(autoPriceMode(value)); }
    setLead(value);
  }
  const left = useVocalGroup(threshold, updateLead), right = useVocalGroup(threshold, setHarmony);
  const previousThreshold = useRef(threshold);
  useEffect(() => {
    if (threshold !== previousThreshold.current) { previousThreshold.current = threshold; left.refill(); right.refill(); }
  }, [threshold]);
  const price = calculatePrice(lead, harmony, mode, round);
  usePageTitle('title', 'cashier');
  return <>
    <Hero eyebrow={t('kicker')} title={t('heading')} description={t('formula')}/>
    <p className="intro-note">{t('audioHelp')}</p>
    <details><summary>{t('thresholdSummary')}</summary><label htmlFor="silenceThreshold">{t('thresholdLabel')} {threshold} dBFS</label><input id="silenceThreshold" type="range" min="-70" max="-20" step="1" value={threshold} onChange={event => setThreshold(Number(event.target.value))}/><p>{t('thresholdHint')}</p></details>
    <div className="two-column">
      <VocalPanel kind="lead" group={left} time={lead} onTime={updateLead} threshold={threshold} price={price.leadPrice} error={price.leadError}>
        <div className="price-options"><label><input type="checkbox" id="leftFixedPrice" checked={mode === 'full'} onChange={event => setMode(event.target.checked ? 'full' : 'time')}/>{t('fullPrice')}</label><label><input type="checkbox" id="leftTwentyPrice" checked={mode === 'twenty'} onChange={event => setMode(event.target.checked ? 'twenty' : 'time')}/>{t('twentyPrice')}</label></div><p className="hint">{t('autoPriceHint')}</p>
      </VocalPanel>
      <VocalPanel kind="harmony" group={right} time={harmony} onTime={setHarmony} threshold={threshold} price={price.harmonyPrice} error={price.harmonyError}/>
    </div>
    <Panel className="total-card"><div><div className="eyebrow">{t('total')}</div><AnimatedValue id="totalResult" className={`big-result ${price.error ? 'error' : ''}`} value={price.error ? t('fixInput') : `¥ ${price.total}`}/>{!price.error && round && price.total !== price.original && <p className="hint">{t('originalPrice')} ¥ {price.original}</p>}</div><label className="toggle"><input id="roundTotalToggle" type="checkbox" checked={round} onChange={event => setRound(event.target.checked)}/>{t('roundTotal')}</label></Panel>
  </>;
}
