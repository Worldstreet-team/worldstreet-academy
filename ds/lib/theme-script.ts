// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.
/** Server-safe (no 'use client'): called from the root layout during SSR. */
/**
 * Inline this in <head> (before paint) so the stored / OS theme applies with no flash.
 * Must use the same storage key as ThemeProvider.
 */
export function themeScript(storageKey = 'cx-theme'): string {
  return `try{var t=localStorage.getItem(${JSON.stringify(storageKey)});if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.setAttribute('data-theme',t)}catch(e){}`;
}
