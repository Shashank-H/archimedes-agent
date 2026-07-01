import { Link, useLocation } from 'react-router-dom';
import { AppTooltip } from '../AppTooltip';
import { Icon } from './icons';

export function AssistantHeader({ status }: { status: string }) {
  const location = useLocation();
  const isSettings = location.pathname.includes('/settings');
  return (
    <header className="assistant-header">
      <div className="assistant-title">
        <span className="assistant-mark">
          <img className="logo-light" src="/logos/logo-light.svg" alt="" aria-hidden="true" />
          <img className="logo-dark" src="/logos/logo-dark.svg" alt="" aria-hidden="true" />
        </span>
        <div className="assistant-title-copy">
          <div className="assistant-heading-row">
            <h1>Archimedes Agent</h1>
            <div className="assistant-header-actions">
              <AppTooltip label={isSettings ? 'Back to chat' : 'Settings'}>
                <Link
                  className="settings-toggle"
                  to={isSettings ? '/chat' : '/settings'}
                  aria-label={isSettings ? 'Back to chat' : 'Open settings'}
                >
                  <Icon name={isSettings ? 'message' : 'settings'} size={15} />
                  <span>{isSettings ? 'Chat' : 'Settings'}</span>
                </Link>
              </AppTooltip>
            </div>
          </div>
          <p>{status}</p>
        </div>
      </div>
    </header>
  );
}
