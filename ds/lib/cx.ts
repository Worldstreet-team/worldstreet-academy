// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.


export type ClassValue = string | false | null | undefined | 0;
export function cx(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}

export type Tone = 'neutral' | 'gain' | 'loss' | 'warning' | 'brand';
