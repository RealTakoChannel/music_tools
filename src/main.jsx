import { Component, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, MotionConfig, useReducedMotion } from 'motion/react';
import { LanguageProvider, useI18n } from './i18n';
import { Header, ToolNavigation } from './components';
import { ToolActivityProvider, useToolNavigation } from './navigation';
import './styles.css';

const Home = lazy(() => import('./pages/Home'));
const pages = { home: Home, audiojoin: lazy(() => import('./pages/AudioJoiner')), bpmcalc: lazy(() => import('./pages/Tempo')), cashier: lazy(() => import('./pages/Cashier')) };
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() { return this.state.error ? <div role="alert" className="card"><p>{this.props.label}</p><button onClick={() => location.reload()}>{this.props.reload}</button></div> : this.props.children; }
}
function App() {
  const { tool, visited } = useToolNavigation();
  const reduce = useReducedMotion();
  const { t } = useI18n();
  return <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 300, damping: 28 }}><main className={`page page-${tool}`}>
    <Header home={tool === 'home'}/><ToolNavigation activeTool={tool}/>
    {visited.map(id => {
      const Page = pages[id], active = id === tool;
      return <ToolActivityProvider key={id} value={active}>
        <motion.div id={`tool-view-${id}`} data-view={id} className="tool-view" hidden={!active} role="region" aria-labelledby={`tool-link-${id}`}
          initial={{ opacity: 0 }} animate={{ opacity: active ? 1 : 0, y: active || reduce ? 0 : 8 }} transition={{ duration: reduce ? 0 : .18 }}>
          <ErrorBoundary label={t('无法读取或处理音频文件，请确认文件完整且格式受支持。')} reload={t('重置')}>
            <Suspense fallback={<p role="status" className="hint">{t('正在加载工具…')}</p>}><Page/></Suspense>
          </ErrorBoundary>
        </motion.div>
      </ToolActivityProvider>;
    })}
    <footer><span>{t('Made for a smoother session')}</span><span>Music Tools</span></footer>
  </main></MotionConfig>;
}
createRoot(document.getElementById('root')).render(<LanguageProvider><App/></LanguageProvider>);
