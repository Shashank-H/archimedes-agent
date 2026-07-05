use std::collections::HashMap;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

mod path;
mod platform;
mod provider;

use path::{canonicalize_inside_root, canonicalize_parent_inside_root, path_from_file_id};
use provider::{create_root, list_children, OpenWorkspaceRootDto, WorkspaceEntryDto};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow, WebviewWindowBuilder};

const NATIVE_OPEN_REQUESTED_EVENT: &str = "native-open-requested";

pub struct WorkspaceState {
    roots: Mutex<HashMap<String, PathBuf>>,
    pending_open_paths_by_window: Mutex<HashMap<String, Vec<String>>>,
    window_workspace_roots: Mutex<HashMap<String, PathBuf>>,
    next_window_index: Mutex<u64>,
}

impl WorkspaceState {
    pub fn new() -> Self {
        Self {
            roots: Mutex::new(HashMap::new()),
            pending_open_paths_by_window: Mutex::new(HashMap::new()),
            window_workspace_roots: Mutex::new(HashMap::new()),
            next_window_index: Mutex::new(1),
        }
    }

    pub fn queue_open_paths_for_window(&self, window_label: &str, paths: Vec<String>) -> Result<(), String> {
        if paths.is_empty() {
            return Ok(());
        }

        self.pending_open_paths_by_window
            .lock()
            .map_err(|_| "Native open request queue lock was poisoned".to_string())?
            .entry(window_label.to_string())
            .or_default()
            .extend(paths);
        Ok(())
    }

    fn take_open_paths_for_window(&self, window_label: &str) -> Result<Vec<String>, String> {
        let mut pending_paths_by_window = self
            .pending_open_paths_by_window
            .lock()
            .map_err(|_| "Native open request queue lock was poisoned".to_string())?;
        Ok(pending_paths_by_window.remove(window_label).unwrap_or_default())
    }

    fn set_window_workspace_root(&self, window_label: String, root_path: Option<PathBuf>) -> Result<(), String> {
        let mut window_workspace_roots = self
            .window_workspace_roots
            .lock()
            .map_err(|_| "Window workspace state lock was poisoned".to_string())?;

        if let Some(root_path) = root_path {
            window_workspace_roots.insert(window_label, root_path);
        } else {
            window_workspace_roots.remove(&window_label);
        }
        Ok(())
    }

    fn find_window_containing_path(&self, path: &Path) -> Result<Option<String>, String> {
        let window_workspace_roots = self
            .window_workspace_roots
            .lock()
            .map_err(|_| "Window workspace state lock was poisoned".to_string())?;

        Ok(window_workspace_roots
            .iter()
            .filter(|(_, active_root)| path.starts_with(active_root))
            .max_by_key(|(_, active_root)| active_root.components().count())
            .map(|(label, _)| label.clone()))
    }

    fn next_window_label(&self) -> Result<String, String> {
        let mut next_window_index = self
            .next_window_index
            .lock()
            .map_err(|_| "Window counter lock was poisoned".to_string())?;
        let label = format!("workspace-{}", *next_window_index);
        *next_window_index += 1;
        Ok(label)
    }
}

#[derive(Clone, Serialize)]
pub struct NativeOpenRequestedDto {
    pub paths: Vec<String>,
}

#[derive(Clone, Serialize)]
pub struct OpenWorkspacePathDto {
    pub status: String,
    pub kind: Option<String>,
    pub path: String,
    pub root: Option<OpenWorkspaceRootDto>,
    pub target_entry: Option<WorkspaceEntryDto>,
    pub message: Option<String>,
}

#[tauri::command]
pub fn open_workspace_root(state: State<'_, WorkspaceState>) -> Result<Option<OpenWorkspaceRootDto>, String> {
    let Some(selected_path) = platform::pick_directory() else {
        return Ok(None);
    };

    open_workspace_root_from_path(state, selected_path)
}

#[tauri::command]
pub fn open_workspace_root_at(
    state: State<'_, WorkspaceState>,
    root_path: String,
) -> Result<Option<OpenWorkspaceRootDto>, String> {
    open_workspace_root_from_path(state, PathBuf::from(root_path))
}

#[tauri::command]
pub fn open_workspace_path(
    state: State<'_, WorkspaceState>,
    requested_path: String,
) -> Result<OpenWorkspacePathDto, String> {
    open_workspace_path_from_path(state, PathBuf::from(requested_path))
}

#[tauri::command]
pub fn take_native_open_requests(
    window: WebviewWindow,
    state: State<'_, WorkspaceState>,
) -> Result<Vec<String>, String> {
    state.take_open_paths_for_window(window.label())
}

