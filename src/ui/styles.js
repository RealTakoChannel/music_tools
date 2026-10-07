// Shared Tailwind utilities. Keep complete class names so Tailwind can scan them.
export const ui = {
  page: 'mx-auto w-[calc(100%-28px)] max-w-[1100px] pt-[22px] pb-7 sm:w-[calc(100%-48px)] sm:pt-9',
  card: 'min-w-0 rounded-[20px] border border-line bg-surface bg-[linear-gradient(145deg,#ffffff02,transparent)] p-5 sm:p-6.5',
  sectionHead:
    'mb-5 flex items-center justify-between gap-3.5 [&>h2]:mb-0 [&>span]:text-[10px] [&>span]:text-quiet',
  hint: 'my-3 text-[11px] leading-[1.85] text-quiet',
  eyebrow: 'mb-[13px] text-[10px] font-[750] uppercase tracking-[.12em] text-mint',
  gradient:
    'bg-[linear-gradient(105deg,#c7b9ff,#a28bf5_55%,#61dcb1)] bg-clip-text text-transparent',
  twoColumn: 'mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2',
  primary:
    'inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-[11px] border border-accent bg-accent px-5 py-[13px] text-center text-xs font-bold text-[#111522] transition-colors hover:enabled:bg-[#c7b6ff] disabled:cursor-not-allowed disabled:opacity-45',
  fileList: 'm-0 list-none p-0',
  fileInfo: 'flex min-w-0 flex-1 flex-col gap-[7px]',
  fileName: 'truncate text-xs font-semibold',
  fileMeta: 'text-[10px] leading-[1.6] text-quiet',
  removeButton: 'size-7 shrink-0 rounded-[10px] border-[#30384980] bg-transparent p-0 text-lg',
  inlineActions: 'flex flex-wrap items-center gap-2 [&_.hint]:m-0',
  inputGrid: 'grid grid-cols-2 gap-3.5 [&_label]:mt-0 [&_input]:text-[22px] [&_input]:tabular-nums',
  resultCard:
    'mt-5 flex flex-wrap items-center justify-between gap-5 bg-[linear-gradient(110deg,#9b7cff13,#11141c)] sm:flex-nowrap',
  bigResult:
    'text-[clamp(38px,6vw,62px)] leading-[1.15] font-[750] tracking-[-.05em] text-[#cbbdff] tabular-nums [&_small]:ml-3 [&_small]:text-sm [&_small]:font-medium [&_small]:tracking-normal [&_small]:text-quiet',
  priceOptions:
    'flex flex-wrap gap-2.5 [&_label]:mt-3.5 [&_label]:inline-flex [&_label]:items-center [&_label]:gap-[9px] [&_label]:rounded-[9px] [&_label]:border [&_label]:border-line [&_label]:bg-[#0b0e1559] [&_label]:px-3 [&_label]:py-[9px]',
  toggle: 'm-0 inline-flex items-center gap-[9px]',
};
export const cx = (...classes) => classes.filter(Boolean).join(' ');
