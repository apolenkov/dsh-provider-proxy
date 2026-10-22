/**
 * Browser entry of `dsh-provider-proxy`.
 *
 * Registers the Proxy routes page on the row's Plugins page via the
 * `plugins.bundle.config` slot. The page implementation lives in lazily loaded
 * chunks (`client.ui.js`, `client.fields.js`, `client.strings.js`,
 * `client.validate.js`, `client.theme.js`) so every committed file stays small; chunks are fetched
 * with `require.async`, the only cross-file mechanism the DSH module system
 * supports for package-local code.
 */
window.__ModuleLoader__.load({
  id: '@apolenkov/dsh-provider-proxy',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'provider-proxy';
    const ENTRY_ID = 'provider-proxy';
    const BUNDLE_ID = '@apolenkov/dsh-provider-proxy';

    function ProxyPageShell(props) {
      const [parts, setParts] = React.useState(null);
      const [failed, setFailed] = React.useState(false);
      React.useEffect(() => {
        let cancelled = false;
        Promise.all([
          require.async('./client.ui.js'),
          require.async('./client.strings.js'),
          require.async('./client.validate.js'),
          require.async('./client.theme.js'),
          require.async('./client.fields.js'),
        ])
          .then(([ui, strings, validate, theme, fields]) => {
            if (!cancelled) setParts({ ui, strings, validate, theme, fields });
          })
          .catch(() => {
            if (!cancelled) setFailed(true);
          });
        return () => {
          cancelled = true;
        };
      }, []);
      if (failed) return h('p', null, 'Proxy routes UI failed to load.');
      if (!parts) return h('p', null, 'Loading…');
      const language = typeof navigator === 'undefined' ? 'en' : String(navigator.language || 'en');
      const lang = language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
      return h(parts.ui.ProxyConfigPage, {
        view: props.view,
        form: props.form,
        STRINGS: parts.strings.STRINGS,
        V: parts.validate,
        CSS: parts.theme.CSS,
        F: parts.fields,
        lang,
      });
    }

    function apply(ctx) {
      const form = ctx.configForms.get(ENTRY_ID);
      ctx.effect(
        () =>
          ctx.configForms.whileServed([ENTRY_ID], () =>
            ctx.slots.inject('plugins.bundle.config', () =>
              ctx.slots.register(
                { name: 'plugins.bundle.config', key: BUNDLE_ID, locale: NS },
                (props) => h(ProxyPageShell, { view: props.view, form }),
              ),
            ),
          ),
        'provider-proxy: config page',
      );
    }

    return { inject: ['slots', 'configForms'], apply, NS, ENTRY_ID, BUNDLE_ID };
  },
});
