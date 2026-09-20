import { useEffect, useRef, useState } from "react";
import {
  Braces,
  BookMarked,
  Images,
  Minus,
  Plus,
  Rows2,
  Rows3,
  SlidersHorizontal,
  Type,
  UserCircle2,
} from "lucide-react";
import type { Persona } from "../../types/persona";
import type { Lorebook } from "../../types/lorebook";
import { useT } from "../../i18n";

interface Props {
  /** Current chat font size in px, shown so the user can tell where the slider sits. */
  fontSize: number;
  imageSize: number;
  density: "compact" | "comfortable";
  personas: Persona[];
  personaId: string | null;
  lorebooks: Lorebook[];
  lorebookId: string | null;
  onFontSize: (delta: number) => void;
  onImageSize: (delta: number) => void;
  onDensity: (density: "compact" | "comfortable") => void;
  onPersona: (personaId: string | null) => void;
  onLorebook: (lorebookId: string | null) => void;
  onOpenLoreInspector: () => void;
  onOpenGallery: () => void;
  onOpenVariables: () => void;
  /** Controlled open state, so the first-run guide can show this menu. Uncontrolled when omitted. */
  menuOpen?: boolean;
  onMenuChange?: (open: boolean) => void;
}

function Row({ icon: Icon, label, children }: { icon: typeof Type; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span className="flex w-[5.5rem] shrink-0 items-center gap-1.5 text-xs font-medium text-text-faint">
        <Icon size={13} />
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
    </div>
  );
}

function Stepper({ onDecrease, onIncrease, children }: { onDecrease: () => void; onIncrease: () => void; children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex items-center gap-1 rounded-md border border-border px-1">
      <button onClick={onDecrease} title={t("chat.options.stepDown")} aria-label={t("chat.options.stepDown")} className="cursor-pointer rounded p-1 text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text">
        <Minus size={13} />
      </button>
      <span className="min-w-10 text-center text-xs tabular-nums text-text">{children}</span>
      <button onClick={onIncrease} title={t("chat.options.stepUp")} aria-label={t("chat.options.stepUp")} className="cursor-pointer rounded p-1 text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text">
        <Plus size={13} />
      </button>
    </div>
  );
}

/**
 * Chat display and per-chat options.
 *
 * These controls used to live as a row of loose buttons in the header, which made the bar crowded
 * and pushed the narrative tools (Memoria, NPCs, Estado) into the noise. They are all "set once and
 * forget" options, so they belong behind one entry point.
 */
export function ChatOptionsMenu({
  fontSize,
  imageSize,
  density,
  personas,
  personaId,
  lorebooks,
  lorebookId,
  onFontSize,
  onImageSize,
  onDensity,
  onPersona,
  onLorebook,
  onOpenLoreInspector,
  onOpenGallery,
  onOpenVariables,
  menuOpen,
  onMenuChange,
}: Props) {
  const t = useT();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const controlled = menuOpen !== undefined;
  const open = controlled ? menuOpen : uncontrolledOpen;

  function setOpen(next: boolean | ((current: boolean) => boolean)) {
    const value = typeof next === "function" ? next(open) : next;
    if (!controlled) setUncontrolledOpen(value);
    onMenuChange?.(value);
  }

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  /** Closes the menu then runs the action, so a modal never opens behind an open popover. */
  function runAndClose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={t("chat.options.menuTitle")}
        data-tour="view-menu"
        className={`flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-bg-elevated-2 hover:text-text ${
          open ? "bg-bg-elevated-2 text-text" : "text-text-muted"
        }`}
      >
        <SlidersHorizontal size={14} />
        <span>{t("chat.options.view")}</span>
      </button>

      {open && (
        <div
          role="menu"
          data-tour="view-menu-panel"
          className="absolute right-0 top-full z-30 mt-1 w-80 overflow-hidden rounded-lg border border-border-strong bg-bg-elevated-2 py-1 shadow-lg"
        >
          <Row icon={Type} label={t("chat.options.fontSize")}>
            <Stepper onDecrease={() => onFontSize(-1)} onIncrease={() => onFontSize(1)}>
              {fontSize + "px"}
            </Stepper>
          </Row>

          <Row icon={Images} label={t("chat.options.images")}>
            <Stepper onDecrease={() => onImageSize(-10)} onIncrease={() => onImageSize(10)}>
              {imageSize}%
            </Stepper>
          </Row>

          <Row icon={density === "compact" ? Rows2 : Rows3} label={t("chat.options.density")}>
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <button
                onClick={() => onDensity("comfortable")}
                className={`cursor-pointer rounded px-2 py-1 text-xs transition-colors ${density === "comfortable" ? "bg-bg-hover font-semibold text-text shadow-sm" : "text-text-muted hover:text-text"}`}
              >
                {t("chat.options.densityComfortable")}
              </button>
              <button
                onClick={() => onDensity("compact")}
                className={`cursor-pointer rounded px-2 py-1 text-xs transition-colors ${density === "compact" ? "bg-bg-hover font-semibold text-text shadow-sm" : "text-text-muted hover:text-text"}`}
              >
                {t("chat.options.densityCompact")}
              </button>
            </div>
          </Row>

          <div className="my-1 border-t border-border" />

          <Row icon={UserCircle2} label={t("chat.options.persona")}>
            <select
              value={personaId ?? ""}
              onChange={(event) => onPersona(event.target.value || null)}
              title={t("chat.options.personaHint")}
              className="min-w-0 flex-1 cursor-pointer rounded-md border border-border bg-bg px-2 py-1 text-xs text-text outline-none"
            >
              <option value="">{t("chat.options.personaNone")}</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>{persona.name}</option>
              ))}
            </select>
          </Row>

          <Row icon={BookMarked} label={t("chat.options.lorebook")}>
            <select
              value={lorebookId ?? ""}
              onChange={(event) => onLorebook(event.target.value || null)}
              aria-label={t("chat.options.lorebookLabel")}
              title={t("chat.options.lorebookHint")}
              className="min-w-0 flex-1 cursor-pointer rounded-md border border-border bg-bg px-2 py-1 text-xs text-text outline-none"
            >
              <option value="">{t("chat.options.lorebookGlobal")}</option>
              {lorebooks.map((book) => (
                <option key={book.id} value={book.id}>{book.name}</option>
              ))}
            </select>
          </Row>

          <div className="my-1 border-t border-border" />

          <button
            role="menuitem"
            onClick={() => runAndClose(onOpenLoreInspector)}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
          >
            <BookMarked size={14} />
            {t("chat.options.openLoreInspector")}
          </button>
          <button
            role="menuitem"
            onClick={() => runAndClose(onOpenGallery)}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
          >
            <Images size={14} />
            {t("chat.options.openGallery")}
          </button>
          <button
            role="menuitem"
            onClick={() => runAndClose(onOpenVariables)}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
          >
            <Braces size={14} />
            {t("chat.variables.title")}
          </button>
        </div>
      )}
    </div>
  );
}
