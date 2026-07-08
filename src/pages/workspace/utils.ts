export type WorkspaceClientPlatform = 'windows' | 'macos' | 'linux' | 'unknown';

export function detectWorkspaceClientPlatform(): WorkspaceClientPlatform {
  if (typeof navigator === 'undefined') return 'unknown';

  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();
  const platformHints = `${platform} ${userAgent}`;

  if (platformHints.includes('mac')) return 'macos';
  if (platformHints.includes('win')) return 'windows';
  if (platformHints.includes('linux') || platformHints.includes('x11')) return 'linux';

  return 'unknown';
}