#[tauri::command]
pub fn register_window_workspace_root(
    window: WebviewWindow,
    state: State<'_, WorkspaceState>,
    root_path: Option<String>,
) -> Result<(), String> {
    let canonical_root = root_path
        .map(|path| PathBuf::from(path).canonicalize().map_err(|error| format!("Could not resolve workspace folder: {error}")))
        .transpose()?;

    state.set_window_workspace_root(window.label().to_string(), canonical_root)
}

#[tauri::command]
pub fn create_new_workspace_window(app: AppHandle) -> Result<(), String> {
    create_empty_workspace_window(&app)
}

fn open_workspace_root_from_path(
    state: State<'_, WorkspaceState>,
    selected_path: PathBuf,
) -> Result<Option<OpenWorkspaceRootDto>, String> {
    let canonical_root = selected_path
        .canonicalize()
        .map_err(|error| format!("Could not resolve selected folder: {error}"))?;
    let result = register_workspace_root(&state, canonical_root)?;

    Ok(Some(result))
}

fn open_workspace_path_from_path(
    state: State<'_, WorkspaceState>,
    requested_path: PathBuf,
) -> Result<OpenWorkspacePathDto, String> {
    let display_path = requested_path.to_string_lossy().to_string();
    let canonical_path = match requested_path.canonicalize() {
        Ok(path) => path,
        Err(error) => {
            return Ok(OpenWorkspacePathDto {
                status: "invalid".to_string(),
                kind: None,
                path: display_path,
                root: None,
                target_entry: None,
                message: Some(format!("Could not resolve path: {error}")),
            });
        }
    };

    if canonical_path.is_dir() {
        let root = register_workspace_root(&state, canonical_path.clone())?;
        return Ok(OpenWorkspacePathDto {
            status: "opened".to_string(),
            kind: Some("directory".to_string()),
            path: canonical_path.to_string_lossy().to_string(),
            root: Some(root),
            target_entry: None,
            message: None,
        });
    }

    if !canonical_path.is_file() {
        return Ok(OpenWorkspacePathDto {
            status: "unsupported".to_string(),
            kind: None,
            path: canonical_path.to_string_lossy().to_string(),
            root: None,
            target_entry: None,
            message: Some("Path is neither a file nor a directory.".to_string()),
        });
    }

    if !provider::is_supported_diagram_path(&canonical_path.to_string_lossy()) {
        return Ok(OpenWorkspacePathDto {
            status: "unsupported".to_string(),
            kind: Some("file".to_string()),
            path: canonical_path.to_string_lossy().to_string(),
            root: None,
            target_entry: None,
            message: Some("Archimedes can open .excalidraw and .excalidraw.json files.".to_string()),
        });
    }

    let parent = canonical_path
        .parent()
        .ok_or_else(|| "Selected file has no parent folder.".to_string())?
        .to_path_buf();
    let root = register_workspace_root(&state, parent)?;
    let target_id = path::file_id_for_path(&canonical_path);
    let target_entry = root.children.iter().find(|entry| entry.id == target_id).cloned();

    Ok(OpenWorkspacePathDto {
        status: "opened".to_string(),
        kind: Some("file".to_string()),
        path: canonical_path.to_string_lossy().to_string(),
        root: Some(root),
        target_entry,
        message: None,
    })
}

fn register_workspace_root(
    state: &State<'_, WorkspaceState>,
    canonical_root: PathBuf,
) -> Result<OpenWorkspaceRootDto, String> {
    let root = create_root(&canonical_root);
    let children = list_children(&root, &canonical_root, None)?;

    state
        .roots
        .lock()
        .map_err(|_| "Workspace state lock was poisoned".to_string())?
        .insert(root.id.clone(), canonical_root);

    Ok(OpenWorkspaceRootDto { root, children })
}

#[tauri::command]
pub fn list_workspace_children(
    state: State<'_, WorkspaceState>,
    root_id: String,
    directory_id: String,
) -> Result<Vec<WorkspaceEntryDto>, String> {
    let root_path = get_root_path(&state, &root_id)?;
    let directory_path = path_from_file_id(&directory_id)?;
    let safe_directory_path = canonicalize_inside_root(&root_path, &directory_path)?;
    let root = create_root(&root_path);
    list_children(&root, &safe_directory_path, Some(directory_id))
}

#[tauri::command]
pub fn read_workspace_file(
    state: State<'_, WorkspaceState>,
    root_id: String,
    file_id: String,
) -> Result<String, String> {
    let root_path = get_root_path(&state, &root_id)?;
    let file_path = path_from_file_id(&file_id)?;
    let safe_file_path = canonicalize_inside_root(&root_path, &file_path)?;

    if !safe_file_path.is_file() {
        return Err("Workspace path is not a file".to_string());
    }

    fs::read_to_string(&safe_file_path).map_err(|error| format!("Could not read file: {error}"))
}

