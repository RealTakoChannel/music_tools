import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { readToolRoute } from './lib/routes.mjs';

export const ToolActivityContext = createContext(true);
export const useToolActive = () => useContext(ToolActivityContext);
const initialTool = readToolRoute(location);
let snapshot = { tool: initialTool, visited: [initialTool] };
const getSnapshot = () => snapshot;
function subscribe(notify) {
  const update = () => {
    const tool = readToolRoute(location);
    if (snapshot.tool !== tool)
      snapshot = {
        tool,
        visited: snapshot.visited.includes(tool) ? snapshot.visited : [...snapshot.visited, tool],
      };
    notify();
  };
  window.addEventListener('hashchange', update);
  update();
  return () => window.removeEventListener('hashchange', update);
}
export function useToolNavigation() {
  const navigation = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [navigation.tool]);
  return navigation;
}
