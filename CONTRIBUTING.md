# Contributing to Pliego Lab

Thank you for helping improve Pliego Lab. The project is local and single-user, but it welcomes improvements to storytelling, memory, visual tools, providers, and the user experience.

## Before opening a pull request

1. Review existing issues and check whether your proposal has already been discussed.
2. For large changes, open an issue first with the problem, proposed solution, and impact on existing data.
3. Do not include API keys, chats, private characters, personal images, or files from `backend/data/`.
4. Preserve compatibility with character and lorebook formats imported from SillyTavern unless the change documents a migration.

## Local development

Requirements: Node.js 20 or newer and npm.

```bash
cp backend/.env.example backend/.env
# Add a key if you want to generate text from the development environment.

cd backend && npm install && npm test && npm run build
cd ../frontend && npm install && npm run i18n:check && npm run lint && npm run build
```

You can also use `./start.sh` or `start.bat` to launch the local application.

## Pull requests

A pull request should include:

- The problem it solves and how it can be tested.
- Screenshots or a video when it changes the interface.
- Tests, or an explanation of why they do not apply.
- Migration notes when it changes the data format or storage.
- Confirmation that it contains no secrets or personal data.

Changes must preserve the local nature of the application and must not add telemetry without explicit consent.

## License

By submitting a contribution, you agree that it may be distributed under the Apache License 2.0, like the project, unless we agree otherwise in writing.
