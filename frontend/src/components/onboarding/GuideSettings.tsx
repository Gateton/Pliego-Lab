import { Compass, Route, Sparkles } from "lucide-react";
import { useT } from "../../i18n";
import { Button, PageHeader } from "../ui";

interface Props {
  onOpenGuide: () => void;
  onOpenWizard: () => void;
}

/** Settings → Guide. The permanent way back into the first-run onboarding. */
export function GuideSettings({ onOpenGuide, onOpenWizard }: Props) {
  const t = useT();

  return (
    <div>
      <PageHeader
        icon={Compass}
        title={t("onboarding.guide.title")}
        description={t("onboarding.guide.description")}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={onOpenGuide}>
          <Route size={14} />
          {t("onboarding.guide.open")}
        </Button>
        <Button variant="secondary" onClick={onOpenWizard}>
          <Sparkles size={14} />
          {t("onboarding.guide.repeatSetup")}
        </Button>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-text-faint">
        {t("onboarding.guide.hintPrefix")} <strong>?</strong> {t("onboarding.guide.hintSuffix")}
      </p>
    </div>
  );
}
