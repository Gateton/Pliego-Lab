import { useCallback, useEffect, useState } from "react";
import * as directorApi from "../api/imageDirector";
import type { CharacterVisualState, ImageDirectorSettings } from "../types/imageDirector";

export interface DirectorRunContext {
  character?: { name: string; description: string; personality: string; scenario: string; imageTags: string };
  npcs?: Array<{ name: string; values: Record<string, string> }>;
  persona?: { name: string; imageTags: string };
  recentMessages?: Array<{ role: string; content: string }>;
  visualState?: Record<string, CharacterVisualState>;
  chatId?: string;
}

export function useImageDirector() {
  const [settings, setSettings] = useState<ImageDirectorSettings | null>(null);
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setSettings(await directorApi.getImageDirectorSettings());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(async (next: ImageDirectorSettings) => {
    setSettings(await directorApi.updateImageDirectorSettings(next));
  }, []);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const list = await directorApi.listImageDirectorModels();
      setModels(list);
    } catch {
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const run = useCallback(async (text: string, context?: DirectorRunContext) => {
    return directorApi.runImageDirector(text, context);
  }, []);

  return { settings, update, refresh, models, modelsLoading, loadModels, run };
}
