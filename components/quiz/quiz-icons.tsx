'use client';

import {
  FileText, Code2, Bot, Cpu, Calculator, FlaskConical, Globe, Languages,
  BookOpen, Lightbulb, Target, Rocket, Trophy, Brain, Music, Palette,
  Sparkles, ThumbsUp, Flame, Award, Star, type LucideIcon,
} from 'lucide-react';

// No emoji anywhere — quizzes/categories/grades use these lucide icons.
export const QUIZ_ICONS: Record<string, LucideIcon> = {
  FileText, Code2, Bot, Cpu, Calculator, FlaskConical, Globe, Languages,
  BookOpen, Lightbulb, Target, Rocket, Trophy, Brain, Music, Palette,
  Sparkles, ThumbsUp, Flame, Award, Star,
};

// Icons offered in the picker (subject-ish set; grade icons excluded).
export const QUIZ_ICON_NAMES = [
  'FileText', 'Code2', 'Bot', 'Cpu', 'Calculator', 'FlaskConical', 'Globe',
  'Languages', 'BookOpen', 'Lightbulb', 'Target', 'Rocket', 'Brain', 'Music',
  'Palette', 'Sparkles',
];

export function QuizIcon({ name, className }: { name?: string | null; className?: string }) {
  const Ic = (name && QUIZ_ICONS[name]) || FileText;
  return <Ic className={className} />;
}

export function IconPicker({ value, onChange }: { value?: string; onChange: (name: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUIZ_ICON_NAMES.map((n) => {
        const Ic = QUIZ_ICONS[n];
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-colors ${
              active ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            title={n}
          >
            <Ic className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );
}

// Tailwind gradient options for categories (graphic, not emoji).
export const CATEGORY_COLORS: { value: string; label: string }[] = [
  { value: 'from-blue-400 to-cyan-400', label: 'ฟ้า-ฟ้าคราม' },
  { value: 'from-green-400 to-emerald-400', label: 'เขียว' },
  { value: 'from-purple-400 to-pink-400', label: 'ม่วง-ชมพู' },
  { value: 'from-orange-400 to-red-400', label: 'ส้ม-แดง' },
  { value: 'from-amber-400 to-orange-400', label: 'เหลือง-ส้ม' },
  { value: 'from-indigo-400 to-purple-400', label: 'คราม-ม่วง' },
  { value: 'from-rose-400 to-pink-400', label: 'กุหลาบ' },
  { value: 'from-teal-400 to-cyan-400', label: 'เขียวมิ้นต์' },
];
