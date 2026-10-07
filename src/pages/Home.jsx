import { ui, cx } from '../ui/styles';
import { motion, useReducedMotion } from 'motion/react';
import { Hero } from '../components';
import { useI18n, usePageTitle } from '../i18n';
import { toolHref } from '../lib/routes.mjs';
const tools = [
  {
    path: 'audiojoin',
    glyph: '♫',
    kicker: 'Audio Joiner',
    title: '音频合并',
    description: '拖入多个 WAV，按文件名顺序合并并插入 1–2 秒静音。保留原采样率、位深与声道。',
    tags: ['无损拼接', '离线处理'],
    color: 'green',
    theme: 'hover:border-mint/40 before:bg-[radial-gradient(circle,#43e6a426,transparent_65%)]',
    icon: 'border-mint/20 bg-mint/5 text-mint',
  },
  {
    path: 'bpmcalc',
    glyph: '120',
    kicker: 'Tempo Utility',
    title: 'BPM 修正工具',
    description: '修正 Half-Time、Double-Time 与 1.5 倍曲速识别，并支持 Tap Tempo 实时测速。',
    tags: ['BPM 映射', 'TAP TEMPO'],
    color: 'purple',
    theme: 'hover:border-accent/40',
    icon: 'border-accent/20 bg-accent/5 text-accent',
  },
  {
    path: 'cashier',
    glyph: '¥',
    kicker: 'Pricing Utility',
    title: '混音价格计算器',
    description: '按主音与和声时长快速计算报价，支持固定价格与五元档快速抹零。',
    tags: ['价格计算', '快速抹零'],
    color: 'blue',
    theme: 'hover:border-sky/40 before:bg-[radial-gradient(circle,#78b7ff26,transparent_65%)]',
    icon: 'border-sky/20 bg-sky/5 text-sky',
  },
];
export default function Home() {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  usePageTitle('Music Tools · 音乐工具站');
  return (
    <>
      <Hero
        large
        eyebrow={t('Studio utilities')}
        title={
          <>
            {t('让音乐工作流')}
            <br />
            <span className={cx('gradient', ui.gradient)}>{t('更轻一点。')}</span>
          </>
        }
        description={t('为日常制作与业务流程准备的小工具合集。无需安装，选择一个工具即可开始。')}
      />
      <div className={cx('section-head', ui.sectionHead)}>
        <h2>{t('全部工具')}</h2>
        <span>{t('选择卡片进入对应工具')}</span>
      </div>
      <div className="tools grid grid-cols-1 gap-[17px] sm:grid-cols-2 md:grid-cols-3">
        {tools.map((tool, index) => (
          <motion.a
            key={tool.path}
            href={toolHref(tool.path)}
            className={`tool relative flex min-h-[290px] flex-col overflow-hidden rounded-[22px] border border-line bg-surface bg-[linear-gradient(150deg,#ffffff03,transparent)] p-[25px] sm:min-h-[320px] md:min-h-[340px] before:pointer-events-none before:absolute before:-top-[100px] before:-right-[110px] before:h-[200px] before:w-[240px] before:bg-[radial-gradient(circle,#9b7cff26,transparent_65%)] [&_h2]:m-0 [&_h2]:text-[26px] [&_h2]:leading-[1.2] [&_h2]:tracking-[-.03em] sm:[&_h2]:text-[clamp(21px,2.3vw,27px)] [&_p]:mt-3 [&_p]:mb-[22px] [&_p]:text-xs [&_p]:leading-[1.8] [&_p]:text-muted ${tool.color} ${tool.theme}`}
            initial={{
              opacity: 0,
              y: reduce ? 0 : 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: reduce ? 0 : index * 0.09,
              duration: 0.35,
            }}
            whileHover={
              reduce
                ? undefined
                : {
                    y: -5,
                  }
            }
            whileTap={
              reduce
                ? undefined
                : {
                    scale: 0.985,
                  }
            }
          >
            <div className="tool-top flex items-center justify-between gap-3">
              <span
                className={cx(
                  'icon grid size-12 place-items-center rounded-[15px] border text-[17px] font-extrabold',
                  tool.icon,
                )}
                aria-hidden="true"
              >
                {tool.glyph}
              </span>
              <span className="ready inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[.08em] text-quiet before:size-[5px] before:rounded-full before:bg-mint">
                {t('Ready')}
              </span>
            </div>
            <div className="tool-content mt-8 flex-1 sm:mt-[46px]">
              <div className="eyebrow mb-[13px] text-[9px] font-[750] uppercase tracking-[.12em] text-quiet">
                {t(tool.kicker)}
              </div>
              <h2>{t(tool.title)}</h2>
              <p>{t(tool.description)}</p>
            </div>
            <div className="tool-footer flex items-center justify-between gap-3 border-t border-line pt-4">
              <div className="tags flex flex-wrap gap-1.5 [&_span]:rounded-full [&_span]:border [&_span]:border-line [&_span]:px-[7px] [&_span]:py-[5px] [&_span]:text-[9px] [&_span]:text-quiet">
                {tool.tags.map((tag) => (
                  <span key={tag}>{t(tag)}</span>
                ))}
              </div>
              <span
                className="arrow grid size-[30px] place-items-center rounded-full border border-line text-[17px] text-muted"
                aria-hidden="true"
              >
                ↗
              </span>
            </div>
          </motion.a>
        ))}
      </div>
    </>
  );
}
