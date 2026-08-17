# Velocity Dash (Sonic-style Runner)

Editor source ejected from Base44, set up to run locally and deploy to [Fly.io](https://fly.io).

The game itself is unchanged from the Base44 editor: `src/pages/Game.jsx`, `src/lib/sfx.js`, and `src/components/game/TouchControls.jsx`. Auth is not required to play.

## Local

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

| Input | Action |
| --- | --- |
| ← → or A D | Move |
| ↑ / W / Space | Jump |
| ↓ or S | Roll / attack |
| Mobile buttons | Same actions |

Beat Eggman (stomp or roll, 6 hits), then touch the GOAL flag.

## Fly.io

```bash
fly apps create velocity-dash-zone
fly deploy
```

The app is a static Vite build served by nginx. After deploy it will be at `https://velocity-dash-zone.fly.dev`.

## What changed from the ejected tree

- `src/App.jsx` boots the game directly (no Base44 login gate).
- `vite.config.js` keeps the `@/` alias and drops the Base44 cloud plugin so local and Fly builds do not call Base44.
- `Dockerfile`, `nginx.conf`, and `fly.toml` serve `dist/` on Fly.

Auth pages, the Base44 SDK client, and `base44/` config are still in the repo if you want to reconnect later.
