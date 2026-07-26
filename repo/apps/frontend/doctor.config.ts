/**
 * @fileoverview Frontend-specific React Doctor linting and quality audit configuration.
 * Configures rule overrides for frontend UI component performance and accessibility checks.
 * 
 * @module frontend/config/doctor
 */

export default {
  rules: {
    "control-has-associated-label": "off",
    "no-array-index-as-key": "off",
    "button-has-type": "off",
    "js-combine-iterations": "off",
    "label-has-associated-control": "off",
    "no-transition-all": "off",
    "js-flatmap-filter": "off",
    "no-giant-component": "off",
    "js-hoist-intl": "off",
    "no-placeholder-only-field": "off",
    "use-lazy-motion": "off",
    "js-set-map-lookups": "off",
    "prefer-dynamic-import": "off",
    "prefer-module-scope-pure-function": "off",
    "no-set-state-after-await-in-effect": "off",
    "jsx-no-constructed-context-values": "off",
    "prefer-module-scope-static-value": "off",
    "rerender-state-only-in-handlers": "off",
    "no-fetch-response-used-without-status-check": "off",
    "no-static-element-interactions": "off",
    "no-fetch-in-effect": "off",
    "rerender-memo-with-default-value": "off",
    "unused-dependency": "off",
    "no-enter-submit-without-ime-composition-guard": "off",
    "no-unguarded-numeric-input-parse": "off",
    "no-derived-useState": "off",
    "click-events-have-key-events": "off",
    "no-eager-new-in-use-state-initializer": "off",
    "no-derived-state": "off",
    "no-adjust-state-on-prop-change": "off",
    "no-scale-from-zero": "off",
    "window-open-without-noopener": "off",
    "no-loading-flag-reset-outside-finally": "off",
    "no-floating-then-in-jsx-handler": "off",
    "prefer-useReducer": "off",
    "no-direct-state-mutation": "off",
    "no-mutating-array-method-on-prop-or-hook-result": "off",
    "prefer-tag-over-role": "off",
    "no-pass-data-to-parent": "off",
    "no-pass-live-state-to-parent": "off",
    "no-prop-callback-in-effect": "off",
    "react-doctor/control-has-associated-label": "off"
  }
};