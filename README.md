# GalAirport

本地 Galgame 库管理器，基于 Tauri 2 + React + TypeScript 构建。

## 功能

### 游戏库管理
- 手动添加游戏，或扫描本地目录批量导入
- 自动识别游戏引擎（KiriKiri、NScripter、Unity、SiglusEngine 等）
- 网格 / 列表两种视图，支持按标题、评分、发售日、游玩时长、添加时间排序
- 支持多选批量删除
- 卡片大小与间距可在外观设置中个性化调整

### 合集与标签
- 合集分组，支持自定义排序
- 侧边栏「全部」开关：开启时显示全部游戏并清除合集筛选，关闭时仅显示未加入任何合集的游戏
- 多标签筛选，标签库可在设置中自定义

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

### 攻略图
- 内置 Mermaid 流程图渲染，可为每款游戏添加可视化攻略路线图
- 支持自定义节点样式（菱形分支、矩形章节、椭圆结局等）

### Magpie 超分辨率
- 可在「设置 → API 配置」中启用，启动游戏时自动拉起 Magpie
- 支持在设置界面直接打开 Magpie.exe 进行参数配置

### 其他
- 多主题配色切换
- 侧边栏支持上传自定义头像（持久化存储）
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
| 流程图 | Mermaid.js |

## 开发

**环境要求**：Node.js ≥ 18、Rust 工具链、Tauri CLI 所需依赖（WebView2、VS Build Tools）

```bash
# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 构建
npm run tauri build

# 生成icon
npm run tauri icon <path-to-image>
```

构建产物在 `src-tauri/target/release/bundle/` 目录下。

## 版本发布

使用 `scripts/deploy.ps1` 自动完成版本号更新、提交、打标签并推送：

```powershell
# 升级补丁版本（默认）
.\scripts\deploy.ps1

# 升级次版本
.\scripts\deploy.ps1 -Type minor

# 升级主版本
.\scripts\deploy.ps1 -Type major

# 指定版本号
.\scripts\deploy.ps1 -Version 2.0.0
```

版本号统一以 `package.json` 为单一来源，构建时自动同步到 Tauri 和 Cargo。

## 设置

打开应用后进入「设置 → API 配置」：

- **DeepSeek API Key**：用于简介翻译和标签匹配，可在 [platform.deepseek.com](https://platform.deepseek.com) 获取，留空则跳过翻译
- **Magpie**：启用后启动游戏时自动拉起超分辨率工具
- 封面与截图下载自动使用系统代理，无需手动配置

进入「设置 → 标签库」可自定义 AI 匹配时使用的类型标签列表。

进入「设置 → 外观」可调整卡片大小、卡片间距等显示选项。
