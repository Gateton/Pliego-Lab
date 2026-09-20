import { Component, type ReactNode } from "react";
import { t } from "../i18n";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors so a single broken component doesn't blank the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="font-display text-lg font-semibold text-text">{t("chrome.error.title")}</p>
          <p className="max-w-md text-sm text-text-muted">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="cursor-pointer rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
          >
            {t("chrome.error.reload")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
