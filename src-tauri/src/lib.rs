use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager};
use walkdir::WalkDir;

/// Known galgame engine signatures: (marker file/pattern, engine name)
const ENGINE_SIGNATURES: &[(&str, &str)] = &[
    ("data.xp3", "KiriKiri"),
    ("data.xp4", "KiriKiri"),
    ("arc.nsa", "NScripter"),
    ("arc1.nsa", "NScripter"),
    ("nscript.dat", "NScripter"),
    ("BGI.exe", "BGI/Ethornell"),
    ("Majiro.arc", "Majiro"),
    ("rio.arc", "Liar-soft"),
    ("UnityPlayer.dll", "Unity"),
    ("GameAssembly.dll", "Unity/IL2CPP"),
    ("AdvHD.exe", "WillPlus AdvHD"),
    ("SiglusEngine.exe", "SiglusEngine"),
    ("RealLive.exe", "RealLive"),
    ("AGERC.DLL", "AGE"),
    ("CatSystem2.exe", "CatSystem2"),
    ("cg.mpk", "Malie"),
    ("start.meg", "Artemis"),
];

/// Exe filenames to exclude (installers, uninstallers, redistributables)
const EXE_BLACKLIST: &[&str] = &[
    "unins000", "uninstall", "setup", "install", "config",
    "setting", "updater", "launcher", "crash", "vc_redist",
    "dxsetup", "dxwebsetup", "dotnetfx",
];

/// Detected game info returned from scanning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedGame {
    pub title: String,
    pub exe_path: String,
    pub install_path: String,
    pub engine: Option<String>,
}

/// Score an exe path to determine the best game executable.
/// Higher score = more preferred.
///
/// Priority:
///   1. Path contains "chs" → highest (Chinese Simplified)
///   2. Path contains "cn"/"chinese"/"zh" → high
///   3. Exe name matches directory name → likely main game
///   4. Larger file size → main exe usually bigger than tools
///   Blacklisted names → heavy penalty
fn score_exe(exe: &Path, dir_name: &str) -> i64 {
    let full_lower = exe.to_string_lossy().to_lowercase();
    let stem = exe
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();

    for bl in EXE_BLACKLIST {
        if stem.contains(bl) {
            return -1_000_000;
        }
    }

    let mut score: i64 = 0;

    // Priority 1: path contains "chs"
    if full_lower.contains("chs") {
        score += 100_000;
    }
    // Priority 1.5: other Chinese indicators
    if full_lower.contains("_cn")
        || full_lower.contains("chinese")
        || full_lower.contains("\\zh\\")
        || full_lower.contains("/zh/")
    {
        score += 50_000;
    }

    // Priority 2: exe name matches directory name
    let dir_lower = dir_name.to_lowercase();
    if !dir_lower.is_empty() && stem.contains(&dir_lower) {
        score += 10_000;
    }

    // Priority 3: file size
    let size = std::fs::metadata(exe).map(|m| m.len()).unwrap_or(0);
    score += std::cmp::min(size / 1024, 9999) as i64;

    score
}

/// Detect a single game from a folder.
/// The folder itself IS the game directory.
fn detect_game_from_folder(folder: &Path) -> Option<DetectedGame> {
    if !folder.is_dir() {
        return None;
    }

    let dir_name = folder
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut exe_files: Vec<PathBuf> = Vec::new();
    let mut detected_engine: Option<String> = None;

    // Walk up to 2 levels (catches "chs/game.exe", "bin/game.exe", etc.)
    for item in WalkDir::new(folder)
        .max_depth(2)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let item_path = item.path();
        let fname = item_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        for (sig, engine) in ENGINE_SIGNATURES {
            if fname.eq_ignore_ascii_case(sig) {
                detected_engine = Some(engine.to_string());
            }
        }

        if let Some(ext) = item_path.extension() {
            if ext.eq_ignore_ascii_case("exe") {
                exe_files.push(item_path.to_path_buf());
            }
        }
    }

    if exe_files.is_empty() {
        return None;
    }

    let best_exe = exe_files
        .iter()
        .max_by_key(|p| score_exe(p, &dir_name))
        .cloned()
        .unwrap_or_else(|| exe_files[0].clone());

    Some(DetectedGame {
        title: dir_name,
        exe_path: best_exe.to_string_lossy().to_string(),
        install_path: folder.to_string_lossy().to_string(),
        engine: detected_engine,
    })
}

