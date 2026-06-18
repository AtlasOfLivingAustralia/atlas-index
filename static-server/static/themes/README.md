# Test themes (dev only)

Runtime theme bundles used to develop and review the theming work. They live here as **test
directories** for now; once the PR is accepted, a bundle like `community/` is meant to be
extracted into its own repo and self-hosted as static pages on any static web server — a
portal then themes the prebuilt app at runtime, no fork or rebuild of atlas-index.

| Theme | Purpose |
|---|---|
| [`ala/`](ala/) | Reproduces the current ALA look. Applying it should be **identical to no theme** → regression check ("does the theming break anything?"). |
| [`community/`](community/) | A non-ALA brand (teal + Living Atlases artwork) — the copy-and-host template/example. See its `README.md`. |

Serve them with the dev static-server (`npx http-server -p 8082 --cors -c-1 static-server` from
the repo root area) and point a UI's `config.js` at e.g.
`http://localhost:8082/static/themes/ala/theme.json`.
