import { motion, useReducedMotion } from 'motion/react';
import { Hero } from '../components';
import { useI18n, usePageTitle } from '../i18n';
import { toolHref } from '../lib/routes.mjs';

const tools = [
  { path: 'audiojoin', glyph: '♫', kicker: 'Audio Joiner', title: '音频合并', description: '拖入多个 WAV，按文件名顺序合并并插入 1–2 秒静音。保留原采样率、位深与声道。', tags: ['无损拼接', '离线处理'], color: 'green' },
  { path: 'bpmcalc', glyph: '120', kicker: 'Tempo Utility', title: 'BPM 修正工具', description: '修正 Half-Time、Double-Time 与 1.5 倍曲速识别，并支持 Tap Tempo 实时测速。', tags: ['BPM 映射', 'TAP TEMPO'], color: 'purple' },
  { path: 'cashier', glyph: '¥', kicker: 'Pricing Utility', title: '混音价格计算器', description: '按主音与和声时长快速计算报价，支持固定价格与五元档快速抹零。', tags: ['价格计算', '快速抹零'], color: 'blue' },
];
export default function Home() {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  usePageTitle('Music Tools · 音乐工具站');
  return <>
    <Hero eyebrow={t('Studio utilities')} title={<>{t('让音乐工作流')}<br/><span className="gradient">{t('更轻一点。')}</span></>} description={t('为日常制作与业务流程准备的小工具合集。无需安装，选择一个工具即可开始。')}/>
    <div className="section-head"><h2>{t('全部工具')}</h2><span>{t('选择卡片进入对应工具')}</span></div>
    <div className="tools">{tools.map((tool, index) => <motion.a key={tool.path} href={toolHref(tool.path)} className={`tool ${tool.color}`} initial={{ opacity: 0, y: reduce ? 0 : 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : index * .09, duration: .35 }} whileHover={reduce ? undefined : { y: -5 }} whileTap={reduce ? undefined : { scale: .985 }}>
      <div className="tool-top"><span className="icon" aria-hidden="true">{tool.glyph}</span><span className="ready">{t('Ready')}</span></div>
      <div className="tool-content"><div className="eyebrow quiet">{t(tool.kicker)}</div><h2>{t(tool.title)}</h2><p>{t(tool.description)}</p></div>
      <div className="tool-footer"><div className="tags">{tool.tags.map(tag => <span key={tag}>{t(tag)}</span>)}</div><span className="arrow" aria-hidden="true">↗</span></div>
    </motion.a>)}</div>
  </>;
}