// ─── Tauri Commands ────────────────────────────────────────────

/// Detect games from a list of folder paths.
/// Each folder is treated as one game.
#[tauri::command]
fn scan_games(paths: Vec<String>) -> Result<Vec<DetectedGame>, String> {
    let mut games: Vec<DetectedGame> = Vec::new();
    for path_str in &paths {
        let path = Path::new(path_str);
        if !path.exists() {
            continue;
        }
        if let Some(game) = detect_game_from_folder(path) {
            games.push(game);
        }
    }
    Ok(games)
}

#[tauri::command]
fn launch_game(app_handle: tauri::AppHandle, exe_path: String, game_id: String) -> Result<(), String> {
    let path = Path::new(&exe_path);
    let working_dir = path.parent().unwrap_or(Path::new(".")).to_path_buf();

    let mut child = std::process::Command::new(&exe_path)
        .current_dir(&working_dir)
        .spawn()
        .map_err(|e| format!("Failed to launch game: {}", e))?;

    let start_time = chrono::Utc::now().to_rfc3339();
    let instant = std::time::Instant::now();

    std::thread::spawn(move || {
        let _ = child.wait();
        let duration_secs = instant.elapsed().as_secs();
        let end_time = chrono::Utc::now().to_rfc3339();
        let _ = app_handle.emit(
            "playtime_session_ended",
            serde_json::json!({
                "game_id": game_id,
                "start_time": start_time,
                "end_time": end_time,
                "duration": duration_secs,
            }),
        );
    });

    Ok(())
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;
    Ok(())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    std::process::Command::new("cmd")
        .args(["/C", "start", "", &url])
        .spawn()
        .map_err(|e| format!("Failed to open URL: {}", e))?;
    Ok(())
}

