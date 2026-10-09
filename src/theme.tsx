import { useEffect, useState } from 'react';
export type Theme = 'light' | 'dark';
const KEY = 'jm:theme';
const META = { light: '#faf6ee', dark: '#080707' };
const device = (): Theme => window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
const saved = (): Theme | null => { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch { return null; } };
export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', META[t]);
}
/** Tema: escolha salva; sem escolha, segue o aparelho (e acompanha se o aparelho mudar). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => saved() ?? device());
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)'); if (!mq) return;
    const on = () => { if (!saved()) setTheme(device()); };
    mq.addEventListener?.('change', on); return () => mq.removeEventListener?.('change', on);
  }, []);
  const toggle = () => setTheme(t => { const n: Theme = t === 'light' ? 'dark' : 'light'; try { localStorage.setItem(KEY, n); } catch { /* sem armazenamento */ } return n; });
  const set = (n: Theme) => { try { localStorage.setItem(KEY, n); } catch { /* sem armazenamento */ } setTheme(n); };
  return { theme, toggle, set };
}
export function ThemeButton({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const light = theme === 'light';
  return <button type="button" className="theme-btn" onClick={onToggle} aria-label={light ? 'Usar tema escuro' : 'Usar tema claro'} title={light ? 'Tema escuro' : 'Tema claro'}>
    {light
      ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" /></svg>
      : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg>}
  </button>;
}
