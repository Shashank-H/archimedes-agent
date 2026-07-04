use std::path::{Path, PathBuf};

pub fn file_id_for_path(path: &Path) -> String {
    format!("native://{}", path.to_string_lossy())
}

pub fn path_from_file_id(file_id: &str) -> Result<PathBuf, String> {
    let raw_path = file_id
        .strip_prefix("native://")
        .ok_or_else(|| "Invalid native workspace file ID".to_string())?;
    Ok(PathBuf::from(raw_path))
}

pub fn canonicalize_inside_root(root: &Path, candidate: &Path) -> Result<PathBuf, String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("Could not resolve workspace root: {error}"))?;
    let canonical_candidate = candidate
        .canonicalize()
        .map_err(|error| format!("Could not resolve workspace path: {error}"))?;

    if canonical_candidate.starts_with(&canonical_root) {
        Ok(canonical_candidate)
    } else {
        Err("Path is outside the opened workspace root".to_string())
    }
}

pub fn canonicalize_parent_inside_root(root: &Path, candidate: &Path) -> Result<PathBuf, String> {
    let parent = candidate
        .parent()
        .ok_or_else(|| "Workspace file has no parent directory".to_string())?;
    let canonical_parent = canonicalize_inside_root(root, parent)?;
    let file_name = candidate
        .file_name()
        .ok_or_else(|| "Workspace file has no filename".to_string())?;
    Ok(canonical_parent.join(file_name))
}
