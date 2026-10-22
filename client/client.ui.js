/**
 * Proxy routes configuration page (form shell + tables).
 *
 * Loaded on demand by `client/client.js` through `require.async`, so the entry
 * stays small. Receives everything it does not own through props: the Host
 * settings `form`, the `STRINGS` dictionaries, the pure validation helpers `V`,
 * and the active two-letter `lang`.
 */
window.__ModuleLoader__.load({
  id: 'dsh-provider-proxy/client.ui.js',
  factory(require) {
    const React = require('react');
    const { useEffect, useRef, useState } = React;
    const h = React.createElement;

    let rowSeq = 0;
    function nextKey(prefix) {
      rowSeq += 1;
      return `${prefix}-${Date.now().toString(36)}-${rowSeq}`;
    }

    function useFormEntry(form) {
      const [snapshot, setSnapshot] = useState(() => form.getSnapshot());
      useEffect(() => form.subscribe(() => setSnapshot(form.getSnapshot())), [form]);
      return [form, snapshot];
    }

    function ProxyConfigPage(props) {
      const { view, form, STRINGS, V, lang, CSS, F } = props;
      if (!F || typeof F.ProxyValueEditor !== 'function') throw new Error('provider-proxy: missing field primitives');
      const { FieldError, ProxyValueEditor } = F;
      const dict = (STRINGS && STRINGS[lang]) || STRINGS.en;
      const t = (key, ...args) => {
        const value = dict[key];
        return typeof value === 'function' ? value(...args) : value;
      };
      const [formApi, snapshot] = useFormEntry(form);
      const [draft, setDraft] = useState(() => V.snapshotToDraft(snapshot.value));
      const [dirty, setDirty] = useState(false);
      const [remoteChanged, setRemoteChanged] = useState(false);
      const [baseRevision, setBaseRevision] = useState(snapshot.revision);
      const [phase, setPhase] = useState('idle');
      const [message, setMessage] = useState('');
      const [errors, setErrors] = useState({ providers: {}, models: {}, form: [] });
      const summaryRef = useRef(null);
      const lastRevision = useRef(snapshot.revision);

      useEffect(() => {
        if (snapshot.status === 'ready' && lastRevision.current === undefined && snapshot.revision !== undefined && !dirty) {
          setDraft(V.snapshotToDraft(snapshot.value));
          setBaseRevision(snapshot.revision);
        }
        if (snapshot.revision !== undefined && snapshot.revision !== lastRevision.current) {
          lastRevision.current = snapshot.revision;
          if (dirty) setRemoteChanged(true);
          else {
            setDraft(V.snapshotToDraft(snapshot.value));
            setBaseRevision(snapshot.revision);
            setRemoteChanged(false);
          }
        }
      }, [snapshot, dirty]);

      if (view === 'summary') return h('span', null, t('description'));
      if (snapshot.status === 'loading') return h('p', { className: 'px-sub' }, t('loading'));
      if (snapshot.status === 'unavailable') return h('p', { className: 'px-sub' }, t('unavailable'));

      const disabled = snapshot.writable === false || phase === 'saving';

      function touchDraft(next) {
        setDraft(next);
        setDirty(true);
        setRemoteChanged(false);
      }

      function fieldError(kind, index, field) {
        return (errors[kind] && errors[kind][index] && errors[kind][index][field]) || '';
      }

      function validate(next) {
        const result = V.validateDraft(next, t);
        setErrors(result.errors);
        return result;
      }

      async function onSave(event) {
        if (event) event.preventDefault();
        const check = validate(draft);
        if (!check.ok) {
          setPhase('error');
          setMessage(t('submitError'));
          if (summaryRef.current && summaryRef.current.focus) summaryRef.current.focus();
          return;
        }
        setPhase('saving');
        setMessage(t('saving'));
        try {
          const accepted = await formApi.mutate([{ op: 'set', path: [], value: V.serializeDraft(draft) }], baseRevision);
          if (accepted) {
            setDirty(false);
            setPhase('saved');
            setMessage(t('statusSaved', baseRevision));
          } else {
            // Keep the draft, but re-base on the latest revision so the next Save
            // overwrites instead of conflicting again — Discard reloads instead.
            const latest = formApi.getSnapshot();
            if (latest && latest.revision !== undefined) setBaseRevision(latest.revision);
            setPhase('conflict');
            setMessage(t('conflict'));
          }
        } catch (failure) {
          setPhase('failed');
          setMessage(t('saveFailed'));
        }
      }

      function onDiscard() {
        setDraft(V.snapshotToDraft(snapshot.value));
        setBaseRevision(snapshot.revision);
        setDirty(false);
        setRemoteChanged(false);
        setErrors({ providers: {}, models: {}, form: [] });
        setPhase('idle');
        setMessage('');
      }

      function onReset() {
        touchDraft({ default: 'inherit', providers: [], models: [] });
        setErrors({ providers: {}, models: {}, form: [] });
      }

      function addProvider() {
        touchDraft({
          ...draft,
          providers: [...draft.providers, { key: nextKey('provider'), label: '', hosts: '', proxyKind: 'inherit', proxyUrl: '', errors: {} }],
        });
      }

      function addModel() {
        touchDraft({
          ...draft,
          models: [...draft.models, { key: nextKey('model'), id: '', provider: '', proxyKind: 'inherit', proxyUrl: '', errors: {} }],
        });
      }

      function updateProvider(index, patch) {
        touchDraft({ ...draft, providers: draft.providers.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
      }

      function updateModel(index, patch) {
        touchDraft({ ...draft, models: draft.models.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
      }

      function removeProvider(index) {
        touchDraft({ ...draft, providers: draft.providers.filter((_, i) => i !== index) });
      }

      function removeModel(index) {
        touchDraft({ ...draft, models: draft.models.filter((_, i) => i !== index) });
      }

      const defaultDecision = draft.default === 'inherit' || draft.default === 'direct' ? draft.default : 'inherit';
      const errorItems = [];
      errors.form.forEach((text, i) => errorItems.push({ href: '#px-error-summary', text: `${i + 1}. ${text}` }));
      Object.keys(errors.providers || {}).forEach((index) => {
        const rowErrors = errors.providers[index] || {};
        Object.keys(rowErrors).forEach((field) => {
          if (rowErrors[field]) errorItems.push({ href: `#px-provider-${index}-${field}`, text: rowErrors[field] });
        });
      });
      Object.keys(errors.models || {}).forEach((index) => {
        const rowErrors = errors.models[index] || {};
        Object.keys(rowErrors).forEach((field) => {
          if (rowErrors[field]) errorItems.push({ href: `#px-model-${index}-${field}`, text: rowErrors[field] });
        });
      });

      return h('div', { className: 'px-root' },
        h('style', null, CSS),
        h('div', { className: 'px-card' },
          h('h2', { className: 'px-title' }, t('title')),
          h('p', { className: 'px-sub' }, t('description')),
          h('div', { className: 'px-status' },
            h('span', { className: 'px-pill' }, t('summary', draft.providers.length, draft.models.length, draft.default)),
            dirty ? h('span', { className: 'px-badge' }, '•') : null,
            h('span', { className: 'px-live', 'aria-live': 'polite' }, message || '')),
          remoteChanged ? h('p', { className: 'px-sub' }, t('conflict')) : null),
        errorItems.length > 0 ? h('div', { className: 'px-error-summary', role: 'alert', tabIndex: -1, ref: summaryRef, id: 'px-error-summary' },
          h('h3', null, t('errorSummaryTitle')),
          h('ul', null, errorItems.map((item, i) => h('li', { key: `err-${i}` }, h('a', { href: item.href }, item.text))))) : null,
        h('form', {
          className: 'px-card',
          onSubmit: onSave,
          // Field blur re-runs validation so errors surface before Save, as documented.
          onBlur: () => validate(draft),
          noValidate: true,
        },
          h('div', { className: 'px-field' },
            h('label', { className: 'px-label', htmlFor: 'px-default' }, t('defaultLabel')),
            h('select', {
              id: 'px-default', className: 'px-select', value: defaultDecision, disabled,
              onChange: (event) => touchDraft({ ...draft, default: event.target.value }),
            },
              h('option', { value: 'inherit' }, t('proxyChoiceInherit')),
              h('option', { value: 'direct' }, t('proxyChoiceDirect'))),
            h('p', { className: 'px-hint' }, t('defaultHint'))),
          h('h3', { className: 'px-title' }, t('providersTitle')),
          draft.providers.length === 0 ? h('p', { className: 'px-sub' }, t('noProviders')) : h('div', { className: 'px-tablewrap' },
            h('table', { className: 'px-table' },
              h('thead', null, h('tr', null,
                h('th', { scope: 'col' }, t('providerLabel')),
                h('th', { scope: 'col' }, t('hostsLabel')),
                h('th', { scope: 'col' }, t('proxyLabel')),
                h('th', { scope: 'col' }, h('span', { className: 'px-muted' }, '·')))),
              h('tbody', null, draft.providers.map((row, index) => h('tr', { key: row.key },
                h('td', null,
                  h('div', { className: 'px-field' },
                    h('label', { className: 'px-label', htmlFor: `px-provider-${index}-label` }, t('providerLabel')),
                    h('input', {
                      id: `px-provider-${index}-label`, className: 'px-input', value: row.label, disabled,
                      autoComplete: 'off', spellCheck: false,
                      'aria-invalid': fieldError('providers', index, 'label') ? 'true' : 'false',
                      'aria-describedby': `px-provider-${index}-label-hint px-provider-${index}-label-error`,
                      onChange: (event) => updateProvider(index, { label: event.target.value }),
                    }),
                    h('p', { className: 'px-hint', id: `px-provider-${index}-label-hint` }, t('providerLabelHint')),
                    h(FieldError, { id: `px-provider-${index}-label-error`, message: fieldError('providers', index, 'label') }))),
                h('td', null,
                  h('div', { className: 'px-field' },
                    h('label', { className: 'px-label', htmlFor: `px-provider-${index}-hosts` }, t('hostsLabel')),
                    h('textarea', {
                      id: `px-provider-${index}-hosts`, className: 'px-textarea', value: row.hosts, disabled,
                      autoComplete: 'off', spellCheck: false,
                      'aria-invalid': fieldError('providers', index, 'hosts') ? 'true' : 'false',
                      'aria-describedby': `px-provider-${index}-hosts-hint px-provider-${index}-hosts-error`,
                      onChange: (event) => updateProvider(index, { hosts: event.target.value }),
                    }),
                    h('p', { className: 'px-hint', id: `px-provider-${index}-hosts-hint` }, t('hostsHint')),
                    h(FieldError, { id: `px-provider-${index}-hosts-error`, message: fieldError('providers', index, 'hosts') }))),
                h('td', null,
                  h(ProxyValueEditor, {
                    t,
                    baseId: `px-provider-${index}-proxy`,
                    disabled,
                    value: { kind: row.proxyKind, url: row.proxyUrl, error: fieldError('providers', index, 'proxy') },
                    onChange: (next) => updateProvider(index, { proxyKind: next.kind, proxyUrl: next.url || '' }),
                  })),
                h('td', null,
                  h('button', { type: 'button', className: 'px-btn px-btn-danger', disabled, 'aria-label': t('deleteRow', row.label || `#${index + 1}`), onClick: () => removeProvider(index) }, t('remove')))))))),
          h('div', { className: 'px-actions' },
            h('button', { type: 'button', className: 'px-btn', disabled, onClick: addProvider }, t('addProvider')),
            h('button', { type: 'button', className: 'px-btn', disabled, onClick: onReset }, t('resetDefaults'))),
          h('h3', { className: 'px-title' }, t('modelsTitle')),
          draft.models.length === 0 ? h('p', { className: 'px-sub' }, t('noModels')) : h('div', { className: 'px-tablewrap' },
            h('table', { className: 'px-table' },
              h('thead', null, h('tr', null,
                h('th', { scope: 'col' }, t('modelLabel')),
                h('th', { scope: 'col' }, t('providerPinLabel')),
                h('th', { scope: 'col' }, t('proxyLabel')),
                h('th', { scope: 'col' }, h('span', { className: 'px-muted' }, '·')))),
              h('tbody', null, draft.models.map((row, index) => h('tr', { key: row.key },
                h('td', null,
                  h('div', { className: 'px-field' },
                    h('label', { className: 'px-label', htmlFor: `px-model-${index}-id` }, t('modelLabel')),
                    h('input', {
                      id: `px-model-${index}-id`, className: 'px-input', value: row.id, disabled,
                      autoComplete: 'off', spellCheck: false,
                      'aria-invalid': fieldError('models', index, 'id') ? 'true' : 'false',
                      'aria-describedby': `px-model-${index}-id-hint px-model-${index}-id-error`,
                      onChange: (event) => updateModel(index, { id: event.target.value }),
                    }),
                    h('p', { className: 'px-hint', id: `px-model-${index}-id-hint` }, t('modelHint')),
                    h(FieldError, { id: `px-model-${index}-id-error`, message: fieldError('models', index, 'id') }))),
                h('td', null,
                  h('div', { className: 'px-field' },
                    h('label', { className: 'px-label', htmlFor: `px-model-${index}-provider` }, t('providerPinLabel')),
                    h('input', {
                      id: `px-model-${index}-provider`, className: 'px-input', value: row.provider, disabled,
                      autoComplete: 'off', spellCheck: false,
                      'aria-invalid': fieldError('models', index, 'provider') ? 'true' : 'false',
                      'aria-describedby': `px-model-${index}-provider-hint px-model-${index}-provider-error`,
                      onChange: (event) => updateModel(index, { provider: event.target.value }),
                    }),
                    h('p', { className: 'px-hint', id: `px-model-${index}-provider-hint` }, t('providerPinHint')),
                    h(FieldError, { id: `px-model-${index}-provider-error`, message: fieldError('models', index, 'provider') }))),
                h('td', null,
                  h(ProxyValueEditor, {
                    t,
                    baseId: `px-model-${index}-proxy`,
                    disabled,
                    value: { kind: row.proxyKind, url: row.proxyUrl, error: fieldError('models', index, 'proxy') },
                    onChange: (next) => updateModel(index, { proxyKind: next.kind, proxyUrl: next.url || '' }),
                  })),
                h('td', null,
                  h('button', { type: 'button', className: 'px-btn px-btn-danger', disabled, 'aria-label': t('deleteRow', row.id || `#${index + 1}`), onClick: () => removeModel(index) }, t('remove')))))))),
          h('div', { className: 'px-actions' },
            h('button', { type: 'button', className: 'px-btn', disabled, onClick: addModel }, t('addModel')),
            h('button', { type: 'submit', className: 'px-btn px-btn-primary', disabled }, phase === 'saving' ? t('saving') : t('save')),
            h('button', { type: 'button', className: 'px-btn', disabled, onClick: onDiscard }, t('discard'))),
          h('p', { className: 'px-sub' }, t('stateNote'))),
        h('div', { className: 'px-card' },
          h('h3', { className: 'px-title' }, t('precedenceTitle')),
          h('p', { className: 'px-sub' }, t('precedence')))
      );
    }

    return { ProxyConfigPage };
  },
});
