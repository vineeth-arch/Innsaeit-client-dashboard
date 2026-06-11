// src/components/Particles.jsx
// Ported from MagicUI's Particles. Two deliberate adaptations:
//  1. The source tracks the mouse with a React state hook that re-renders on
//     every mousemove — replaced here with a ref + window listener so the app
//     never re-renders from particle motion (no jank on long SKU lists).
//  2. Added reduced-motion gating, visibility pause, and theme→colour via a ref
//     (recolours without re-seeding the field).
// Single fixed canvas behind all content (.particles-canvas in styles.css).
import { useEffect, useRef } from 'react';

const COLORS = {
  dark: { rgb: [0, 255, 207], mult: 0.35 },   // mint, very low opacity
  light: { rgb: [44, 0, 152], mult: 0.25 },   // indigo, low opacity
};

export default function Particles({ theme = 'dark', quantity = 50, staticity = 80, ease = 50 }) {
  const canvasRef = useRef(null);
  const colorRef = useRef(COLORS[theme] || COLORS.dark);

  // Recolour without re-seeding when the theme flips.
  useEffect(() => { colorRef.current = COLORS[theme] || COLORS.dark; }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    let circles = [];
    let raf = null;
    const size = { w: 0, h: 0 };
    const mouse = { x: 0, y: 0 };
    let resizeTimer = null;

    const remap = (v, a1, b1, a2, b2) => {
      const r = ((v - a1) * (b2 - a2)) / (b1 - a1) + a2;
      return r > 0 ? r : 0;
    };

    const circleParams = () => ({
      x: Math.floor(Math.random() * size.w),
      y: Math.floor(Math.random() * size.h),
      translateX: 0,
      translateY: 0,
      size: Math.random() * 0.6 + 0.6,        // 0.6–1.2px
      alpha: 0,
      targetAlpha: parseFloat((Math.random() * 0.4 + 0.1).toFixed(1)),
      dx: (Math.random() - 0.5) * 0.1,
      dy: (Math.random() - 0.5) * 0.1,
      magnetism: 0.1 + Math.random() * 4,
    });

    const draw = (c) => {
      const { rgb, mult } = colorRef.current;
      ctx.translate(c.translateX, c.translateY);
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.size, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(${rgb.join(', ')}, ${c.alpha * mult})`;
      ctx.fill();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const resize = () => {
      size.w = window.innerWidth;
      size.h = window.innerHeight;
      canvas.width = size.w * dpr;
      canvas.height = size.h * dpr;
      canvas.style.width = `${size.w}px`;
      canvas.style.height = `${size.h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      circles = Array.from({ length: quantity }, circleParams);
    };

    const clear = () => ctx.clearRect(0, 0, size.w, size.h);

    const animate = () => {
      clear();
      circles.forEach((c, i) => {
        const edges = [
          c.x + c.translateX - c.size,
          size.w - c.x - c.translateX - c.size,
          c.y + c.translateY - c.size,
          size.h - c.y - c.translateY - c.size,
        ];
        const closest = edges.reduce((a, b) => Math.min(a, b));
        const remapped = parseFloat(remap(closest, 0, 20, 0, 1).toFixed(2));
        if (remapped > 1) {
          c.alpha = Math.min(c.alpha + 0.02, c.targetAlpha);
        } else {
          c.alpha = c.targetAlpha * remapped;
        }
        c.x += c.dx;
        c.y += c.dy;
        c.translateX += (mouse.x / (staticity / c.magnetism) - c.translateX) / ease;
        c.translateY += (mouse.y / (staticity / c.magnetism) - c.translateY) / ease;
        draw(c);
        if (c.x < -c.size || c.x > size.w + c.size || c.y < -c.size || c.y > size.h + c.size) {
          circles.splice(i, 1);
          circles.push(circleParams());
        }
      });
      raf = window.requestAnimationFrame(animate);
    };

    const start = () => { if (raf == null) animate(); };
    const stop = () => { if (raf != null) { window.cancelAnimationFrame(raf); raf = null; } };

    const onMouseMove = (e) => {
      const x = e.clientX - size.w / 2;
      const y = e.clientY - size.h / 2;
      mouse.x = x;
      mouse.y = y;
    };
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    };
    const onVisibility = () => { if (document.hidden) stop(); else start(); };

    // Reduced motion: render nothing moving. Re-evaluate if the user toggles it.
    const setup = () => {
      stop();
      if (mq.matches) { resize(); clear(); return; }
      resize();
      start();
    };
    const onMqChange = () => setup();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    mq.addEventListener?.('change', onMqChange);
    setup();

    return () => {
      stop();
      clearTimeout(resizeTimer);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      mq.removeEventListener?.('change', onMqChange);
    };
  }, [quantity, staticity, ease]);

  return <canvas ref={canvasRef} className="particles-canvas" aria-hidden="true" />;
}
