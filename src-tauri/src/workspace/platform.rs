use std::path::PathBuf;

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use tauri::AppHandle;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use tauri_plugin_dialog::DialogExt;

pub enum DirectoryPickerResult {
    Selected(PathBuf),
    Canceled,
    Invalid(String),
    #[allow(dead_code)]
    Unavailable(String),
}

pub enum SaveFilePickerResult {
    Selected(PathBuf),
    Canceled,
    Invalid(String),
    #[allow(dead_code)]
    Unavailable(String),
}

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
pub fn pick_directory(app: &AppHandle) -> Result<DirectoryPickerResult, String> {
    let Some(folder) = app
        .dialog()
        .file()
        .set_title("Open workspace folder")
        .blocking_pick_folder()
    else {
        return Ok(DirectoryPickerResult::Canceled);
    };

    let path = match folder.into_path() {
        Ok(path) => path,
        Err(error) => {
            return Ok(DirectoryPickerResult::Invalid(format!(
                "The selected folder path is invalid or unsupported: {error}"
            )));
        }
    };
    Ok(DirectoryPickerResult::Selected(path))
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
pub fn pick_directory(_app: &tauri::AppHandle) -> Result<DirectoryPickerResult, String> {
    Ok(DirectoryPickerResult::Unavailable(
        "Native folder picking is unavailable on this platform.".to_string(),
    ))
}

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
pub fn pick_save_file(
    app: &AppHandle,
    suggested_name: &str,
) -> Result<SaveFilePickerResult, String> {
    let Some(file) = app
        .dialog()
        .file()
        .set_title("Save diagram")
        .set_file_name(suggested_name)
        .add_filter("Excalidraw files", &["excalidraw", "json"])
        .blocking_save_file()
    else {
        return Ok(SaveFilePickerResult::Canceled);
    };

    let path = match file.into_path() {
        Ok(path) => path,
        Err(error) => {
            return Ok(SaveFilePickerResult::Invalid(format!(
                "The selected file path is invalid or unsupported: {error}"
            )));
        }
    };
    Ok(SaveFilePickerResult::Selected(path))
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
pub fn pick_save_file(
    _app: &tauri::AppHandle,
    _suggested_name: &str,
) -> Result<SaveFilePickerResult, String> {
    Ok(SaveFilePickerResult::Unavailable(
        "Native file saving is unavailable on this platform.".to_string(),
    ))
}
