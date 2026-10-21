# Price Tracker — frontend

Vue 3 + Vite SPA for the Amazon price tracker. It is a pure API client: everything it
shows comes from the Symfony backend in `../backend`.

Setup, configuration, deployment and the API reference live in the
[root README](../README.md). Frontend conventions (data service, sidecharts, Tailwind
v4) are in [CLAUDE.md](CLAUDE.md) and [docs/](docs).

```bash
npm install
npm run dev     # http://localhost:5173, talking to the API on :8077
npm run build   # emits into ../backend/public/app
```
