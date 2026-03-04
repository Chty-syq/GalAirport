import { X, Zap, FolderPlus, LayoutGrid, Clock, Globe, FolderOpen, Tag, Settings, MousePointer } from "lucide-react";

interface Props {
  onClose: () => void;
}

interface Section {
  icon: React.ReactNode;
  title: string;
  items: { label: string; desc: string }[];
}

const SECTIONS: Section[] = [
  {
    icon: <Zap className="w-4 h-4" />,
    title: "快速上手",
    items: [
      { label: "扫描导入", desc: "点击顶部「扫描」按钮，选择游戏文件夹，程序自动识别引擎和 EXE，并从 VNDB 拉取封面、评分、简介。" },
      { label: "手动添加", desc: "点击顶部「添加」按钮，手动填写游戏信息，适合无法自动匹配的游戏。" },
      { label: "启动游戏", desc: "点击游戏封面上的播放键，或在详情页点「启动游戏」。游戏运行时自动记录时长。" },
    ],
  },
  {
    icon: <FolderPlus className="w-4 h-4" />,
    title: "导入游戏",
    items: [
      { label: "文件夹结构", desc: "每个文件夹视为一个游戏。程序扫描 2 层子目录，按汉化标记、文件名相似度、文件体积自动选择主 EXE。" },
      { label: "审核匹配", desc: "自动匹配完成后进入审核页，可为每款游戏手动更换 VNDB 条目或跳过匹配。" },
      { label: "未匹配游戏", desc: "未匹配到 VNDB 的游戏仍会导入，可在详情页点「VNDB 自动匹配」补充元数据。" },
      { label: "重复检测", desc: "已导入的游戏路径会被记录，重复扫描时自动跳过。" },
    ],
  },
  {
    icon: <LayoutGrid className="w-4 h-4" />,
    title: "游戏库",
    items: [
      { label: "两种视图", desc: "卡片视图适合浏览封面，列表视图显示评分和标签，适合大量游戏快速查找。点击顶部图标切换。" },
      { label: "筛选", desc: "左侧边栏可按游玩状态、合集、标签组合筛选；顶部搜索框支持标题、开发商、备注全文搜索。" },
      { label: "排序", desc: "支持按添加时间、标题、VNDB 评分、游玩时长排序，可升降序切换。" },
      { label: "批量删除", desc: "点击顶部「多选」按钮进入选择模式，勾选后批量删除。删除仅移除库记录，不删除本地文件。" },
    ],
  },
  {
    icon: <MousePointer className="w-4 h-4" />,
    title: "游戏状态",
    items: [
      { label: "四种状态", desc: "未开始 · 游玩中 · 已通关 · 全线通关。点击卡片左上角的状态标签可直接切换，无需打开详情页。" },
      { label: "个人评分", desc: "在详情页或编辑页为游戏打 1–10 分（显示为 1–5 颗星）。" },
    ],
  },
  {
    icon: <Clock className="w-4 h-4" />,
    title: "游玩时间记录",
    items: [
      { label: "自动计时", desc: "通过「启动游戏」按钮启动时开始计时，游戏窗口关闭后自动停止并写入记录。" },
      { label: "启动器支持", desc: "部分游戏使用启动器。程序会在主进程退出后，继续监测安装目录内的子进程，直到所有相关进程结束。" },
      { label: "查看时长", desc: "在列表/卡片/详情页均可查看累计游玩时长。" },
    ],
  },
  {
    icon: <Globe className="w-4 h-4" />,
    title: "VNDB 元数据",
    items: [
      { label: "无需注册", desc: "VNDB 数据免费获取，不需要账号。封面和截图通过代理地址下载（可在设置中配置）。" },
      { label: "自动翻译", desc: "配置 DeepSeek API Key 后，英文简介自动翻译为中文，VNDB 英文标签自动匹配到类型标签库。" },
      { label: "手动匹配", desc: "在详情页点「VNDB 自动匹配」，或游戏编辑页点「从 VNDB 匹配」，可搜索并手动选择正确条目。" },
    ],
  },
  {
    icon: <FolderOpen className="w-4 h-4" />,
    title: "合集",
    items: [
      { label: "创建合集", desc: "点击顶部「新建合集」按钮，为游戏系列或自定义分组创建合集。" },
      { label: "添加游戏", desc: "在游戏卡片的「…」菜单中选择「加入合集」。一个游戏只能属于一个合集。" },
      { label: "合集筛选", desc: "左侧边栏点击合集名称，只显示该合集内的游戏。再次点击取消筛选。" },
    ],
  },
  {
    icon: <Tag className="w-4 h-4" />,
    title: "标签系统",
    items: [
      { label: "类型标签", desc: "标签从「类型标签库」中匹配，而非直接使用 VNDB 英文标签。默认包含：百合、悬疑、奇幻等 12 个类型。" },
      { label: "自定义标签库", desc: "在「设置 → 标签库」中增删标签，AI 匹配时只会从你的标签库中选择。" },
      { label: "标签筛选", desc: "左侧边栏点击标签可组合筛选（AND 逻辑），高亮的标签为当前激活的过滤条件。" },
    ],
  },
  {
    icon: <Settings className="w-4 h-4" />,
    title: "设置",
    items: [
      { label: "外观", desc: "提供 6 种主题风格（暗夜 / 明亮 / 午夜蓝 / 森林 / 樱花 / 摩卡），即时预览切换。" },
      { label: "DeepSeek API Key", desc: "用于简介翻译和标签匹配。在 platform.deepseek.com 注册获取，费用极低。DeepSeek 请求不走代理。" },
      { label: "代理地址", desc: "格式 http://127.0.0.1:7890。用于 VNDB 封面/截图下载。留空则自动读取 Windows 系统代理。" },
    ],
  },
];

export function HelpDialog({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 dialog-overlay backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[85vh] bg-surface-1 border border-surface-3 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3 shrink-0">
          <h2 className="text-base font-semibold text-text-primary">使用帮助</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-3 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              {/* 节标题 */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-accent">{section.icon}</span>
                <h3 className="text-sm font-semibold text-text-primary">{section.title}</h3>
              </div>

              {/* 条目 */}
              <div className="space-y-2 pl-6">
                {section.items.map((item) => (
                  <div key={item.label} className="flex gap-3">
                    <span className="text-xs font-medium text-text-secondary shrink-0 w-20 pt-px">
                      {item.label}
                    </span>
                    <p className="text-xs text-text-muted leading-relaxed flex-1">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* 页脚 */}
          <div className="pt-2 border-t border-surface-3 text-[10px] text-text-muted/50 text-center pb-1">
            数据来源：vndb.org · AI 翻译：DeepSeek · 本软件免费开源
          </div>
        </div>
      </div>
    </div>
  );
}
