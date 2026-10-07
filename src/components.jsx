import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useI18n } from './i18n';
import { toolHref } from './lib/routes.mjs';

export function Panel({ children, className = '', ...props }) {
  const reduce = useReducedMotion();
  return <motion.section className={`card ${className}`} initial={{ opacity: 0, y: reduce ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .32 }} {...props}>{children}</motion.section>;
}
export function AnimatedValue({ value, className = '', ...props }) {
  const reduce = useReducedMotion();
  return <span className={className} {...props}><AnimatePresence mode="wait" initial={false}><motion.span key={String(value)} initial={{ opacity: .4, y: reduce ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}>{value}</motion.span></AnimatePresence></span>;
}
export function FileRow({ children, ...props }) {
  const reduce = useReducedMotion();
  return <motion.li className="file-row" layout={!reduce} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .18 }} {...props}>{children}</motion.li>;
}
export function Notice({ message, error = false }) {
  return <div role="status" aria-live="polite" className={`notice ${error ? 'error' : ''}`}>{message}</div>;
}
export function Dropzone({ id, accept = 'audio/*,.wav,.mp3,.m4a,.flac,.ogg', multiple = true, disabled = false, onFiles, title, hint, children }) {
  const input = useRef(null);
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  const isFiles = event => [...event.dataTransfer.types].includes('Files');
  useEffect(() => {
    const prevent = event => { if ([...event.dataTransfer.types].includes('Files')) event.preventDefault(); };
    const reset = () => { depth.current = 0; setOver(false); };
    const leave = event => { if (!event.relatedTarget && (event.target === document.documentElement || event.target === document.body || event.target === document)) reset(); };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    window.addEventListener('drop', reset);
    window.addEventListener('dragend', reset);
    window.addEventListener('dragleave', leave);
    return () => { window.removeEventListener('dragover', prevent); window.removeEventListener('drop', prevent); window.removeEventListener('drop', reset); window.removeEventListener('dragend', reset); window.removeEventListener('dragleave', leave); };
  }, []);
  return <div className={`dropzone ${over ? 'over' : ''}`} id={`${id}Dropzone`} aria-busy={disabled}
    onDragEnter={event => { if (isFiles(event)) { event.preventDefault(); depth.current++; setOver(true); } }}
    onDragOver={event => { if (isFiles(event)) event.preventDefault(); }}
    onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); }}
    onDrop={event => { if (!isFiles(event)) return; event.preventDefault(); depth.current = 0; setOver(false); if (event.dataTransfer.files.length) onFiles([...event.dataTransfer.files]); }}>
    <input ref={input} id={id} type="file" accept={accept} multiple={multiple} disabled={disabled} hidden onChange={event => { onFiles([...event.target.files]); event.target.value = ''; }} />
    <motion.button type="button" className="drop-button" disabled={disabled} onClick={() => input.current.click()} whileTap={{ scale: .985 }}>
      <span className="drop-icon" aria-hidden="true">↥</span><strong>{title}</strong><span>{hint}</span>
    </motion.button>{children}
  </div>;
}
export function Header({ home = false }) {
  const { t, language, setLanguage } = useI18n();
  return <nav className="topbar" aria-label={t(home ? '站点导航' : '工具导航')}>
    <a className="brand" href={toolHref('home')} aria-label={home ? 'Music Tools' : t('返回主界面')}>
      <span className="brand-mark" aria-hidden="true"><i/><i/><i/></span><span>Music Tools</span>{!home && <span className="back-label">/ {t('返回主界面')}</span>}
    </a>
    <div className="nav-actions"><span className="local"><i/>{t('离线 · 本机处理')}</span>
      <div className="language-switch" role="group" aria-label={t('界面语言')}>
        {[['zh', '中文'], ['ja', '日本語'], ['en', 'English']].map(([key, label]) => <button key={key} type="button" data-language={key} aria-pressed={language === key} onClick={() => setLanguage(key)}>{label}</button>)}
      </div>
    </div>
  </nav>;
}
export function ToolNavigation({ activeTool }) {
  const { t } = useI18n();
  const links = [['home', '⌂', '全部工具'], ['audiojoin', '♫', '音频合并'], ['bpmcalc', '120', 'BPM 修正工具'], ['cashier', '¥', '混音价格计算器']];
  return <nav className="app-navigation" aria-label={t('工具导航')}>
    {links.map(([id, glyph, label]) => <a key={id} id={`tool-link-${id}`} className="app-nav-link" href={toolHref(id)} aria-current={activeTool === id ? 'page' : undefined}>
      {activeTool === id && <motion.span layoutId="active-tool" className="nav-indicator" aria-hidden="true"/>}
      <span className="nav-glyph" aria-hidden="true">{glyph}</span><span>{t(label)}</span>
    </a>)}
  </nav>;
}
export function Hero({ eyebrow, title, description }) {
  return <header className="hero"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></header>;
}
