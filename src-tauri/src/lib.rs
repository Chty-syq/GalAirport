use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager};
use walkdir::WalkDir;

// async-openai 类型在三个 DeepSeek 命令中均用到，统一放顶层
use async_openai::{
    config::OpenAIConfig,
    types::{
        ChatCompletionRequestSystemMessageArgs,
        ChatCompletionRequestUserMessageArgs,
        CreateChatCompletionRequestArgs,
    },
    Client as OpenAIClient,
};

const GITHUB_REPO: &str = "Chty-syq/GalAirport";

// ─── 引擎识别 ────────────────────────────────────────────────

/// 已知 galgame 引擎的特征文件：(文件名, 引擎名)
const ENGINE_SIGNATURES: &[(&str, &str)] = &[
    ("data.xp3",         "KiriKiri"),
    ("data.xp4",         "KiriKiri"),
    ("arc.nsa",          "NScripter"),
    ("arc1.nsa",         "NScripter"),
    ("nscript.dat",      "NScripter"),
    ("BGI.exe",          "BGI/Ethornell"),
    ("Majiro.arc",       "Majiro"),
    ("rio.arc",          "Liar-soft"),
    ("UnityPlayer.dll",  "Unity"),
    ("GameAssembly.dll", "Unity/IL2CPP"),
    ("AdvHD.exe",        "WillPlus AdvHD"),
    ("SiglusEngine.exe", "SiglusEngine"),
    ("RealLive.exe",     "RealLive"),
    ("AGERC.DLL",        "AGE"),
    ("CatSystem2.exe",   "CatSystem2"),
    ("cg.mpk",           "Malie"),
    ("start.meg",        "Artemis"),
];

/// 需要排除的 exe 文件名（安装程序、卸载程序、运行时等）
const EXE_BLACKLIST: &[&str] = &[
    "unins000", "uninstall", "setup", "install", "config",
    "setting", "updater", "launcher", "crash", "vc_redist",
    "dxsetup", "dxwebsetup", "dotnetfx",
];

// ─── 游戏扫描 ────────────────────────────────────────────────

/// 扫描结果：从文件夹中检测到的游戏信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedGame {
    pub title: String,
    pub exe_path: String,
    pub install_path: String,
    pub engine: Option<String>,
}

/// 对候选 exe 路径打分，分数越高越可能是主游戏程序。
/// 优先级：汉化版路径 > 文件名匹配目录名 > 文件体积
fn score_exe(exe: &Path, dir_name: &str) -> i64 {
    let full_lower = exe.to_string_lossy().to_lowercase();
    let stem = exe.file_stem().unwrap_or_default().to_string_lossy().to_lowercase();

    // 黑名单直接淘汰
    if EXE_BLACKLIST.iter().any(|bl| stem.contains(bl)) {
        return -1_000_000;
    }

    let mut score: i64 = 0;

    // 汉化标记加分
    if full_lower.contains("chs") { score += 100_000; }
    if full_lower.contains("_cn") || full_lower.contains("chinese")
        || full_lower.contains("\\zh\\") || full_lower.contains("/zh/")
    {
        score += 50_000;
    }

    // exe 名与目录名匹配
    if !dir_name.is_empty() && stem.contains(&dir_name.to_lowercase()) {
        score += 10_000;
    }

    // 文件体积（最多 9999 分，避免压过前两项）
    let size = std::fs::metadata(exe).map(|m| m.len()).unwrap_or(0);
    score += std::cmp::min(size / 1024, 9999) as i64;

    score
}

