import { useEffect, useState } from 'react';
import { fetchGitHubStars, starRefreshInterval } from '../lib/github-stars.mjs';

export function useGitHubStars() {
  const [state, setState] = useState(() => ({
    count: null,
    phase: location.protocol === 'file:' || !navigator.onLine ? 'offline' : 'loading',
  }));
  useEffect(() => {
    // Downloaded single-file applications keep their no-network behavior.
    if (location.protocol === 'file:') return;
    let disposed = false,
      controller,
      nextAttempt = 0;
    async function refresh() {
      if (
        disposed ||
        controller ||
        !navigator.onLine ||
        document.visibilityState !== 'visible' ||
        Date.now() < nextAttempt
      )
        return;
      nextAttempt = Date.now() + starRefreshInterval;
      controller = new AbortController();
      const request = controller;
      const timeout = setTimeout(() => request.abort(), 8000);
      try {
        const count = await fetchGitHubStars(request.signal);
        if (!disposed) setState({ count, phase: 'ready' });
      } catch (error) {
        if (!disposed) {
          nextAttempt = Math.max(
            nextAttempt,
            error.retryAt || Date.now() + 5 * starRefreshInterval,
          );
          setState((current) => ({
            ...current,
            phase: current.count === null ? 'unavailable' : 'stale',
          }));
        }
      } finally {
        clearTimeout(timeout);
        controller = null;
      }
    }
    const offline = () =>
      setState((current) => ({ ...current, phase: current.count === null ? 'offline' : 'stale' }));
    refresh();
    const timer = setInterval(refresh, starRefreshInterval);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      clearInterval(timer);
      controller?.abort();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return state;
}
