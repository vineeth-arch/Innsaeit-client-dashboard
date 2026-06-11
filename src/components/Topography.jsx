// src/components/Topography.jsx
// Static topographic contour-line backdrop for the post-login pages (replaces
// the old Particles canvas). Pure SVG, no rAF / React state — it just paints.
// The lines are generated procedurally: fractal-noise turbulence is pushed into
// the alpha channel, then a "spike" component-transfer keeps only thin slices of
// that field, which read as the iso-contours of a topographic map. Composited
// with a flood colour a touch lighter than the page background so the pattern is
// felt more than seen. Recolours with the theme; honours reduced motion only in
// that there's nothing to honour — it never animates.
import { useId } from 'react';

const TONE = {
  // [flood rgb, flood-opacity] — a shade offset from the page background.
  dark: { rgb: '150, 140, 210', opacity: 0.5 },   // faint light-indigo on the dark field
  light: { rgb: '44, 0, 152', opacity: 0.16 },    // faint indigo on the light field
};

// 40 buckets, a single contour line every 5th → ~8 evenly spaced iso-lines.
const TABLE = '0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1';

export default function Topography({ theme = 'dark' }) {
  const rawId = useId();
  const filterId = `topo-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const tone = TONE[theme] || TONE.dark;

  return (
    <svg className="topo-bg" aria-hidden="true" preserveAspectRatio="none"
         xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id={filterId} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.009"
                        numOctaves="3" seed="11" stitchTiles="stitch" result="noise" />
          {/* Move a single noise channel into alpha so we have one scalar field. */}
          <feColorMatrix in="noise" type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="field" />
          {/* Keep only thin slices of that field → contour lines. */}
          <feComponentTransfer in="field" result="lines">
            <feFuncA type="discrete" tableValues={TABLE} />
          </feComponentTransfer>
          <feFlood floodColor={`rgb(${tone.rgb})`} floodOpacity={tone.opacity} result="ink" />
          <feComposite in="ink" in2="lines" operator="in" />
        </filter>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" filter={`url(#${filterId})`} />
    </svg>
  );
}
