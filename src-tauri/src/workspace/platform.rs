use std::path::PathBuf;

pub fn pick_directory() -> Option<PathBuf> {
    // Kept as the platform seam. The current dependency-light implementation
    // lets the frontend provide a path explicitly; native dialog integration can
    // be added here per OS without changing command DTOs.
    None
}