/// 从单个文件夹检测游戏，扫描深度 2 层（覆盖 chs/、bin/ 等子目录）
fn detect_game_from_folder(folder: &Path) -> Option<DetectedGame> {
    if !folder.is_dir() { return None; }

    let dir_name = folder.file_name().unwrap_or_default().to_string_lossy().to_string();
    let mut exe_files: Vec<PathBuf> = Vec::new();
    let mut detected_engine: Option<String> = None;

    for item in WalkDir::new(folder).max_depth(2).into_iter().filter_map(|e| e.ok()) {
        let path = item.path();
        let fname = path.file_name().unwrap_or_default().to_string_lossy();

        // 识别引擎
        for (sig, engine) in ENGINE_SIGNATURES {
            if fname.eq_ignore_ascii_case(sig) {
                detected_engine = Some(engine.to_string());
            }
        }

        // 收集 exe
        if path.extension().map(|e| e.eq_ignore_ascii_case("exe")).unwrap_or(false) {
            exe_files.push(path.to_path_buf());
        }
    }

    let best_exe = exe_files.iter().max_by_key(|p| score_exe(p, &dir_name))?.clone();

    Some(DetectedGame {
        title: dir_name,
        exe_path: best_exe.to_string_lossy().to_string(),
        install_path: folder.to_string_lossy().to_string(),
        engine: detected_engine,
    })
}

// ─── 代理工具 ────────────────────────────────────────────────

/// 解析 Windows ProxyServer 注册表值为 http:// URL。
/// 支持三种格式：纯 host:port、带 scheme 的 URL、以及 http=host:port;https=host:port。
#[cfg(target_os = "windows")]
fn parse_windows_proxy_server(proxy_server: &str) -> Option<String> {
    if proxy_server.is_empty() { return None; }
    if proxy_server.contains('=') {
        // 多协议格式，优先取 https，再取 http
        for proto in &["https", "http"] {
            let prefix = format!("{}=", proto);
            for part in proxy_server.split(';') {
                if let Some(addr) = part.trim().strip_prefix(prefix.as_str()) {
                    return Some(format!("http://{}", addr));
                }
            }
        }
        return None;
    }
    if proxy_server.starts_with("http://") || proxy_server.starts_with("https://") {
        return Some(proxy_server.to_string());
    }
    Some(format!("http://{}", proxy_server))
}

/// 读取 Windows 系统代理设置（HKCU Internet Settings）
#[cfg(target_os = "windows")]
fn detect_windows_system_proxy() -> Option<String> {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};
    let settings = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings")
        .ok()?;
    let enabled: u32 = settings.get_value("ProxyEnable").ok()?;
    if enabled == 0 { return None; }
    parse_windows_proxy_server(&settings.get_value::<String, _>("ProxyServer").ok()?)
}

/// 构建带代理的 HTTP 客户端。
/// 优先级：显式 proxy_url > 环境变量 > Windows 系统代理 > 无代理
fn build_proxy_client(proxy_url: &str) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder();

    if !proxy_url.is_empty() {
        let proxy = reqwest::Proxy::all(proxy_url)
            .map_err(|e| format!("代理地址无效: {}", e))?;
        builder = builder.proxy(proxy);
    } else {
        // 无显式代理时，尝试自动读取 Windows 系统代理（仅在未设置环境变量时）
        #[cfg(target_os = "windows")]
        if std::env::var("HTTPS_PROXY").or_else(|_| std::env::var("HTTP_PROXY"))
            .map(|v| v.is_empty()).unwrap_or(true)
        {
            if let Some(sys) = detect_windows_system_proxy() {
                if let Ok(p) = reqwest::Proxy::all(&sys) {
                    builder = builder.proxy(p);
                }
            }
        }
    }

    builder.build().map_err(|e| format!("HTTP 客户端创建失败: {}", e))
}

/// 构建 DeepSeek API 客户端，强制绕过代理（避免代理证书干扰 API 调用）
fn build_deepseek_client(api_key: &str) -> Result<OpenAIClient<OpenAIConfig>, String> {
    let config = OpenAIConfig::new()
        .with_api_key(api_key)
        .with_api_base("https://api.deepseek.com/v1");
    let http = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {}", e))?;
    Ok(OpenAIClient::with_config(config).with_http_client(http))
}

// ─── 图片下载 ────────────────────────────────────────────────

