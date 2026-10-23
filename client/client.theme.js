/**
 * Shared theme tokens for the provider-proxy Plugins page.
 *
 * A separate `require.async` chunk so the interactive page chunk stays small.
 * Colors come from DSH design tokens (`--dsw-alias-*`); only interaction states
 * and layout live here.
 */
window.__ModuleLoader__.load({
  id: '@apolenkov/dsh-provider-proxy/client.theme.js',
  factory() {
    const CSS = [
      '.px-root{box-sizing:border-box;display:flex;flex-direction:column;gap:16px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}',
      '.px-root *{box-sizing:border-box}',
      '.px-card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:16px}',
      '.px-title{font-size:15px;margin:0 0 4px}',
      '.px-sub{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5;margin:0 0 12px}',
      '.px-status{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.px-pill{display:inline-block;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px 10px;font-size:12px}',
      '.px-error-summary{border:1px solid var(--dsw-alias-state-error-primary);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-layer-1)}',
      '.px-error-summary h3{margin:0 0 6px;font-size:13px;color:var(--dsw-alias-state-error-primary)}',
      '.px-error-summary ul{margin:0;padding-left:18px}',
      '.px-error-summary a{color:inherit}',
      '.px-badge{display:inline-block;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 9px;font-size:11px;color:var(--dsw-alias-label-secondary)}',
      '.px-rules{display:flex;flex-direction:column;gap:12px}',
      '.px-rule{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);padding:12px 14px 14px}',
      '.px-rule-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 10px}',
      '.px-rule-name{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}',
      '.px-rule-remove{min-height:28px;padding:0 10px;font-size:12px;line-height:1;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.px-rule-remove:hover:not(:disabled){border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}',
      '.px-rule-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px 16px}',
      '.px-rule-grid>*{min-width:0}',
      '.px-field{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.px-label{font-size:12px;font-weight:600}',
      '.px-hint{font-size:11px;line-height:1.45;margin:0;color:var(--dsw-alias-label-secondary)}',
      '.px-input,.px-select,.px-textarea{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:0 10px;font-size:13px;min-height:40px;width:100%}',
      '.px-textarea{padding:8px 10px;min-height:66px;resize:vertical}',
      '.px-input[aria-invalid="true"],.px-select[aria-invalid="true"],.px-textarea[aria-invalid="true"]{border-color:var(--dsw-alias-state-error-primary)}',
      '.px-ferr{font-size:11px;color:var(--dsw-alias-state-error-primary);min-height:16px;margin:0}',
      '.px-actions{display:flex;flex-wrap:wrap;gap:8px}',
      '.px-btn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 14px;font-size:13px;min-height:40px;cursor:pointer}',
      '.px-btn:hover{background:var(--dsw-alias-bg-layer-1)}',
      '.px-btn:disabled{opacity:.5;cursor:default}',
      '.px-btn-primary{background:var(--dsw-alias-button-contrast-fill);color:var(--dsw-alias-label-primary-inverted);border-color:transparent}',
      '.px-btn-danger{border-color:var(--dsw-alias-state-error-primary);min-height:40px}',
      '.px-live{font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.px-live[aria-live]{min-height:18px}',
      'a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '@media (prefers-reduced-motion: reduce){.px-btn{transition:none}}',
    ].join('\n');
    return { CSS };
  },
});
