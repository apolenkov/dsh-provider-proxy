/**
 * Browser entry of `dsh-provider-proxy`.
 *
 * Registers the same route editor in two places:
 *   1. the bundle's row page on the Plugins screen (`plugins.bundle.config`);
 *   2. its own page in Settings (`settings.section`, id `proxy-routes`).
 *
 * Both seats render one component, so the rules have a single implementation.
 * The heavy parts live in lazily loaded chunks (`client.ui.js`,
 * `client.fields.js`, `client.strings.js`, `client.validate.js`,
 * `client.theme.js`) fetched with `require.async` — the only cross-file
 * mechanism the DSH module system supports for package-local code — so every
 * committed file stays small.
 */
window.__ModuleLoader__.load({
  id: '@apolenkov/dsh-provider-proxy',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'provider-proxy';
    const ENTRY_ID = 'provider-proxy';
    const BUNDLE_ID = '@apolenkov/dsh-provider-proxy';
    const SECTION_ID = 'proxy-routes';

    /** Section label, available synchronously before any chunk loads. */
    const NAV = {
      en: 'Proxy routes',
      ru: 'Прокси',
      zh: '代理路由',
    };

    /**
     * Dictionary id for the active harness locale, falling back to the browser
     * language when the locale face is absent (isolated tests, older hosts).
     */
    function detectLang(locale) {
      let active = '';
      try {
        active = String(locale?.getLocale?.()?.active ?? '');
      } catch {
        active = '';
      }
      const raw = active !== '' ? active : (typeof navigator === 'undefined' ? 'en' : String(navigator.language || 'en'));
      const tag = raw.toLowerCase();
      if (tag.startsWith('ru')) return 'ru';
      if (tag.startsWith('zh')) return 'zh';
      return 'en';
    }

    /** Route editor: loads its chunks once, then renders the shared page. */
    function ProxyRoutesView(props) {
      const [parts, setParts] = React.useState(null);
      const [failed, setFailed] = React.useState(false);
      const [, bumpLocale] = React.useState(0);
      React.useEffect(() => {
        const off = props.locale?.subscribe?.(() => bumpLocale((value) => value + 1));
        return typeof off === 'function' ? off : undefined;
      }, [props.locale]);
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
      return h(parts.ui.ProxyConfigPage, {
        view: props.view ?? 'full',
        form: props.form,
        STRINGS: parts.strings.STRINGS,
        V: parts.validate,
        CSS: parts.theme.CSS,
        F: parts.fields,
        lang: detectLang(props.locale),
      });
    }

    function apply(ctx) {
      const form = ctx.configForms.get(ENTRY_ID);
      const locale = ctx.locale;
      const navLabel = () => NAV[detectLang(locale)] ?? NAV.en;

      // 1. The bundle's page on the Plugins screen.
      ctx.effect(
        () =>
          ctx.configForms.whileServed([ENTRY_ID], () =>
            ctx.slots.inject('plugins.bundle.config', () =>
              ctx.slots.register(
                { name: 'plugins.bundle.config', key: BUNDLE_ID, locale: NS },
                (props) => h(ProxyRoutesView, { view: props.view, form, locale }),
              ),
            ),
          ),
        'provider-proxy: plugins config page',
      );

      // 2. A first-class page in Settings, beside Models.
      ctx.effect(
        () =>
          ctx.configForms.whileServed([ENTRY_ID], () =>
            ctx.slots.inject('settings.section', () =>
              ctx.slots.register(
                {
                  name: 'settings.section',
                  id: SECTION_ID,
                  order: 20,
                  label: navLabel,
                },
                () => h(ProxyRoutesView, { view: 'full', form, locale }),
              ),
            ),
          ),
        'provider-proxy: settings section',
      );
    }

    return { inject: ['slots', 'locale', 'configForms'], apply, NS, ENTRY_ID, BUNDLE_ID, SECTION_ID };
  },
});
