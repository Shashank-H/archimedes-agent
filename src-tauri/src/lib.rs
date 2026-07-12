mod workspace;

use std::path::PathBuf;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(not(mobile))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
        let paths = workspace::open_paths_from_cli_args(
            args.into_iter().map(Into::into),
            PathBuf::from(cwd),
        );
        let app_handle = app.clone();
        if let Err(error) = app.run_on_main_thread(move || {
            if let Err(error) = workspace::route_native_open_paths(app_handle, paths) {
                eprintln!("Could not route native open request: {error}");
            }
        }) {
            eprintln!("Could not schedule native open request: {error}");
        }
    }));

    let builder = builder
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(workspace::WorkspaceState::new())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                workspace::apply_workspace_window_chrome(&window);
                eprintln!("[archimedes] opening the web inspector for diagram-agent diagnostics");
                window.open_devtools();
            }

            let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
            let paths = workspace::open_paths_from_cli_args(std::env::args_os().skip(1), cwd);
            app.state::<workspace::WorkspaceState>()
                .queue_open_paths_for_window("main", paths)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            workspace::open_workspace_root,
            workspace::pick_workspace_save_file,
            workspace::open_workspace_root_at,
            workspace::open_workspace_path,
            workspace::take_native_open_requests,
            workspace::register_window_workspace_root,
            workspace::create_new_workspace_window,
            workspace::open_workspace_path_in_new_window,
            workspace::list_workspace_children,
            workspace::read_workspace_file,
            workspace::create_workspace_file,
            workspace::write_workspace_file,
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
        if let tauri::RunEvent::Opened { urls } = event {
            let paths = urls
                .into_iter()
                .filter_map(|url| url.to_file_path().ok())
                .map(|path| path.to_string_lossy().to_string())
                .collect();
            if let Err(error) = workspace::route_native_open_paths(app.clone(), paths) {
                eprintln!("Could not route native open request: {error}");
            }
        }

        #[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
        let _ = (app, event);
    });
}
