import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { PlayStatus } from "@/types/game";
import { statusLabel, statusColor, cn } from "@/lib/utils";

const ALL_STATUSES: PlayStatus[] = ["unplayed", "playing", "finished", "completed"];

interface Props {
  status: PlayStatus;
  onChange: (status: PlayStatus) => void;
  disabled?: boolean;
  /** Extra classes on the trigger badge */
  className?: string;
}

export function StatusDropdown({ status, onChange, disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={cn(
          "px-2 py-0.5 rounded-full text-[11px] font-medium text-white/90 backdrop-blur-sm transition-opacity",
          statusColor(status),
          !disabled && "hover:opacity-75 cursor-pointer",
          disabled && "cursor-default",
          className
        )}
      >
        {statusLabel(status)}
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="w-28 bg-surface-3 border border-surface-4 rounded-lg shadow-2xl py-1 z-[200]"
        >
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={(e) => {
                e.stopPropagation();
                onChange(s);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors",
                s === status
                  ? "text-accent bg-accent/10"
                  : "text-text-secondary hover:bg-surface-4"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusColor(s))} />
              {statusLabel(s)}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
