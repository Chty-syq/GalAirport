import { useState } from "react";
import { X, Settings, FolderSearch, FolderOpen, Tag, GitBranch, HelpCircle, ChevronRight, CheckCircle2 } from "lucide-react";

interface Props {
  onClose: () => void;
}

interface Step {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  content: React.ReactNode;
}

const STEPS: Step[] = [
  {
    icon: <Settings className="w-4 h-4" />,
    title: "初始设置",
    subtitle: "配置 API 与网络",
    content: (
      <div className="space-y-5">
        <div>
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
            配置 DeepSeek API Key
          </h4>
          <div className="pl-7 space-y-2 text-xs text-text-muted leading-relaxed">
            <p>打开 <span className="text-accent font-medium">设置 → API 配置</span>，填入你的 DeepSeek API Key。</p>
            <p>API Key 用于：导入时自动将 VNDB 英文简介翻译为中文，以及将 VNDB 标签智能匹配到你的标签库。</p>
            <div className="mt-3 p-3 bg-surface-2 rounded-lg border border-surface-3 space-y-1">
              <p className="font-medium text-text-secondary">如何获取 Key？</p>
              <p>前往 <span className="font-mono text-accent">platform.deepseek.com</span> 注册账号，在「API Keys」页面创建即可。费用极低，正常使用月均不超过几分钱。</p>
            </div>
            <div className="mt-2 p-3 bg-amber-500/8 rounded-lg border border-amber-500/20">
              <p className="text-amber-600 dark:text-amber-400 font-medium">注意</p>
              <p className="text-text-muted mt-0.5">DeepSeek 请求不走代理，请确保能直连 DeepSeek 服务器。若无 Key，导入时可跳过翻译，事后在详情页手动触发。</p>
            </div>
          </div>
        </div>

        <div className="border-t border-surface-3" />

        <div>
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
            检查 VNDB 网络连通性
          </h4>
          <div className="pl-7 space-y-2 text-xs text-text-muted leading-relaxed">
            <p>GalAirport 通过 <span className="font-mono text-accent">api.vndb.org</span> 获取游戏封面、评分、简介、标签等元数据，无需注册账号。</p>
            <p>若你的网络无法直连 VNDB，请在 <span className="text-accent font-medium">设置 → API 配置 → 代理地址</span> 中填入本地代理：</p>
            <div className="font-mono text-[11px] bg-surface-2 border border-surface-3 rounded-lg px-3 py-2 text-text-secondary">
              http://127.0.0.1:7890
            </div>
            <p>留空时程序自动读取 Windows 系统代理。代理仅用于 VNDB 封面/截图下载，不影响 DeepSeek 请求。</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: <FolderSearch className="w-4 h-4" />,
    title: "导入游戏",
    subtitle: "扫描或手动添加",
    content: (
      <div className="space-y-5">
        <div>
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
            扫描导入（推荐）
          </h4>
          <div className="pl-7 space-y-2 text-xs text-text-muted leading-relaxed">
            <p>点击顶部工具栏的 <span className="text-accent font-medium">「扫描」</span> 按钮，选择存放游戏的根目录。</p>
            <p>程序会扫描该目录下 2 层子目录，<strong className="text-text-secondary">每个子文件夹视为一个游戏</strong>，并按以下规则自动选择启动 EXE：</p>
            <ul className="space-y-1 list-none">
              {["优先包含「游戏」「中文」「汉化」字样的 EXE", "其次按文件名与文件夹名相似度排序", "最后按文件体积选取最大 EXE"].map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">·</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-surface-3" />

        <div>
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
            审核匹配结果
          </h4>
          <div className="pl-7 space-y-2 text-xs text-text-muted leading-relaxed">
            <p>扫描完成后进入 <strong className="text-text-secondary">审核页</strong>，程序会展示每款游戏的自动匹配结果，你可以：</p>
            <ul className="space-y-1">
              {[
                "确认匹配正确，直接点「导入」",
                "点「换一个」搜索并手动选择正确的 VNDB 条目",
                "点「跳过匹配」，以无元数据状态导入，事后在详情页补充",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3 h-3 text-accent mt-0.5 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-surface-3" />

        <div>
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
            手动添加
          </h4>
          <div className="pl-7 text-xs text-text-muted leading-relaxed">
            <p>点击顶部 <span className="text-accent font-medium">「添加」</span> 按钮，手动填写游戏名称和 EXE 路径。适合目录结构不规则或已有游戏信息的情况。添加后可在详情页触发 VNDB 匹配。</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: <FolderOpen className="w-4 h-4" />,
    title: "合集",
    subtitle: "游戏分组管理",
    content: (
      <div className="space-y-5">
        <div className="p-3 bg-accent/8 rounded-xl border border-accent/15 text-xs text-text-secondary leading-relaxed">
          合集适合按<strong className="text-text-primary">游戏系列</strong>或<strong className="text-text-primary">自定义主题</strong>分组，例如「Key 社作品」「游玩中合集」「妹系」等。
        </div>

        <div>
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
            创建合集
          </h4>
          <div className="pl-7 text-xs text-text-muted leading-relaxed">
            点击顶部工具栏的 <span className="text-accent font-medium">「新建合集」</span> 按钮，输入合集名称即可创建。合集会出现在左侧边栏的「合集」区域。
          </div>
        </div>

        <div className="border-t border-surface-3" />

        <div>
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
            添加游戏到合集
          </h4>
          <div className="pl-7 text-xs text-text-muted leading-relaxed space-y-1">
            <p>在游戏卡片或列表行上点击 <span className="text-accent font-medium">「…」菜单</span>，选择「加入合集」，然后选择目标合集。</p>
            <p className="text-text-muted/60">一个游戏只能属于一个合集。若需移出，同样通过「…」菜单操作。</p>
          </div>
        </div>

        <div className="border-t border-surface-3" />

        <div>
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
            按合集筛选
          </h4>
          <div className="pl-7 text-xs text-text-muted leading-relaxed space-y-1">
            <p>点击左侧边栏的合集名称，游戏库只显示该合集内的游戏。<strong className="text-text-secondary">再次点击</strong>取消筛选。</p>
            <p>点击边栏「全部」按钮可切换是否同时显示未分类游戏。</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: <Tag className="w-4 h-4" />,
    title: "标签",
    subtitle: "分类与智能筛选",
    content: (
      <div className="space-y-5">
        <div className="p-3 bg-accent/8 rounded-xl border border-accent/15 text-xs text-text-secondary leading-relaxed">
          GalAirport 使用<strong className="text-text-primary">自定义标签库</strong>而非直接同步 VNDB 的英文标签，由 AI 负责将 VNDB 标签映射到你定义的中文标签。
        </div>

        <div>
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
            管理标签库
          </h4>
          <div className="pl-7 text-xs text-text-muted leading-relaxed space-y-1">
            <p>前往 <span className="text-accent font-medium">设置 → 标签库</span>，查看、新增或删除标签。</p>
            <p>默认预置了百合、悬疑、奇幻、恋爱喜剧等 12 个常用类型。你可以完全自定义。</p>
          </div>
        </div>

        <div className="border-t border-surface-3" />

        <div>
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
            AI 自动打标
          </h4>
          <div className="pl-7 text-xs text-text-muted leading-relaxed space-y-1">
            <p>导入游戏时（需配置 DeepSeek Key），AI 会根据 VNDB 标签自动从标签库中选择匹配的标签打给游戏。</p>
            <p>也可在详情页点击 <span className="text-accent font-medium">「AI 匹配标签」</span> 手动触发。</p>
          </div>
        </div>

        <div className="border-t border-surface-3" />

        <div>
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
            标签筛选
          </h4>
          <div className="pl-7 text-xs text-text-muted leading-relaxed space-y-1">
            <p>左侧边栏点击标签进行筛选，支持<strong className="text-text-secondary">多标签组合</strong>（AND 逻辑）。</p>
            <p>点击「清除」按钮一键取消所有标签筛选。</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: <GitBranch className="w-4 h-4" />,
    title: "攻略图",
    subtitle: "可视化剧情流程",
    content: (
      <div className="space-y-5">
        <div className="p-3 bg-accent/8 rounded-xl border border-accent/15 text-xs text-text-secondary leading-relaxed">
          攻略图使用 <strong className="text-text-primary">Mermaid flowchart</strong> 语法绘制游戏剧情树，支持 AI 生成和手动编辑。
        </div>

        <div>
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
            打开攻略图
          </h4>
          <div className="pl-7 text-xs text-text-muted leading-relaxed">
            在游戏卡片的「…」菜单中点击 <span className="text-accent font-medium">「攻略图」</span>，或在详情页中找到对应入口。
          </div>
        </div>

        <div className="border-t border-surface-3" />

        <div>
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
            节点类型与语法
          </h4>
          <div className="pl-7 space-y-2 text-xs text-text-muted">
            <p className="leading-relaxed">使用 Mermaid 语法，首行固定为 <span className="font-mono text-accent">flowchart TD</span>，然后按以下规则定义节点：</p>
            <div className="space-y-1.5 font-mono text-[11px]">
              {[
                { syntax: "([文字])", color: "bg-blue-500/20 text-blue-400", label: "药丸形", desc: "主线叙事节点" },
                { syntax: "[文字]", color: "bg-rose-500/20 text-rose-400", label: "矩形", desc: "玩家选择节点" },
                { syntax: "{{文字}}", color: "bg-green-500/20 text-green-400", label: "六边形", desc: "分支决策节点" },
                { syntax: "((文字))", color: "bg-purple-500/20 text-purple-400", label: "圆形", desc: "路线结局节点" },
              ].map((n) => (
                <div key={n.syntax} className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${n.color} shrink-0 w-20 text-center`}>{n.syntax}</span>
                  <span className="text-text-secondary shrink-0">{n.label}</span>
                  <span className="text-text-muted/60">— {n.desc}</span>
                </div>
              ))}
            </div>
            <p className="text-text-muted/60 leading-relaxed pt-1">连线：<span className="font-mono">A --&gt; B</span>（实线）或 <span className="font-mono">A --文字--&gt; B</span>（带标签）</p>
          </div>
        </div>

        <div className="border-t border-surface-3" />

        <div>
          <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
            AI 生成攻略图
          </h4>
          <div className="pl-7 text-xs text-text-muted leading-relaxed space-y-1">
            <p>点击「编辑」后切换到 <span className="text-accent font-medium">「AI 生成」</span> 面板，用自然语言描述游戏剧情结构，例如：</p>
            <div className="mt-2 p-2.5 bg-surface-2 rounded-lg border border-surface-3 text-text-muted/80 italic">
              "共三条主线，第一章末尾选择分叉。A 线有真结局和普通结局，B 线一个结局，C 线有隐藏结局需要满足条件解锁。"
            </div>
            <p className="mt-2">按 <kbd className="px-1.5 py-0.5 text-[10px] bg-surface-3 border border-surface-4 rounded font-mono">Ctrl+Enter</kbd> 或点击「生成」，AI 会生成 Mermaid 代码，可在左侧代码区手动微调。</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: <HelpCircle className="w-4 h-4" />,
    title: "常见问题",
    subtitle: "FAQ",
    content: (
      <div className="space-y-4">
        {[
          {
            q: "扫描后游戏封面全是空白？",
            a: "通常是 VNDB 网络不通导致图片下载失败。请在「设置 → API 配置」中配置代理地址，格式为 http://127.0.0.1:7890。配置后在游戏详情页点「重新拉取封面」。",
          },
          {
            q: "导入时简介没有被翻译？",
            a: "请检查 DeepSeek API Key 是否填写正确，余额是否充足。也可在详情页点「翻译简介」单独触发。若 Key 无误仍失败，可能是 DeepSeek 服务暂时不可用，稍后重试即可。",
          },
          {
            q: "游戏 EXE 识别错误怎么办？",
            a: "在游戏详情页点「编辑」，手动选择正确的 EXE 文件。如果是多个 EXE 的游戏（如带启动器），程序会在主 EXE 退出后继续监测目录内其他进程，直到全部关闭。",
          },
          {
            q: "VNDB 没有找到对应的游戏？",
            a: "部分游戏在 VNDB 上可能仅有日文原名，请尝试用罗马字或原文标题搜索。在详情页点「从 VNDB 匹配」进入手动搜索界面，找到后点击确认替换。",
          },
          {
            q: "攻略图代码报错无法渲染？",
            a: "常见原因：节点 ID 包含中文空格或特殊字符，或箭头语法写错。建议节点 ID 用英文字母+数字（如 A1、B2），显示文字写在方括号内。错误信息显示在预览区顶部，可按提示定位问题行。",
          },
          {
            q: "删除游戏会删除本地文件吗？",
            a: "不会。删除操作仅移除 GalAirport 数据库中的记录，本地游戏文件完全不受影响。",
          },
        ].map(({ q, a }) => (
          <div key={q} className="p-3 bg-surface-2 rounded-xl border border-surface-3 space-y-1.5">
            <p className="text-xs font-semibold text-text-primary flex items-start gap-1.5">
              <span className="text-accent mt-0.5 shrink-0">Q</span>
              {q}
            </p>
            <p className="text-xs text-text-muted leading-relaxed pl-4">{a}</p>
          </div>
        ))}
      </div>
    ),
  },
];

export function HelpDialog({ onClose }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const step = STEPS[activeStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 dialog-overlay backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-3xl bg-surface-1 border border-surface-3 rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: "88vh" }}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-3 shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">使用帮助</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-3 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        {/* 主体：左步骤导航 + 右内容 */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* 左侧步骤列表 */}
          <nav className="w-44 shrink-0 border-r border-surface-3 flex flex-col py-3 bg-surface-0/50">
            {STEPS.map((s, i) => {
              const active = i === activeStep;
              return (
                <button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors relative ${
                    active ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                  }`}
                >
                  {/* 步骤序号 */}
                  <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                    active ? "bg-accent text-white" : "bg-surface-3 text-text-muted"
                  }`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${active ? "text-accent" : ""}`}>{s.title}</p>
                    <p className="text-[10px] text-text-muted truncate mt-0.5">{s.subtitle}</p>
                  </div>
                  {active && <ChevronRight className="w-3 h-3 text-accent absolute right-2" />}
                </button>
              );
            })}

            {/* 页脚 */}
            <div className="mt-auto px-4 pt-3 border-t border-surface-3 mx-2">
              <p className="text-[9px] text-text-muted/40 leading-relaxed">
                数据来源 vndb.org<br />AI 翻译 DeepSeek<br />本软件免费开源
              </p>
            </div>
          </nav>

          {/* 右侧内容区 */}
          <div className="flex-1 overflow-y-auto min-w-0">
            {/* 内容标题 */}
            <div className="sticky top-0 z-10 bg-surface-1 border-b border-surface-3 px-6 py-4 flex items-center gap-3">
              <span className="text-accent">{step.icon}</span>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{step.title}</h3>
                <p className="text-[10px] text-text-muted">{step.subtitle}</p>
              </div>
            </div>

            {/* 内容正文 */}
            <div className="px-6 py-5">
              {step.content}
            </div>

            {/* 翻页按钮 */}
            <div className="px-6 pb-5 flex justify-between items-center">
              <button
                onClick={() => setActiveStep((p) => Math.max(0, p - 1))}
                disabled={activeStep === 0}
                className="text-xs text-text-muted hover:text-text-secondary disabled:opacity-30 transition-colors"
              >
                ← 上一步
              </button>
              <span className="text-[10px] text-text-muted/50">{activeStep + 1} / {STEPS.length}</span>
              <button
                onClick={() => setActiveStep((p) => Math.min(STEPS.length - 1, p + 1))}
                disabled={activeStep === STEPS.length - 1}
                className="text-xs text-accent hover:text-accent-hover disabled:opacity-30 transition-colors"
              >
                下一步 →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
