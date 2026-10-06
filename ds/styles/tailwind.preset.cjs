// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.
/**
 * Cryonix — Tailwind CSS v3 preset
 *
 * Every value points at a --cx-* custom property from src/styles/tokens, so the
 * dark/light switch (.cx-light / [data-theme="light"]) re-skins utilities with
 * no rebuild. Nothing here holds a literal colour.
 *
 * Setup
 *   1. Import the tokens once, globally (before your Tailwind layers):
 *        @import "./design-system/src/styles/tokens/index.css";
 *        @import "./design-system/src/styles/components/index.css";   // optional .cx-* kit
 *        @tailwind base; @tailwind components; @tailwind utilities;
 *   2. tailwind.config.js:
 *        module.exports = {
 *          presets: [require('./design-system/integrations/tailwind.preset.cjs')],
 *          content: ['./src/**\/*.{ts,tsx,html}'],
 *        };
 *
 * Naming
 *   colors      bg-bg, bg-elevated, bg-surface(-2/-3), text-text, text-text-2,
 *               text-muted, bg-ember, text-ember-text, text-gain, bg-gain-wash…
 *   spacing     p-cx-1 … p-cx-13 (4px…120px). Prefixed so Tailwind's default
 *               numeric scale is left intact.
 *   radius      rounded-xs|sm|icon|md|card|lg|pill
 *   type        text-h1 … text-caption (size + line-height + tracking)
 *   shadow      shadow-sm|md|lg|xl, shadow-cta, shadow-focus
 *   z-index     z-raised, z-sticky, z-nav, z-drawer, z-modal, z-popover, z-toast, z-tooltip
 *
 * Dark is the default theme on :root; `dark:` variants only fire under an
 * explicit .cx-dark ancestor (useful for a dark island inside a light page).
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '.cx-dark'],
  theme: {
    extend: {
      colors: {
        // brand (identical in both themes)
        black: 'var(--cx-black)',
        ink: 'var(--cx-ink)',
        white: 'var(--cx-white)',
        mist: 'var(--cx-mist)',
        'mist-2': 'var(--cx-mist-2)',
        ember: {
          DEFAULT: 'var(--cx-ember)',
          50: 'var(--cx-ember-50)',
          text: 'var(--cx-ember-text)',
          press: 'var(--cx-ember-press)',
        },
        flame: 'var(--cx-flame)',
        amber: 'var(--cx-amber)',
        peach: 'var(--cx-peach)',
        green: 'var(--cx-green)',
        primary: 'var(--cx-primary)',
        'on-primary': 'var(--cx-on-primary)',

        // surfaces
        bg: 'var(--cx-bg)',
        elevated: 'var(--cx-elevated)',
        overlay: 'var(--cx-overlay)',
        surface: {
          DEFAULT: 'var(--cx-surface)',
          2: 'var(--cx-surface-2)',
          3: 'var(--cx-surface-3)',
        },
        'row-hover': 'var(--cx-row-hover)',
        hairline: 'var(--cx-hairline)',
        field: {
          DEFAULT: 'var(--cx-field)',
          hover: 'var(--cx-field-hover)',
          border: 'var(--cx-field-border)',
        },

        // text
        text: {
          DEFAULT: 'var(--cx-text)',
          2: 'var(--cx-text-2)',
          3: 'var(--cx-text-3)',
          muted: 'var(--cx-text-muted)',
          disabled: 'var(--cx-text-disabled)',
        },
        muted: 'var(--cx-text-muted)',

        // money + status
        gain: { DEFAULT: 'var(--cx-gain)', wash: 'var(--cx-gain-wash)' },
        loss: { DEFAULT: 'var(--cx-loss)', wash: 'var(--cx-loss-wash)', border: 'var(--cx-loss-border)' },
        warning: { DEFAULT: 'var(--cx-warning)', wash: 'var(--cx-warning-wash)' },
        info: { DEFAULT: 'var(--cx-info)', wash: 'var(--cx-info-wash)' },
        positive: 'var(--cx-positive)',
        'brand-wash': 'var(--cx-brand-wash)',
        halo: 'var(--cx-halo)',

        // charts
        chart: {
          1: 'var(--cx-chart-1)',
          2: 'var(--cx-chart-2)',
          3: 'var(--cx-chart-3)',
          4: 'var(--cx-chart-4)',
          5: 'var(--cx-chart-5)',
          6: 'var(--cx-chart-6)',
          grid: 'var(--cx-chart-grid)',
        },
      },

      backgroundImage: {
        wash: 'var(--cx-wash)',
        panel: 'var(--cx-panel)',
        'heading-hero': 'var(--cx-heading-hero)',
        heading: 'var(--cx-heading)',
      },

      fontFamily: {
        sans: ['var(--cx-font)'],
        mono: ['var(--cx-font-mono)'],
      },

      fontSize: {
        h1: ['var(--cx-h1)', { lineHeight: 'var(--cx-h1-lh)', letterSpacing: 'var(--cx-h1-ls)', fontWeight: '400' }],
        h2: ['var(--cx-h2)', { lineHeight: 'var(--cx-h2-lh)', letterSpacing: 'var(--cx-h2-ls)', fontWeight: '400' }],
        h3: ['var(--cx-h3)', { lineHeight: 'var(--cx-h3-lh)', letterSpacing: 'var(--cx-h3-ls)', fontWeight: '500' }],
        h4: ['var(--cx-h4)', { lineHeight: 'var(--cx-h4-lh)', letterSpacing: 'var(--cx-h4-ls)', fontWeight: '500' }],
        lead: ['var(--cx-lead)', { lineHeight: 'var(--cx-lead-lh)', letterSpacing: 'var(--cx-lead-ls)' }],
        'body-lg': ['var(--cx-body-lg)', { lineHeight: 'var(--cx-body-lg-lh)', letterSpacing: 'var(--cx-body-lg-ls)' }],
        body: ['var(--cx-body)', { lineHeight: 'var(--cx-body-lh)', letterSpacing: 'var(--cx-body-ls)' }],
        small: ['var(--cx-small)', { lineHeight: 'var(--cx-small-lh)', letterSpacing: 'var(--cx-small-ls)' }],
        caption: ['var(--cx-caption)', { letterSpacing: 'var(--cx-caption-ls)' }],
        balance: ['var(--cx-balance)', { lineHeight: '1.05', letterSpacing: '-2px', fontWeight: '300' }],
      },

      spacing: {
        'cx-1': 'var(--cx-s-1)',
        'cx-2': 'var(--cx-s-2)',
        'cx-3': 'var(--cx-s-3)',
        'cx-4': 'var(--cx-s-4)',
        'cx-5': 'var(--cx-s-5)',
        'cx-6': 'var(--cx-s-6)',
        'cx-7': 'var(--cx-s-7)',
        'cx-8': 'var(--cx-s-8)',
        'cx-9': 'var(--cx-s-9)',
        'cx-10': 'var(--cx-s-10)',
        'cx-11': 'var(--cx-s-11)',
        'cx-12': 'var(--cx-s-12)',
        'cx-13': 'var(--cx-s-13)',
        gutter: 'var(--cx-gutter)',
        section: 'var(--cx-section)',
        'card-pad': 'var(--cx-card-pad)',
        gap: 'var(--cx-gap)',
        'nav-h': 'var(--cx-nav-h)',
        sidebar: 'var(--cx-sidebar-w)',
        control: 'var(--cx-control-h)',
        'control-sm': 'var(--cx-control-h-sm)',
        'control-lg': 'var(--cx-control-h-lg)',
        touch: 'var(--cx-touch)',
      },

      maxWidth: {
        container: 'var(--cx-container)',
        narrow: 'var(--cx-container-narrow)',
      },

      borderRadius: {
        xs: 'var(--cx-r-xs)',
        sm: 'var(--cx-r-sm)',
        icon: 'var(--cx-r-icon)',
        md: 'var(--cx-r-md)',
        card: 'var(--cx-r-card)',
        lg: 'var(--cx-r-lg)',
        pill: 'var(--cx-r-pill)',
      },

      boxShadow: {
        sm: 'var(--cx-shadow-sm)',
        md: 'var(--cx-shadow-md)',
        lg: 'var(--cx-shadow-lg)',
        xl: 'var(--cx-shadow-xl)',
        cta: 'var(--cx-glow-cta)',
        focus: 'var(--cx-focus-ring)',
        'focus-halo': 'var(--cx-focus-halo)',
      },

      zIndex: {
        base: 'var(--cx-z-base)',
        raised: 'var(--cx-z-raised)',
        sticky: 'var(--cx-z-sticky)',
        nav: 'var(--cx-z-nav)',
        drawer: 'var(--cx-z-drawer)',
        modal: 'var(--cx-z-modal)',
        popover: 'var(--cx-z-popover)',
        toast: 'var(--cx-z-toast)',
        tooltip: 'var(--cx-z-tooltip)',
      },

      transitionTimingFunction: {
        cx: 'var(--cx-ease)',
        'cx-in-out': 'var(--cx-ease-in-out)',
      },
      transitionDuration: {
        fast: 'var(--cx-dur-fast)',
        cx: 'var(--cx-dur)',
        slow: 'var(--cx-dur-slow)',
      },

      backdropBlur: {
        nav: '16px',
        glass: '20px',
      },

      // mirrors the breakpoints noted in tokens.css (vars can't drive @media)
      screens: {
        tablet: '768px',
        desktop: '1200px',
      },
    },
  },
};
