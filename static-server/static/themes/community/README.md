# Community theme (example / template)

A copy-and-host **theme** for the atlas-index UIs, used here as an in-repo **test theme** while
the runtime-theming PR is under review. If the PR is accepted, this folder is the template to
extract into its own repo (e.g. `la-theme-starter`) and **self-host as static pages** on any
static web server — **no fork or rebuild of atlas-index needed to theme a portal.**

## Files

| File | What it is | Edit it? |
|---|---|---|
| `theme.json` | Manifest the app fetches; lists the URLs below | ✅ URLs + `homeUrl` |
| `theme.css` | Brand: 4 `--ala-*` values (+RGB) + `--bs-*` palette + chrome overrides | ✅ the 4 colours |
| `banner.mustache` | Header HTML (self-styled; logo via `{{logoUrl}}`, menu links) | ✅ |
| `footer.mustache` | Footer HTML (columns, links, logo, copyright) | ✅ |
| `i18n/en.json` | UI strings (Crowdin-compatible) | optional |
| `preview.html` | Local preview | — |

Logo here comes from the community artwork repo
(<https://github.com/living-atlases/artwork> → `la-logo.svg`).

## Try it locally (no rebuild)

1. Serve this repo's static dir: from `atlas-index/static-server`, run
   `npx http-server -p 8082 --cors -c-1 .`
2. Point a UI at it via its runtime `config.js` (served at the app root, overwrite — no rebuild):
   ```js
   window.APP_CONFIG = {
     VITE_THEME_CONFIG_URL: "http://localhost:8082/static/themes/community/theme.json"
   };
   ```
3. Run the UI (e.g. `npm --prefix search-ui run dev`) → teal brand + LA logo + custom footer.
4. Preview just the theme assets: open <http://localhost:8082/static/themes/community/preview.html>.

There is also an **`ala`** theme next to this one (`../ala/theme.json`) that reproduces the
current ALA look — applying it should be identical to running with no theme (regression check).

## To host for real (when extracted to a repo)

Self-host these static files on any static web server. Replace the
`http://localhost:8082/static/themes/community` URLs in `theme.json` with
your hosting URL, and set `VITE_THEME_CONFIG_URL` in the portal's `config.js` to your hosted
`theme.json`. The host must send permissive CORS (`Access-Control-Allow-Origin`) since the app
fetches these assets cross-origin.