#[tauri::command]
pub fn write_workspace_file(
    state: State<'_, WorkspaceState>,
    root_id: String,
    file_id: String,
    content: String,
) -> Result<(), String> {
    let root_path = get_root_path(&state, &root_id)?;
    let file_path = path_from_file_id(&file_id)?;
    let safe_file_path = if file_path.exists() {
        canonicalize_inside_root(&root_path, &file_path)?
    } else {
        canonicalize_parent_inside_root(&root_path, &file_path)?
    };

    fs::write(&safe_file_path, content).map_err(|error| format!("Could not write file: {error}"))
}

fn get_root_path(state: &State<'_, WorkspaceState>, root_id: &str) -> Result<PathBuf, String> {
    state
        .roots
        .lock()
        .map_err(|_| "Workspace state lock was poisoned".to_string())?
        .get(root_id)
        .cloned()
        .ok_or_else(|| "Workspace root is not open".to_string())
}

pub fn route_native_open_paths(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    if paths.is_empty() {
        create_empty_workspace_window(&app)?;
        return Ok(());
    }

    for path in paths {
        route_native_open_path(&app, path)?;
    }
    Ok(())
}

pub fn queue_native_open_paths_for_window(
    app: &AppHandle,
    window_label: &str,
    paths: Vec<String>,
) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }

    let state = app.state::<WorkspaceState>();
    state.queue_open_paths_for_window(window_label, paths.clone())?;
    app.emit_to(window_label, NATIVE_OPEN_REQUESTED_EVENT, NativeOpenRequestedDto { paths })
        .map_err(|error| format!("Could not emit native open request: {error}"))
}

fn route_native_open_path(app: &AppHandle, path: String) -> Result<(), String> {
    let target_path = canonical_requested_path(&path);
    let state = app.state::<WorkspaceState>();

    if let Some(target_path) = target_path.as_ref() {
        if let Some(window_label) = state.find_window_containing_path(target_path)? {
            queue_native_open_paths_for_window(app, &window_label, vec![path])?;
            focus_window(app, &window_label);
            return Ok(());
        }
    }

    create_window_for_native_open_path(app, path)
}

fn create_window_for_native_open_path(app: &AppHandle, path: String) -> Result<(), String> {
    let state = app.state::<WorkspaceState>();
    let label = state.next_window_label()?;
    state.queue_open_paths_for_window(&label, vec![path])?;
    create_workspace_window(app, label)
}

fn create_empty_workspace_window(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<WorkspaceState>();
    let label = state.next_window_label()?;
    create_workspace_window(app, label)
}

fn create_workspace_window(app: &AppHandle, label: String) -> Result<(), String> {
    let mut window_config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or_else(|| "No window configuration is available".to_string())?;
    window_config.label = label.clone();
    window_config.url = tauri::WebviewUrl::App("index.html?archimedesWindow=isolated".into());

    let window = WebviewWindowBuilder::from_config(app, &window_config)
        .map_err(|error| format!("Could not create workspace window: {error}"))?
        .build()
        .map_err(|error| format!("Could not create workspace window: {error}"))?;
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

fn focus_window(app: &AppHandle, window_label: &str) {
    if let Some(window) = app.get_webview_window(window_label) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn canonical_requested_path(path: &str) -> Option<PathBuf> {
    PathBuf::from(path).canonicalize().ok()
}

pub fn open_paths_from_cli_args<I>(args: I, cwd: PathBuf) -> Vec<String>
where
    I: IntoIterator<Item = OsString>,
{
    let current_exe = std::env::current_exe().ok();
    let current_exe_name = current_exe
        .as_ref()
        .and_then(|path| path.file_name())
        .map(|name| name.to_os_string());

    args.into_iter()
        .filter(|arg| !is_current_exe_arg(arg, current_exe.as_deref(), current_exe_name.as_deref()))
        .filter_map(|arg| {
            let text = arg.to_string_lossy().trim().to_string();
            if text.is_empty() || text.starts_with('-') {
                return None;
            }
            let path = PathBuf::from(&text);
            let resolved_path = if path.is_absolute() { path } else { cwd.join(path) };
            Some(resolved_path.to_string_lossy().to_string())
        })
        .collect()
}

fn is_current_exe_arg(arg: &OsString, current_exe: Option<&Path>, current_exe_name: Option<&std::ffi::OsStr>) -> bool {
    let arg_path = PathBuf::from(arg);

    if let Some(current_exe) = current_exe {
        if arg_path == current_exe {
            return true;
        }
    }

    match (arg_path.file_name(), current_exe_name) {
        (Some(arg_name), Some(current_name)) => arg_name == current_name,
        _ => false,
    }
}
