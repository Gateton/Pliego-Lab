import { config } from "./config.js";
import { createApp } from "./app.js";
import { migratePrompts } from "./services/migratePrompts.js";
import { migrateGenerationSettings } from "./services/migrateGenerationSettings.js";
import { seedDefaultCharacters } from "./services/defaultCharacters.js";
import { seedDefaultSamplingPreset } from "./services/seedDefaultSamplingPreset.js";

const app = createApp();

migratePrompts()
  .then(() => migrateGenerationSettings())
  .then(() => seedDefaultSamplingPreset())
  .then(() => seedDefaultCharacters())
  .catch((error) => {
    console.error("[migrations] failed:", error);
  })
  .finally(() => {
    app.listen(config.port, config.host, () => {
      console.log(`Pliego Lab backend listening on http://${config.host}:${config.port}`);
    });
  });
