// src/components/InteractiveHoverButton.jsx
// Adapted from MagicUI's InteractiveHoverButton — a mint dot that expands to
// fill the button on hover while the label crossfades to a dark-on-mint label
// with an arrow. Ported to plain JSX; all motion lives in CSS (.ihb in
// styles.css), gated behind @media (hover: hover) so touch devices don't get
// stuck-hover states. Spreads through disabled/onClick/style.
export default function InteractiveHoverButton({ children, className = '', ...props }) {
  return (
    <button className={`ihb ${className}`.trim()} {...props}>
      <span className="ihb-base">
        <span className="ihb-dot" />
        <span className="ihb-text">{children}</span>
      </span>
      <span className="ihb-hover" aria-hidden="true">
        {children}
        <span className="ihb-arrow">→</span>
      </span>
    </button>
  );
}
