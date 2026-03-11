# GalManager

本地 Galgame 库管理器，基于 Tauri 2 + React + TypeScript 构建。

## 功能

### 游戏库管理
- 手动添加游戏，或扫描本地目录批量导入
- 自动识别游戏引擎（KiriKiri、NScripter、Unity、SiglusEngine 等）
- 网格 / 列表两种视图，支持按标题、评分、发售日、游玩时长、添加时间排序
- 合集分组，支持自定义排序；侧边栏"显示全部"开关可切换仅看未分类游戏

### 状态与游玩时间
- 四档状态：未开始 / 游玩中 / 已通关 / 全线通关
- 自动记录每次游玩时长并累计统计

### VNDB 元数据匹配
从 VNDB 数据库搜索并一键导入：

- **封面图**：拉取该作所有发行版的封面（实体正面 / 盘面 / 数字版），自由选择使用哪张
- **截图**：自动下载游戏截图
- **基本信息**：标题、原始标题、开发商、发售日
- **评分数据**：VNDB 评分、投票数、平均游玩时长
- **简介**：可借助 DeepSeek 自动翻译为简体中文
- **类型标签**：通过 DeepSeek 从自定义标签库中智能匹配

### DeepSeek AI
- 自动翻译英文 / 日文游戏简介为简体中文
- 根据 VNDB 标签从用户定义的标签库中匹配类型

### 其他
- 多主题配色切换
- 截图灯箱，支持键盘左右键翻页
- 一键打开游戏目录 / 存档目录
- 网络请求自动使用系统代理（支持 HTTP / SOCKS5），DeepSeek 直连

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 19 + TypeScript + Vite |
| 样式 | Tailwind CSS |
| 后端 | Rust（reqwest、serde、walkdir、sysinfo） |
| 数据库 | SQLite（tauri-plugin-sql） |
| AI | DeepSeek API（兼容 OpenAI 协议） |

## 开发

**环境要求**：Node.js ≥ 18、Rust 工具链、Tauri CLI 所需依赖（WebView2、VS Build Tools）

```bash
# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 构建
npm run tauri build
```

构建产物在 `src-tauri/target/release/bundle/` 目录下。

## 设置

打开应用后进入「设置 → API 配置」：

- **DeepSeek API Key**：用于简介翻译和标签匹配，可在 [platform.deepseek.com](https://platform.deepseek.com) 获取，留空则跳过翻译
- 封面与截图下载自动使用系统代理，无需手动配置

进入「设置 → 标签库」可自定义 AI 匹配时使用的类型标签列表。
