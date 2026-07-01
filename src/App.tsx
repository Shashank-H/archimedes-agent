import { AssistantPaneRouter } from './app/router';
import { WorkspacePage } from './pages/workspace/WorkspacePage';
import { AppProviders } from './providers/AppProviders';
import './styles.css';

export default function App() {
  return (
    <AppProviders>
      <WorkspacePage>
        <AssistantPaneRouter />
      </WorkspacePage>
    </AppProviders>
  );
}
