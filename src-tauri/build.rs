fn main() {
    println!("cargo:rerun-if-changed=embedded-runtime/music-api-runtime.zip");
    tauri_build::build()
}
