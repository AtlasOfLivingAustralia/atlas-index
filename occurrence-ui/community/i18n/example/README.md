# Example message catalogues

These are samples, not the application's translations. They are here so you can try the runtime
catalogues locally without setting up a server for them, and a real deployment does not serve them.

To use them, add `I18N_MESSAGES_PATH: '/i18n/example/{locale}.json'` to `community/config.js` next
to the locales. A real deployment leaves that key out and serves its own files from
`/i18n/<code>.json`.

The application's English catalogue is still bundled from `src/translations/en.json` and is used for
anything a runtime catalogue does not have, so a catalogue only needs the keys it changes or adds.
