import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  Axe,
  BowArrow,
  Circle,
  Crosshair,
  Hand,
  Hammer,
  MoveUpRight,
  Swords,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { FIGHTERS, type Weapon } from "../game/data";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand-compact" : ""}`}>
      <svg
        className="brand-mark"
        viewBox="0 0 40 42"
        fill="none"
        aria-hidden="true"
      >
        <path d="M9 2H19L11 17H22L7 39L11 24H1L9 2Z" fill="currentColor" />
        <path d="M29 3H39L29 21H38L20 40L26 24H17L29 3Z" fill="currentColor" />
      </svg>
      <span>
        RIFT
        <span className="brand-second">
          RIVALS<span className="brand-dot">.</span>
        </span>
      </span>
    </span>
  );
}

export function WeaponIcon({
  weapon,
  size = 17,
}: {
  weapon: Weapon;
  size?: number;
}) {
  const props = { size, strokeWidth: 1.6, "aria-hidden": true as const };
  if (weapon === "Sword" || weapon === "Katars") return <Swords {...props} />;
  if (weapon === "Scythe")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M5 21 15 4M10 5C15 1 23 5 21 12c-2-5-6-6-11-4M9 17l4 2" />
      </svg>
    );
  if (weapon === "Blasters") return <Crosshair {...props} />;
  if (weapon === "Gauntlets") return <Hand {...props} />;
  if (weapon === "Axe") return <Axe {...props} />;
  if (weapon === "Hammer") return <Hammer {...props} />;
  if (weapon === "Bow") return <BowArrow {...props} />;
  if (weapon === "Spear") return <MoveUpRight {...props} />;
  if (weapon === "Orb") return <WandSparkles {...props} />;
  if (weapon === "Nunchucks")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 19L8 7M16 5l4 12M8 7c1-3 7-3 8-2" />
        <circle cx="8" cy="7" r="1" fill="currentColor" />
        <circle cx="16" cy="5" r="1" fill="currentColor" />
      </svg>
    );
  if (weapon === "Chain Blade")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 16c4-8 10-6 16-12M6 20l2-4M18 4l2 6" />
        <circle cx="5" cy="18" r="2" />
      </svg>
    );
  if (weapon === "Cannon")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 15h14l4-5H7zM7 15v4h4v-4M15 15v4h4v-4" />
        <circle cx="7" cy="19" r="2" />
        <circle cx="15" cy="19" r="2" />
      </svg>
    );
  return <Circle {...props} />;
}

export function Portrait({
  id,
  className = "",
  style = {},
}: {
  id: string;
  className?: string;
  style?: CSSProperties;
}) {
  const index = Math.max(
    0,
    FIGHTERS.findIndex((f) => f.id === id),
  );
  return (
    <span
      aria-hidden="true"
      className={`portrait ${className}`}
      style={{
        backgroundPosition: `${(index % 5) * 25}% ${Math.min(4, Math.floor(index / 5)) * 25}%`,
        ...style,
      }}
    />
  );
}

export function Key({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return <kbd className={wide ? "key key-wide" : "key"}>{children}</kbd>;
}

export function SpecialIcon({ size = 18 }: { size?: number }) {
  return <Zap size={size} strokeWidth={1.7} aria-hidden="true" />;
}

export function Dialog({
  title,
  eyebrow,
  children,
  onClose,
  className = "",
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key !== "Tab" || !ref.current) return;
      const focusable = ref.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input, select, [tabindex="0"]',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === ref.current)
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey, true);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        ref={ref}
        tabIndex={-1}
      >
        <div className="dialog-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id="dialog-title">{title}</h2>
          </div>
          <button
            className="icon-button close-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
