import { ui, cx } from './ui/styles';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useI18n } from './i18n';
import { toolHref } from './lib/routes.mjs';
import GitHubStar from './GitHubStar';
export function Panel({ children, className = '', ...props }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      className={cx('card', ui.card, className)}
      initial={{
        opacity: 0,
        y: reduce ? 0 : 14,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.32,
      }}
      {...props}
    >
      {children}
    </motion.section>
  );
}
export function AnimatedValue({ value, className = '', ...props }) {
  const reduce = useReducedMotion();
  return (
    <span className={className} {...props}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={String(value)}
          initial={{
            opacity: 0.4,
            y: reduce ? 0 : 6,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
          }}
          transition={{
            duration: 0.12,
          }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
export function FileRow({ children, ...props }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      className="file-row flex items-center gap-3 border-b border-line/50 py-4 [&_button]:size-7 [&_button]:shrink-0 [&_button]:border-[#30384980] [&_button]:bg-transparent [&_button]:p-0 [&_button]:text-lg"
      layout={!reduce}
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
      transition={{
        duration: 0.18,
      }}
      {...props}
    >
      {children}
    </motion.li>
  );
}
export function Notice({ message, error = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`notice py-3 text-[11px] leading-[1.8] whitespace-pre-wrap text-muted wrap-anywhere empty:hidden ${error ? 'error text-danger!' : ''}`}
    >
      {message}
    </div>
  );
}
export function Dropzone({
  id,
  accept = 'audio/*,.wav,.mp3,.m4a,.flac,.ogg',
  multiple = true,
  disabled = false,
  onFiles,
  title,
  hint,
  children,
}) {
  const input = useRef(null);
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  const isFiles = (event) => [...event.dataTransfer.types].includes('Files');
  useEffect(() => {
    const prevent = (event) => {
      if ([...event.dataTransfer.types].includes('Files')) event.preventDefault();
    };
    const reset = () => {
      depth.current = 0;
      setOver(false);
    };
    const leave = (event) => {
      if (
        !event.relatedTarget &&
        (event.target === document.documentElement ||
          event.target === document.body ||
          event.target === document)
      )
        reset();
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    window.addEventListener('drop', reset);
    window.addEventListener('dragend', reset);
    window.addEventListener('dragleave', leave);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
      window.removeEventListener('drop', reset);
      window.removeEventListener('dragend', reset);
      window.removeEventListener('dragleave', leave);
    };
  }, []);
  return (
    <div
      className={`dropzone rounded-2xl border border-dashed border-[#343d50] bg-[#0b0e1580] transition-colors ${over ? 'over border-accent! bg-[#9b7cff14]!' : ''}`}
      id={`${id}Dropzone`}
      aria-busy={disabled}
      onDragEnter={(event) => {
        if (isFiles(event)) {
          event.preventDefault();
          depth.current++;
          setOver(true);
        }
      }}
      onDragOver={(event) => {
        if (isFiles(event)) event.preventDefault();
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setOver(false);
      }}
      onDrop={(event) => {
        if (!isFiles(event)) return;
        event.preventDefault();
        depth.current = 0;
        setOver(false);
        if (event.dataTransfer.files.length) onFiles([...event.dataTransfer.files]);
      }}
    >
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        hidden
        onChange={(event) => {
          onFiles([...event.target.files]);
          event.target.value = '';
        }}
      />
      <motion.button
        type="button"
        className="drop-button flex w-full flex-col items-center gap-[9px] rounded-[inherit] border-0 bg-transparent px-[18px] py-6.5 hover:enabled:bg-white/2 [&_strong]:text-sm [&_strong]:text-[#e3e9f5] [&_strong]:wrap-anywhere [&>span:last-child]:text-[11px] [&>span:last-child]:leading-[1.8] [&>span:last-child]:text-quiet"
        disabled={disabled}
        onClick={() => input.current.click()}
        whileTap={{
          scale: 0.985,
        }}
      >
        <span
          className="drop-icon mb-1 grid size-10 place-items-center rounded-xl bg-[#43e6a411] text-[30px] text-mint"
          aria-hidden="true"
        >
          ↥
        </span>
        <strong>{title}</strong>
        <span>{hint}</span>
      </motion.button>
      {children}
    </div>
  );
}
export function Header({ home = false }) {
  const { t, language, setLanguage } = useI18n();
  return (
    <nav
      className="topbar flex min-h-[38px] flex-wrap items-center justify-between gap-x-5 gap-y-3 max-[380px]:gap-x-2"
      aria-label={t(home ? '站点导航' : '工具导航')}
    >
      <a
        className="brand inline-flex items-center gap-2.5 whitespace-nowrap text-sm font-[750] max-[380px]:gap-[7px] max-[380px]:text-xs"
        href={toolHref('home')}
        aria-label={home ? 'Music Tools' : t('返回主界面')}
      >
        <span
          className="brand-mark flex size-9 items-end justify-center gap-[3px] rounded-[11px] border border-[#9b7cff40] bg-[linear-gradient(140deg,#9b7cff33,#43e6a40f)] p-[9px] max-[380px]:size-[30px] max-[380px]:p-1.5 [&_i]:h-[9px] [&_i]:w-[3px] [&_i]:rounded-[3px] [&_i]:bg-accent [&_i:nth-child(2)]:h-[17px] [&_i:nth-child(2)]:bg-mint [&_i:nth-child(3)]:h-3 [&_i:nth-child(3)]:bg-sky"
          aria-hidden="true"
        >
          <i />
          <i />
          <i />
        </span>
        <span>Music Tools</span>
        {!home && (
          <span className="back-label hidden text-[11px] font-medium text-muted sm:inline">
            / {t('返回主界面')}
          </span>
        )}
      </a>
      <div className="nav-actions ml-auto flex flex-wrap items-center justify-end gap-2.5 md:gap-[18px]">
        <span className="local hidden items-center gap-[7px] text-[10px] text-quiet md:inline-flex [&_i]:size-[5px] [&_i]:rounded-full [&_i]:bg-mint">
          <i />
          {t('离线 · 本机处理')}
        </span>
        <div
          className="language-switch inline-flex gap-[3px] rounded-xl border border-line bg-surface/75 p-1 [&_button]:rounded-lg [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-2 [&_button]:py-1.5 [&_button]:text-[10px] [&_button]:text-quiet [&_button[aria-pressed=true]]:bg-[#2a233f] [&_button[aria-pressed=true]]:text-[#d3c7ff] max-[380px]:[&_button]:px-1.5 max-[380px]:[&_button]:text-[9px]"
          role="group"
          aria-label={t('界面语言')}
        >
          {[
            ['zh', '中文'],
            ['ja', '日本語'],
            ['en', 'English'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              data-language={key}
              aria-pressed={language === key}
              onClick={() => setLanguage(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <GitHubStar />
      </div>
    </nav>
  );
}
export function ToolNavigation({ activeTool }) {
  const { t } = useI18n();
  const links = [
    ['home', '⌂', '全部工具'],
    ['audiojoin', '♫', '音频合并'],
    ['bpmcalc', '120', 'BPM 修正工具'],
    ['cashier', '¥', '混音价格计算器'],
  ];
  return (
    <nav
      className="app-navigation mt-5 grid grid-cols-2 gap-1.5 rounded-[15px] border border-line bg-surface/75 p-1.5 sm:mt-6.5 sm:grid-cols-4"
      aria-label={t('工具导航')}
    >
      {links.map(([id, glyph, label]) => (
        <a
          key={id}
          id={`tool-link-${id}`}
          className="app-nav-link relative flex min-h-11 items-center justify-center gap-2.5 rounded-[10px] px-2 py-2.5 text-[11px] text-muted hover:bg-white/2 hover:text-ink aria-[current=page]:text-[#d6cbff] sm:px-2.5 sm:py-[13px] sm:text-xs [&>span:not(.nav-indicator)]:relative [&>span:not(.nav-indicator)]:z-1"
          href={toolHref(id)}
          aria-current={activeTool === id ? 'page' : undefined}
        >
          {activeTool === id && (
            <motion.span
              layoutId="active-tool"
              className="nav-indicator absolute inset-0 rounded-[inherit] border border-[#9b7cff35] bg-[#9b7cff1a]"
              aria-hidden="true"
            />
          )}
          <span className="nav-glyph text-sm font-[750] text-accent" aria-hidden="true">
            {glyph}
          </span>
          <span>{t(label)}</span>
        </a>
      ))}
    </nav>
  );
}
export function Hero({ eyebrow, title, description, large = false }) {
  return (
    <header className={cx('hero pt-[42px] pb-[34px] sm:pt-16', large && 'sm:pb-12')}>
      <div className={cx('eyebrow', ui.eyebrow)}>{eyebrow}</div>
      <h1
        className={cx(
          'm-0 font-[750] tracking-[-.045em]',
          large
            ? 'text-[clamp(38px,6.4vw,68px)] leading-[1.12]'
            : 'text-[clamp(32px,4.5vw,50px)] leading-[1.15]',
        )}
      >
        {title}
      </h1>
      <p className="mt-4 max-w-[650px] text-[13px] leading-[1.85] text-muted">{description}</p>
    </header>
  );
}