/// 下载单张图片到指定目录；若文件已存在则直接返回路径（幂等）
async fn download_to_dir(
    dir: PathBuf,
    url: &str,
    filename: &str,
    proxy_url: &str,
) -> Result<String, String> {
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;

    let dest = dir.join(filename);
    if dest.exists() {
        return Ok(dest.to_string_lossy().to_string());
    }

    let bytes = build_proxy_client(proxy_url)?
        .get(url)
        .send()
        .await
        .map_err(|e| format!("下载请求失败: {}", e))?
        .error_for_status()
        .map_err(|e| format!("HTTP 错误: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    std::fs::write(&dest, &bytes)
        .map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}

// ─── Tauri 命令 ──────────────────────────────────────────────

/// 扫描多个文件夹，每个文件夹识别为一个游戏
#[tauri::command]
fn scan_games(paths: Vec<String>) -> Result<Vec<DetectedGame>, String> {
    let games = paths.iter()
        .filter_map(|p| detect_game_from_folder(Path::new(p)))
        .collect();
    Ok(games)
}

/// 启动游戏并记录游玩时间。
/// 支持"启动器模式"：若主进程在 30 秒内退出，继续轮询安装目录下的子进程，
/// 直到所有相关进程退出后再上报本次游玩时长。
#[tauri::command]
fn launch_game(
    app_handle: tauri::AppHandle,
    exe_path: String,
    game_id: String,
) -> Result<(), String> {
    let path = Path::new(&exe_path);
    let working_dir = path.parent().unwrap_or(Path::new(".")).to_path_buf();
    let install_dir = working_dir.to_string_lossy().to_lowercase();

    let mut child = std::process::Command::new(&exe_path)
        .current_dir(&working_dir)
        .spawn()
        .map_err(|e| format!("启动失败: {}", e))?;

    let start_time = chrono::Utc::now().to_rfc3339();
    let instant = std::time::Instant::now();

    std::thread::spawn(move || {
        let _ = child.wait();

        // 若主进程 30 秒内就退出（通常是启动器），轮询安装目录下的实际游戏进程
        if instant.elapsed().as_secs() < 30 && install_dir.len() > 5 {
            std::thread::sleep(std::time::Duration::from_secs(3));
            loop {
                let still_running = sysinfo::System::new_all()
                    .processes()
                    .values()
                    .any(|p| {
                        p.exe()
                            .map(|e| e.to_string_lossy().to_lowercase().starts_with(&install_dir))
                            .unwrap_or(false)
                    });
                if !still_running { break; }
                std::thread::sleep(std::time::Duration::from_secs(2));
            }
        }

        let _ = app_handle.emit("playtime_session_ended", serde_json::json!({
            "game_id":    game_id,
            "start_time": start_time,
            "end_time":   chrono::Utc::now().to_rfc3339(),
            "duration":   instant.elapsed().as_secs(),
        }));
    });

    Ok(())
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("打开目录失败: {}", e))?;
    Ok(())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    std::process::Command::new("cmd")
        .args(["/C", "start", "", &url])
        .spawn()
        .map_err(|e| format!("打开链接失败: {}", e))?;
    Ok(())
}

#[tauri::command]
fn get_folder_size(path: String) -> Result<u64, String> {
    let total = WalkDir::new(&path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .map(|e| e.metadata().map(|m| m.len()).unwrap_or(0))
        .sum();
    Ok(total)
}

#[tauri::command]
fn find_save_directories(install_path: String) -> Result<Vec<String>, String> {
    let root = Path::new(&install_path);
    let candidates = ["save", "savedata", "Save", "SaveData", "saves", "Saves", "data"];
    let found = candidates.iter()
        .map(|name| root.join(name))
        .filter(|p| p.is_dir())
        .map(|p| p.to_string_lossy().to_string())
        .collect();
    Ok(found)
}

/// 下载封面图到 covers 目录
#[tauri::command]
async fn download_cover(
    app_handle: tauri::AppHandle,
    url: String,
    filename: String,
    proxy_url: String,
) -> Result<String, String> {
    let dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?
        .join("covers");
    download_to_dir(dir, &url, &filename, &proxy_url).await
}

/// 下载截图到 screenshots 目录
#[tauri::command]
async fn download_screenshot(
    app_handle: tauri::AppHandle,
    url: String,
    filename: String,
    proxy_url: String,
) -> Result<String, String> {
    let dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?
        .join("screenshots");
    download_to_dir(dir, &url, &filename, &proxy_url).await
}

/// 使用 DeepSeek 将视觉小说简介翻译为简体中文
#[tauri::command]
async fn deepseek_translate(api_key: String, text: String) -> Result<String, String> {
    let client = build_deepseek_client(&api_key)?;

    let req = CreateChatCompletionRequestArgs::default()
        .model("deepseek-chat")
        .temperature(0.3)
        .max_tokens(2048u32)
        .messages(vec![
            ChatCompletionRequestSystemMessageArgs::default()
                .content("你是专业游戏简介翻译器。将视觉小说简介翻译成自然流畅的简体中文，保持原文语气，不添加说明。原文已是中文则直接返回。")
                .build().map_err(|e| e.to_string())?.into(),
            ChatCompletionRequestUserMessageArgs::default()
                .content(text)
                .build().map_err(|e| e.to_string())?.into(),
        ])
        .build().map_err(|e| e.to_string())?;

    let resp = client.chat().create(req).await
        .map_err(|e| format!("DeepSeek 请求失败: {}", e))?;

    resp.choices.first()
        .and_then(|c| c.message.content.clone())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "DeepSeek 返回空响应".to_string())
}

/// 发送最小请求验证 API Key 是否有效
#[tauri::command]
async fn deepseek_test(api_key: String) -> Result<bool, String> {
    let client = build_deepseek_client(&api_key)?;

    let req = CreateChatCompletionRequestArgs::default()
        .model("deepseek-chat")
        .max_tokens(1u32)
        .messages(vec![
            ChatCompletionRequestUserMessageArgs::default()
                .content("Hi")
                .build().map_err(|e| e.to_string())?.into(),
        ])
        .build().map_err(|e| e.to_string())?;

    Ok(client.chat().create(req).await.is_ok())
}

// ─── 更新检查 ────────────────────────────────────────────────

#[derive(Serialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub latest_version: String,
    pub current_version: String,
    pub release_url: String,
    pub download_url: String,
}

