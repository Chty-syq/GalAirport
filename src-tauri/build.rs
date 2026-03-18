fn main() {
    // Read version from package.json (single source of truth) and override
    // CARGO_PKG_VERSION so `tauri::VERSION` / `env!("CARGO_PKG_VERSION")`
    // always reflects the real app version even if Cargo.toml is stale.
    let pkg_json = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri should have a parent dir")
        .join("package.json");

    if let Ok(content) = std::fs::read_to_string(&pkg_json) {
        // Quick parse without an extra dependency: find "version": "x.y.z"
        if let Some(version) = parse_version(&content) {
            println!("cargo:rustc-env=CARGO_PKG_VERSION={}", version);
        }
    }

    // Re-run only when package.json changes
    println!("cargo:rerun-if-changed=../package.json");

    tauri_build::build()
}

fn parse_version(json: &str) -> Option<&str> {
    // Find "version": and grab the quoted value
    let key = r#""version""#;
    let start = json.find(key)? + key.len();
    let rest = json[start..].trim_start_matches(|c: char| c.is_whitespace() || c == ':');
    let inner = rest.trim_start_matches('"');
    let end = inner.find('"')?;
    Some(&inner[..end])
}
