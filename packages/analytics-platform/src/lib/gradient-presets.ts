export interface GradientPreset {
  id: string;
  label: string;
  css: string;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: 'mesh-default',
    label: 'Indigo Mist',
    css: 'radial-gradient(ellipse 80% 60% at 10% 0%,rgba(99,102,241,.07) 0%,transparent 60%),radial-gradient(ellipse 60% 50% at 90% 10%,rgba(139,92,246,.06) 0%,transparent 50%),radial-gradient(ellipse 70% 40% at 50% 90%,rgba(244,114,182,.05) 0%,transparent 50%),linear-gradient(160deg,#f8f9ff 0%,#f5f3ff 30%,#fef7f0 55%,#f0f4ff 80%,#f8fafc 100%)',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    css: 'linear-gradient(135deg,#e0f2fe 0%,#f0f9ff 25%,#ecfeff 50%,#e0f2fe 75%,#f0f9ff 100%)',
  },
  {
    id: 'rose',
    label: 'Rose Quartz',
    css: 'linear-gradient(135deg,#fff1f2 0%,#fef2f2 25%,#fdf2f8 50%,#fce7f3 75%,#fff1f2 100%)',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    css: 'linear-gradient(135deg,#ecfdf5 0%,#f0fdf4 30%,#f7fee7 60%,#ecfdf5 100%)',
  },
  {
    id: 'amber',
    label: 'Amber Glow',
    css: 'linear-gradient(135deg,#fffbeb 0%,#fef3c7 25%,#fff7ed 50%,#fffbeb 75%,#fefce8 100%)',
  },
  {
    id: 'slate',
    label: 'Slate Clean',
    css: 'linear-gradient(160deg,#f8fafc 0%,#f1f5f9 40%,#e2e8f0 100%)',
  },
  {
    id: 'violet',
    label: 'Violet Dream',
    css: 'radial-gradient(ellipse at 20% 0%,rgba(139,92,246,.08) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(168,85,247,.06) 0%,transparent 50%),linear-gradient(160deg,#faf5ff 0%,#f5f3ff 40%,#ede9fe 100%)',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    css: 'linear-gradient(135deg,#fff7ed 0%,#fef2f2 30%,#fdf2f8 60%,#faf5ff 100%)',
  },
  {
    id: 'minimal',
    label: 'Minimal White',
    css: 'linear-gradient(180deg,#ffffff 0%,#fafafa 100%)',
  },
  {
    id: 'charcoal',
    label: 'Charcoal',
    css: 'linear-gradient(160deg,#f1f5f9 0%,#e2e8f0 50%,#cbd5e1 100%)',
  },
];

export function getGradientCss(id: string | undefined): string {
  if (!id) return GRADIENT_PRESETS[0].css;
  return GRADIENT_PRESETS.find(g => g.id === id)?.css || GRADIENT_PRESETS[0].css;
}
