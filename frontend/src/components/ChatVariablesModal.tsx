import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useT } from "../i18n";
import { Button, Modal, inputClasses } from "./ui";

interface Props {
  variables: Record<string, string>;
  onSave: (variables: Record<string, string>) => void;
  onClose: () => void;
}

export function ChatVariablesModal({ variables, onSave, onClose }: Props) {
  const t = useT();
  const [entries, setEntries] = useState<[string, string][]>([]);

  useEffect(() => {
    setEntries(Object.entries(variables).map(([k, v]) => [k, v]));
  }, [variables]);

  function update(index: number, key: string, value: string) {
    setEntries((prev) => prev.map((e, i) => (i === index ? [key, value] : e)));
  }
  function remove(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }
  function add() {
    setEntries((prev) => [...prev, ["", ""]]);
  }
  function loadExample() {
    setEntries([
      [t("chat.variables.example.weatherName"), t("chat.variables.example.weatherValue")],
      [t("chat.variables.example.locationName"), t("chat.variables.example.locationValue")],
      [t("chat.variables.example.timeName"), t("chat.variables.example.timeValue")],
    ]);
  }
  function save() {
    const result: Record<string, string> = {};
    for (const [k, v] of entries) {
      const key = k.trim();
      if (key) result[key] = v;
    }
    onSave(result);
  }

  return (
    <Modal title={t("chat.variables.title")} onClose={onClose} size="md">
      <p className="mb-3 text-xs text-text-muted">
        {t("chat.variables.hint.prefix")}
        <code className="rounded bg-bg-elevated-2 px-1">{t("chat.variables.example.weatherName")}</code>,{" "}
        <code className="rounded bg-bg-elevated-2 px-1">{t("chat.variables.example.locationName")}</code>
        {t("chat.variables.hint.middle")}
        <code className="rounded bg-bg-elevated-2 px-1">{`{{${t("chat.variables.example.weatherName")}}}`}</code>
        {t("chat.variables.hint.suffix")}
      </p>
      <div className="flex flex-col gap-2">
        {entries.length === 0 && <p className="text-sm text-text-muted">{t("chat.variables.empty")}</p>}
        {entries.map(([key, value], i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={key}
              onChange={(e) => update(i, e.target.value, value)}
              placeholder={t("chat.variables.keyPlaceholder")}
              className={`${inputClasses} w-32!`}
            />
            <input
              value={value}
              onChange={(e) => update(i, key, e.target.value)}
              placeholder={t("chat.variables.valuePlaceholder")}
              className={inputClasses}
            />
            <button onClick={() => remove(i)} aria-label={t("chat.variables.remove")} title={t("chat.variables.remove")} className="cursor-pointer rounded p-1.5 text-text-muted transition-colors hover:text-danger">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={add}>
          <Plus size={14} />
          {t("chat.variables.add")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadExample}
          title={t("chat.variables.loadExampleHint", {
            weather: t("chat.variables.example.weatherName"),
            location: t("chat.variables.example.locationName"),
            time: t("chat.variables.example.timeName"),
          })}
        >
          {t("chat.variables.loadExample")}
        </Button>
        <div className="flex-1" />
        <Button variant="primary" size="sm" onClick={save}>
          {t("common.actions.save")}
        </Button>
      </div>
    </Modal>
  );
}
