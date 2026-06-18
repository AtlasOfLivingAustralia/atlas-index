/// <reference types="vite/client" />

interface ImportMetaEnv {
    // URL of a runtime theme.json manifest. When empty, the app falls back to ALA_DEFAULT_THEME
    // (built from the VITE_COMMON_* / VITE_LOGO_URL env vars). See common-ui ThemeConfig.
    readonly VITE_THEME_CONFIG_URL: string;
}
