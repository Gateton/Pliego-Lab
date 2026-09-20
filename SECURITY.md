# Security

Pliego Lab is a local, single-user application. Do not expose it directly to the Internet without additional authentication, isolation, and security configuration.

## Reporting a vulnerability

Do not publish credentials, private paths, chats, or an exploitable vulnerability in a public issue. Use a private GitHub Security Advisory when available, or contact the repository maintainers directly.

Include the following when possible:

- affected version or commit;
- operating system and Node.js version;
- minimal reproduction steps;
- observed impact;
- a suggested mitigation, if available.

## Sensitive data

- Never upload `.env`, API keys, `backend/data/`, chats, private characters, or personal images.
- API keys are stored on the backend, and conversations are sent to the provider configured by the user.
- For import issues, replace private files with a minimal anonymized fixture.
