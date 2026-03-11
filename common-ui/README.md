yar# Common UI components

This directory contains common UI components used by the `-ui` projects in this repository. Each `-ui` project
should include this directory in its build process to ensure that the common components are available and tested.

## Development Setup

Setup the environment so that changes to the `common-ui` package are reflected in the `-ui` projects while using `yarn run dev`, etc.

Set the yarn link. Use the `./link_common_ui.sh` script to link the `common-ui` package all `-ui` projects.

Or if you prefer to do it manually, follow these steps:
1. In the `common-ui` directory, run:
```bash
yarn install
yarn link
```
2. In your `-ui` project directory, run:
```bash
yarn link @ala/common-ui
```

## Testing

```bash
yarn check-types
yarn test
```

## Configuration

For consistency, using the following environment variables in the `.env` file:

```properties
# header/footer and common assets (retrieved and applied at runtime)
VITE_COMMON_HEADER_HTML=http://localhost:8082/static/common/header.html
VITE_COMMON_FOOTER_HTML=http://localhost:8082/static/common/footer.html
VITE_COMMON_CSS=http://localhost:8082/static/common/common.css
VITE_COMMON_JS=http://localhost:8082/static/common/common.js

# environment tagging (included in the deployed application header meta info)
VITE_ENV=local

# banner messages (scope should match the application name and be found in the status.json when fetched at runtime)
VITE_BANNER_SCOPE=app-name
VITE_BANNER_MESSAGES_URL=http://localhost:8082/static/common/status.json

# authentication required (search-service instance and the app base URL)
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
    injectCommonInfo(buildInfo, import.meta.env.VITE_ENV, import.meta.env.VITE_COMMON_JS, import.meta.env.VITE_COMMON_CSS, setCssLoaded);
}, []);
```

4. Update App.tsx to include the common header, breadcrumbs, banner, and footer:

```tsx
<Header 
    isLoggedIn={isLoggedIn} 
    logoutFn={handleLogout} 
    loginFn={handleLogin} 
    headerUrl={import.meta.env.VITE_COMMON_HEADER_HTML}/>

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
