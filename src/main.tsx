import ReactDOM from 'react-dom/client';
import App from './App';
import { initAnalytics } from './lib/analytics';
import { installTauriFetchIfNeeded } from './lib/http/installTauriFetch';

async function bootstrap() {
  void initAnalytics();
  await installTauriFetchIfNeeded();
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
}

void bootstrap();