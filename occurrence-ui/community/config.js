/*
 * Default runtime configuration. Ships with the build and is REPLACED on every deploy, so do not
 * edit it in a deployed site: put your own values in config.local.js next to it, which is never
 * shipped and never overwritten, and whose values win. That way a new release can update these
 * defaults without discarding what you set.
 *
 * Both files are plain scripts read before the app bundle, so a deployer changes settings after the
 * build instead of recompiling. This is not only for translations: anything that is different in
 * each portal and does not need a rebuild can go here.
 *
 * The tags that load them are only present when the app is built with VITE_RUNTIME_CONFIG_ENABLED
 * (see .env.community and `yarn build:community`). The ALA build removes them and ships neither
 * file. config.local.js is optional; if it is not there the browser gets a 404 and nothing breaks.
 *
 * A config.local.js looks like this, with only the keys it changes:
 *
 *   window.APP_CONFIG_LOCAL = {
 *
 *     // --- General -----------------------------------------------------------------------------
 *     // Portal display name. Kept out of the translated strings so that one set of translations
 *     // ("Search {portalName}") works for every portal.
 *     PORTAL_NAME: 'NBN Atlas',
 *
 *     // --- Translations ------------------------------------------------------------------------
 *     // Listing locales is what makes the app load catalogues at runtime, so adding a language or
 *     // fixing a string needs no rebuild. With no locales listed it uses the messages bundled at
 *     // build time and makes no request.
 *     I18N_DEFAULT_LOCALE: 'en',
 *     I18N_LOCALES: [
 *       { code: 'en', label: 'English' },
 *       { code: 'es', label: 'Español' }
 *     ],
 *     // Where the catalogues are. Defaults to /i18n/{locale}.json on the same origin: usually the
 *     // web server exposes the directory the ala-i18n package installs, so the files stay local.
 *     // Set this for a different naming or another host, e.g. '/i18n/messages_{locale}.json' or
 *     // 'https://your-host/i18n/occurrence-ui/{locale}.json'. The bundled messages are still used for
 *     // anything a catalogue does not have.
 *     I18N_MESSAGES_PATH: '/i18n/{locale}.json'
 *   };
 *
 * To try the runtime catalogues locally, point I18N_MESSAGES_PATH at '/i18n/example/{locale}.json'
 * and see community/i18n/example/README.md.
 *
 * To add a new kind of setting, add its keys to RuntimeConfig from the module that owns them
 * (common-ui/src/util/runtimeConfig.ts shows how) and document them in a block above.
 */
window.APP_CONFIG = {};
