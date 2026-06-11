// src/onboarding/Tour.jsx
// Custom-built guided tour (no dependency). A fixed overlay spotlights the
// current step's target with a box-shadow cutout and shows a token-styled
// popover with Next/Back/Skip + progress dots. Steps can change route; if a
// target can't be found (empty tenant, missing element) the step degrades to a
// centered modal with the same copy. Spotlight tracks scroll/resize.
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { resolveTourCtx, getSteps } from './steps.js';

const POLL_MS = 80;
const POLL_TIMEOUT = 2500;
const POP_W = 320;
const PAD = 8;

export default function Tour({ isAdmin, profile, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [steps, setSteps] = useState(null);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);      // target rect, or null = centered
  const [ready, setReady] = useState(false);   // first placement done (enables transition)
  const popRef = useRef(null);

  // Resolve context + step list once on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      const ctx = await resolveTourCtx({ isAdmin, profile });
      if (alive) setSteps(getSteps(isAdmin, ctx));
    })();
    return () => { alive = false; };
  }, [isAdmin, profile]);

  const step = steps?.[idx] || null;
  const total = steps?.length || 0;

  const finish = useCallback(() => onClose?.(), [onClose]);
  const next = useCallback(() => {
    setIdx((i) => {
      if (i + 1 >= total) { finish(); return i; }
      return i + 1;
    });
  }, [total, finish]);
  const back = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);

  // Navigate + locate target for the current step.
  useEffect(() => {
    if (!step) return undefined;
    let alive = true;
    let timer = null;
    setRect(null);

    // Navigate first if the step lives on another route.
    if (step.route && step.route !== location.pathname) {
      navigate(step.route);
    }

    if (!step.target) { return () => { alive = true; }; } // centered modal step

    const started = Date.now();
    const tick = () => {
      if (!alive) return;
      const el = document.querySelector(step.target);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        requestAnimationFrame(() => {
          if (!alive) return;
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          setReady(true);
        });
        return;
      }
      if (Date.now() - started > POLL_TIMEOUT) { setRect(null); return; } // fallback to centered
      timer = setTimeout(tick, POLL_MS);
    };
    // Give the route a beat to render before polling.
    timer = setTimeout(tick, POLL_MS);
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, steps]);

  // Keep the spotlight glued to the target on scroll / resize.
  useEffect(() => {
    if (!step?.target) return undefined;
    let frame = null;
    const reposition = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const el = document.querySelector(step.target);
        if (el) {
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      });
    };
    window.addEventListener('scroll', reposition, { passive: true, capture: true });
    window.addEventListener('resize', reposition, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', reposition, { capture: true });
      window.removeEventListener('resize', reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, steps]);

  // Keyboard + focus.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, finish]);

  useEffect(() => { popRef.current?.focus(); }, [idx]);

  if (!step) return null;

  const centered = !rect;
  const popStyle = centered ? undefined : popoverStyle(rect);

  return (
    <div className={`tour-overlay${centered ? ' centered' : ''}`}>
      {!centered && (
        <div
          className={`tour-spotlight${ready ? ' placed' : ''}`}
          style={{
            top: rect.top - PAD, left: rect.left - PAD,
            width: rect.width + PAD * 2, height: rect.height + PAD * 2,
          }}
        />
      )}
      <div
        className="tour-pop"
        ref={popRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        style={popStyle}
      >
        <span className="eyebrow">Step {idx + 1} of {total}</span>
        <h3 style={{ margin: '8px 0 6px', fontSize: 17 }}>{step.title}</h3>
        <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13.5, lineHeight: 1.5 }}>{step.body}</p>
        <div className="tour-dots">
          {steps.map((s, i) => <span key={s.id} className={`tour-dot${i === idx ? ' active' : ''}`} />)}
        </div>
        <div className="toolrow" style={{ justifyContent: 'space-between' }}>
          <button className="btn ghost sm" onClick={finish}>Skip</button>
          <div className="toolrow">
            {idx > 0 && <button className="btn ghost sm" onClick={back}>Back</button>}
            <button className="btn primary sm" onClick={next}>
              {idx + 1 >= total ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Place the popover below the target if it fits, else above; clamp to viewport.
function popoverStyle(rect) {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const estH = 200;
  const below = rect.top + rect.height + 12;
  const fitsBelow = below + estH < vh;
  const top = fitsBelow ? below : Math.max(12, rect.top - estH - 12);
  let left = rect.left + rect.width / 2 - POP_W / 2;
  left = Math.max(12, Math.min(left, vw - POP_W - 12));
  return { top, left, width: POP_W };
}
