use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

use super::path::file_id_for_path;

#[derive(Clone, Serialize)]
pub struct WorkspaceRootDto {
    pub id: String,
    pub provider_kind: String,
    pub name: String,
    pub path: String,
}

#[derive(Clone, Serialize)]
pub struct WorkspaceEntryDto {
    pub id: String,
    pub root_id: String,
    pub kind: String,
    pub name: String,
    pub path: String,
    pub parent_id: Option<String>,
    pub extension: Option<String>,
    pub is_supported: bool,
}

#[derive(Clone, Serialize)]
pub struct OpenWorkspaceRootDto {
    pub root: WorkspaceRootDto,
    pub children: Vec<WorkspaceEntryDto>,
}

pub fn create_root(path: &Path) -> WorkspaceRootDto {
    WorkspaceRootDto {
        id: file_id_for_path(path),
        provider_kind: "native".to_string(),
        name: path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string()),
        path: path.to_string_lossy().to_string(),
    }
}

pub fn list_children(root: &WorkspaceRootDto, directory: &Path, parent_id: Option<String>) -> Result<Vec<WorkspaceEntryDto>, String> {
    let mut entries = Vec::new();

    for entry in fs::read_dir(directory).map_err(|error| format!("Could not list directory: {error}"))? {
        let entry = entry.map_err(|error| format!("Could not read directory entry: {error}"))?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|error| format!("Could not read file metadata: {error}"))?;
        let kind = if metadata.is_dir() { "directory" } else { "file" };
        let name = entry.file_name().to_string_lossy().to_string();
        let display_path = path.to_string_lossy().to_string();
        let extension = extension_for_path(&path);
        let is_supported = metadata.is_file() && is_supported_diagram_path(&display_path);

        entries.push(WorkspaceEntryDto {
            id: file_id_for_path(&path),
            root_id: root.id.clone(),
            kind: kind.to_string(),
            name,
            path: display_path,
            parent_id: parent_id.clone(),
            extension,
            is_supported,
        });
    }

    entries.sort_by(|left, right| {
        let left_is_file = left.kind == "file";
        let right_is_file = right.kind == "file";
        left_is_file
            .cmp(&right_is_file)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });

    Ok(entries)
}

fn extension_for_path(path: &PathBuf) -> Option<String> {
    let name = path.file_name()?.to_string_lossy().to_lowercase();
    if name.ends_with(".excalidraw.json") {
        Some(".excalidraw.json".to_string())
    } else {
        path.extension().map(|extension| format!(".{}", extension.to_string_lossy()))
    }
}

fn is_supported_diagram_path(path: &str) -> bool {
    let lower_path = path.to_lowercase();
    lower_path.ends_with(".excalidraw") || lower_path.ends_with(".excalidraw.json")
}
