type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

type PostHogClient = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  opt_in_capturing?: () => void;
  opt_out_capturing?: () => void;
};

const POSTHOG_ENABLED = import.meta.env.VITE_POSTHOG_ENABLED === 'true';
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
const SETTINGS_KEY = 'archimedes-agent.settings.v1';

let initialized = false;
let posthogClient: PostHogClient | null = null;
let usageLogsAllowed = loadUsageLogsPreference();

function loadUsageLogsPreference() {
  if (typeof localStorage === 'undefined') return true;

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { sendAnonymizedUsageLogs?: unknown };
    return parsed.sendAnonymizedUsageLogs !== false;
  } catch {
    return true;
  }
}

export function isAnalyticsEnabled() {
  return POSTHOG_ENABLED && Boolean(POSTHOG_KEY) && usageLogsAllowed;
}

export async function initAnalytics() {
  if (initialized || !isAnalyticsEnabled()) return;
  initialized = true;

  try {
    const key = POSTHOG_KEY;
    if (!key) return;

    const { default: posthog } = await import('posthog-js');
    posthog.init(key, {
      api_host: POSTHOG_HOST,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      person_profiles: 'identified_only',
      loaded: (client) => {
        posthogClient = client;
        if (!usageLogsAllowed) {
          client.opt_out_capturing?.();
          return;
        }
        client.opt_in_capturing?.();
        client.capture('app_loaded', {
          app: 'archimedes-agent',
          mode: import.meta.env.MODE,
        });
      },
    });
  } catch (error) {
    console.warn('PostHog analytics failed to initialize', error);
  }
}

export function setAnalyticsUsageConsent(allowed: boolean) {
  usageLogsAllowed = allowed;

  if (!allowed) {
    posthogClient?.opt_out_capturing?.();
    return;
  }

  posthogClient?.opt_in_capturing?.();
  void initAnalytics();
}

export function captureAnalyticsEvent(event: string, properties?: AnalyticsProperties) {
  if (!isAnalyticsEnabled()) return;
  if (!posthogClient) void initAnalytics();
  posthogClient?.capture(event, {
    app: 'archimedes-agent',
    ...properties,
  });
}
