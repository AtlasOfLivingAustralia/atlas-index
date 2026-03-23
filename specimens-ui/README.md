# Specimens UI

A modern UI replacement for the specimens application, built with Vite and React.

## Table of Contents
- [Collections Configuration](#collections-configuration)
- [Development Setup](#development-setup)
- [Production Build](#production-build)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)

## Collections Configuration

The list of collections to include in the specimens UI is defined in `./public/collections.json`.

During the build process, this file generates `./src/api/sources/collections.json` by fetching collection metadata from the URL specified in `.env.production:VITE_APP_COLLECTIONS_URL`.

**⚠️ Important:** The generated `./src/api/sources/collections.json` file is **not** automatically rebuilt if it already exists. If you modify `./public/collections.json`, you must manually delete `./src/api/sources/collections.json` to trigger regeneration.

### Building Collections Data

```bash
node buildCollections.js
```

This command generates the collections data file using the URL from `.env.production:VITE_APP_COLLECTIONS_URL`.

## Development Setup

### Prerequisites

- Node.js (version specified in `.nvmrc` or `package.json`)
- Yarn package manager
- Access to the `@ala/common-ui` package

### Step 1: Link the common-ui Package

The specimens UI depends on the `@ala/common-ui` package, which must be linked locally. See the [common-ui README](../common-ui/README.md) for detailed setup instructions.

In the `specimens-ui` directory:

```bash
yarn link @ala/common-ui
```

### Step 2: Install Dependencies

```bash
yarn install

yarn playwright install
```

### Step 3: Build Collections Data

```bash
node buildCollections.js
```

### Step 4: Start Development Server

```bash
yarn run dev
```

The application will be available at `http://localhost:5173` (or the port specified in your Vite config).

## Production Build

To create a production-ready build:

(for Playwright tests, see [Testing](#testing))

```bash
yarn install
yarn test
yarn run prebuild
yarn run build
```

The build artifacts will be generated in the `dist/` directory and are ready for deployment.

## Testing

### Playwright Tests

Playwright tests verify basic functionality and run in headless mode by default.

#### Running Tests (Headless)

```bash
./run-playwright-test.sh [workers]
```

- `workers`: Number of parallel workers (default: 10)

**What this script does:**
1. Starts a local static server to serve common files
2. Builds the application using `.env.playwright` configuration
3. Runs tests against the locally running specimens-ui instance

**Note:** If using a different testing method, ensure you use the same configuration as defined in `.env.playwright`. Refer to `run-playwright-test.sh` for complete environment details.

#### Running Tests (UI Mode)

For interactive test development:

1. **Keep the static server running** from step 1

2. **Start development server** (changes apply immediately):
   ```bash
   yarn run dev
   ```

3. **Launch Playwright UI** (test changes apply immediately):
   ```bash
   yarn playwright test --ui
   ```

This setup enables hot-reload for both application and test changes, streamlining the development workflow.


## Environment Variables

The application uses Vite environment variables for configuration. Create a `.env.local` file in the project root for local development.

### General Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_HOME_URL` | Home page URL | `https://ala.org.au` |
| `VITE_LOGIN_URL` | User login/profile URL | `https://userdetails.ala.org.au/myprofile` |
| `VITE_LOGO_URL` | Application logo URL | `https://www.ala.org.au/app/uploads/2019/01/logo.png` |
| `VITE_AUTH_COOKIE` | Authentication cookie name | `ALA-Auth-Test-Local=` |
| `VITE_AUTH_COOKIE_DOMAIN` | Cookie domain | `localhost` |
| `VITE_ENV` | Environment name | `local`, `dev`, `production` |

### Service URLs

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_APP_BIOCACHE_URL` | Biocache web service URL | `https://biocache-ws.ala.org.au/ws` |
| `VITE_APP_BIOCACHE_UI_URL` | Biocache UI URL | `https://biocache.ala.org.au` |
| `VITE_APP_IMAGES_URL` | Images service URL | `https://images.ala.org.au` |
| `VITE_APP_COLLECTIONS_URL` | Collections metadata URL | Used by `buildCollections.js` |

### Common UI Components

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_CONTACT_URL` | Contact page URL | `https://www.ala.org.au/contact-us/` |
| `VITE_CREATE_ACCOUNT_URL` | Account creation URL | `https://userdetails.ala.org.au/registration/createAccount` |
| `VITE_COMMON_HEADER_HTML` | Shared header HTML | `http://localhost:8082/static/common/header.html` |
| `VITE_COMMON_FOOTER_HTML` | Shared footer HTML | `http://localhost:8082/static/common/footer.html` |
| `VITE_COMMON_CSS` | Common CSS file | `http://localhost:8082/static/common/common.css` |
| `VITE_COMMON_JS` | Common JavaScript file | `http://localhost:8082/static/common/common.js` |
| `VITE_BANNER_MESSAGES_URL` | Banner status messages | `http://localhost:8082/static/common/status.json` |
| `VITE_BANNER_SCOPE` | Banner scope filter | `specimens` |

### Example Configuration Files

See the following files for reference configurations:
- `.env.example` - Template for environment variables
- `.env.production` - Production configuration
- `.env.playwright` - Playwright test configuration

## Deployment

For ALA environment configuration and deployment information, refer to the [Ansible inventories repository](https://github.com/AtlasOfLivingAustralia/ansible-inventories/tree/master/atlas-index/local/specimens-ui).

## Project Structure

```
specimens-ui/
├── public/
│   └── collections.json       # Source collections configuration
├── src/
│   ├── api/
│   │   └── sources/
│   │       └── collections.json  # Generated collections data
│   ├── components/            # React components
│   └── ...
├── tests/                     # Playwright tests
├── buildCollections.js        # Collections data builder
├── run-playwright-test.sh     # Test runner script
└── package.json
```

## Troubleshooting

### Collections not updating

If changes to `./public/collections.json` are not reflected:

1. Delete the generated file:
   ```bash
   rm ./src/api/sources/collections.json
   ```

2. Rebuild collections data:
   ```bash
   node buildCollections.js
   ```

### Common UI linking issues

If you encounter issues with the `@ala/common-ui` package:

1. Ensure the package is properly built in the `common-ui` directory
2. Re-link the package, make sure @ala/common-ui is pre-registered in the common-ui directory:
   ```bash
   yarn link @ala/common-ui
   ```
3. Clear node_modules and reinstall if needed:
   ```bash
   rm -rf node_modules yarn.lock
   yarn install
   ```

### Playwright tests failing

Ensure:
- The static server is running (automatically started by `run-playwright-test.sh`)
- You're using the correct environment configuration (`.env.playwright`)
- All dependencies are installed (`yarn install`)
