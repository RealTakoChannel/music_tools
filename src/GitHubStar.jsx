import { useGitHubStars } from './hooks/useGitHubStars';
import { useI18n } from './i18n';
import { repositoryUrl } from './lib/github-stars.mjs';

export default function GitHubStar() {
  const { count, phase } = useGitHubStars();
  const { t } = useI18n();
  const descriptions = {
    loading: '正在获取 GitHub Star 数量…',
    ready: 'GitHub Star 数量，每分钟自动更新',
    unavailable: '暂时无法获取 Star 数量，仍可打开 GitHub 仓库',
    stale: '当前显示上次获取的 Star 数量',
    offline: '离线模式：打开 GitHub 仓库需要联网',
  };
  const label =
    count === null ? t('在 GitHub 上 Star') : t('在 GitHub 上 Star，当前 {count} 个', { count });
  return (
    <a
      href={repositoryUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="github-star inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface/75 px-3 py-1.5 text-[11px] text-muted transition-colors hover:border-accent/60 hover:bg-accent/10 hover:text-ink"
      aria-label={label}
      title={t(descriptions[phase])}
      data-status={phase}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 fill-current">
        <path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.09c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.79 10.79 0 0 1 5.63 0c2.15-1.45 3.1-1.15 3.1-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.03.76 2.09v3.09c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z" />
      </svg>
      <span>Star</span>
      <span className="text-amber-300" aria-hidden="true">
        ★
      </span>
      <span
        className="min-w-5 border-l border-line pl-2 text-center font-semibold text-ink tabular-nums"
        data-star-count
        aria-live="polite"
        aria-atomic="true"
      >
        {count === null
          ? phase === 'loading'
            ? '…'
            : '—'
          : new Intl.NumberFormat('en-US').format(count)}
      </span>
    </a>
  );
}
