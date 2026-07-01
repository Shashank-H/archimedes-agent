import type { LocalOllamaOs } from './constants';

export function detectBrowserOs(): LocalOllamaOs {
  if (typeof navigator === 'undefined') return 'mac';

  const navigatorWithUserAgentData = navigator as Navigator & { userAgentData?: { platform?: string } };
  const osHint = `${navigatorWithUserAgentData.userAgentData?.platform ?? ''} ${navigator.platform} ${navigator.userAgent}`.toLowerCase();

  if (osHint.includes('win')) return 'windows';
  if (osHint.includes('mac') || osHint.includes('iphone') || osHint.includes('ipad')) return 'mac';
  if (osHint.includes('linux') || osHint.includes('x11') || osHint.includes('android') || osHint.includes('cros')) return 'linux';

  return 'mac';
}
