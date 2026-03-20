interface Props {
  text: string;
}

export function Bubble({ text }: Props) {
  if (!text) return null;

  return (
    <div
      className="relative bg-surface-1 border border-surface-3 rounded-xl px-3 py-2 shadow-xl max-w-[200px] w-max pointer-events-none"
      style={{ animation: "live2d-bubble-in 0.2s ease-out" }}
    >
      <p className="text-xs leading-relaxed text-text-primary text-center whitespace-pre-wrap">
        {text}
      </p>
      {/* 尾巴朝下，指向头顶 */}
      <div
        className="absolute top-full left-1/2"
        style={{
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "6px solid var(--color-surface-3, #26243a)",
        }}
      />
      <div
        className="absolute top-full left-1/2"
        style={{
          transform: "translateX(-50%)",
          marginTop: "-1px",
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: "5px solid var(--color-surface-1, #12111b)",
        }}
      />
    </div>
  );
}
