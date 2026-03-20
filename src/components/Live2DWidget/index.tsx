import { useEffect, useRef, useState, useCallback } from "react";
import { Settings, HelpCircle } from "lucide-react";
import { Bubble } from "./Bubble";
import {
  systemMessages,
  getIdleMessages,
  getRandomFrom,
} from "./messages";

// 宽度匹配侧边栏 w-56 = 224px，高度由模型实际渲染尺寸决定
const SIDEBAR_W = 224;

const IDLE_INTERVAL_MS = 28000;
const MODEL_URL = "/Murasame/Murasame.model3.json";
const CUBISM_CORE_CDN =
  "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js";

const HIT_TO_MOTION: Record<string, string> = {
  face: "Tapface",
  hair: "Taphair",
  xiongbu: "Tapxiongbu",
  qunzi: "Tapqunzi",
  leg: "Tapleg",
};

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

function loadCubismCore(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).Live2DCubismCore) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${CUBISM_CORE_CDN}"]`
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("CDN failed")));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CUBISM_CORE_CDN;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("CDN failed"));
    document.head.appendChild(script);
  });
}

export type Live2DEvent =
  | { type: "gameAdded"; key: number }
  | { type: "gameCompleted"; key: number }
  | null;

interface Props {
  enabled: boolean;
  visibleHeight?: number;
  event?: Live2DEvent;
  onSettings: () => void;
  onHelp: () => void;
}

export function Live2DWidget({ enabled, visibleHeight = 200, event, onSettings, onHelp }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // visibleH = 0 表示模型还未加载，加载后根据模型高度计算
  const [visibleH, setVisibleH] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const [bubbleText, setBubbleText] = useState("");
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBubble = useCallback((text: string, duration = 5000) => {
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    setBubbleText(text);
    bubbleTimerRef.current = setTimeout(() => setBubbleText(""), duration);
  }, []);

  useEffect(() => {
    if (!enabled || !canvasRef.current) {
      setModelReady(false);
      setVisibleH(0);
      return;
    }

    let destroyed = false;
    let idleTimer: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      try {
        await loadCubismCore();
        if (destroyed) return;

        const PIXI = await import("pixi.js");
        const { Live2DModel } = await import("pixi-live2d-display/cubism4");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Live2DModel.registerTicker(PIXI.Ticker as any);
        if (destroyed) return;

        // 先用一个大高度初始化，加载模型后再按实际尺寸调整
        const app = new PIXI.Application({
          view: canvasRef.current!,
          width: SIDEBAR_W,
          height: 800,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        // 预加载 model3.json 以获取各 motion 的 Text 字段
        const motionTexts: Record<string, string[]> = {};
        try {
          const modelData = await (await fetch(MODEL_URL)).json();
          const motions = modelData.FileReferences?.Motions ?? {};
          for (const [group, entries] of Object.entries(motions)) {
            motionTexts[group] = (entries as { Text?: string }[]).map((e) => e.Text ?? "");
          }
        } catch { /* 获取失败则无文字 */ }

        const model = await Live2DModel.from(MODEL_URL, { autoInteract: false });

        if (destroyed) {
          model.destroy();
          app.destroy(false);
          return;
        }

        // 按宽度缩放，使模型恰好填满侧边栏宽度
        const fitScale = SIDEBAR_W / model.internalModel.originalWidth;
        const modelH = Math.round(model.internalModel.originalHeight * fitScale);

        model.scale.set(fitScale);
        model.anchor.set(0.5, 1.0);
        model.x = SIDEBAR_W / 2;
        model.y = modelH; // 脚部对齐 canvas 底部

        // 将 canvas/renderer 精确调整为模型实际高度
        app.renderer.resize(SIDEBAR_W, modelH);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.stage.addChild(model as any);

        // 初始显示高度（prop 变化由独立 effect 响应）
        setVisibleH(visibleHeight);
        setModelReady(true);

        // autoInteract:false 时仍需手动开启交互
        model.interactive = true;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model.on("pointertap", (e: any) => {
          // PIXI 6: e.data.global；PIXI 7: e.global
          const global = e.data?.global ?? e.global;
          const hitAreas: string[] = model.hitTest(global.x, global.y);
          console.debug("[Live2D] tap global:", global, "hitAreas:", hitAreas);
          if (!hitAreas.length) return;
          const area = hitAreas[0].toLowerCase();
          const motionGroup = HIT_TO_MOTION[area];
          if (!motionGroup) return;
          const texts = motionTexts[motionGroup] ?? [];
          const idx = Math.floor(Math.random() * Math.max(texts.length, 1));
          model.motion(motionGroup, idx);
          const text = texts[idx];
          if (text) showBubble(text, 8000);
        });

        showBubble(getRandomFrom(systemMessages.startup), 6000);

        idleTimer = setInterval(() => {
          showBubble(getRandomFrom(getIdleMessages()));
        }, IDLE_INTERVAL_MS);

        cleanupRef.current = () => {
          if (idleTimer) clearInterval(idleTimer);
          model.destroy();
          app.destroy(false);
        };
      } catch (err) {
        console.error("[Live2D] Init failed:", err);
      }
    };

    init();

    return () => {
      destroyed = true;
      setModelReady(false);
      setVisibleH(0);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [enabled, showBubble]);

  // 实时响应高度 prop 变化（不重新加载模型）
  useEffect(() => {
    if (modelReady) setVisibleH(visibleHeight);
  }, [visibleHeight, modelReady]);

  useEffect(() => {
    if (!event) return;
    const msgs = systemMessages[event.type] ?? [];
    if (msgs.length) showBubble(getRandomFrom(msgs), 6000);
  }, [event, showBubble]);

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
        // 模型加载前隐藏（height:0），加载后展开到 visibleH
        height: visibleH,
        transition: "height 0.4s ease",
      }}
    >
      {/* Live2D canvas：全高渲染，被容器 overflow:hidden 裁剪 */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 block"
        style={{ zIndex: 0 }}
      />

      {/* 圆形弧形按钮 */}
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
              opacity: modelReady ? 1 : 0,
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
