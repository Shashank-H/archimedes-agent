import { Icon } from '../../../components/ui/icons';
import type { useChatGptSubscriptionAuth } from '../../../hooks/useChatGptSubscriptionAuth';

type ChatGptSubscriptionAuth = ReturnType<typeof useChatGptSubscriptionAuth>;

type ChatGptSubscriptionAuthCardProps = {
  auth: ChatGptSubscriptionAuth;
  isBusy: boolean;
};

export function ChatGptSubscriptionAuthCard({ auth, isBusy }: ChatGptSubscriptionAuthCardProps) {
  return (
    <div className="oauth-settings-card">
      <div>
        <strong>ChatGPT subscription sign-in</strong>
        <p>
          {auth.credentials
            ? `Signed in as ${auth.signedInLabel}.`
            : 'Use the Codex device-code OAuth flow for ChatGPT Plus/Pro access.'}
        </p>
      </div>
      {auth.deviceCodeInfo && (
        <div className="oauth-device-code">
          <span>Code copied to clipboard — paste at {auth.deviceCodeInfo.verificationUri}</span>
          <strong>{auth.deviceCodeInfo.userCode}</strong>
        </div>
      )}
      {auth.error && <p className="settings-field-error">{auth.error}</p>}
      <div className="oauth-actions">
        <button type="button" onClick={auth.signIn} disabled={auth.isSigningIn || isBusy}>
          <Icon name="plug" size={15} />
          {auth.credentials ? 'Reconnect' : auth.isSigningIn ? 'Waiting for login...' : 'Sign in'}
        </button>
        {auth.deviceCodeInfo && (
          <button type="button" className="secondary-settings-button" onClick={auth.openDeviceCodeUrl}>
            Open browser
          </button>
        )}
        {auth.isSigningIn && (
          <button type="button" className="secondary-settings-button" onClick={auth.cancelSignIn}>
            Cancel
          </button>
        )}
        {auth.credentials && (
          <button type="button" className="secondary-settings-button" onClick={auth.signOut}>
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}