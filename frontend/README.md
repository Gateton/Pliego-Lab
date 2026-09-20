# Pliego Lab frontend

This directory contains the React, Vite, and TypeScript frontend for Pliego Lab. The frontend talks to the local Node and Express backend through the `/api` proxy during development.

For the complete product overview and local setup, see the [root README](../README.md).

## Requirements

- Node.js 20 or newer.
- npm.
- A running Pliego Lab backend for API-backed development.

## Development

```bash
npm install
npm run dev
```

Vite starts the frontend development server and proxies `/api` requests to the backend configured in `vite.config.ts`.

## Validation

```bash
npm run i18n:check
npm run lint
npm run build
```

The i18n check verifies that the English catalog remains compatible with the Spanish source catalog. The production build writes the frontend bundle to `dist/`.
