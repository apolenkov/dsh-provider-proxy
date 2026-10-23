/**
 * Reusable field primitives for the Proxy routes page.
 *
 * Loaded as its own `require.async` chunk so the interactive page chunk keeps
 * room under the repository file-size budget. Only React is required; copy
 * arrives through `t`, so these components stay locale-agnostic.
 */
window.__ModuleLoader__.load({
  id: '@apolenkov/dsh-provider-proxy/client.fields.js',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    function FieldError({ id, message }) {
      if (!message) return h('p', { className: 'px-ferr', id }, '');
      return h('p', { className: 'px-ferr', id, role: 'alert' }, message);
    }

    function ProxyValueEditor(props) {
      const { t, value, onChange, disabled, baseId } = props;
      const kind = value.kind;
      const setKind = (next) => onChange({ kind: next, url: next === 'custom' ? value.url : '' });
      return h('div', { className: 'px-field' },
        h('label', { className: 'px-label', htmlFor: `${baseId}-kind` }, t('proxyLabel')),
        h('select', {
          id: `${baseId}-kind`,
          className: 'px-select',
          value: kind,
          disabled,
          'aria-describedby': `${baseId}-kind-hint ${baseId}-error`,
          onChange: (event) => setKind(event.target.value),
        },
          h('option', { value: 'inherit' }, t('proxyChoiceInherit')),
          h('option', { value: 'direct' }, t('proxyChoiceDirect')),
          h('option', { value: 'custom' }, t('proxyChoiceCustom'))),
        kind === 'custom'
          ? h('p', { className: 'px-hint', id: `${baseId}-kind-hint` }, t('proxyUrlHint'))
          : null,
        kind === 'custom' ? h('label', { className: 'px-label', htmlFor: `${baseId}-url`, id: `${baseId}-url-hint` }, t('proxyUrlLabel')) : null,
        kind === 'custom'
          ? h('input', {
            id: `${baseId}-url`,
            className: 'px-input',
            value: value.url,
            disabled,
            inputMode: 'url',
            autoComplete: 'off',
            spellCheck: false,
            'aria-invalid': value.error ? 'true' : 'false',
            'aria-describedby': `${baseId}-url-hint ${baseId}-error`,
            onChange: (event) => onChange({ kind, url: event.target.value }),
          })
          : null,
        h(FieldError, { id: `${baseId}-error`, message: value.error }));
    }

    return { FieldError, ProxyValueEditor };
  },
});