#[derive(Serialize, Clone)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
}

/// 比较两个 semver 字符串，a > b 时返回 true（忽略前导 'v'）
fn version_gt(a: &str, b: &str) -> bool {
    let parse = |s: &str| -> Vec<u64> {
        s.trim_start_matches('v')
            .split('.')
            .filter_map(|x| x.parse().ok())
            .collect()
    };
    parse(a) > parse(b)
}

/// 检查 GitHub 是否有新版本，返回版本信息
#[tauri::command]
async fn check_update(
    app_handle: tauri::AppHandle,
    proxy_url: String,
) -> Result<UpdateInfo, String> {
    let current = app_handle.package_info().version.to_string();

    let client = build_proxy_client(&proxy_url)?;
    let resp = client
        .get(format!("https://api.github.com/repos/{}/releases/latest", GITHUB_REPO))
        .header("User-Agent", "GalManager")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status().as_u16()));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析失败: {}", e))?;

    let tag = json["tag_name"].as_str().ok_or("无法获取版本号")?.to_string();
    let release_url = json["html_url"].as_str().unwrap_or("").to_string();
    let has_update = version_gt(&tag, &current);

    // 从 assets 中找 NSIS 安装包（优先 x64-setup.exe，其次任意 setup.exe）
    let download_url = json["assets"]
        .as_array()
        .and_then(|assets| {
            assets
                .iter()
                .find(|a| {
                    a["name"]
                        .as_str()
                        .map(|n| n.ends_with("_x64-setup.exe"))
                        .unwrap_or(false)
                })
                .or_else(|| {
                    assets.iter().find(|a| {
                        a["name"]
                            .as_str()
                            .map(|n| n.to_lowercase().contains("setup") && n.ends_with(".exe"))
                            .unwrap_or(false)
                    })
                })
                .and_then(|a| a["browser_download_url"].as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_default();

    Ok(UpdateInfo {
        has_update,
        latest_version: tag,
        current_version: format!("v{}", current),
        release_url,
        download_url,
    })
}

/// 流式下载更新安装包到临时目录，通过事件上报进度，返回本地文件路径
#[tauri::command]
async fn download_update(
    app_handle: tauri::AppHandle,
    url: String,
    proxy_url: String,
) -> Result<String, String> {
    use std::io::Write;

    let filename = url.split('/').last().unwrap_or("GalManager-setup.exe");
    let dest = std::env::temp_dir().join(filename);

    let client = build_proxy_client(&proxy_url)?;
    let resp = client
        .get(&url)
        .header("User-Agent", "GalManager")
        .timeout(std::time::Duration::from_secs(300))
        .send()
        .await
        .map_err(|e| format!("下载请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status().as_u16()));
    }

    let total = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = std::fs::File::create(&dest)
        .map_err(|e| format!("创建文件失败: {}", e))?;

    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("读取数据失败: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("写入失败: {}", e))?;
        downloaded += chunk.len() as u64;
        let _ = app_handle.emit("update_download_progress", DownloadProgress { downloaded, total });
    }

    Ok(dest.to_string_lossy().to_string())
}

/// 启动已下载的安装包（NSIS 安装程序），启动后应用可继续运行直到用户确认
#[tauri::command]
fn install_update(path: String) -> Result<(), String> {
    std::process::Command::new(&path)
        .spawn()
        .map_err(|e| format!("启动安装程序失败: {}", e))?;
    Ok(())
}

/// 测试 VNDB 连接（使用指定代理），返回延迟毫秒数
#[tauri::command]
async fn test_vndb_connection(proxy_url: String) -> Result<u64, String> {
    let client = build_proxy_client(&proxy_url)?;
    let start = std::time::Instant::now();
    match client
        .get("https://api.vndb.org/kana/stats")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => Ok(start.elapsed().as_millis() as u64),
        Ok(resp) => Err(format!("HTTP {}", resp.status().as_u16())),
        Err(e) => Err(format!("连接失败: {}", e)),
    }
}

/// 将 VNDB 英文标签与用户配置的类型标签库匹配，返回适用的标签（零个或多个）
#[tauri::command]
async fn deepseek_match_tags(
    api_key: String,
    vndb_tags: Vec<String>,
    genre_tags: Vec<String>,
) -> Result<Vec<String>, String> {
    if vndb_tags.is_empty() || genre_tags.is_empty() || api_key.is_empty() {
        return Ok(vec![]);
    }

    let client = build_deepseek_client(&api_key)?;

    let req = CreateChatCompletionRequestArgs::default()
        .model("deepseek-chat")
        .temperature(0.0)
        .max_tokens(256u32)
        .messages(vec![
            ChatCompletionRequestSystemMessageArgs::default()
                .content("你是视觉小说分类专家。根据给定的VNDB英文标签，从可用类型标签中选出适合这部作品的标签，以JSON数组格式输出。没有匹配则输出[]。只输出JSON数组。")
                .build().map_err(|e| e.to_string())?.into(),
            ChatCompletionRequestUserMessageArgs::default()
                .content(format!(
                    "VNDB标签：{}\n可用类型标签：{}\n\n输出适合的类型标签（JSON数组）：",
                    vndb_tags.join(", "),
                    genre_tags.join("、"),
                ))
                .build().map_err(|e| e.to_string())?.into(),
        ])
        .build().map_err(|e| e.to_string())?;

    let raw = client.chat().create(req).await
        .map_err(|e| format!("DeepSeek 请求失败: {}", e))?
        .choices.first()
        .and_then(|c| c.message.content.clone())
        .unwrap_or_default();

    // 从响应中提取 JSON 数组（兼容 markdown 代码块等多余格式）
    let json_str = match (raw.find('['), raw.rfind(']')) {
        (Some(s), Some(e)) if e > s => &raw[s..=e],
        _ => "[]",
    };

    let matched: Vec<String> = serde_json::from_str(json_str).unwrap_or_default();

    // 白名单过滤：剔除不在 genre_tags 中的标签，防止 AI 幻觉
    let genre_set: std::collections::HashSet<&str> = genre_tags.iter().map(|s| s.as_str()).collect();
    Ok(matched.into_iter().filter(|t| genre_set.contains(t.as_str())).collect())
}

// ─── 应用入口 ────────────────────────────────────────────────

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
            check_update,
            download_update,
            install_update,
            test_vndb_connection,
            deepseek_translate,
            deepseek_test,
            deepseek_match_tags,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 应用启动失败");
}
