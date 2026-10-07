import { createContext, useContext, useEffect, useState } from 'react';
import { readToolRoute } from './lib/routes.mjs';

const ToolActivityContext = createContext(true);
export const ToolActivityProvider = ToolActivityContext.Provider;
export const useToolActive = () => useContext(ToolActivityContext);

export function useToolNavigation() {
  const [navigation, setNavigation] = useState(() => {
    const tool = readToolRoute(location);
    return { tool, visited: [tool] };
  });
  useEffect(() => {
    const update = () => {
      const tool = readToolRoute(location);
      setNavigation(current => current.tool === tool ? current : {
        tool,
        visited: current.visited.includes(tool) ? current.visited : [...current.visited, tool],
      });
    };
    window.addEventListener('hashchange', update);
    update();
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [navigation.tool]);
  return navigation;
}
