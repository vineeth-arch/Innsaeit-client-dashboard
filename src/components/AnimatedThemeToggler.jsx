// src/components/AnimatedThemeToggler.jsx
// Ported from MagicUI's AnimatedThemeToggler (circle variant). Instead of
// next-themes / a `.dark` class it drives our existing data-theme + localStorage
// mechanism (owned by Layout, passed in as { theme, setTheme }). On supporting
// browsers it reveals the new theme with a circular clip-path wipe centred on
// the button via the View Transitions API; falls back to an instant toggle in
// Firefox and under reduced motion. The data-attribute + CSS variables pin the
// collapsed clip-path so engines don't flash the new theme unclipped between the
// snapshot and the JS animation (source's Firefox-safety technique).
import { useRef } from 'react';
import { flushSync } from 'react-dom';

const Sun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const Moon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const DURATION = 400;

export default function AnimatedThemeToggler({ theme, setTheme }) {
  const ref = useRef(null);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const apply = () => {
      // flushSync captures the icon swap in the snapshot; passive effects aren't
      // guaranteed to flush inside the VT callback, so set the attribute directly.
      flushSync(() => setTheme(next));
      document.documentElement.setAttribute('data-theme', next);
    };

    if (typeof document.startViewTransition !== 'function' || reduced) {
      apply();
      return;
    }

    const root = document.documentElement;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const maxR = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const clip = [`circle(0px at ${x}px ${y}px)`, `circle(${maxR}px at ${x}px ${y}px)`];

    root.dataset.magicuiThemeVt = 'active';
    root.style.setProperty('--magicui-theme-toggle-vt-duration', `${DURATION}ms`);
    root.style.setProperty('--magicui-theme-vt-clip-from', clip[0]);
    const cleanup = () => {
      delete root.dataset.magicuiThemeVt;
      root.style.removeProperty('--magicui-theme-toggle-vt-duration');
      root.style.removeProperty('--magicui-theme-vt-clip-from');
    };

    const vt = document.startViewTransition(apply);
    if (vt?.finished?.finally) vt.finished.finally(cleanup); else cleanup();

    vt.ready?.then(() => {
      try {
        root.animate(
          { clipPath: clip },
          { duration: DURATION, easing: 'ease-in-out', fill: 'forwards',
            pseudoElement: '::view-transition-new(root)' },
        );
      } catch {
        // Older engines without pseudoElement support: the theme still switched.
      }
    });
  }

  return (
    <button
      ref={ref}
      className="btn ghost sm theme-toggle"
      aria-label="Toggle light/dark theme"
      onClick={toggle}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </button>
  );
}
