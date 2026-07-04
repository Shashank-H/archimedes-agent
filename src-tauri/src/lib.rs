mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(workspace::WorkspaceState::new())
        .invoke_handler(tauri::generate_handler![
            workspace::open_workspace_root,
            workspace::open_workspace_root_at,
            workspace::list_workspace_children,
            workspace::read_workspace_file,
            workspace::write_workspace_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