#[tauri::command]
fn get_folder_size(path: String) -> Result<u64, String> {
    let mut total: u64 = 0;
    for entry in WalkDir::new(&path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    Ok(total)
}

#[tauri::command]
fn find_save_directories(install_path: String) -> Result<Vec<String>, String> {
    let root = Path::new(&install_path);
    let common_save_dirs = [
        "save", "savedata", "Save", "SaveData", "saves", "Saves", "data",
    ];
    let mut found: Vec<String> = Vec::new();
    for name in &common_save_dirs {
        let candidate = root.join(name);
        if candidate.is_dir() {
            found.push(candidate.to_string_lossy().to_string());
        }
    }
    Ok(found)
}

/// Download a cover image from URL and save to app data covers directory.
#[tauri::command]
async fn download_cover(
    app_handle: tauri::AppHandle,
    url: String,
    filename: String,
) -> Result<String, String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let covers_dir = app_data.join("covers");
    std::fs::create_dir_all(&covers_dir)
        .map_err(|e| format!("Failed to create covers dir: {}", e))?;

    let dest = covers_dir.join(&filename);

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download image: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    std::fs::write(&dest, &bytes)
        .map_err(|e| format!("Failed to save image: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}

/// Download a screenshot image from URL and save to app data screenshots directory.
#[tauri::command]
async fn download_screenshot(
    app_handle: tauri::AppHandle,
    url: String,
    filename: String,
) -> Result<String, String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let screenshots_dir = app_data.join("screenshots");
    std::fs::create_dir_all(&screenshots_dir)
        .map_err(|e| format!("Failed to create screenshots dir: {}", e))?;

    let dest = screenshots_dir.join(&filename);

    // Skip if already downloaded
    if dest.exists() {
        return Ok(dest.to_string_lossy().to_string());
    }

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download screenshot: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    std::fs::write(&dest, &bytes)
        .map_err(|e| format!("Failed to save screenshot: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}

/// Translate text using DeepSeek API (OpenAI-compatible) via async-openai.
#[tauri::command]
async fn deepseek_translate(api_key: String, text: String) -> Result<String, String> {
    use async_openai::{
        config::OpenAIConfig,
        types::{
            ChatCompletionRequestSystemMessageArgs,
            ChatCompletionRequestUserMessageArgs,
            CreateChatCompletionRequestArgs,
        },
        Client,
    };

    let config = OpenAIConfig::new()
        .with_api_key(&api_key)
        .with_api_base("https://api.deepseek.com/v1");

    let client = Client::with_config(config);

    let request = CreateChatCompletionRequestArgs::default()
        .model("deepseek-chat")
        .temperature(0.3)
        .max_tokens(2048u32)
        .messages(vec![
            ChatCompletionRequestSystemMessageArgs::default()
                .content("你是一个专业的游戏简介翻译器。将以下视觉小说(Visual Novel)的简介翻译成自然流畅的简体中文。保持原文的语气和风格，不要添加任何额外的说明或注释。如果原文已经是中文，请直接返回原文。")
                .build()
                .map_err(|e| e.to_string())?
                .into(),
            ChatCompletionRequestUserMessageArgs::default()
                .content(text.clone())
                .build()
                .map_err(|e| e.to_string())?
                .into(),
        ])
        .build()
        .map_err(|e| format!("Failed to build request: {}", e))?;

    let response = client
        .chat()
        .create(request)
        .await
        .map_err(|e| format!("DeepSeek API error: {}", e))?;

    let content = response
        .choices
        .first()
        .and_then(|c| c.message.content.clone())
        .unwrap_or_default()
        .trim()
        .to_string();

    if content.is_empty() {
        return Err("DeepSeek returned empty response".to_string());
    }

    Ok(content)
}

/// Test DeepSeek API key validity.
#[tauri::command]
async fn deepseek_test(api_key: String) -> Result<bool, String> {
    use async_openai::{
        config::OpenAIConfig,
        types::{
            ChatCompletionRequestUserMessageArgs,
            CreateChatCompletionRequestArgs,
        },
        Client,
    };

    let config = OpenAIConfig::new()
        .with_api_key(&api_key)
        .with_api_base("https://api.deepseek.com/v1");

    let client = Client::with_config(config);

    let request = CreateChatCompletionRequestArgs::default()
        .model("deepseek-chat")
        .max_tokens(1u32)
        .messages(vec![
            ChatCompletionRequestUserMessageArgs::default()
                .content("Hi")
                .build()
                .map_err(|e| e.to_string())?
                .into(),
        ])
        .build()
        .map_err(|e| format!("Failed to build request: {}", e))?;

    match client.chat().create(request).await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Translate an array of tags to Chinese using DeepSeek API.
#[tauri::command]
async fn deepseek_translate_tags(api_key: String, tags: Vec<String>) -> Result<Vec<String>, String> {
    use async_openai::{
        config::OpenAIConfig,
        types::{
            ChatCompletionRequestSystemMessageArgs,
            ChatCompletionRequestUserMessageArgs,
            CreateChatCompletionRequestArgs,
        },
        Client,
    };

    if tags.is_empty() || api_key.is_empty() {
        return Ok(tags);
    }

    let config = OpenAIConfig::new()
        .with_api_key(&api_key)
        .with_api_base("https://api.deepseek.com/v1");

    let client = Client::with_config(config);

    let tags_text = tags.join("\n");

    let request = CreateChatCompletionRequestArgs::default()
        .model("deepseek-chat")
        .temperature(0.0)
        .max_tokens(1024u32)
        .messages(vec![
            ChatCompletionRequestSystemMessageArgs::default()
                .content("你是一个游戏标签翻译器。将以下英文游戏标签逐行翻译为简洁的简体中文。每行一个标签，保持行数和顺序完全一致。只输出翻译结果，不要编号，不要解释。")
                .build()
                .map_err(|e| e.to_string())?
                .into(),
            ChatCompletionRequestUserMessageArgs::default()
                .content(tags_text)
                .build()
                .map_err(|e| e.to_string())?
                .into(),
        ])
        .build()
        .map_err(|e| format!("Failed to build request: {}", e))?;

    let response = client
        .chat()
        .create(request)
        .await
        .map_err(|e| format!("DeepSeek API error: {}", e))?;

    let content = response
        .choices
        .first()
        .and_then(|c| c.message.content.clone())
        .unwrap_or_default();

    let translated: Vec<String> = content
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    // If line count matches, use translated; otherwise fall back to originals
    if translated.len() == tags.len() {
        Ok(translated)
    } else {
        Ok(tags)
    }
}

// ─── App Entry ─────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            scan_games,
            launch_game,
            open_folder,
            open_url,
            get_folder_size,
            find_save_directories,
            download_cover,
            download_screenshot,
            deepseek_translate,
            deepseek_test,
            deepseek_translate_tags,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}