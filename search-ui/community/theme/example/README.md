# Example theme

A small, self-contained theme, here so you can see runtime theming work locally without needing a
hosted `base-branding`-style theme. It is not a copy of ALA's real header/footer — those are
hundreds of lines of ALA-specific navigation — just a minimal banner and footer that exercise the
same contract `Header`/`Footer` expect: `{{containerClass}}`, `{{searchServer}}{{searchPath}}`,
`{{loginStatus}}`, and the `loginBtn`/`logoutBtn` class hooks (see
`common-ui/src/components/header.tsx`'s doc comment for the full contract).

The search box also keeps the real `ala-combined.js`'s own default selectors
(`#autocompleteHeader`, `#autocompleteSearchALA`, `#autoCompleteTemplate` — see its
`window.BC_CONF.autoCompleteSelector`/etc. fallbacks), so `THEME_JS_URL` doesn't need to be set at
all: it falls back to the build's own default JS and the autocomplete widget just works, the same way
`base-branding` reuses ALA's JS for legacy apps — a markup contract, not custom code.

`accent-override.css` only restyles this example's own header/footer classes — it is not a Bootstrap
replacement. The rest of the page (tabs, buttons, form controls) has no bundled Bootstrap CSS of its
own; it is only styled because the build's base theme stylesheet is loaded too. So `THEME_CSS_URL`
needs the base stylesheet AND this override, base first:

```js
window.APP_CONFIG_LOCAL = {
  PORTAL_NAME: 'Example Atlas', // optional — from #183, unrelated to THEME_*, shown together here
  THEME_HEADER_URL: '/community/theme/example/banner.mustache',
  THEME_FOOTER_URL: '/community/theme/example/footer.mustache',
  THEME_CSS_URL: 'http://localhost:8082/static/common/ala-combined.css,/community/theme/example/accent-override.css',
};
```

The base URL above is where the ALA build's own `VITE_COMMON_CSS` already points in dev
(`static-server`, see the repo root README). A real deployment substitutes whatever its own base theme
URL is; it does not need `static-server`, which is dev-only.

`THEME_JS_URL` is left out on purpose: unset, it falls back to the build's own default JS
(`ala-combined.js`), and this example's markup already matches what that script expects — see above.

`community/` is served as-is in dev and copied whole into `dist/` for the LA Community build
(`yarn build:community`), so these paths work the same in both. A real deployment would point
`THEME_HEADER_URL`/`THEME_FOOTER_URL` at its own hosted theme instead — same keys, no atlas-index
rebuild either way.

## What this does and does not change

The header/footer bar switches to this example theme, with no rebuild — that part was already
external. The SPA's own components (tabs, buttons, links) are a separate case: their accent colour is
baked into the app's own bundled CSS as `var(--ala-accent-color, #c44d34)` and
`var(--ala-accent-color-hover, #883524)` — the ALA red stays the default, but any theme that declares
`:root { --ala-accent-color: ...; --ala-accent-color-hover: ...; }` (as `accent-override.css` does
above) recolours them too, still with no rebuild.

Only `accent-override.css` should declare that `:root` block — the app's own CSS intentionally
declares none, only `var(--x, fallback)` uses. Two equal-specificity `:root` rules are decided by
document order, not by which one "should" win, so an app-owned `:root` here would silently re-shadow
whatever the theme sets. See `common-ui/README.md`'s Theming section for the full write-up.

Everything else about the app's own layout, icons, and non-colour styling stays as built; only the
accent colour and what was already external (header, footer, CSS/JS) are runtime-themeable.
