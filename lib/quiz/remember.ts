// Remember the quiz student identity (code + school) on this device so kids
// don't have to retype every time. Stored in localStorage (client-only).
const KEY = 'codelab_quiz_student';

export interface RememberedStudent { code: string; school: string }

export function getRememberedStudent(): RememberedStudent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && typeof obj.code === 'string' && typeof obj.school === 'string') return obj;
    return null;
  } catch {
    return null;
  }
}

export function rememberStudent(code: string, school: string) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify({ code: code.trim(), school: school.trim() })); } catch { /* ignore */ }
}

export function forgetStudent() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
