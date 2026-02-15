import { useEffect, useRef } from "react";
import type { Session } from "../../lib/types";

interface SessionContextMenuProps {
  session: Session;
  position: { x: number; y: number };
  onClose: () => void;
  onRename: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
}

export function SessionContextMenu({
  session,
  position,
  onClose,
  onRename,
  onTogglePin,
  onToggleArchive,
}: SessionContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Clamp position to viewport
  const menuWidth = 180;
  const menuHeight = 140;
  const clampedX = Math.min(position.x, window.innerWidth - menuWidth - 8);
  const clampedY = Math.min(position.y, window.innerHeight - menuHeight - 8);

  return (
    <div
      ref={menuRef}
      className="animate-scale-in fixed z-50 min-w-[160px] rounded-xl border border-border/50 bg-bg-secondary py-1.5 shadow-xl shadow-black/20"
      style={{ left: clampedX, top: clampedY }}
    >
      <ContextMenuItem
        label="Rename"
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        }
        onClick={() => {
          onRename();
          onClose();
        }}
      />
      <ContextMenuItem
        label={session.pinned ? "Unpin" : "Pin"}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill={session.pinned ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        }
        onClick={() => {
          onTogglePin();
          onClose();
        }}
      />
      <div className="mx-2 my-1 h-px bg-border/30" />
      <ContextMenuItem
        label={session.archived ? "Unarchive" : "Archive"}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="5" x="2" y="3" rx="1" />
            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
            <path d="M10 12h4" />
          </svg>
        }
        onClick={() => {
          onToggleArchive();
          onClose();
        }}
      />
    </div>
  );
}

interface ContextMenuItemProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function ContextMenuItem({ label, icon, onClick }: ContextMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs text-text-secondary transition-colors hover:bg-bg-tertiary/60 hover:text-text"
    >
      <span className="flex-shrink-0 opacity-70">{icon}</span>
      {label}
    </button>
  );
}
