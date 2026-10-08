export const repositoryUrl = 'https://github.com/RealTakoChannel/music_tools';
export const repositoryApi = 'https://api.github.com/repos/RealTakoChannel/music_tools';
export const starRefreshInterval = 60_000;

export async function fetchGitHubStars(signal, fetcher = fetch, now = Date.now()) {
  const response = await fetcher(repositoryApi, {
    signal,
    cache: 'no-store',
    credentials: 'omit',
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) {
    const error = new Error(`GitHub request failed (${response.status})`);
    const retrySeconds = Number(response.headers.get('retry-after'));
    const resetSeconds = Number(response.headers.get('x-ratelimit-reset'));
    error.retryAt = Math.max(
      now + 5 * starRefreshInterval,
      Number.isFinite(retrySeconds) ? now + retrySeconds * 1000 : 0,
      (response.status === 403 || response.status === 429) && Number.isFinite(resetSeconds)
        ? resetSeconds * 1000
        : 0,
    );
    throw error;
  }
  const { stargazers_count: count } = await response.json();
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid GitHub star count');
  return count;
}
