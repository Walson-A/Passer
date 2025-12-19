use std::path::PathBuf;
use std::fs;

// --- Helper: Get Base Dirs ---
pub fn get_passer_base_dir() -> PathBuf {
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());
    PathBuf::from(user_profile).join("Desktop").join("Passer")
}

pub fn get_downloads_dir() -> PathBuf {
    let path = get_passer_base_dir().join("Passboard"); // For Push/Pull
    let _ = fs::create_dir_all(&path);
    path
}

pub fn get_cache_dir() -> PathBuf {
    let path = get_passer_base_dir().join(".cache");
    let _ = fs::create_dir_all(&path);
    path
}

pub fn get_webdav_dir() -> PathBuf {
    let path = get_passer_base_dir().join("Passer Space"); // For WebDAV
    let _ = fs::create_dir_all(&path);
    path
}

// --- Helper: Sort into Subfolders (Legacy) ---
// Now we just dump into Passboard flat or keep logic? User said "Passboard pour les fichiers Push/Pull".
// Let's keep subfolders inside Passboard for organization if desired, or flatten. 
// User instruction: "C:\\Users\\Walson\\Desktop\\Passer\\Passboard pour les fichiers de Push et Pass"
// I will keep the subfolder logic relative to get_downloads_dir() for now to avoid breaking existing flow.
pub fn get_target_dir(base: &PathBuf, content_type: &str, filename: &str) -> PathBuf {
    let lower_name = filename.to_lowercase();
    let sub = if content_type.starts_with("image/") || lower_name.ends_with(".png") || lower_name.ends_with(".jpg") || lower_name.ends_with(".jpeg") || lower_name.ends_with(".heic") {
        "Images"
    } else if content_type.starts_with("video/") || lower_name.ends_with(".mp4") || lower_name.ends_with(".mov") {
        "Videos"
    } else if content_type.starts_with("audio/") || lower_name.ends_with(".mp3") || lower_name.ends_with(".wav") {
        "Audio"
    } else if content_type.starts_with("application/pdf") || lower_name.ends_with(".pdf") || lower_name.ends_with(".doc") || lower_name.ends_with(".docx") {
        "Documents"
    } else {
        "Misc"
    };
    
    let path = base.join(sub);
    let _ = fs::create_dir_all(&path);
    path
}

/// Find an available filename by appending (1), (2), etc. if the file already exists
/// Returns a PathBuf with a unique filename that doesn't exist yet
pub fn get_unique_file_path(path: PathBuf) -> PathBuf {
    // If the file doesn't exist, return the original path
    if !path.exists() {
        return path;
    }

    // Extract the directory, stem (name without extension), and extension
    let parent = path.parent().unwrap_or_else(|| std::path::Path::new("."));
    let file_stem = path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    let extension = path.extension()
        .and_then(|s| s.to_str())
        .map(|ext| format!(".{}", ext))
        .unwrap_or_else(String::new);

    // Try (1), (2), (3), ... up to 9999
    for counter in 1..=9999 {
        let new_filename = format!("{} ({}){}", file_stem, counter, extension);
        let new_path = parent.join(&new_filename);
        
        if !new_path.exists() {
            return new_path;
        }
    }

    // Fallback: if we somehow reach 9999, append timestamp
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let new_filename = format!("{} ({}).{}", file_stem, timestamp, 
        path.extension().and_then(|s| s.to_str()).unwrap_or("tmp"));
    parent.join(&new_filename)
}