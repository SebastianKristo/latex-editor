#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // Windows: egen tittellinje med ─ ☐ ✕ tegnes av web-klienten.
    #[cfg(target_os = "windows")]
    let builder = builder.setup(|app| {
        use tauri::Manager;
        if let Some(w) = app.get_webview_window("main") {
            w.set_decorations(false)?;
        }
        Ok(())
    });
    builder
        .run(tauri::generate_context!())
        .expect("kunne ikke starte Kobling");
}
