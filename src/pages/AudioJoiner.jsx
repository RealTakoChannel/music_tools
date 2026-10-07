import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Dropzone, FileRow, Hero, Notice, Panel } from '../components';
import { useI18n, usePageTitle } from '../i18n';
import { compareByFilename, outputFilename, sizeLabel, timeLabel, wav, yieldToUI } from '../lib/audio.mjs';
import { useToolActive } from '../navigation';

export default function AudioJoiner() {
  const { t, language } = useI18n();
  const active = useToolActive(), audio = useRef(null);
  const [items, setItems] = useState([]), [busy, setBusy] = useState(false);
  const [gap, setGap] = useState(1.5), [enteredName, setEnteredName] = useState('');
  const [result, setResult] = useState(null), [previewError, setPreviewError] = useState(false);
  const [message, setMessage] = useState(null);
  const lock = useRef(false), alive = useRef(true), download = useRef(null);
  const sorted = [...items].sort(compareByFilename), first = sorted[0];
  const incompatible = first && sorted.some(item => wav.differences(first.fmt, item.fmt).length);
  const name = enteredName || first?.file.name.replace(/\.wav$/i, '') || '';
  const filename = outputFilename(name, t('合并音频'));
  const fieldLabel = fields => fields.map(field => t(field)).join(language === 'en' ? ', ' : '、');
  const rateLabel = fmt => `${fmt.rate / 1000} kHz / ${fmt.bits}-bit${fmt.validBits !== fmt.bits ? t('（有效 {bits}）', { bits: fmt.validBits }) : ''}${fmt.encoding === 3 ? ' Float' : ''}`;
  const errorLabel = error => {
    const mismatch = error.message?.match(/^第 (\d+) 个文件的(.+)与第一个文件不一致。$/);
    return mismatch ? t('第 {index} 个文件的{fields}与第一个文件不一致。', { index: mismatch[1], fields: fieldLabel(mismatch[2].split('、')) })
      : Object.hasOwn(globalThis.ToolTranslations.messages, error.message) ? t(error.message) : t('无法读取或处理音频文件，请确认文件完整且格式受支持。');
  };
  usePageTitle(new URLSearchParams(location.search).get('desktop') === '1' ? '音频合并 · 离线桌面工具' : '音频合并 · Music Tools');
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { const url = result?.url; return () => { if (url) URL.revokeObjectURL(url); }; }, [result?.url]);
  useEffect(() => { if (result && active) download.current?.focus({ preventScroll: true }); }, [result]);
  useEffect(() => { if (!active) audio.current?.pause(); }, [active]);
  function invalidate() { setResult(null); setPreviewError(false); setMessage(null); }
  async function addFiles(files) {
    if (!files.length) return;
    if (lock.current) { setMessage({ key: '正在读取或导出，请稍后再添加文件。' }); return; }
    if (items.length + files.length > 500) { setMessage({ key: '一次合并最多支持 500 个文件，请分批处理。', error: true }); return; }
    invalidate(); lock.current = true; setBusy(true);
    const added = [], errors = [];
    try {
      for (const [index, file] of files.entries()) {
        if (!alive.current) return;
        setMessage({ key: '正在读取 {index} / {count}：{name}', values: { index: index + 1, count: files.length, name: file.name } });
        try { const parsed = await wav.parseWav(file); added.push({ ...parsed, id: crypto.randomUUID() }); }
        catch (error) { errors.push({ name: file.name, error }); }
      }
      if (!alive.current) return;
      setItems(current => [...current, ...added]);
      setMessage(errors.length ? { errors, error: true } : null);
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  useEffect(() => {
    if (!active) return;
    const drop = event => {
      if (!event.dataTransfer.files.length || event.target.closest?.('#fileInputDropzone')) return;
      event.preventDefault(); addFiles([...event.dataTransfer.files]);
    };
    window.addEventListener('drop', drop);
    return () => window.removeEventListener('drop', drop);
  });
  async function merge() {
    if (lock.current || !first || incompatible) return;
    lock.current = true; setBusy(true); setMessage({ key: '正在组装音频，保留原始采样数据…' });
    try {
      await yieldToUI();
      const merged = wav.mergeWavs(sorted, gap);
      if (!alive.current) return;
      setResult({ ...merged, count: sorted.length, url: URL.createObjectURL(merged.blob) });
      setPreviewError(false); setMessage(null);
    } catch (error) { if (alive.current) setMessage({ mergeError: error, error: true }); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  let duration = 0, bytes = 0, rf64 = false;
  if (first && !incompatible) {
    const frames = sorted.reduce((sum, item) => sum + item.frames, 0) + Math.round(gap * first.fmt.rate) * (sorted.length - 1);
    duration = frames / first.fmt.rate;
    const header = wav.makeHeader(first.fmt, frames * first.fmt.blockAlign);
    bytes = header.totalSize; rf64 = header.rf64;
  }
  const messageText = message?.errors ? t('以下文件未添加：\n{errors}', { errors: message.errors.map(({ name, error }) => `${name}: ${errorLabel(error)}`).join('\n') })
    : message?.mergeError ? t('合并失败：{error}', { error: errorLabel(message.mergeError) }) : message ? t(message.key, message.values) : '';
  return <>
    <Hero eyebrow={t('A LITTLE SPACE BETWEEN TRACKS')} title={<>{t('把音频，')}<span className="gradient">{t('接在一起。')}</span></>} description={t('拖入 WAV，按文件名自动排序，留一点安静。原始采样数据完整保留。')}/>
    <div className="workspace">
      <Panel aria-labelledby="queueTitle"><div className="section-head"><h2 id="queueTitle">{t('音频队列')} <span className="count" id="count">{items.length}</span></h2><button className="text-button" disabled={busy || !items.length} onClick={() => { setItems([]); setEnteredName(''); invalidate(); }}>{t('清空')}</button></div>
        <Dropzone id="fileInput" accept=".wav,audio/wav,audio/x-wav" disabled={busy} onFiles={addFiles} title={t('拖入多个 WAV 音频')} hint={t('或点击这里选择文件')}/>
        <p className="hint">{t('适合 48 kHz / 24-bit WAV · 支持 PCM 与 Float')}</p>
        {!items.length ? <div className="empty"><span>01 → … → 02 → … → 03</span><p>{t('自动按文件名排序，只在片段之间加入静音。')}</p></div> : <div className="list-head">{t('按文件名升序合并')} · {t('自然排序：2 在 10 前面')}</div>}
        <ol className="file-list" aria-label={t('按文件名升序排列的音频合并顺序')}><AnimatePresence initial={false}>{sorted.map((item, index) => {
          const diff = wav.differences(first.fmt, item.fmt);
          return <FileRow key={item.id}><span className="row-number">{String(index + 1).padStart(2, '0')}</span><div className="file-info"><strong className="file-name" title={item.file.name}>{item.file.name}</strong><span className={`file-meta ${diff.length ? 'error' : ''}`}>{timeLabel(item.duration)} · {rateLabel(item.fmt)} · {t('{count} 声道', { count: item.fmt.channels })}{!!diff.length && ` · ${t('{fields}不一致', { fields: fieldLabel(diff) })}`}</span></div><button disabled={busy} aria-label={t('移除 {name}', { name: item.file.name })} onClick={() => { setItems(current => current.filter(i => i.id !== item.id)); if (items.length === 1) setEnteredName(''); invalidate(); }}>×</button></FileRow>;
        })}</AnimatePresence></ol>
        <Notice message={messageText} error={message?.error}/>
      </Panel>
      <Panel className="settings" aria-labelledby="settingsTitle"><h2 id="settingsTitle">{t('合并设置')}</h2>
        <label htmlFor="gapRange">{t('片段间隔')}</label><div className="gap-display">{gap.toFixed(1)} <small>{t('秒')}</small></div>
        <input id="gapRange" type="range" min="1" max="2" step=".1" value={gap} disabled={busy} onChange={event => { setGap(Number(event.target.value)); invalidate(); }}/>
        <div className="presets">{[1, 1.5, 2].map(value => <button key={value} disabled={busy} aria-pressed={value === gap} onClick={() => { setGap(value); invalidate(); }}>{t(`${value} 秒`)}</button>)}</div>
        <label htmlFor="outputName">{t('输出文件名')}</label><div className="input-suffix"><input id="outputName" value={name} maxLength={120} placeholder={t('默认使用第一个文件名')} disabled={busy} onChange={event => setEnteredName(event.target.value)}/>{!/\.wav$/i.test(name.trim()) && <span>.wav</span>}</div>
        <div className="spec-box"><div><span>{t('输出格式')}</span><strong id="specFormat">{first ? `WAV · ${first.fmt.encoding === 1 ? 'PCM' : 'IEEE Float'}${rf64 ? ' · RF64' : ''}` : t('WAV · 原始参数')}</strong></div><div><span>{t('采样率 / 位深')}</span><strong id="specRate">{first ? rateLabel(first.fmt) : t('等待读取文件')}</strong></div><div><span>{t('声道')}</span><strong>{first ? t('{count} 声道', { count: first.fmt.channels }) : '—'}</strong></div></div>
        <p className={`hint ${incompatible ? 'error' : first ? 'good' : ''}`}>{t(incompatible ? '有文件参数与第一项不一致。请移除这些文件，或换用参数一致的音频后再合并。' : first ? '✓ 所有文件参数一致，原始采样数据将完整保留。' : '所有文件需使用相同的采样率、位深和声道。不同参数会提示，避免自动转换。')}</p>
        <div className="summary"><div><span>{t('预计总时长')}</span><strong id="totalTime">{incompatible ? t('参数不一致') : timeLabel(duration)}</strong></div><div><span>{t('预计文件大小')}</span><strong>{bytes ? sizeLabel(bytes) : '—'}</strong></div></div>
        <button className="primary" id="mergeBtn" disabled={busy || !first || incompatible} onClick={merge}>{t('合并并导出 WAV')} ↗</button><p className="hint">{t('直接拼接采样数据 · 无重采样 · 无重新量化')}</p>
      </Panel>
    </div>
    {result && <Panel className="result"><div className="result-top"><div><div className="eyebrow">{t('ALL TOGETHER')}</div><h2>{t('合并完成')}</h2><p>{t('{count} 个片段 · {duration} · {rate} · {size}', { count: result.count, duration: timeLabel(result.duration), rate: rateLabel(result.fmt), size: sizeLabel(result.blob.size) })}</p></div><a ref={download} id="download" className="primary" href={result.url} download={filename}>{t('保存 WAV 文件')} ↓</a></div><audio ref={audio} controls src={result.url} preload="metadata" aria-label={t('试听合并后的音频')} onError={() => setPreviewError(true)}/><p className="hint">{t(previewError ? '当前浏览器无法试听这个 WAV 编码，仍可保存文件并用音频软件播放。' : result.rf64 ? '已输出 RF64 WAV。浏览器可能无法试听，可下载后在音频软件中打开。' : '试听是否可用取决于浏览器；导出的音频参数不会因试听而改变。')}</p></Panel>}
    <details><summary>{t('关于保留音质与文件格式')}</summary><p>{t('48 kHz / 24-bit WAV 会输出同样的 48 kHz / 24-bit WAV，原始采样字节不变。也支持参数一致的其他常见 PCM / Float WAV。静音时长按采样帧取整，误差不超过半个采样周期。')}</p><p>{t('只合并音频采样数据与必要的格式信息，不合并文件中原有的封面、标记点、BWF 描述、时间码等附加元数据。大于 4 GB 的输出自动使用 RF64（.wav），需播放器或音频软件支持。文件始终在本机处理。')}</p></details>
  </>;
}
