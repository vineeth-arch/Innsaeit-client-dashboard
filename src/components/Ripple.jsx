// src/components/Ripple.jsx
// Adapted from MagicUI's Ripple — concentric bordered circles that breathe
// slowly behind the login card. Ported to plain JSX and restyled with our
// tokens (indigo borders, a faint mint tint on the innermost ring). The
// animation rests at scale(1), so when prefers-reduced-motion freezes it
// (global rule in styles.css) it settles into clean static concentric rings.
export default function Ripple({ mainSize = 210, count = 7 }) {
  return (
    <div className="ripple" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => {
        const size = mainSize + i * 70;
        const opacity = Math.max(0.04, 0.22 - i * 0.025);
        const borderColor = i === 0
          ? 'rgba(0, 255, 207, 0.25)'
          : `rgba(44, 0, 152, ${Math.max(0.1, 0.55 - i * 0.05)})`;
        return (
          <span
            key={i}
            className="ripple-ring"
            style={{
              width: size,
              height: size,
              opacity,
              borderColor,
              animationDelay: `${i * 0.18}s`,
            }}
          />
        );
      })}
    </div>
  );
}
