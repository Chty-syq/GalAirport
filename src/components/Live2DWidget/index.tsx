import { useEffect, useRef, useState, useCallback } from "react";
import { Settings, HelpCircle } from "lucide-react";
import { Bubble } from "./Bubble";
import { MODEL_LIST, DEFAULT_MODEL_ID } from "./models";

// 宽度匹配侧边栏 w-56 = 224px
const SIDEBAR_W = 224;
const CUBISM_CORE_URL = "/live2dcubismcore.min.js";
const CUBISM2_SDK_URL = "/live2d.min.js";

// 圆形按钮弧形布局（以 canvas 坐标系为基准）
const ARC_CENTER = { x: SIDEBAR_W / 2, y: 100 };
const ARC_RADIUS = 80;
const BTN_SIZE = 36;
const ARC_BTNS = [
  { key: "settings", angleDeg: 40 },
  { key: "help",     angleDeg: 70 },
];

function arcPos(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: ARC_CENTER.x + ARC_RADIUS * Math.sin(rad) - BTN_SIZE / 2,
    y: ARC_CENTER.y - ARC_RADIUS * Math.cos(rad) - BTN_SIZE / 2,
  };
}

function loadScript(src: string, globalCheck: () => boolean): Promise<void> {
  if (globalCheck()) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Failed: ${src}`)));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed: ${src}`));
    document.head.appendChild(script);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadCubismCore = () => loadScript(CUBISM_CORE_URL, () => !!(window as any).Live2DCubismCore);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadCubism2SDK = () => loadScript(CUBISM2_SDK_URL, () => !!(window as any).Live2D);

// 从 model JSON 中提取 hitArea → motionGroup 映射 和 motionGroup → motionEntries 映射
interface MotionEntry {
  Text?: string;
  TextDelay?: number;
  TextDuration?: number;
}

function parseModelJson(modelData: Record<string, unknown>) {
  // motionGroup → entries[]
  const motions =
    (modelData.FileReferences as Record<string, unknown>)?.Motions ??
    (modelData.motions as Record<string, unknown>) ??
    {};
  const motionMap: Record<string, MotionEntry[]> = {};
  for (const [group, entries] of Object.entries(motions as Record<string, unknown>)) {
    // 某些旧格式 entries 是 { $values: [...] }
    const arr = (entries as { $values?: MotionEntry[] }).$values ??
      (entries as MotionEntry[]);
    if (Array.isArray(arr)) motionMap[group] = arr;
  }

  // hitArea name → motionGroup
  const hitAreaMap: Record<string, string> = {};
  // 支持三种格式：Cubism 4 (HitAreas[])、Cubism 2 标准 (hit_areas[])、ViewerEX (hit_areas.$values[])
  const hitAreasC4 = (modelData.HitAreas as { Name: string; Motion?: string }[]) ?? [];
  const hitAreasRaw = modelData.hit_areas;
  const hitAreasC2 = (
    Array.isArray(hitAreasRaw)
      ? (hitAreasRaw as Array<{ name: string }>)
      : ((hitAreasRaw as { $values?: Array<{ name: string }> })?.$values ?? [])
  ).map((a) => ({ Name: a.name }));
  const hitAreas = hitAreasC4.length > 0 ? hitAreasC4 : hitAreasC2;
  const groupKeys = Object.keys(motionMap);
  for (const area of hitAreas) {
    const name = area.Name ?? "";
    let group = "";
    const motion = (area as { Name: string; Motion?: string }).Motion;
    if (motion) {
      group = motion.split(":")[0];
    } else {
      // 按 "Tap" + name 或 "tap_" + name 或直接名称匹配
      group =
        groupKeys.find(
          (g) =>
            g.toLowerCase() === `tap${name.toLowerCase()}` ||
            g.toLowerCase() === `tap_${name.toLowerCase()}` ||
            g.toLowerCase() === name.toLowerCase()
        ) ?? "";
    }
    if (group) hitAreaMap[name.toLowerCase()] = group;
  }

  return { motionMap, hitAreaMap };
}

