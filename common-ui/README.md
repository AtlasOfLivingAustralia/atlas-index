# Common UI components

This directory contains common UI components used by the `-ui` projects in this repository. Each `-ui` project
should include this directory in its build process to ensure that the common components are available and tested.

## Development Setup

Setup the environment so that changes to the `common-ui` package are reflected in the `-ui` projects while using `yarn run dev`, etc.

Run `yarn install` in the root directory of atlas-index. This sets up the `common-ui` package and links it to the `-ui` projects using yarn 4.x workspace.

## Testing

```bash
yarn check-types
yarn test
```

## Configuration

For consistency, using the following environment variables in the `.env` file:

```properties
# header/footer and common assets and config (retrieved and applied at runtime by the client using common-ui components)
VITE_COMMON_HEADER_HTML=http://localhost:8082/static/common/banner.mustache
VITE_COMMON_FOOTER_HTML=http://localhost:8082/static/common/footer.mustache
VITE_COMMON_CSS=http://localhost:8082/static/common/ala-combined.css
VITE_COMMON_JS=http://localhost:8082/static/common/ala-combined.js
VITE_COMMON_CONTAINER_CLASS=container-fluid OR container (full width vs narrow)
VITE_SEARCH_URL_PREFIX=https://bie.test.ala.org.au

# environment tagging (included in the deployed application header meta info)
VITE_ENV=local

# banner messages (scope should match the application name and be found in the status.json when fetched at runtime)
VITE_BANNER_SCOPE=app-name
VITE_BANNER_MESSAGES_URL=http://localhost:8082/static/common/status.json

# required for authentication (search-service instance and the app base URL)
VITE_APP_API_URL=http://localhost:8081
VITE_APP_BASE_URL=http://localhost:5173
```

## Typical inclusion in a `-ui` project

1. Add "@ala/common-ui" as a dependency in the `-ui` project directory `package.json` file:
```json
{
  "dependencies": {
    "@ala/common-ui": "file:../common-ui"
  }
}
```

2. Update `vite.config.js` to include:
```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['@ala/common-ui'],
  },
  server: {
    fs: {
      allow: ['..'], // allow access to linked packages outside root
    },
  },
});
```

3. Update App.tsx for common setup (when using the existing `-ui` project structure):

```tsx
const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isLoggedInInitial);
const [cssLoaded, setCssLoaded] = useState<boolean>(false);

useEffect(() => {
    injectCommonInfo(buildInfo, import.meta.env.VITE_ENV, import.meta.env.VITE_COMMON_CSS, setCssLoaded);
}, []);
```

4. Update App.tsx to include the common header, breadcrumbs, banner, and footer:

```tsx
<Header 
    isLoggedIn={isLoggedIn} 
    logoutFn={handleLogout} 
    loginFn={handleLogin} 
    headerUrl={import.meta.env.VITE_COMMON_HEADER_HTML}
    containerClass={import.meta.env.VITE_COMMON_CONTAINER_CLASS}
    searchBaseUrl={import.meta.env.VITE_SEARCH_URL_PREFIX} 
    jsUrl={import.meta.env.VITE_COMMON_JS}/>

<Breadcrumbs 
    breadcrumbs={breadcrumbs}/>

<Banner 
    bannerUrl={import.meta.env.VITE_BANNER_MESSAGES_URL}
    scope={import.meta.env.VITE_BANNER_SCOPE}/>

/* routes, components, etc. */

<Footer 
    isLoggedIn={isLoggedIn} 
    logoutFn={handleLogout} 
    loginFn={handleLogin}
    footerUrl={import.meta.env.VITE_COMMON_FOOTER_HTML}/>
```

5. Include the same dependencies. Refer to [package.json](./package.json) for the list of dependencies to include in the `-ui` project `package.json` file.

6. When authentication is required, follow the instructions in [AUTH.md](./AUTH.md) to set up authentication utilities and context.

## Runtime configuration and build profiles

Settings that a deployment can change after the build come from two scripts loaded before the app
bundle:

| | ships with the build | overwritten on deploy | who owns it |
|---|---|---|---|
| `config.js` | yes | yes | the application: defaults, and the documentation of every key |
| `config.local.js` | no | no | the deployment: only the keys it changes, and they win |

The point of the split is that a new release can update the defaults without discarding what the
deployment set. `config.local.js` is optional and a 404 for it is harmless.

This is not only for translations: anything that is different in each portal and does not need a
rebuild can go here.

There are two build profiles:

| | ALA build (`yarn build`) | LA Community build (`yarn build:community`) |
|---|---|---|
| `config.js` and `config.local.js` tags | removed | kept |
| `community/` in the output | not copied | copied |
| Language selector | not included | included, and hidden when there is only one locale |

`VITE_RUNTIME_CONFIG_ENABLED` and `VITE_HEADER_LANGUAGE_SWITCHER_ENABLED` control this. Both are
false when they are not set, so a deployment with an older `.env` still gets the ALA build.
`.env.community` sets them, and Vite loads it on top of the deployment's own `.env`, so it is two
lines instead of a copy.

Each UI's `community/config.js` lists the keys a deployer can set and shows what a `config.local.js`
looks like. `util/runtimeConfig.ts` has the functions to read them and shows how to add new ones.

## Internationalisation (i18n)

`react-intl` does the formatting. Each UI passes its own `src/translations/en.json` to
`I18nProvider`. That is the ALA build: English only, no network request, no language selector.

The LA Community build can load the catalogues at runtime instead, so adding a language or fixing a
string does not need a rebuild. Set `I18N_LOCALES` in `config.js` to turn this on. Catalogues are
flat JSON files, the format Crowdin publishes, loaded from `/i18n/{locale}.json`. They are merged
over the bundled messages, which are still used for anything the catalogue does not have, or if it
is missing or too slow to load. The Grails applications work the same way through
[ala-i18n](https://github.com/living-atlases/ala-i18n), so translations ship separately from the
application.

`community/config.js` explains the rest key by key: where catalogues are read from, how the initial
locale is chosen, and the `lang` and `dir` attributes that right-to-left languages need.
`community/i18n/example/` has sample files to try it locally.

The common header and footer are HTML fetched from the theme, so their labels come from whatever
serves the theme, not from these catalogues.

### Coverage reporting

`yarn i18n:coverage`, which `yarn test` also runs, compares the message ids used in the code with
the bundled catalogue. Run it in a UI directory or from the repo root. It lists ids that are missing
from `en.json` and keys that nothing in the code uses, and only fails the build with `--strict`.

Ids built at runtime cannot be matched exactly. Prefixes like `` `facet.${fieldName}` `` are counted
on their own, and an id that is just a variable could be any key, so treat the unused count as a
hint, not as a list of keys to delete.
