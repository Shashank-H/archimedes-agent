use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

mod path;
mod platform;
mod provider;

use path::{canonicalize_inside_root, canonicalize_parent_inside_root, path_from_file_id};
use provider::{create_root, list_children, OpenWorkspaceRootDto, WorkspaceEntryDto};

pub struct WorkspaceState {
    roots: Mutex<HashMap<String, PathBuf>>,
}

impl WorkspaceState {
    pub fn new() -> Self {
        Self {
            roots: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub fn open_workspace_root(state: tauri::State<'_, WorkspaceState>) -> Result<Option<OpenWorkspaceRootDto>, String> {
    let Some(selected_path) = platform::pick_directory() else {
        return Ok(None);
    };

    open_workspace_root_from_path(state, selected_path)
}

#[tauri::command]
pub fn open_workspace_root_at(
    state: tauri::State<'_, WorkspaceState>,
    root_path: String,
) -> Result<Option<OpenWorkspaceRootDto>, String> {
    open_workspace_root_from_path(state, PathBuf::from(root_path))
}

fn open_workspace_root_from_path(
    state: tauri::State<'_, WorkspaceState>,
    selected_path: PathBuf,
) -> Result<Option<OpenWorkspaceRootDto>, String> {
    let canonical_root = selected_path
        .canonicalize()
        .map_err(|error| format!("Could not resolve selected folder: {error}"))?;
    let root = create_root(&canonical_root);
    let children = list_children(&root, &canonical_root, None)?;

    state
        .roots
        .lock()
        .map_err(|_| "Workspace state lock was poisoned".to_string())?
        .insert(root.id.clone(), canonical_root);

    Ok(Some(OpenWorkspaceRootDto { root, children }))
}

#[tauri::command]
pub fn list_workspace_children(
    state: tauri::State<'_, WorkspaceState>,
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
    state: tauri::State<'_, WorkspaceState>,
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
    state: tauri::State<'_, WorkspaceState>,
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

fn get_root_path(state: &tauri::State<'_, WorkspaceState>, root_id: &str) -> Result<PathBuf, String> {
    state
        .roots
        .lock()
        .map_err(|_| "Workspace state lock was poisoned".to_string())?
        .get(root_id)
        .cloned()
        .ok_or_else(|| "Workspace root is not open".to_string())
}
