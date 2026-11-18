# phoenix vs commonui-bs5: evaluation for atlas-index and common UI

**Date:** 2026-11-18. **Branch:** `feature/phoenix-demo` (atlas-index, local commit, not pushed).

**Evaluated revisions**

| Repo | Ref | How it was read |
| --- | --- | --- |
| phoenix (`@ala/ui`) | `testing` @ [`c6fbee4`](https://github.com/AtlasOfLivingAustralia/phoenix/tree/c6fbee4) | Local checkout, built with `pnpm build` (output under gitignored `dist/` only) |
| atlas-index | `feature/phoenix-demo` (base `e02fa11`) | Local checkout. In scope: `search-ui`, `occurrence-ui`, `regions-ui`, `common-ui` |
| commonui-bs5-2019 (current skin) | `main` @ [`4fcae16`](https://github.com/AtlasOfLivingAustralia/commonui-bs5-2019/tree/4fcae16) | Shallow clone outside the repos, plus the live files at `https://www.test.ala.org.au/commonui-bs5-2019/` |
| commonui-bs5-currawong (new skin) | `test` @ [`53df423`](https://github.com/AtlasOfLivingAustralia/commonui-bs5-currawong/tree/53df423) | Shallow clone outside the repos |

**Decision gates**

| Gate | Answer used |
| --- | --- |
| UIs in scope | `search-ui`, `occurrence-ui`, `regions-ui`, `common-ui` |
| Consumer matrix | Evergreen browsers (Bootstrap 5.3 browserslist), Grails/GSP apps loading `ala-combined.*` by URL, mustache-only header/footer consumers, React apps |
| Backwards compatibility | Required, in parallel: existing URLs keep working and phoenix bundles ship at new versioned URLs |
| Timeline | Unknown, so the plan is phased |
| Other atlases | Unknown, so generic examples are used |

**Conventions.** Paths starting `../` are relative to this file in atlas-index. "Unverified" marks anything I couldn't confirm from code, build output or a live request. Effort is in person-days (pd) for one developer who knows the codebase; every effort figure is an **estimate**.

---

## 1. Executive summary and recommendation

**phoenix is a better foundation than commonui-bs5 for React apps, but it can't replace commonui-bs5 yet.**

**Where phoenix is better.** These were measured on the rebuilt search page (§9):

- **Accessibility.** axe-core 4.13 (WCAG 2.0/2.1/2.2 A and AA rules) found **0 rule failures** on the phoenix page. The current page has **6 failing rules**: button-name, color-contrast (13 nodes), image-alt (12), link-name (3), select-name, target-size.
- **Keyboard support.** Facets are real checkboxes (20 focusable) that toggle from the keyboard. On the current page they are clickable `<div>`s, with 0 focusable controls.
- **CSS size.** The theme CSS is 41 KB gzip, vs 68 KB for `ala-combined.css`. A React app needs no jQuery bundle (64 KB gzip saved).
- **Dark and system modes** work, and an atlas can recolour the page with one CSS file and no rebuild.
- **Structure.** Components are typed, Storybook has 27 story files and 74 interaction tests, and a test makes every Figma candidate (128) have a component, story and Code Connect mapping.

**phoenix and currawong implement the same design.** Both use the same palette names and values; seafoam has already drifted (`#6BDAD5` in phoenix vs `#68dad5` in currawong). Both have the new quicklinks, acknowledgement and partner footer. Maintaining two hand-written copies of one design is the strongest argument for making phoenix's tokens the single source.

**Why it can't replace commonui-bs5 today:**

1. **No non-React deliverable.** No `ala-combined.js` (jQuery, Bootstrap JS, autocomplete, analytics), no mustache header or footer, no hosted URL. phoenix's own README says it "supplies no Grails plugin or Bootstrap JavaScript replacement" ([README.md#L173](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/README.md#L173)).
2. **Not distributable.** `private: true`, version `0.0.0`, no registry ([package.json#L3](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/package.json#L3)). The demo had to vendor a tarball.
3. **Header and Footer aren't production-ready for atlases.** They have no signed-in state, autocomplete, skip link or logo override, hard-coded partner content, English-only strings, and placeholder navigation links.
4. **Component gaps surfaced by real data:**
   - Result rows have a fixed 87 px height and clip content.
   - Every result title is italic.
   - Images have no fallback.
   - Pagination has only a window and Next.
   - Phoenix `Button` can't be a link.
5. **Organisational risk.** One contributor (53 commits since 2026-08-12). The README lists design deviations still awaiting designer review.

**Recommendation: adopt phoenix as the single source of truth for the ALA design, and treat commonui as a distribution target generated from phoenix.**

- **Phases 1–2: make phoenix ship and emit the legacy files.** Fix the gaps above, publish phoenix, and add a legacy build. That build emits `ala-combined.css`, `ala-combined.js`, `banner.mustache` and `footer.mustache` from phoenix tokens and components, at **new versioned URLs**. The existing `commonui-bs5-2019` URLs stay untouched (§2).
- **Phase 3: migrate the React apps page by page**, using separate HTML entries as in the demo (§3).
- **Theming:** standardise on runtime CSS custom properties (`--ala-*`) delivered through the existing `THEME_CSS_URL` runtime key, plus a small runtime "brand config" for logo, navigation and footer content (§5).

Total effort for the in-scope work is roughly **71–117 pd**, phased (§8).

**Do not** retire currawong or `commonui-bs5-2019` until the legacy build has passed visual and behavioural parity on at least one Grails app and one mustache consumer (risk R1).

---

## 2. Q1: Can phoenix output `ala-combined.css` and `ala-combined.js` equivalents?

### 2.1 What the current files contain (verified)

| File | Contents | Evidence |
| --- | --- | --- |
| `ala-combined.css` (418,358 B, 67,783 B gzip; served compressed at 85,077 B) | Bootstrap **5.3.3** plus ALA Sass (~251 KB), jQuery UI 1.12.1 autocomplete CSS (~17 KB), Font Awesome Free **6.5.2** (~140 KB across blocks, fonts at `./fonts/fa-*.ttf`), "ALA custom style rules" (~8 KB). It also `@import`s Google Fonts **Roboto and Lato**. | Live file banners; byte split from `/*!` banner offsets. Gulp concatenation at [gulpfile.js#L246](https://github.com/AtlasOfLivingAustralia/commonui-bs5-2019/blob/4fcae16/gulpfile.js#L246) |
| `ala-combined.js` (203,292 B, 64,223 B gzip) | jQuery **3.7.1**, Bootstrap **5.3.3** bundle (with Popper), jQuery UI 1.12.1 autocomplete, and `application.js`. `application.js` provides header autocomplete on `#autocompleteHeader` (defaults to `bie-ws.ala.org.au/ws/search/auto.json`, overridable through `window.BC_CONF`), `focusOnClickSearchButton()`, and Fathom `trackEvent` calls on BIE tabs. | Live file banners; [application.js#L55-L105](https://github.com/AtlasOfLivingAustralia/commonui-bs5-2019/blob/4fcae16/source/js/application.js#L55-L105), [#L108](https://github.com/AtlasOfLivingAustralia/commonui-bs5-2019/blob/4fcae16/source/js/application.js#L108), [#L122](https://github.com/AtlasOfLivingAustralia/commonui-bs5-2019/blob/4fcae16/source/js/application.js#L122); concatenation at [gulpfile.js#L257](https://github.com/AtlasOfLivingAustralia/commonui-bs5-2019/blob/4fcae16/gulpfile.js#L257) |
| `banner.mustache` (18 KB), `footer.mustache` (27 KB) | Variables: `{{containerClass}}`, `{{loginStatus}}`, `{{loginURL}}`, `{{logoutURL}}`, `{{searchServer}}{{searchPath}}`. DOM contract: `#wrapper-navbar`, `#autocompleteSearchALA`, `#autocompleteHeader`, `.loginBtn`/`.logoutBtn`, `.loginStatus.signedIn/.signedOut`. The skip link points to the literal `#INSERT_CONTENT_ID_HERE`. | Live templates (line 2 for the skip link) |
| Currawong (new skin) | Same build shape. JS order: jQuery → jQuery UI → Bootstrap → `application.js`. Adds keyboard handling for the nav submenu and an acknowledgement banner dismissed via `localStorage`. Adds hashed filenames. Mustache variables add `{{homeDomain}}`, `{{profileURL}}`, `{{signUpURL}}`, `{{fathomID}}`. Deployed on test (357,646 B CSS); **404 on prod**. | [gulpfile.js#L41](https://github.com/AtlasOfLivingAustralia/commonui-bs5-currawong/blob/53df423/gulpfile.js#L41), [application.js#L172](https://github.com/AtlasOfLivingAustralia/commonui-bs5-currawong/blob/53df423/source/js/application.js#L172), live HTTP checks |

### 2.2 What phoenix outputs today (verified by build)

| Output | Size (raw / gzip) | Notes |
| --- | --- | --- |
| `dist/phoenix.css` | 293,841 / 40,951 | Bootstrap **5.3.8** compiled with token-derived Sass variables, 98 light-mode and 39 dark-mode `--ala-*` custom properties, and component styles. Built by [build-theme.mjs](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/scripts/build-theme.mjs#L4) |
| `dist/theme.js` | 501 / 340 | `initializeTheme()` only (light, dark, system) |
| `dist/ui.js` | 80,222 / 24,135 | React components. React, React DOM and React-Bootstrap are external peers |
| `dist/assets/` | 668 KB on disk | Logos and SVGs that `phoenix.css` references by relative path |
| Fonts, icon font, jQuery, Bootstrap JS, autocomplete, mustache | **none** | README: "does not bundle or load" fonts ([#L125](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/README.md#L125)); no Bootstrap JS replacement ([#L173](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/README.md#L173)) |

### 2.3 Build changes needed

The work stays inside phoenix's existing Node and Sass toolchain. No gulp is needed. One new script, `scripts/build-legacy.mjs`, alongside `build-theme.mjs`, would do the following.

1. **CSS.** Compile a `legacy.scss` that `@use`s the phoenix theme plus:
   - Font Awesome 6.5.2: needed for parity, because GSP and mustache markup uses `fa-*` classes (the extent is unverified per Grails app).
   - jQuery UI autocomplete CSS.
   - The Google Fonts `@import`, or a `<link>` in the generated mustache head.

   Output goes to `legacy/<version>/css/ala-combined.css`, with `assets/` and `fonts/` copied alongside so relative URLs resolve. **2–3 pd.**
2. **JS.** Concatenate jQuery 3.7.1, `bootstrap/dist/js/bootstrap.bundle.js` (already a phoenix devDependency), jQuery UI autocomplete, a ported `application.js` and an IIFE build of `theme.js`, then minify. Output: `legacy/<version>/js/ala-combined.js`. **2–3 pd**, including porting currawong's nav keyboard handling and acknowledgement dismissal.
3. **Header and footer for mustache.** Server-render phoenix `Header` and `Footer` into `banner.mustache` and `footer.mustache` using `react-dom/server`. **3–5 pd.**
   - **Tested:** the import is SSR-safe and renders 41,921 B of header and 8,189 B of footer HTML.
   - The rendered markup has **0 `data-bs-*` attributes**. The Navbar toggler and 6 mega-menu toggles depend on React state, so the static HTML is inert without either (a) a ~1–2 KB vanilla shim in `ala-combined.js`, or (b) changing the components to emit Bootstrap data-API attributes.
   - Mustache placeholders (`{{loginURL}}`, `{{loginStatus}}`, `{{containerClass}}`…) and the existing `#autocompleteHeader` and `.loginBtn` hooks must be added as props or slots. Otherwise atlas-index `cleanMustache` ([utils.tsx#L145](../common-ui/src/util/utils.tsx#L145)) and the Grails layouts can't integrate them.
4. **Publish.** CI uploads `legacy/<version>/` to a static host under a new, versioned prefix, for example `https://www.test.ala.org.au/commonui-phoenix/1.0.0/`, plus a moving `latest/` alias. The hosting target and pipeline are unverified; phoenix's only deploy pipeline today is Storybook on AWS. **1–2 pd.**
5. **Parity tests.** Extend `test:package` with a legacy fixture covering:
   - jQuery and Bootstrap JS present (`window.jQuery`, `bootstrap.Collapse`).
   - Autocomplete attaches to `#autocompleteHeader`.
   - Login and logout class toggling works.
   - Visual snapshot of the mustache header and footer.

   **2–3 pd.**

**Total: about 10–16 pd.** The difficulty is mainly in item 3: making phoenix's React-driven header work as static HTML.

### 2.4 Parity with today's files

| Aspect | Parity achievable? | Caveat |
| --- | --- | --- |
| Bootstrap classes and utilities | Yes (5.3.3 → 5.3.8, a minor version) | phoenix restyles Bootstrap globally: body text 16 px (was 14 px), `.btn-primary` becomes a white pill with a rust border and arrow, `:focus-visible` outline changes. That is the new design, but **every consumer page changes appearance**. Layering test: body 14 → 16 px and page height 3,282 → 3,866 px (+18%) on the current search page |
| ALA-specific classes (`#wrapper-navbar`, `.site-footer`, `.loginStatus`, `.ala-btn-*`) | Partly | phoenix uses `.ala-header__*` and `.ala-footer__*` BEM classes. Selectors on old header and footer ids must be shimmed or dropped. `.ala-btn-primary` is defined in search-ui's own `index.css`, not commonui ([index.css#L5](../search-ui/src/index.css#L5)) |
| JS behaviour (jQuery global, Bootstrap data-API, autocomplete, Fathom) | Yes, by bundling the same libraries | Bundling jQuery keeps the 64 KB gzip cost for legacy consumers |
| Fonts (Roboto and Lato via `@import`) | Yes | phoenix intentionally doesn't load fonts. For drop-in parity the legacy CSS must re-add the import |
| Icons (Font Awesome 6 webfont) | Yes, if bundled | phoenix uses 52 inline SVG icons, so FA would be legacy-only weight (~140 KB raw) |

### 2.5 Backwards compatibility for URL consumers

- **Never overwrite** `…/commonui-bs5-2019/css/ala-combined.css` and its siblings. Publish phoenix output at **new versioned URLs** and let each consumer opt in by changing one URL. In atlas-index that's `THEME_CSS_URL`/`THEME_JS_URL`/`THEME_HEADER_URL`/`THEME_FOOTER_URL` in `config.local.js` ([runtimeTheme.tsx#L40](../common-ui/src/util/runtimeTheme.tsx#L40), PR #186); in Grails it's the layout or `header_and_footer_baseurl`.
- Keep the **same file names and relative layout** (`css/`, `js/`, `banner.mustache`, `footer.mustache`) so consumers switch by changing a base URL.
- Version the path, because 2019 doesn't and currawong only hashes filenames. That allows pinning and rollback, which phoenix's README already asks for ([#L548](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/README.md#L548)).
- A drop-in replacement at the same URL is **not recommended**: the visual changes above would hit every consumer at once.

---

## 3. Q2: Migration effort for atlas-index UIs

### 3.1 Current integration (verified)

- **CSS.** `injectCommonInfo()` inserts `ala-combined.css` as the *first* `<link>` in `<head>`, so app CSS wins ([utils.tsx#L77](../common-ui/src/util/utils.tsx#L77), [#L107](../common-ui/src/util/utils.tsx#L107)). App render waits for that CSS.
- **Header and footer.** `Header` fetches the mustache, runs `cleanMustache`, writes `innerHTML`, wires `.loginBtn`/`.logoutBtn`, then loads `ala-combined.js` sequentially ([header.tsx#L60](../common-ui/src/components/header.tsx#L60), [#L76](../common-ui/src/components/header.tsx#L76), [#L118](../common-ui/src/components/header.tsx#L118)).
- **Runtime overrides.** All five URLs and the container class can be overridden at runtime through `THEME_*` (PR #186). Service URLs can be overridden too (PR #195), and i18n catalogues are loaded at runtime (PR #183). All of this lives in the LA Community build only.
- **regions-ui has no runtime config.** Its `index.html` has no `config.js` ([index.html#L15](../regions-ui/index.html#L15)), and it passes `VITE_COMMON_FOOTER_HTML` directly ([App.tsx#L89](../regions-ui/src/App.tsx#L89)).
- **Pre-existing issues found along the way:**
  - The header skip link targets `#INSERT_CONTENT_ID_HERE`, which `cleanMustache` never replaces, so the link is broken.
  - `App` wraps header and footer inside `<main>` ([App.tsx#L75](../search-ui/src/App.tsx#L75)).
  - In dev, `ala-combined.css` is injected twice because of StrictMode's double effect (observed: two identical `<link>`s).

### 3.2 Per-app size and markup style

Measured with grep over non-test `.tsx` files, excluding the new demo folder.

| App | `.tsx` files / LOC | CSS lines | react-bootstrap import lines | Raw Bootstrap class uses¹ | `style={{…}}` | Clickable `div`/`span` | Native `button`/`select`/`input`/`table` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| common-ui | 45 / 2,325 | 136 | **0** | 6 | 48 | 2 | 11 / 1 / 0 / 0 |
| search-ui | 31 / 7,074 | 4,451 | **0** | 57 | 333 | 13 | 16 / 3 / 4 / 13 |
| occurrence-ui | 62 / 14,807 | 6,454 | 18 (Modal ×13, Popover, Overlay, Tabs) | 577 | 276 | 16 | 86 / 40 / 62 / 24 |
| regions-ui | 5 / 1,820 | 149 | 2 (Accordion, Tabs, Tooltip, OverlayTrigger, Container) | 10 | 8 | 1 | 10 / 0 / 4 / 0 |

¹ `className` values containing `btn`, `row`, `col-*`, `form-*`, `nav-*`, `dropdown*`, `modal*`, `pagination`, `badge`, `alert`, `card`, `table` or `list-group`.

This confirms the brief: the apps are React, but **search-ui and common-ui use no react-bootstrap at all**. Interactive elements are often `<div onClick>`. For example, the search tabs ([Search.tsx#L255](../search-ui/src/views/Search.tsx#L255)), the facets ([genericView.tsx#L312](../search-ui/src/components/search/genericView.tsx#L312)) and a hand-made modal without a focus trap ([genericView.tsx#L493](../search-ui/src/components/search/genericView.tsx#L493)).

### 3.3 Keeping configurability

| Mechanism today | With phoenix | Effort |
| --- | --- | --- |
| `.env` / `VITE_*` and runtime `VITE_APP_*` service URLs (#195) | **Unchanged.** phoenix components are presentational, and the demo reuses every existing env key | 0 |
| i18n (#183, react-intl runtime catalogues) | App strings unchanged. **phoenix's own strings are hard-coded English** ("Contact us", "Sign in", "Next", "Clear search", footer copy, acknowledgement). Each needs a label prop, or the components need to take a message function | phoenix: 2–3 pd |
| Mustache header and footer via `THEME_HEADER_URL`/`THEME_FOOTER_URL` | React apps render phoenix `Header`/`Footer`. Atlas-specific content (logo, nav sections, footer links and partners) moves to a **runtime brand config** read with the same `getRuntimeConfig()` pattern, e.g. `THEME_BRAND_URL` → JSON. Atlases that want their own markup keep the existing mustache path as a fallback (both can be supported) | common-ui 3–5 pd; phoenix props 2–3 pd |
| Extra CSS via `THEME_CSS_URL` (#186, `--ala-accent-color`) | Same key, but the CSS now overrides phoenix `--ala-*` properties after `phoenix.css`. **Demonstrated** (§5.3, screenshot). `--ala-accent-color` maps onto `--ala-color-primary` and the button colours | 1 pd (docs and alias) |
| `THEME_JS_URL` | Not needed for React pages, which need no jQuery. Keep it for analytics or other atlas scripts | 0 |

### 3.4 Can raw HTML and phoenix coexist?

- **Same document, two themes: no.** Both `ala-combined.css` and `phoenix.css` contain a full Bootstrap. Layering them changes global typography (measured +18% page height) and double-loads Bootstrap (+48 KB gzip). phoenix's README forbids it ([#L47](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/README.md#L47)). Vite CSS imports are global to an SPA bundle, so a phoenix **route** inside the existing bundle would restyle the old pages too.
- **Same app, separate HTML entries: yes. This is what the demo does.** `phoenix/index.html` is a second Vite input with its own bundle and CSS. The old page at `/` and the new page at `/phoenix/` share code (data definitions, common-ui, translations) but never share a stylesheet. Links between them are full page loads.
- **Raw-Bootstrap components on a phoenix page: yes, with caveats.** The demo reuses common-ui `Breadcrumbs` and `Banner` and search-ui `Examples` unchanged; they render because phoenix includes Bootstrap. But they lose ALA-specific styling (breadcrumb spacing came from `ala-combined.css`), and they don't follow phoenix tokens or dark mode. The `Examples` links are nearly invisible in dark mode (screenshot `phx-species-dark-tiles.jpg`).

### 3.5 Per-app estimates

| App | Scope | Key blockers | Estimate |
| --- | --- | --- | --- |
| **common-ui** | `PhoenixShell` (Header and Footer with auth state, brand config, i18n labels, skip link); `injectCommonInfo` skips the legacy CSS on phoenix entries; Pagination parity; Breadcrumbs via RB `Breadcrumb`; Banner → `AlertBanner` severity mapping; runtime brand config | phoenix Header and Footer props (§4) | **6–10 pd** |
| **search-ui** | Search page (demo done, at parity minus a styled autocomplete); Species page (541 LOC plus `components/species/*`: galleries, maps, name tables); remove `css/search.css` (2,724 lines) once both pages move; update Playwright tests | Autocomplete, image fallback, ResultTile sizing, Species-page components phoenix lacks (tables, galleries, tabs) | **10–16 pd** (Search hardening 2–3, Species 6–10, tests 2–3) |
| **occurrence-ui** | Largest app: 14.8k LOC, 577 raw class uses, 13 RB Modals, 40 selects, 62 inputs, 24 tables, download forms, Leaflet/MapLibre maps, typeahead | phoenix has **no** Modal, Table, Select, TextInput, DatePicker, Tooltip, Typeahead or Tabs components. These would use themed React-Bootstrap directly (works, but isn't "phoenix") or need new phoenix components plus Figma masters | **25–40 pd** |
| **regions-ui** | 5 views, already partly RB; add runtime config (`config.js`) first | Same Header/Footer work as common-ui | **4–7 pd** |

### 3.6 Staged path

1. **Shell first.** The common-ui `PhoenixShell` and brand config are used by a phoenix entry in each app. Old entries are untouched.
2. **One page at a time.** Each page gets its own HTML entry (`/phoenix/…` during the trial). The URL switches when parity is signed off.
3. **Flip the default entry per app** once all its routes are migrated. Delete the app's legacy global CSS and the `injectCommonInfo` CSS path.
4. **Retire the mustache path** for React apps. Keep it only where an atlas explicitly needs its own header markup.

---

## 4. Q3: Gap analysis

Severity: **H** blocks replacement, **M** needs work before production, **L** cosmetic or nice-to-have. Effort: **S** ≤1 pd, **M** 2–5 pd, **L** >5 pd.

| Item | common-UI (commonui-bs5 + atlas-index common-ui) | phoenix (`testing`) | Gap | Sev. | Effort |
| --- | --- | --- | --- | --- | --- |
| **Distribution** | Static files on `www.test.ala.org.au`/`www.ala.org.au`; 2019 paths unversioned; currawong uses hashed filenames, test only | `private: true`, `0.0.0`, no registry or CDN ([README.md#L13](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/README.md#L13)) | Needs registry, semver, release workflow, static hosting for legacy files | H | M |
| **Combined JS** | jQuery 3.7.1, Bootstrap 5.3.3 bundle, jQuery UI autocomplete, `application.js` | `theme.js` only | All of it missing for non-React consumers | H | M |
| **Header (non-React)** | `banner.mustache` | None (SSR possible, but inert without JS) | Generate mustache plus vanilla shim | H | M |
| **Header (React)** | Mustache via `innerHTML` with `.loginBtn` and `.loginStatus` toggling | `Header` with `onSignIn`/`onSearch`/`onThemeToggle` | No signed-in/profile/sign-out state; no autocomplete; **no skip link**; logo hard-coded `<Logo name="ala">` ([Header.tsx#L42](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/src/organisms/Header.tsx#L42)); "Contact us" hard-coded ([#L51](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/src/organisms/Header.tsx#L51)); default nav hrefs are placeholders `https://www.ala.org.au/?q=…` ([navigation.ts#L11](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/src/organisms/navigation.ts#L11)) | H | M |
| **Footer** | `footer.mustache` (2019: site map; currawong: partners) | `Footer` with link props | Partner text and NCRIS/CSIRO/GBIF logos hard-coded ([Footer.tsx#L63](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/src/organisms/Footer.tsx#L63)); English only; no login links; acknowledgement artwork has fixed colours | M | S–M |
| **Search autocomplete** | jQuery UI on `#autocompleteHeader`; search-ui has a hand-made dropdown with no combobox ARIA ([Search.tsx#L167](../search-ui/src/views/Search.tsx#L167)) | None (`SearchField` is an input) | Needs an accessible combobox (demo used a native `<datalist>`) | H | M |
| **Pagination** | common-ui: first, last, ellipses, deep-paging cap ([pagination.tsx#L32](../common-ui/src/components/pagination.tsx#L32)) | Sliding window of 5 plus Next ([Pagination.tsx#L22](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/src/molecules/Pagination.tsx#L22)) | No Previous, first or last; 1-based vs API 0-based | M | S |
| **Result tile** | App-specific raw markup | `ResultTile` | Fixed `height: 87px`, `overflow: hidden` clips real content ([_molecules.scss#L624](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/src/styles/components/_molecules.scss#L624)); all titles italic ([#L572](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/src/styles/components/_molecules.scss#L572)); no image fallback or `onError`; desktop/mobile is a JS prop, not responsive CSS ([ResultTile.tsx#L28](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/src/molecules/ResultTile.tsx#L28)) | M | S |
| **Button as link** | `<a class="btn ala-btn-primary">` | `Button` omits `href` ([Button.tsx#L17](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/src/atoms/Button.tsx#L17)) | No link-styled button | L | S |
| **Form controls, modal, table, tabs, tooltip, date, typeahead** | Bootstrap classes or RB | Only `Check`, `SearchField`, `SortDropdown`, `SearchTypeSelect`, `SubNavLink` | Use themed RB directly or add components plus Figma masters | M | L |
| **Breadcrumbs** | common-ui raw markup styled by `ala-combined` | None | Add a component or use RB `Breadcrumb` | L | S |
| **Banner messages** | common-ui `Banner` (fetch, scope, dismiss) with raw `.alert` | `AlertBanner` (presentational) | Keep the logic in common-ui and render `AlertBanner` | L | S |
| **Markup and class contract** | Global ids and classes (`#wrapper-navbar`, `.site-footer`, `.loginStatus`, `#autocompleteHeader`) relied on by JS and GSP | BEM `.ala-*` emitted by React | GSP pages can't reuse the React markup; legacy hooks needed in generated mustache | H (non-React) | M |
| **Design tokens** | Sass variables hard-coded per repo (currawong palette), runtime `--ala-accent-color` added in atlas-index #186 | DTCG-style JSON → Sass plus 98 light / 39 dark `--ala-*` custom properties; validated build | phoenix is better. Values are "best-effort", not designer-approved ([README.md#L210](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/README.md#L210)); seafoam already differs from currawong | M | S |
| **Runtime theming reach** | Whole theme swappable by URL | CSS variables recolour components, but some values are compiled in: check marks ([THEME.md#L93](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/THEME.md#L93)), Sass→Bootstrap values ([#L131](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/THEME.md#L131)), footer waves ([#L108](https://github.com/AtlasOfLivingAustralia/phoenix/blob/c6fbee4/THEME.md#L108)), logos | Expose more as variables; make logo and artwork configurable | M | M |
| **Colour modes** | Light only | Light, dark, system (`initializeTheme`) | phoenix ahead. Legacy components inside phoenix pages don't follow dark mode | L | – |
| **Fonts** | Google Fonts Roboto and Lato `@import` in CSS | None; consumer adds `<link>` | Legacy bundle must re-add them for drop-in parity | M | S |
| **Icons** | Font Awesome 6.5.2 webfont (apps also use FA 7 React and bootstrap-icons) | 52 inline SVG icons | Legacy bundle must keep FA; React apps can drop it over time | M | S |
| **Accessibility** | Measured on search page: 6 axe rule failures; skip link to `#INSERT_CONTENT_ID_HERE` (broken); `<div onClick>` facets and tabs | Measured on demo: 0 axe failures (after a 24 px facet spacing fix); Storybook a11y addon; README targets WCAG 2.2 AA | phoenix ahead. Header lacks a skip link; `Check` sm needs 24 px pitch for WCAG 2.2 target size; manual screen-reader review not done (unverified) | M | S |
| **Browser support** | Bootstrap 5.3.3; autoprefixer default (browserslist not set; unverified) | Bootstrap 5.3.8; relies on custom properties, `:focus-visible`, grid, `aspect-ratio`, CSS masks | Both fit the agreed evergreen matrix; no IE/legacy support in either | L | – |
| **Bundle size** | CSS 67.8 KB gzip + JS 64.2 KB gzip + 45 KB mustache | CSS 41.0 KB gzip; React lib 24.1 KB gzip (+ React peers apps already ship) | phoenix smaller for React apps. A legacy bundle would carry the same jQuery cost | L | – |
| **Versioning and rollback** | Overwrite in place (2019) | Semver intended but not released | Needs a release process | H | S |
| **i18n** | Mustache in English; atlases host translated templates | Hard-coded English in Header, Footer, Pagination and SearchField labels | Label props or message injection | M | M |
| **Analytics** | Fathom script in currawong footer, `trackEvent` in 2019 JS | None | Keep in the legacy JS; React apps call it themselves | L | S |
| **Docs and showcase** | currawong `patternLibrary*.html` (4 static pages) | Storybook (27 story files, 74 `play` tests), Code Connect (25 mappings), README and THEME.md | phoenix ahead. Storybook hosting pipeline not yet bootstrapped for all envs (unverified) | – | – |
| **Ownership** | Two repos (2019, currawong); contributors unverified | 53 commits, 1 contributor (`git shortlog`) | Bus factor 1 | H | – |
| **Toolchain** | gulp 5, Sass, npm | Node 26, pnpm 12, Vite 8, Storybook 10, Playwright, Figma CLI | atlas-index uses Node ≥24.16 and yarn 4: two toolchains | L | – |

---

## 5. Q4: Theming for other atlases

### 5.1 What atlases can do today (atlas-index)

- Point `THEME_HEADER_URL`, `THEME_FOOTER_URL`, `THEME_CSS_URL`, `THEME_JS_URL` and `THEME_CONTAINER_CLASS` at their own hosted theme, with no rebuild (PR #186).
- Recolour SPA-owned accents with `--ala-accent-color` and `--ala-accent-color-hover` (#186).

This replaces whole header and footer markup, but app-level styling is only partially themable: 333 inline `style={{}}` objects in search-ui hard-code colours (e.g. `#E7E7E7`, `#D9D9D9` in [Search.tsx](../search-ui/src/views/Search.tsx)).

### 5.2 Options compared

| Option | How | Rebuild per atlas? | Reach | Risks | Fit |
| --- | --- | --- | --- | --- | --- |
| **A. Tokens as CSS custom properties** (`--ala-*`) | Atlas ships one small CSS file overriding light and dark variables, loaded after the theme | No | All phoenix components and app CSS that uses tokens; dark mode included | Values compiled into Bootstrap Sass and baked SVGs don't follow; shared variables affect multiple components (documented in THEME.md) | **Best default** |
| B. Bootstrap Sass override | Atlas compiles `@use "pkg:@ala/ui/scss"` with its own variables | Yes, CSS only | Everything, including compiled Bootstrap values, spacing and breakpoints | Every atlas needs a Sass toolchain and must rebuild on each phoenix release; drift | Escape hatch for deep changes |
| C. Runtime CSS injection (today's model) | Swap the whole `ala-combined.css` and header/footer by URL | No | Everything, including markup | Atlas forks the whole theme; forks fall behind; two Bootstraps if layered wrongly | Keep only for atlases that need their own header markup |
| D. Per-atlas builds | Build a phoenix variant per atlas (token JSON per atlas) | Yes, phoenix and apps | Everything | N builds and releases; CI cost; contradicts the "no fork" goal of #183/#186/#195 | Not recommended |

### 5.3 Recommendation: A, delivered through the existing runtime injection, plus a brand config

- **Contract:** document a stable, semver-governed subset of `--ala-*` properties as the public theming API. THEME.md already lists the shared colours. Alias `--ala-accent-color` onto it so existing atlas overrides keep working.
- **Delivery:** reuse `THEME_CSS_URL`. On phoenix pages it points at an override stylesheet, not a full theme.
- **Brand content:** a runtime JSON (logo URL and alt text, nav sections, footer links and partners, acknowledgement text) read by `PhoenixShell`. Same `config.js` pattern as #183/#186/#195.
- **phoenix work (M):**
  - Map more Bootstrap compile-time values to runtime variables, e.g. `--bs-primary-rgb`, `--bs-link-color` via `var(--ala-…)`.
  - Make the logo and acknowledgement artwork configurable.
  - Add a Storybook "Atlas theme" playground so atlases preview overrides without code.
- **Evidence it works:** [`atlas-override-example.css`](atlas-override-example.css) (10 declarations, injected at runtime, no rebuild) recoloured these on the demo page: hero surface, primary button, search button, active tab, facet headings, pagination, links; it also swapped the body font. It did **not** change the header logo, footer partner logos or acknowledgement wave, which confirms the brand-config gap. See `screenshots/phx-datasets-atlas-override.jpg`.
- **Why A over B, C and D:** no rebuild (matches the direction of #183/#186/#195), tiny per-atlas artefact, dark mode for free, and upgrades of phoenix don't require atlas action. Atlases needing structural changes can still use B or C.

---

## 6. Q5: Figma and Storybook vs the current approach

Scores are 1–5, where 5 is best. For maintenance cost, 5 means cheapest.

| Criterion | commonui-bs5 (current) | phoenix (Figma + Storybook) | Evidence |
| --- | --- | --- | --- |
| Documentation | 2 | 4 | commonui: README and 4 static pattern-library pages (currawong). phoenix: 555-line README, THEME.md, 27 story files with Controls, Code Connect snippets in Figma |
| Developer experience | 2 | 4 | Typed props and autocomplete. The demo page needed no app CSS for components, only layout (132 CSS lines vs 637 in `search.module.css`). The minus: React-only and two toolchains |
| Design-to-code fidelity | 2 | 3 | Code Connect plus inventory test enforce *coverage* (128/128). But README lists unresolved deviations and "best-effort" tokens, and Figma-fixed sizes broke on real data (87 px rows). Fidelity to Figma isn't fitness for real content |
| Maintenance cost | 3 | 2 | phoenix CI runs build, typecheck, lint, unit, Storybook interaction (Playwright), package, Storybook build and theme checks, plus Figma publish and an AWS Storybook pipeline. Heavier than gulp, and one maintainer |
| Contributor onboarding | 3 | 3 | commonui: gulp and Sass, simple but undocumented conventions. phoenix: needs React, TS, pnpm, Storybook and Figma literacy, but the README's contribution steps are explicit |
| Runtime and bundle cost | 2 | 4 (React) / 2 (legacy) | CSS 41 vs 68 KB gzip; no jQuery for React apps. A legacy bundle would carry jQuery again |
| Fit with non-JS consumers (Grails/GSP, mustache) | 5 | 1 today, 3 after Phase 2 | commonui was built for this. phoenix offers only a CSS file to copy, plus `theme.js` |

**What Figma and Storybook deliver that the current approach doesn't:**

- A browsable, interactive component catalogue with light and dark preview.
- Interaction and a11y tests per story (74 `play` functions).
- Figma ↔ code linkage, so designers see the real React snippet in Dev Mode.
- An enforced inventory, so no Figma master goes unimplemented.
- Validated tokens feeding both Sass and runtime variables.

**What it costs:**

- Toolchain and CI weight, plus a Figma access token and an AWS pipeline.
- Designers must actually review in Storybook and Figma, or "design integration" stays one-sided (README: deviations "need designer review").
- React-only components exclude GSP unless Phase 2 is built.
- Bus factor 1.

**Do the claimed benefits hold up in this codebase?**

| Claim | Verdict |
| --- | --- |
| Clearer documentation | **Yes** |
| Better DX for React apps | **Yes**. The demo replaced bespoke markup with ~10 components |
| Better accessibility | **Yes**, measured |
| Tighter design integration | **Partially.** The mechanism exists, but the designer review loop isn't evidenced, and pixel-exact masters need content-robust variants |
| Better for all consumers | **No, not yet.** Non-React consumers get nothing today |

---

## 7. Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | Switching a URL consumer to phoenix CSS changes the appearance of every page (16 px body text, new button styles) | High | High | Versioned URLs, opt-in per consumer, visual regression on a Grails app and a mustache consumer before switching |
| R2 | phoenix stays unpublished, so apps vendor tarballs (as in the demo) and drift | Medium | High | Phase 1: choose a registry (GitHub Packages/npm), semver, release workflow |
| R3 | Bus factor 1 on phoenix | High | High | Second maintainer, CODEOWNERS, design-owner sign-off per README |
| R4 | Two implementations of the new design (currawong Sass and phoenix tokens) drift (seafoam already differs) | High | Medium | Freeze currawong styling; generate the legacy bundle from phoenix tokens |
| R5 | Header and Footer lack auth state, autocomplete, skip link and configurable brand, so atlases can't adopt | High | High | Phase 1 phoenix work; keep the mustache fallback for atlases |
| R6 | Static (SSR) header inert without JS shim | Certain if unaddressed | Medium | Emit Bootstrap data-API attributes or ship a small shim in `ala-combined.js` |
| R7 | Figma-exact fixed sizes fail on real content (clipping, italics) | Medium | Medium | Content-robust variants; real-data stories (fixtures from the search service) |
| R8 | Legacy raw-Bootstrap components on phoenix pages ignore tokens and dark mode | Medium | Low | Migrate shared common-ui components first; ship light mode only until migrated |
| R9 | occurrence-ui needs components phoenix lacks (Modal, Table, forms, Typeahead) | High | Medium | Allow themed React-Bootstrap directly; add Figma masters only where the design differs |
| R10 | Hosting of the `/phoenix/` second entry in production (routing rewrite) | Medium | Low | Confirm the search-ui hosting/rewrite config (unverified) before shipping |
| R11 | Font and icon parity (Roboto/Lato, Font Awesome) missed in legacy bundle | Medium | Medium | Include them in the legacy build and test GSP pages that use `fa-*` |
| R12 | Licensing and redistribution of Figma brand artwork (README flags it) | Low | Medium | Confirm before public package release |

---

## 8. Phased roadmap

| Phase | Outcome | Main tasks | Estimate |
| --- | --- | --- | --- |
| 0. Decisions | Agreed scope | Registry; static host and URL scheme; theming contract; designer review of README deviations; second maintainer | 2–4 pd |
| 1. Harden phoenix | Release-ready React library | Header (auth state, skip link, logo, i18n labels, real nav via props or brand config); Footer configurability; accessible autocomplete combobox; Pagination (prev, first, last, ellipsis); ResultTile (auto height, title style, image fallback, responsive layout); Button `href`; Check target spacing; Breadcrumbs; publish `1.0.0`; hosted Storybook | 12–20 pd |
| 2. Legacy bundle | Drop-in files at new versioned URLs | `build-legacy.mjs` (CSS with fonts and FA, JS with jQuery, Bootstrap, autocomplete, theme), SSR mustache with placeholders and shim, CI publish, parity tests | 10–16 pd |
| 3. common-ui shell | Shared phoenix shell for all apps | `PhoenixShell`, runtime brand config, `THEME_CSS_URL` override semantics, Banner and Pagination adapters | 6–10 pd |
| 4a. search-ui | Both pages on phoenix | Harden demo Search page; Species page; tests; delete legacy CSS | 10–16 pd |
| 4b. regions-ui | On phoenix with runtime config | Add `config.js`; Region and Regions views | 4–7 pd |
| 4c. occurrence-ui | On phoenix | Search, record, download and explore views; modals, tables, forms | 25–40 pd |
| 5. Atlases | First external atlas themed | Override CSS plus brand JSON; docs; Storybook theme playground | 2–4 pd + 1–3 pd per atlas |
| 6. Deprecation | Retire `commonui-bs5-2019` | Inventory URL consumers (access logs), migrate, announce, sunset | Timeline unknown |
| **Total (phases 0–5, in scope)** | | | **~71–117 pd** + per-atlas work |

Phases 1 and 2 can run in parallel. Phase 4 depends on 1 and 3, not on 2.

---

## 9. Demo: search-ui page rebuilt with phoenix

### 9.1 What was built (commit on `feature/phoenix-demo`)

| File | Purpose |
| --- | --- |
| [`search-ui/phoenix/index.html`](../search-ui/phoenix/index.html) | Second Vite HTML entry served at `/phoenix/`; loads Roboto and the runtime `config.js` hooks |
| [`search-ui/src/phoenix/main.tsx`](../search-ui/src/phoenix/main.tsx) | Imports `@ala/ui/theme.css` only (never `ala-combined.css`); router basename `/phoenix` |
| [`search-ui/src/phoenix/PhoenixApp.tsx`](../search-ui/src/phoenix/PhoenixApp.tsx) | phoenix `Header`/`Footer`; existing common-ui auth, `Breadcrumbs` and `Banner` unchanged; light/dark toggle |
| [`search-ui/src/phoenix/PhoenixSearch.tsx`](../search-ui/src/phoenix/PhoenixSearch.tsx) | Search page built from `SearchField`, `SearchButton`, `SubNavLink`, `Check`, `SortDropdown`, `ViewButton`, `ResultTile`, `Pagination`, `Link`, `Button`, plus RB `Offcanvas`, `Nav`, `Placeholder` and grid |
| [`search-ui/src/phoenix/useSearch.ts`](../search-ui/src/phoenix/useSearch.ts) | Data hooks reusing the existing `*Defn` facet and filter definitions; requests abort on change |
| [`search-ui/src/phoenix/toResultTile.tsx`](../search-ui/src/phoenix/toResultTile.tsx) | Adapter from search-service items to `ResultTile` props |
| [`search-ui/src/phoenix/phoenix.css`](../search-ui/src/phoenix/phoenix.css) | Layout only, token-based (`var(--ala-*)`), plus documented workarounds |
| [`search-ui/vite.config.ts`](../search-ui/vite.config.ts) | Adds the second HTML input |
| `search-ui/vendor/ala-ui-0.0.0-c6fbee4.tgz` and `package.json`/`yarn.lock` | phoenix packed from `testing@c6fbee4` (`pnpm pack`, 740,570 B), installed with `file:` |

The old page at `/` is unchanged.

**Run it:**

```sh
cd search-ui
VITE_APP_API_URL=https://service.test.ala.org.au yarn dev
# old: http://localhost:5173/?q=kangaroo#tab=species
# new: http://localhost:5173/phoenix/?q=kangaroo#tab=species
```

`service.test.ala.org.au` sends `Access-Control-Allow-Origin: *`, so `.env.local` didn't need editing.

**To upgrade phoenix**, re-run `pnpm pack` in phoenix and `yarn add "@ala/ui@file:./vendor/<tgz>"`.

### 9.2 Verification

| Check | Result |
| --- | --- |
| `tsc --noEmit` (search-ui) | Pass |
| `yarn test` (search-ui: jest and i18n coverage) | 8 suites, 69 tests pass |
| `vite build` (with the two missing map env vars supplied, see C14) | Pass. The ALA build strips `config.js` from **both** HTML entries |
| axe-core 4.13, WCAG A/AA rules, species tab, 1366 px | Old page: 6 failing rules. phoenix page: **0** |
| Keyboard | Facet checkbox focus plus Space applies the filter (42 results); tabs are buttons; mobile Refine uses a focus-trapped Offcanvas |
| Console errors (Playwright, both pages) | None |
| Dark mode | `data-bs-theme="dark"` applied via the Header toggle |

**Build output.** Not like-for-like: `main` also contains the Species route and the map libraries.

| Asset | Old entry (`/`) | phoenix entry (`/phoenix/`) |
| --- | --- | --- |
| Entry JS | 1,341.9 KB (368.9 KB gzip) | 163.2 KB (55.7 KB gzip) |
| Shared chunk (React, react-intl, common-ui, translations) | 377.7 KB (117.2 KB gzip) | same |
| Bundled CSS | 200.1 KB (35.2 KB gzip) | 325.1 KB (47.7 KB gzip, includes Bootstrap) |
| External theme | `ala-combined.css` 67.8 KB gzip + `ala-combined.js` 64.2 KB gzip + 45 KB mustache | none |

### 9.3 Screenshots (`screenshots/`)

| Old | phoenix |
| --- | --- |
| `old-species-desktop.jpg` | `phx-species-desktop.jpg` |
| `old-all-desktop.jpg` | `phx-all-desktop.jpg` |
| `old-species-mobile.jpg` | `phx-species-mobile.jpg` |
| `old-top.jpg` | `old-plus-top.jpg` (old page with `phoenix.css` layered, shows the clash) |
| | `phx-species-dark-tiles.jpg` (dark mode and tiles) |
| | `phx-datasets-atlas-override.jpg` (runtime atlas override) |

### 9.4 Challenges and issues

| # | Challenge | Resolution in demo | Implication |
| --- | --- | --- | --- |
| C1 | `phoenix.css` includes Bootstrap and must not load with `ala-combined.css`. Vite CSS is global per bundle | Separate HTML entry (`phoenix/index.html`) | Page-level coexistence works. Production hosting needs a `/phoenix/` → `phoenix/index.html` rewrite (unverified) |
| C2 | phoenix is unpublished (`private: true`) | Vendored `pnpm pack` tarball (740 KB) in git | Not sustainable; needs a registry (R2) |
| C3 | No autocomplete component | Native `<datalist>`, fed by the existing `/v1/bie/search/auto` | Works and is accessible, but unstyled and limited on iOS Safari (unverified on device); needs a phoenix combobox |
| C4 | Header has no signed-in state | Sign-in button label toggles to "Sign out" | Needs profile and sign-out UI in phoenix |
| C5 | Header nav uses placeholder hrefs, and the logo is fixed | Left as default (links go to `ala.org.au/?q=…`) | Must be configurable before any real use |
| C6 | `ResultTile` rows are fixed at 87 px with overflow hidden | App CSS override: `height: auto`, 3-line clamp | Fix in phoenix (content-robust variant) |
| C7 | All result titles italic | App CSS override; `<i>` only for TAXON names | Fix in phoenix (`title` style prop or no italics by default) |
| C8 | No image fallback; the test image proxy is blocked by Chromium (`ERR_BLOCKED_BY_ORB`) on old and new pages alike | Capture-phase `error` listener swaps in `missing-image.png` | Add `imageFallback`/`onImageError` to `ResultTile` |
| C9 | `ResultTile` layout is a JS prop, not responsive CSS | `useSyncExternalStore` on `matchMedia` | Prefer CSS container or media queries in phoenix |
| C10 | `Button` can't take `href` | External resource links use phoenix `Link` | Add `as`/`href` support |
| C11 | Facet checkboxes failed WCAG 2.2 target-size (stacked < 24 px); `size="lg"` didn't help | 24 px min-height per item (old facets had 6 px gaps too) | Bake spacing guidance into `Check` or a facet-list component |
| C12 | `*Defn` renderers mix data and JSX (URLs built inside JSX) | Read `href` back from the rendered element (`shortcut:` comment) | Extract `getUrl(item)` per definition during real migration |
| C13 | Legacy components on a phoenix page | `Breadcrumbs`, `Banner`, `Examples` reused unchanged | Lose ALA spacing; `Examples` nearly invisible in dark mode |
| C14 | Pre-existing: `vite build` fails without `VITE_OSM_VECTOR_TILE_STYLE_URL` and `VITE_OPENSTREETMAP_ZXY_ATTRIBUTION` in `.env.local` (env-check plugin) | Supplied dummy values on the command line | Unrelated to phoenix |
| C15 | phoenix component strings are English-only | Page strings kept as in the original (also hard-coded there) | Label props needed for i18n (#183) |
| C16 | Fonts not bundled | Google Fonts `<link>` in `phoenix/index.html` | Every consumer must add it (or the legacy bundle does) |
| C17 | Pagination is 1-based; the API is 0-based; no first/last | Converted at the call site | Parity gap (§4) |
| C18 | Two toolchains (phoenix: Node 26/pnpm 12; atlas-index: Node ≥24.16/yarn 4) | Built phoenix separately, then packed | Fine for packages; awkward for local linking |

**Not done in the demo:**

- Species page.
- Breadcrumb restyle.
- Real nav links.
- Production hosting of `/phoenix/`.
- Manual screen-reader pass.
- Real-device mobile testing.

---

## 10. Open questions

1. **Registry and hosting:** where will `@ala/ui` be published (npm, GitHub Packages), and where will versioned legacy files live (same `www.*.ala.org.au` host as commonui?)
2. **Timeline:** is there a date for currawong's design going live? That drives whether Phase 2 replaces currawong's build before it ships to prod (it currently returns 404 on prod).
3. **Atlases:** which atlases theme first, and do they need their own header markup (option C) or only colours, logo and nav (option A + brand config)?
4. **Grails consumers:** which apps load `ala-combined.*`, and do they use jQuery, jQuery UI or `fa-*` classes directly? This needs an access-log or code-search inventory; not verified here.
5. **Design ownership:** who signs off the README's best-effort deviations and the new content-robust variants (ResultTile height, title style)?
6. **Maintainership:** who is the second maintainer for phoenix?
7. **Analytics:** should Fathom tracking stay in shared JS or move to apps?
8. **Dark mode:** in scope for ALA production, or light-only until legacy components are migrated?
9. **search-ui hosting:** how is it deployed (needed to route `/phoenix/` or to flip entries)?
10. **i18n:** should phoenix components take label props or a message function compatible with react-intl?