function isCubism4Json(modelData: Record<string, unknown>): boolean {
  return "FileReferences" in modelData;
}

interface Props {
  enabled: boolean;
  modelId?: string;
  visibleHeight?: number;
  showHitAreas?: boolean;
  onSettings: () => void;
  onHelp: () => void;
}

export function Live2DWidget({
  enabled,
  modelId = DEFAULT_MODEL_ID,
  visibleHeight = 200,
  showHitAreas = false,
  onSettings,
  onHelp,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  // 角色实际显示高度（px），用于百分比→像素换算
  const charDisplayHRef = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hitAreasGfxRef = useRef<any>(null);
  const showHitAreasRef = useRef(showHitAreas);
  showHitAreasRef.current = showHitAreas;

  const [visibleH, setVisibleH] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const [bubbleText, setBubbleText] = useState("");
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBubble = useCallback((text: string, duration = 5000) => {
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    setBubbleText(text);
    bubbleTimerRef.current = setTimeout(() => setBubbleText(""), duration);
  }, []);

  const modelDef = MODEL_LIST.find((m) => m.id === modelId) ?? MODEL_LIST[0];
  const modelUrl = modelDef.url;

  useEffect(() => {
    if (!enabled || !containerRef.current) {
      setModelReady(false);
      setVisibleH(0);
      return;
    }

    let destroyed = false;
    setModelFailed(false);

    const init = async () => {
      // 清除容器内可能残留的旧 canvas（异常退出时未清理的情况）
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }

      let canvas: HTMLCanvasElement | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let app: any = null;

      try {
        // 先加载 model JSON 以判断 Cubism 版本，再加载对应 SDK
        let hitAreaMap: Record<string, string> = {};
        let motionMap: Record<string, MotionEntry[]> = {};
        let cubism4 = true;
        try {
          const modelData = await (await fetch(modelUrl)).json();
          cubism4 = isCubism4Json(modelData);
          ({ hitAreaMap, motionMap } = parseModelJson(modelData));
        } catch { /* 解析失败则无交互文字 */ }

        if (cubism4) {
          await loadCubismCore();
        } else {
          await loadCubism2SDK();
        }
        if (destroyed) return;

        const PIXI = await import("pixi.js");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let Live2DModel: any;
        if (cubism4) {
          ({ Live2DModel } = await import("pixi-live2d-display/cubism4"));
        } else {
          ({ Live2DModel } = await import("pixi-live2d-display/cubism2"));
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Live2DModel.registerTicker(PIXI.Ticker as any);
        if (destroyed) return;

        // 每次加载都创建新 canvas，避免复用已销毁的 WebGL context
        canvas = document.createElement("canvas");
        canvas.style.cssText = "position:absolute;top:0;left:0;display:block;";
        containerRef.current!.appendChild(canvas);
        if (destroyed) { canvas.remove(); return; }

        app = new PIXI.Application({
          view: canvas,
          width: SIDEBAR_W,
          height: 800,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        const model = await Live2DModel.from(modelUrl, { autoInteract: false });

        if (destroyed) {
          model.destroy();
          app.destroy(true);
          return;
        }

        const origW = model.internalModel.originalWidth;
        const origH = model.internalModel.originalHeight;

        // 扫描用的小尺寸（越小越快，精度够用即可）
        const SCAN_W = 200;
        const SCAN_H = Math.round(origH / origW * SCAN_W);
        const scanScale = SCAN_W / origW;

        // 设置模型到扫描姿态
        model.scale.set(scanScale);
        model.anchor.set(0.5, 1.0);
        model.x = SCAN_W / 2;
        model.y = SCAN_H;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.stage.addChild(model as any);

        // 等一帧让 ticker 初始化模型内部状态
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (destroyed) { model.destroy(); app.destroy(true); return; }

        // 渲染到小尺寸 RenderTexture，扫描不透明像素确定角色实际宽度
        const rt = PIXI.RenderTexture.create({ width: SCAN_W, height: SCAN_H });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.renderer.render(model as any, rt as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pixels: Uint8Array = (app.renderer as any).extract.pixels(rt);
        rt.destroy(true);

        let pMinX = SCAN_W, pMaxX = -1;
        let pMinY = SCAN_H, pMaxY = -1;
        for (let y = 0; y < SCAN_H; y++) {
          for (let x = 0; x < SCAN_W; x++) {
            if (pixels[(y * SCAN_W + x) * 4 + 3] > 5) {
              if (x < pMinX) pMinX = x;
              if (x > pMaxX) pMaxX = x;
              if (y < pMinY) pMinY = y;
              if (y > pMaxY) pMaxY = y;
            }
          }
        }

        // 换算回原始坐标系
        const charW = pMaxX >= pMinX ? (pMaxX - pMinX + 1) / scanScale : origW;
        const charTopOrigY = pMinY >= 0 ? pMinY / scanScale : 0;
        console.log(`[Live2D] origW=${origW} charW=${Math.round(charW)} charTopOrigY=${Math.round(charTopOrigY)}`);

        // 用角色实际宽度计算缩放，使角色填满侧边栏
        const fitScale = SIDEBAR_W / charW;
        const modelH = Math.round(origH * fitScale);

        // 角色显示高度（px）
        const charDisplayH = pMaxY >= pMinY
          ? Math.round((pMaxY - pMinY + 1) / scanScale * fitScale)
          : modelH;
        charDisplayHRef.current = charDisplayH;

        model.scale.set(fitScale);
        // 让角色顶部（头部）对齐 canvas y=0
        model.y = Math.round((origH - charTopOrigY) * fitScale);
        app.renderer.resize(SIDEBAR_W, modelH);

        setVisibleH(Math.round(visibleHeight / 100 * charDisplayH));
        setModelReady(true);

        // 扫描命中区域并构建可视化覆盖层
        const STEP = 8;
        const PALETTE = [0xf87171, 0x60a5fa, 0xa78bfa, 0x34d399, 0xfbbf24, 0xf472b6];
        const areaColors: Record<string, number> = {};
        let palIdx = 0;
        const cells: { x: number; y: number; color: number }[] = [];
        const centroids: Record<string, { sx: number; sy: number; n: number }> = {};

        for (let px = STEP / 2; px < SIDEBAR_W; px += STEP) {
          for (let py = STEP / 2; py < modelH; py += STEP) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hits: string[] = (model as any).hitTest(px, py);
            if (!hits.length) continue;
            const name = hits[0];
            if (!areaColors[name]) areaColors[name] = PALETTE[palIdx++ % PALETTE.length];
            cells.push({ x: px - STEP / 2, y: py - STEP / 2, color: areaColors[name] });
            if (!centroids[name]) centroids[name] = { sx: 0, sy: 0, n: 0 };
            centroids[name].sx += px;
            centroids[name].sy += py;
            centroids[name].n++;
          }
        }

        const gfx = new PIXI.Graphics();
        for (const { x, y, color } of cells) {
          gfx.beginFill(color, 0.35);
          gfx.drawRect(x, y, STEP, STEP);
          gfx.endFill();
        }
        for (const [name, { sx, sy, n }] of Object.entries(centroids)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const label = new (PIXI as any).Text(name, {
            fontSize: 12, fill: 0xffffff, fontWeight: "bold",
            stroke: 0x000000, strokeThickness: 3,
          });
          label.x = sx / n - label.width / 2;
          label.y = sy / n - label.height / 2;
          gfx.addChild(label);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.stage.addChild(gfx as any);
        gfx.visible = showHitAreasRef.current;
        hitAreasGfxRef.current = gfx;

        model.interactive = true;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model.on("pointertap", (e: any) => {
          const global = e.data?.global ?? e.global;
          const hitAreas: string[] = model.hitTest(global.x, global.y);
          if (!hitAreas.length) return;

          const areaName = hitAreas[0];
          const motionGroup = hitAreaMap[areaName.toLowerCase()];
          if (!motionGroup) return;

          const entries = motionMap[motionGroup] ?? [];
          const idx = Math.floor(Math.random() * Math.max(entries.length, 1));
          model.motion(motionGroup, idx);

          const entry = entries[idx];
          if (entry?.Text) {
            const delay = entry.TextDelay ?? 0;
            const duration = entry.TextDuration ?? 6000;
            if (textDelayTimerRef.current) clearTimeout(textDelayTimerRef.current);
            if (delay > 0) {
              textDelayTimerRef.current = setTimeout(() => showBubble(entry.Text!, duration), delay);
            } else {
              showBubble(entry.Text, duration);
            }
          }
        });

        cleanupRef.current = () => {
          hitAreasGfxRef.current = null;
          model.destroy();
          app.destroy(true);
        };
      } catch (err) {
        console.error("[Live2D] Init failed:", err);
        // 清理部分初始化的资源，防止残留 canvas 影响下次加载
        try { app?.destroy(true); } catch { /* ignore */ }
        if (!app && canvas) canvas.remove();
        if (!destroyed) setModelFailed(true);
        showBubble("模型加载失败", 4000);
      }
    };

    init();

    return () => {
      destroyed = true;
      setModelReady(false);
      setVisibleH(0);
      if (textDelayTimerRef.current) clearTimeout(textDelayTimerRef.current);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, modelUrl, showBubble]);

  // 实时响应高度百分比 prop 变化
  useEffect(() => {
    if (modelReady && charDisplayHRef.current > 0) {
      setVisibleH(Math.round(visibleHeight / 100 * charDisplayHRef.current));
    }
  }, [visibleHeight, modelReady]);

  // 实时切换命中区域可视化
  useEffect(() => {
    if (hitAreasGfxRef.current) {
      hitAreasGfxRef.current.visible = showHitAreas;
    }
  }, [showHitAreas]);


  if (!enabled) return null;

  return (
    <>
      {/* 气泡：固定在模型头顶上方，在 overflow:hidden 容器之外 */}
      {bubbleText && (
        <div
          className="fixed z-[101] pointer-events-none"
          style={{
            bottom: visibleH + 8,
            left: SIDEBAR_W / 2,
            transform: "translateX(-50%)",
          }}
        >
          <Bubble text={bubbleText} />
        </div>
      )}

      <div
        className="fixed z-[100] bottom-0 left-0 select-none overflow-hidden"
        style={{
          width: SIDEBAR_W,
          height: modelFailed ? 100 : visibleH,
          transition: "height 0.4s ease",
        }}
      >
        {/* Live2D canvas 由 init() 动态创建并挂载到此容器 */}
        <div
          ref={containerRef}
          className="absolute top-0 left-0 w-full h-full"
          style={{ zIndex: 0 }}
        />

        {/* 弧形按钮 */}
        {ARC_BTNS.map(({ key, angleDeg }, i) => {
          const pos = arcPos(angleDeg);
          const isSettings = key === "settings";
          return (
            <button
              key={key}
              onClick={isSettings ? onSettings : onHelp}
              title={isSettings ? "设置" : "帮助"}
              className="absolute flex items-center justify-center rounded-full
                         bg-surface-1/75 backdrop-blur-sm border border-surface-3/60
                         hover:bg-surface-2 hover:border-accent/40 hover:scale-110
                         text-text-secondary hover:text-accent
                         shadow-lg transition-all duration-200"
              style={{
                width: BTN_SIZE,
                height: BTN_SIZE,
                left: pos.x,
                top: pos.y,
                zIndex: 1,
                opacity: modelReady || modelFailed ? 1 : 0,
                transitionDelay: `${i * 60}ms`,
              }}
            >
              {isSettings ? <Settings className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
            </button>
          );
        })}
      </div>
    </>
  );
}
