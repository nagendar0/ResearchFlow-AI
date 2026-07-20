use std::fs;
use std::path::PathBuf;

fn get_base_dir() -> Result<PathBuf, String> {
    if let Some(user_profile) = std::env::var_os("USERPROFILE") {
        let mut path = PathBuf::from(user_profile);
        path.push("Documents");
        path.push("EvidenceFlow");
        return Ok(path);
    }
    Err("Could not retrieve user profile directory".to_string())
}

fn validate_path_parts(dir_type: &str, filename: &str) -> Result<(), String> {
    const ALLOWED_DIRECTORIES: &[&str] = &["projects", "sources", "evidence", "reports", "documents", "explain", "cache"];
    if !ALLOWED_DIRECTORIES.contains(&dir_type)
        || filename.is_empty()
        || filename.contains('/')
        || filename.contains('\\')
        || filename.contains("..")
    {
        return Err("Invalid local storage path".to_string());
    }
    Ok(())
}

#[tauri::command]
fn save_local_file(dir_type: String, filename: String, content: String) -> Result<(), String> {
    validate_path_parts(&dir_type, &filename)?;
    let mut path = get_base_dir()?;
    path.push(&dir_type);
    
    // Create directory tree if not present
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    
    path.push(&filename);
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_local_file(dir_type: String, filename: String) -> Result<String, String> {
    validate_path_parts(&dir_type, &filename)?;
    let mut path = get_base_dir()?;
    path.push(&dir_type);
    path.push(&filename);
    
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(content)
}

#[tauri::command]
fn delete_local_file(dir_type: String, filename: String) -> Result<(), String> {
    validate_path_parts(&dir_type, &filename)?;
    let mut path = get_base_dir()?;
    path.push(&dir_type);
    path.push(&filename);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn list_local_files(dir_type: String) -> Result<Vec<String>, String> {
    validate_path_parts(&dir_type, "list")?;
    let mut path = get_base_dir()?;
    path.push(&dir_type);
    
    if !path.exists() {
        return Ok(Vec::new());
    }
    
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            if let Some(name) = entry.file_name().to_str() {
                files.push(name.to_string());
            }
        }
    }
    Ok(files)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![save_local_file, read_local_file, list_local_files, delete_local_file])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
