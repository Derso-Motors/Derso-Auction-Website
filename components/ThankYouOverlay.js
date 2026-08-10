'use client';

import { useEffect, useState } from 'react';

const CONFETTI_COLORS = ['#4edea3', '#6ffbbe', '#c0c6de', '#ffd166', '#ff7b9c'];

// Animated thank-you overlay: confetti + checkmark. Shown after a successful
// payment (?ok=...) and auto-dismisses.
export default function ThankYouOverlay({ message }) {
  const [visible, setVisible] = useState(true);
  const [pieces] = useState(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: (i * 137.5) % 100,
      delay: (i % 12) * 0.12,
      duration: 2.4 + ((i * 37) % 100) / 55,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + ((i * 53) % 8),
      rotate: (i * 97) % 360,
    }))
  );

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 5200);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className="ty-overlay" onClick={() => setVisible(false)}>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="ty-confetti"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            background: p.color,
            width: p.size,
            height: p.size * 0.5,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
      <div className="ty-box">
        <svg className="ty-check" viewBox="0 0 52 52">
          <circle className="ty-check-circle" cx="26" cy="26" r="24" fill="none" />
          <path className="ty-check-mark" fill="none" d="M14 27l8 8 16-17" />
        </svg>
        <div className="ty-title">תודה רבה! 🙏</div>
        <div className="ty-msg">{message}</div>
        <div className="ty-sub">צוות דרסו כבר על זה — נעדכן אותך בכל שלב</div>
        <button className="ty-close" onClick={() => setVisible(false)}>המשך</button>
      </div>
      <style jsx>{`
        .ty-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(5, 20, 36, 0.78);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: ty-fade 0.4s ease both;
          overflow: hidden;
        }
        @keyframes ty-fade { from { opacity: 0; } to { opacity: 1; } }
        .ty-confetti {
          position: absolute;
          top: -20px;
          border-radius: 2px;
          animation-name: ty-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          opacity: 0.9;
        }
        @keyframes ty-fall {
          to { transform: translateY(110vh) rotate(720deg); }
        }
        .ty-box {
          background: #0d1c2d;
          border: 1px solid rgba(78, 222, 163, 0.3);
          border-radius: 28px;
          padding: 40px 36px 32px;
          text-align: center;
          max-width: 380px;
          margin: 16px;
          box-shadow: 0 0 60px rgba(78, 222, 163, 0.2);
          animation: ty-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
          position: relative;
        }
        @keyframes ty-pop {
          from { opacity: 0; transform: scale(0.6) translateY(30px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .ty-check { width: 84px; height: 84px; margin: 0 auto 18px; display: block; }
        .ty-check-circle {
          stroke: #4edea3;
          stroke-width: 2.5;
          stroke-dasharray: 151;
          stroke-dashoffset: 151;
          animation: ty-draw 0.7s ease-out 0.35s forwards;
        }
        .ty-check-mark {
          stroke: #4edea3;
          stroke-width: 4;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 36;
          stroke-dashoffset: 36;
          animation: ty-draw 0.45s ease-out 0.95s forwards;
        }
        @keyframes ty-draw { to { stroke-dashoffset: 0; } }
        .ty-title { font-size: 24px; font-weight: 700; color: #d4e4fa; margin-bottom: 8px; }
        .ty-msg { font-size: 14.5px; color: #4edea3; font-weight: 600; margin-bottom: 6px; }
        .ty-sub { font-size: 13px; color: #c6c6cd; margin-bottom: 20px; }
        .ty-close {
          background: #4edea3;
          color: #003824;
          border: none;
          border-radius: 999px;
          padding: 11px 34px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s, background 0.2s;
        }
        .ty-close:hover { background: #6ffbbe; transform: scale(1.04); }
      `}</style>
    </div>
  );
}
