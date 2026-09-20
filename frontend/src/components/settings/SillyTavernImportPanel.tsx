import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Download, FolderSearch, Search } from "lucide-react";
import { useT } from "../../i18n";
import * as importApi from "../../api/sillyTavernImport";
import { refreshSamplingPresets } from "../../hooks/useSamplingPresets";
import type { ScanResult, ScannedPersona } from "../../types/sillyTavernImport";
import { Alert, Button, Field, PageHeader, inputClasses } from "../ui";

export function SillyTavernImportPanel({ embedded = false }: { embedded?: boolean }) {
  const t = useT();
  const [path, setPath] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [activeUser, setActiveUser] = useState("");

  const [characterFilter, setCharacterFilter] = useState("");
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
  const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
  const [selectedLorebooks, setSelectedLorebooks] = useState<Set<string>>(new Set());

  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    importApi.getConfig().then((c) => {
      if (c.sillyTavernPath) setPath(c.sillyTavernPath);
    });
  }, []);

  async function handleScan(user?: string) {
    setScanning(true);
    setScanError("");
    setApplyResult(null);
    try {
      if (!user) await importApi.setConfig(path);
      const scanResult = await importApi.scan(user);
      setResult(scanResult);
      setActiveUser(scanResult.activeUser);
      setSelectedCharacters(new Set());
      setSelectedPresets(new Set());
      setSelectedPersonas(new Set());
      setSelectedLorebooks(new Set());
    } catch (err) {
      setScanError(err instanceof Error ? err.message : t("settings.stImport.scanError"));
      setResult(null);
    } finally {
      setScanning(false);
    }
  }

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, key: string) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSet(next);
  }

  const filteredCharacters = result?.characters.filter((c) => c.name.toLowerCase().includes(characterFilter.toLowerCase())) ?? [];

  const totalSelected = selectedCharacters.size + selectedPresets.size + selectedPersonas.size + selectedLorebooks.size;

  async function handleApply() {
    if (!result) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const personas = result.personas.filter((p) => selectedPersonas.has(p.avatarFile));
      const res = await importApi.apply({
        user: activeUser,
        characters: Array.from(selectedCharacters),
        presets: Array.from(selectedPresets),
        personas,
        lorebooks: Array.from(selectedLorebooks),
      });
      const parts = [
        t("settings.stImport.importedCharacters", { count: res.importedCharacters }),
        t("settings.stImport.importedPresets", { count: res.importedPresets }),
        t("settings.stImport.importedPersonas", { count: res.importedPersonas }),
        t("settings.stImport.importedLorebooks", { count: res.importedLorebooks }),
      ];
      const message = res.errors.length
        ? t("settings.stImport.importedWithErrors", { summary: parts.join(", "), count: res.errors.length, errors: res.errors.join(" · ") })
        : t("settings.stImport.imported", { summary: parts.join(", ") });
      setApplyResult({ ok: res.errors.length === 0, message });
      setSelectedCharacters(new Set());
      setSelectedPresets(new Set());
      setSelectedPersonas(new Set());
      setSelectedLorebooks(new Set());
      // The Response panel on the left keeps its own preset list; refresh the shared store so the
      // imported presets appear there immediately instead of after a reload.
      if (res.importedPresets > 0) await refreshSamplingPresets();
    } catch (err) {
      setApplyResult({ ok: false, message: err instanceof Error ? err.message : t("settings.stImport.applyError") });
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className={embedded ? "sg-onboarding__import-panel" : undefined}>
      {!embedded && (
        <PageHeader
          icon={Download}
          title={t("settings.stImport.title")}
          description={t("settings.stImport.description")}
        />
      )}

      <Field label={t("settings.stImport.folder")} hint={t("settings.stImport.folderHint")}>
        <div className="flex flex-wrap gap-2">
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder={t("settings.stImport.folderPlaceholder")}
            className={`${inputClasses} min-w-0 flex-1`}
          />
          <Button variant="primary" onClick={() => handleScan()} disabled={scanning || !path.trim()}>
            <FolderSearch size={16} />
            {scanning ? t("settings.stImport.scanning") : t("settings.stImport.scan")}
          </Button>
        </div>
      </Field>

      {scanError && (
        <div className="mt-4">
          <Alert kind="error">{scanError}</Alert>
        </div>
      )}

      {result && (
        <div className="mt-6 flex flex-col gap-6">
          {result.users.length > 1 && (
            <Field label={t("settings.stImport.user")} className="max-w-xs">
              <select
                value={activeUser}
                onChange={(e) => {
                  setActiveUser(e.target.value);
                  handleScan(e.target.value);
                }}
                className={inputClasses}
              >
                {result.users.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <SelectionSection
            title={t("settings.stImport.charactersTitle", { count: result.characters.length })}
            selectedCount={selectedCharacters.size}
            onSelectAll={() => setSelectedCharacters(new Set(filteredCharacters.map((c) => c.file)))}
            onSelectNone={() => setSelectedCharacters(new Set())}
          >
            <div className="relative mb-2">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" />
              <input
                placeholder={t("settings.stImport.searchCharacter")}
                value={characterFilter}
                onChange={(e) => setCharacterFilter(e.target.value)}
                className={`${inputClasses} pl-8`}
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              {filteredCharacters.map((c) => (
                <label key={c.file} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-bg-elevated-2">
                  <input
                    type="checkbox"
                    checked={selectedCharacters.has(c.file)}
                    onChange={() => toggle(selectedCharacters, setSelectedCharacters, c.file)}
                    className="accent-accent"
                  />
                  <span className="truncate text-text">{c.name}</span>
                </label>
              ))}
              {filteredCharacters.length === 0 && <p className="px-3 py-2 text-sm text-text-faint">{t("settings.stImport.noResults")}</p>}
            </div>
          </SelectionSection>

          <SelectionSection
            title={t("settings.stImport.lorebooksTitle", { count: result.lorebooks.length })}
            selectedCount={selectedLorebooks.size}
            onSelectAll={() => setSelectedLorebooks(new Set(result.lorebooks.map((book) => book.file)))}
            onSelectNone={() => setSelectedLorebooks(new Set())}
          >
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              {result.lorebooks.map((book) => (
                <label key={book.file} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-bg-elevated-2">
                  <span className="flex min-w-0 items-center gap-2"><input type="checkbox" checked={selectedLorebooks.has(book.file)} onChange={() => toggle(selectedLorebooks, setSelectedLorebooks, book.file)} className="accent-accent" /><span className="truncate text-text">{book.name}</span></span>
                  <span className="shrink-0 text-xs text-text-faint">{t("settings.stImport.entryCount", { count: book.entryCount })}</span>
                </label>
              ))}
              {result.lorebooks.length === 0 && <p className="px-3 py-2 text-sm text-text-faint">{t("settings.stImport.noLorebooks")}</p>}
            </div>
          </SelectionSection>

          <SelectionSection
            title={t("settings.stImport.presetsTitle", { count: result.presets.length })}
            selectedCount={selectedPresets.size}
            onSelectAll={() => setSelectedPresets(new Set(result.presets.map((p) => p.file)))}
            onSelectNone={() => setSelectedPresets(new Set())}
          >
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              {result.presets.map((p) => (
                <label key={p.file} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-bg-elevated-2">
                  <input
                    type="checkbox"
                    checked={selectedPresets.has(p.file)}
                    onChange={() => toggle(selectedPresets, setSelectedPresets, p.file)}
                    className="accent-accent"
                  />
                  <span className="truncate text-text">{p.name}</span>
                </label>
              ))}
              {result.presets.length === 0 && <p className="px-3 py-2 text-sm text-text-faint">{t("settings.stImport.noPresets")}</p>}
            </div>
          </SelectionSection>

          <SelectionSection
            title={t("settings.stImport.personasTitle", { count: result.personas.length })}
            selectedCount={selectedPersonas.size}
            onSelectAll={() => setSelectedPersonas(new Set(result.personas.map((p) => p.avatarFile)))}
            onSelectNone={() => setSelectedPersonas(new Set())}
          >
            <div className="rounded-md border border-border">
              {result.personas.map((p: ScannedPersona) => (
                <label key={p.avatarFile} className="flex cursor-pointer items-start gap-2 px-3 py-1.5 text-sm hover:bg-bg-elevated-2">
                  <input
                    type="checkbox"
                    checked={selectedPersonas.has(p.avatarFile)}
                    onChange={() => toggle(selectedPersonas, setSelectedPersonas, p.avatarFile)}
                    className="mt-0.5 accent-accent"
                  />
                  <span>
                    <span className="text-text">{p.name}</span>
                    {p.description && <span className="block text-xs text-text-faint">{p.description}</span>}
                  </span>
                </label>
              ))}
              {result.personas.length === 0 && <p className="px-3 py-2 text-sm text-text-faint">{t("settings.stImport.noPersonas")}</p>}
            </div>
          </SelectionSection>

          <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-bg pt-4">
            <Button variant="primary" onClick={handleApply} disabled={applying || totalSelected === 0}>
              {applying ? t("settings.stImport.applying") : t("settings.stImport.apply", { count: totalSelected })}
            </Button>
          </div>

          {applyResult && (
            <Alert kind={applyResult.ok ? "success" : "warning"}>{applyResult.message}</Alert>
          )}
        </div>
      )}
    </div>
  );
}

function SelectionSection({
  title,
  selectedCount,
  onSelectAll,
  onSelectNone,
  children,
}: {
  title: string;
  selectedCount: number;
  onSelectAll: () => void;
  onSelectNone: () => void;
  children: ReactNode;
}) {
  const t = useT();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-text">
          {title} {selectedCount > 0 && <span className="text-accent">— {t("settings.stImport.selectedCount", { count: selectedCount })}</span>}
        </h3>
        <div className="flex gap-2 text-xs">
          <button onClick={onSelectAll} className="cursor-pointer text-text-muted hover:text-text">
            {t("settings.stImport.selectAll")}
          </button>
          <span className="text-text-faint">·</span>
          <button onClick={onSelectNone} className="cursor-pointer text-text-muted hover:text-text">
            {t("settings.shared.none")}
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
