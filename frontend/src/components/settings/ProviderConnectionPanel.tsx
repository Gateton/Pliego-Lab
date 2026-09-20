import { useEffect, useState } from "react";
import { KeyRound, Plug, RotateCcw } from "lucide-react";
import { useT } from "../../i18n";
import { useProviders } from "../../hooks/useProviders";
import * as providersApi from "../../api/providers";
import { Alert, Button, Field, PageHeader, inputClasses } from "../ui";

interface Props {
  embedded?: boolean;
}

/** Provider selection + credentials. The API key is written server-side and never read back. */
export function ProviderConnectionPanel({ embedded = false }: Props) {
  const t = useT();
  const { providers, active, loading, saveProvider, setActive, setKey, deleteKey } = useProviders();
  const [keyInput, setKeyInput] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBaseUrl(active?.baseUrl ?? "");
    setKeyInput("");
    setResult(null);
  }, [active?.id, active?.baseUrl]);

  if (loading) return <p className="text-text-muted">{t("settings.providers.loading")}</p>;
  if (!active) return <Alert kind="error">{t("settings.providers.loadFailed")}</Alert>;

  async function handleTest() {
    setTesting(true);
    setResult(null);
    try {
      const res = await providersApi.testProvider(active!.id);
      setResult(
        res.ok
          ? { ok: true, message: t("settings.providers.testReplied", { reply: res.reply ?? "" }) }
          : { ok: false, message: res.error ?? t("settings.providers.unknownError") },
      );
    } catch {
      setResult({ ok: false, message: t("settings.providers.backendUnreachable") });
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveBaseUrl() {
    setSaving(true);
    try {
      await saveProvider(active!.id, { baseUrl: baseUrl.trim() });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveKey() {
    if (!keyInput.trim()) return;
    setSaving(true);
    try {
      await setKey(active!.id, keyInput.trim());
      setKeyInput("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {!embedded && (
        <PageHeader
          icon={Plug}
          title={t("settings.providers.title")}
          description={t("settings.providers.description")}
        />
      )}

      <Field label={t("settings.providers.active")} hint={active.description} className="mb-5 max-w-md">
        <select value={active.id} onChange={(e) => setActive(e.target.value)} className={inputClasses}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={t("settings.providers.baseUrl")}
        hint={
          active.baseUrl === active.defaultBaseUrl
            ? t("settings.providers.baseUrlDefault", { url: active.defaultBaseUrl })
            : t("settings.providers.baseUrlOverride", { url: active.defaultBaseUrl })
        }
        className="mb-3 max-w-md"
      >
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={active.defaultBaseUrl} className={inputClasses} />
      </Field>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={handleSaveBaseUrl} disabled={saving || baseUrl.trim() === active.baseUrl}>
          {t("settings.providers.saveBaseUrl")}
        </Button>
        {active.baseUrl !== active.defaultBaseUrl && (
          <Button variant="ghost" onClick={() => { setBaseUrl(active.defaultBaseUrl); void saveProvider(active.id, { baseUrl: "" }); }}>
            <RotateCcw size={14} />
            {t("settings.providers.restoreDefault")}
          </Button>
        )}
      </div>

      <Field
        label={t("settings.providers.apiKey")}
        // `keyHint` is only null when there is no key, so inside the branches below it is a string.
        hint={
          active.hasKey
            ? active.keyFromEnv
              ? t("settings.providers.keyFromEnv", { hint: active.keyHint ?? "" })
              : t("settings.providers.keyStored", { hint: active.keyHint ?? "" })
            : active.requiresApiKey
              ? t("settings.providers.keyMissing")
              : t("settings.providers.keyOptional")
        }
        className="mb-3 max-w-md"
      >
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder={active.hasKey ? t("settings.providers.replaceKey") : t("settings.providers.pasteKey")}
          autoComplete="off"
          className={inputClasses}
        />
      </Field>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button onClick={handleSaveKey} disabled={saving || !keyInput.trim()}>
          <KeyRound size={14} />
          {t("settings.providers.saveKey")}
        </Button>
        {active.hasKey && !active.keyFromEnv && (
          <Button variant="danger" onClick={() => deleteKey(active.id)} disabled={saving}>
            {t("settings.providers.deleteKey")}
          </Button>
        )}
        <Button variant="secondary" onClick={handleTest} disabled={testing}>
          {testing ? t("settings.providers.testing") : t("settings.providers.test")}
        </Button>
      </div>

      {result && (
        <div className="max-w-xl">
          <Alert kind={result.ok ? "success" : "error"}>{result.message}</Alert>
        </div>
      )}
      <p className="mt-3 text-xs text-text-faint">
        {t("settings.providers.testNote", { provider: active.label })}
      </p>
    </div>
  );
}
