import { Icon } from '../../../components/ui/icons';
import { workspaceProviderFactory } from '../../../lib/workspace/factory';
import { getWorkspacePlatformActions, getWorkspaceRuntime } from '../../../lib/workspace/platformActions';
import { useWorkspace } from '../../../providers/workspace/WorkspaceContext';
import { useWorkspaceTabManager } from '../../../providers/workspace/tabs/WorkspaceTabManagerContext';
import { WorkspaceTree } from './WorkspaceTree';

export function WorkspaceExplorer() {
  const {
    root,
    entriesByParentId,
    expandedEntryIds,
    selectedEntryId,
    isOpeningRoot,
    treeError,
    openWorkspaceRoot,
    refreshWorkspaceRoot,
    selectEntry,
  } = useWorkspace();
  const { tabs, activeTabId, openUntitledTab, switchTab } = useWorkspaceTabManager();
  const provider = workspaceProviderFactory.getProvider(root?.providerKind ?? workspaceProviderFactory.getDefaultProvider().kind);
  const actions = getWorkspacePlatformActions({
    runtime: getWorkspaceRuntime(),
    providerKind: root?.providerKind ?? null,
    capabilities: provider.capabilities,
    hasRoot: Boolean(root),
    canSave: false,
    canReview: false,
    isAssistantBusy: false,
  });
  const openAction = actions.find((action) => action.id === 'open-folder');
  const refreshAction = actions.find((action) => action.id === 'refresh');
  const localDraftTabs = tabs.filter((tab) => tab.isUntitled);
  const recentTabs = tabs.filter((tab) => !tab.isUntitled).slice(0, 6);

  return (
    <aside className="workspace-explorer" aria-label="Workspace explorer">
      <header className="workspace-explorer-header">
        <div className="workspace-explorer-title-row">
          <div className="workspace-explorer-title">
            <p className="workspace-eyebrow">Explorer{root ? `: ${root.name}` : ''}</p>
            <h2>{root?.name ?? 'No folder opened'}</h2>
          </div>
          <div className="workspace-explorer-actions" aria-label="Explorer actions">
            {openAction?.visible ? (
              <button
                type="button"
                className="workspace-icon-button"
                onClick={openWorkspaceRoot}
                disabled={isOpeningRoot || !openAction.enabled}
                aria-label={openAction.ariaLabel}
                title={openAction.title}
              >
                <Icon name="openExternal" size={14} />
              </button>
            ) : null}
            {refreshAction?.visible ? (
              <button
                type="button"
                className="workspace-icon-button"
                onClick={refreshWorkspaceRoot}
                disabled={!refreshAction.enabled}
                aria-label={refreshAction.ariaLabel}
                title={refreshAction.title}
              >
                <Icon name="refresh" size={14} />
              </button>
            ) : null}
            <button
              type="button"
              className="workspace-icon-button"
              onClick={openUntitledTab}
              aria-label="Create new untitled diagram"
              title="New untitled diagram"
            >
              <Icon name="plus" size={14} />
            </button>
          </div>
        </div>
        <p className="workspace-explorer-provider">
          {root ? `${root.providerKind} workspace` : provider.capabilities.canOpenDirectory ? 'Open a folder to browse diagrams' : 'Folder workspaces unavailable in this browser'}
        </p>
      </header>

      {treeError ? <div className="workspace-error" role="alert">{treeError}</div> : null}

      <div className="workspace-explorer-content">
        <section className="workspace-explorer-section" aria-label="Workspace files">
          <div className="workspace-section-header">
            <span><Icon name="explorer" size={12} />Workspace</span>
          </div>
          {root ? (
            <WorkspaceTree
              root={root}
              entriesByParentId={entriesByParentId}
              expandedEntryIds={expandedEntryIds}
              selectedEntryId={selectedEntryId}
              tabs={tabs}
              onSelectEntry={(entry) => void selectEntry(entry)}
            />
          ) : (
            <div className="workspace-empty">
              <p>Open a folder to browse Excalidraw diagrams.</p>
              <button type="button" onClick={openWorkspaceRoot} disabled={isOpeningRoot || !provider.capabilities.canOpenDirectory}>
                {isOpeningRoot ? 'Opening…' : 'Open folder'}
              </button>
            </div>
          )}
        </section>

        <section className="workspace-explorer-section" aria-label="Untitled diagrams">
          <div className="workspace-section-header">
            <span><Icon name="draft" size={12} />Untitled</span>
            <button type="button" onClick={openUntitledTab} aria-label="New untitled diagram" title="New untitled diagram"><Icon name="plus" size={12} /></button>
          </div>
          {localDraftTabs.length > 0 ? (
            <div className="workspace-sidebar-list">
              {localDraftTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`workspace-sidebar-item${activeTabId === tab.id ? ' is-selected' : ''}${tab.saveState === 'dirty' ? ' is-dirty' : ''}`}
                  onClick={() => switchTab(tab.id)}
                  title={tab.path}
                >
                  <Icon name="draft" size={14} />
                  <span>{tab.title}</span>
                  {tab.saveState === 'dirty' ? <i role="img" aria-label="Unsaved changes" /> : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="workspace-sidebar-note">No untitled diagrams yet.</p>
          )}
        </section>

        <section className="workspace-explorer-section" aria-label="Recent open diagrams">
          <div className="workspace-section-header">
            <span><Icon name="recent" size={12} />Recent</span>
          </div>
          {recentTabs.length > 0 ? (
            <div className="workspace-sidebar-list">
              {recentTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`workspace-sidebar-item${activeTabId === tab.id ? ' is-selected' : ''}${tab.saveState === 'dirty' ? ' is-dirty' : ''}`}
                  onClick={() => switchTab(tab.id)}
                  title={tab.path}
                >
                  <Icon name="diagram" size={14} />
                  <span>{tab.title}</span>
                  {tab.saveState === 'dirty' ? <i role="img" aria-label="Unsaved changes" /> : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="workspace-sidebar-note">Opened workspace diagrams appear here.</p>
          )}
        </section>
      </div>
    </aside>
  );
}
