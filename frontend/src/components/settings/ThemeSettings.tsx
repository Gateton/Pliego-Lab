import { Palette } from "lucide-react";
import { useT } from "../../i18n";
import type { AppThemeId } from "../../lib/themes";
import { PageHeader } from "../ui";
import { ThemeGrid } from "./ThemeGrid";

interface Props {
  value: AppThemeId;
  onChange: (theme: AppThemeId) => void;
}

export function ThemeSettings({ value, onChange }: Props) {
  const t = useT();

  return (
    <div>
      <PageHeader
        icon={Palette}
        title={t("settings.themes.title")}
        description={t("settings.themes.description")}
      />
      <ThemeGrid value={value} onChange={onChange} />
    </div>
  );
}
