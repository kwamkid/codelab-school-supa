'use client';

import { ReactNode, useEffect, useState } from 'react';

interface Star { top: number; left: number; size: number; delay: number; dur: number }

// "CodeLab Space" background for student quiz pages: deep-space gradient with a
// red brand nebula, twinkling stars, shooting stars, a planet and a space station.
// `headerRight` renders on the same line as the logo (e.g. language toggle).
export function QuizBackground({ children, headerRight }: { children: ReactNode; headerRight?: ReactNode }) {
  const [stars, setStars] = useState<Star[]>([]);

  // generate stars client-side (avoids SSR/CSR hydration mismatch)
  useEffect(() => {
    setStars(
      Array.from({ length: 46 }, () => ({
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 3,
        dur: Math.random() * 2.5 + 1.8,
      }))
    );
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex flex-col bg-gradient-to-b from-[#0a0a23] via-[#270d22] to-[#4d1018]">
      <style>{`
        @keyframes twinkle { 0%,100% { opacity: .2; } 50% { opacity: 1; } }
        @keyframes shoot {
          0% { transform: translate(-140px,-80px) rotate(22deg); opacity: 0; }
          8% { opacity: 1; }
          55% { opacity: 1; }
          100% { transform: translate(60vw,42vh) rotate(22deg); opacity: 0; }
        }
        @keyframes neb { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(26px,-30px) scale(1.12); } }
        @keyframes nebB { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px,24px) scale(1.08); } }
        @keyframes bob { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-14px) rotate(2deg); } }
        @keyframes rocketFly { 0% { transform: translate(0,16vh) rotate(20deg); } 100% { transform: translate(48vw,-36vh) rotate(20deg); } }
        @keyframes shipDrift { 0% { transform: translate(-14vw,0); } 50% { transform: translate(30vw,-20px); } 100% { transform: translate(76vw,0); } }
        @keyframes flame { 0%,100% { transform: scaleY(1); opacity: .85; } 50% { transform: scaleY(1.45); opacity: 1; } }
      `}</style>

      {/* red brand nebula glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -left-10 w-96 h-96 rounded-full blur-3xl opacity-40" style={{ background: 'radial-gradient(circle,#ef443a,transparent 70%)', animation: 'neb 16s ease-in-out infinite' }} />
        <div className="absolute top-1/2 -right-24 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(circle,#8b5cf6,transparent 70%)', animation: 'nebB 20s ease-in-out infinite' }} />
        <div className="absolute -bottom-24 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(circle,#ff7a3c,transparent 70%)', animation: 'neb 18s ease-in-out infinite' }} />
      </div>

      {/* twinkling stars */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {stars.map((s, i) => (
          <span key={i} className="absolute rounded-full bg-white"
            style={{ top: `${s.top}%`, left: `${s.left}%`, width: s.size, height: s.size, animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite` }} />
        ))}
      </div>

      {/* shooting stars */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute h-[2px] w-24 rounded-full bg-gradient-to-l from-white to-transparent" style={{ top: '12%', left: '0%', animation: 'shoot 7s linear 1.5s infinite' }} />
        <span className="absolute h-[2px] w-20 rounded-full bg-gradient-to-l from-[#ffc94a] to-transparent" style={{ top: '4%', left: '30%', animation: 'shoot 9s linear 4s infinite' }} />
        <span className="absolute h-[2px] w-28 rounded-full bg-gradient-to-l from-white to-transparent" style={{ top: '24%', left: '12%', animation: 'shoot 11s linear 7s infinite' }} />
      </div>

      {/* planet (bottom-left) */}
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-16 w-56 h-56 rounded-full opacity-70 blur-[1px]"
        style={{ background: 'radial-gradient(circle at 35% 30%, #ff9d5c, #b3261e 60%, #5a0f0c)' }} />

      {/* space station (top-right) */}
      <svg aria-hidden viewBox="0 0 130 64" className="pointer-events-none absolute top-[10%] right-[6%] w-28 sm:w-36 opacity-80" style={{ animation: 'bob 9s ease-in-out infinite' }}>
        {/* solar panels */}
        <g stroke="#7c8aa5" strokeWidth="1">
          <rect x="2" y="26" width="36" height="12" fill="#37456b" />
          <line x1="14" y1="26" x2="14" y2="38" /><line x1="26" y1="26" x2="26" y2="38" />
          <rect x="92" y="26" width="36" height="12" fill="#37456b" />
          <line x1="104" y1="26" x2="104" y2="38" /><line x1="116" y1="26" x2="116" y2="38" />
        </g>
        <line x1="38" y1="32" x2="46" y2="32" stroke="#9ca3af" strokeWidth="2" />
        <line x1="84" y1="32" x2="92" y2="32" stroke="#9ca3af" strokeWidth="2" />
        {/* core module */}
        <rect x="46" y="22" width="38" height="20" rx="8" fill="#d7dded" stroke="#aab4cc" />
        <circle cx="65" cy="32" r="5" fill="#ef443a" />
        {/* antenna */}
        <line x1="65" y1="22" x2="65" y2="12" stroke="#9ca3af" strokeWidth="1.5" />
        <circle cx="65" cy="11" r="2.4" fill="#ffc94a" />
      </svg>

      {/* rocket (flies up-right, looping) */}
      <svg aria-hidden viewBox="0 0 40 72" className="pointer-events-none absolute bottom-[8%] left-[6%] w-9 sm:w-11 opacity-90" style={{ animation: 'rocketFly 16s linear infinite' }}>
        <path d="M14 54 Q20 72 26 54 Q20 60 14 54 Z" fill="#ffc94a" style={{ transformOrigin: '20px 54px', animation: 'flame .45s ease-in-out infinite' }} />
        <path d="M20 4 C30 14 30 40 28 54 L12 54 C10 40 10 14 20 4 Z" fill="#eef2f8" stroke="#aab4cc" strokeWidth="1" />
        <path d="M20 4 C26 12 28 19 28 24 L12 24 C12 19 14 12 20 4 Z" fill="#ef443a" />
        <circle cx="20" cy="31" r="4.5" fill="#2563eb" stroke="#fff" strokeWidth="1.2" />
        <path d="M12 44 L4 58 L12 53 Z" fill="#ef443a" />
        <path d="M28 44 L36 58 L28 53 Z" fill="#ef443a" />
      </svg>

      {/* spaceship / UFO (drifts across) */}
      <svg aria-hidden viewBox="0 0 64 32" className="pointer-events-none absolute top-[32%] left-0 w-20 sm:w-24 opacity-75" style={{ animation: 'shipDrift 26s ease-in-out infinite' }}>
        <ellipse cx="32" cy="21" rx="28" ry="7.5" fill="#8b96b5" />
        <ellipse cx="32" cy="21" rx="28" ry="7.5" fill="none" stroke="#aab4cc" strokeWidth="0.8" />
        <ellipse cx="32" cy="14" rx="13" ry="9" fill="#cfd6e8" />
        <ellipse cx="32" cy="13" rx="9" ry="6" fill="#2563eb" opacity="0.55" />
        <circle cx="14" cy="23" r="1.6" fill="#ffc94a" />
        <circle cx="32" cy="26" r="1.6" fill="#5dd49e" />
        <circle cx="50" cy="23" r="1.6" fill="#ff7ac6" />
      </svg>

      {/* header: logo (left) + slot (right) */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-8 pt-5 flex items-center justify-between gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="CodeLab" className="h-7 sm:h-8 brightness-0 invert drop-shadow" />
        {headerRight}
      </header>

      <div className="relative z-10 flex-1 flex flex-col">{children}</div>

      {/* footer */}
      <footer className="relative z-10 py-6 flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="CodeLab" className="h-5 brightness-0 invert opacity-90" />
        <p className="text-white/70 text-xs">Powered &amp; licensed by CodeLab Thailand</p>
      </footer>
    </div>
  );
}
