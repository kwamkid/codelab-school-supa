'use client';

type Lang = 'th' | 'en';

// Sliding toggle-style language switcher with flag images (no text/emoji).
export function FlagToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const flags: { code: Lang; src: string; alt: string }[] = [
    { code: 'th', src: 'https://flagcdn.com/w40/th.png', alt: 'ไทย' },
    { code: 'en', src: 'https://flagcdn.com/w40/gb.png', alt: 'English' },
  ];
  const idx = lang === 'th' ? 0 : 1;

  return (
    <div className="relative inline-flex items-center rounded-full bg-white/25 p-1 backdrop-blur-sm">
      {/* sliding white thumb */}
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 w-9 rounded-full bg-white shadow transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${idx * 100}%)` }}
      />
      {flags.map((f) => (
        <button
          key={f.code}
          onClick={() => onChange(f.code)}
          aria-label={f.alt}
          aria-pressed={lang === f.code}
          className="relative z-10 w-9 h-7 flex items-center justify-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={f.src}
            alt={f.alt}
            width={24}
            height={16}
            className={`w-6 h-4 object-cover rounded-sm transition-opacity ${lang === f.code ? 'opacity-100' : 'opacity-50'}`}
          />
        </button>
      ))}
    </div>
  );
}
