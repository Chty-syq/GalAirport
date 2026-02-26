# GalManager — 本地 Galgame 管理器

一个基于 Tauri 2 + React + TypeScript 的 Windows 桌面应用，用于管理本地安装的 Galgame。

## 功能 (MVP)

- **游戏库管理** — 手动添加或扫描文件夹自动发现游戏
- **引擎识别** — 自动识别 KiriKiri、NScripter、Unity 等常见引擎
- **元数据编辑** — 标题、开发商、发售日、评分、标签、备注
- **封面墙 / 列表** — 两种视图模式切换
- **一键启动** — 直接从管理器启动游戏
- **搜索筛选** — 按标题搜索，按状态筛选，多种排序方式
- **深色主题** — 专为 Galgame 爱好者设计的暗色 UI

## 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://rustup.rs/) >= 1.77
- [Tauri CLI prerequisites](https://v2.tauri.app/start/prerequisites/) (Windows: WebView2, VS Build Tools)

## 快速开始

```bash
# 1. 克隆或解压项目后进入目录
cd galgame-manager

# 2. 安装前端依赖
npm install

# 3. 开发模式运行
npm run tauri dev

# 4. 构建发布版本
npm run tauri build
```

构建产物在 `src-tauri/target/release/bundle/` 目录下。

## 项目结构

```
galgame-manager/
├── src/                    # React 前端
│   ├── components/         # UI 组件
│   │   ├── GameCard.tsx    # 卡片视图的游戏卡片
│   │   ├── GameListRow.tsx # 列表视图的行
│   │   ├── GameDetail.tsx  # 游戏详情侧边栏
│   │   ├── GameForm.tsx    # 添加/编辑表单
│   │   ├── ScanDialog.tsx  # 扫描对话框
│   │   └── Toolbar.tsx     # 工具栏(搜索/筛选/排序)
│   ├── hooks/
│   │   └── useGameLibrary.ts  # 游戏库状态管理
│   ├── lib/
│   │   ├── database.ts     # SQLite 数据库操作层
│   │   └── utils.ts        # 工具函数
│   ├── types/
│   │   └── game.ts         # TypeScript 类型定义
│   ├── App.tsx             # 主应用组件
│   ├── main.tsx            # 入口
│   └── styles.css          # 全局样式
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── lib.rs          # Tauri commands (扫描/启动/存档检测)
│   │   └── main.rs         # 入口
│   ├── capabilities/
│   │   └── default.json    # Tauri 权限配置
│   ├── Cargo.toml
│   └── tauri.conf.json     # Tauri 配置
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 架构说明

| 层 | 技术 | 作用 |
|---|---|---|
| 前端 | React 19 + TypeScript + Tailwind CSS | 用户界面 |
| 后端 | Rust + Tauri 2 | 文件扫描、进程启动、系统调用 |
| 数据库 | SQLite (tauri-plugin-sql) | 游戏元数据持久化 |
| 通信 | Tauri IPC (invoke) | 前后端命令调用 |

## 后续计划

- [ ] VNDB API 自动匹配元数据
- [ ] 游玩时间自动记录
- [ ] 存档备份/恢复
- [ ] Locale Emulator 转区启动集成
- [ ] Bangumi 同步
- [ ] 导入/导出游戏库
