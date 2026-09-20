# Privacy in Pliego Lab

Pliego Lab is a local, single-user application. This document describes the expected behavior of the initial public version and does not constitute legal advice.

## What is stored locally

The application stores chats, characters, personas, presets, lorebooks, Memoria Viva, settings, history, and other data needed to continue your work in `backend/data/`. Do not upload this directory to GitHub: it may contain conversations, imported material, and personal configuration.

Provider credentials are resolved by the backend. Depending on the provider configuration, they may come from `backend/.env` or the local secrets store. API keys are not sent to the frontend and are not included in status summaries; the interface only receives indicators such as `hasKey`, `keyHint`, and `keyFromEnv`.

## What leaves your machine

When you generate text, Pliego Lab sends the prompts, instructions, context, and parameters required for that request to the active provider. The content may include chat messages, characters, lorebooks, or Memoria Viva data when they are included in the prompt. Each provider has its own retention, training, and privacy policies.

ComfyInject and Image Director are optional. If you configure a remote ComfyUI instance or an external image endpoint, prompts, workflows, and required generation data may leave your machine according to that configuration. With local ComfyUI, the traffic stays on your computer.

SillyTavern imports read the files you select locally. SillyTavern does not need to be installed at runtime, and the imported library is not uploaded automatically.

## Telemetry and responsibility

This version does not include its own analytics or telemetry system. External services you choose may log requests under their own terms. Review their policies before using sensitive material.

Do not expose the backend directly to the Internet. If you change `HOST` or configure a remote endpoint, add appropriate authentication, access control, and network protections.

## Backups and deletion

Back up `backend/data/` before migrations or major changes. To delete local data, stop the application and remove that directory after preserving anything you want to keep. Also remove `backend/.env` and the local secrets store if you need to delete stored credentials.

To report a vulnerability, follow [`SECURITY.md`](SECURITY.md). Do not attach chats, API keys, or private files to issues or pull requests.
