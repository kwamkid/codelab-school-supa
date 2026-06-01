'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormSelect } from '@/components/ui/form-select';
import { Switch } from '@/components/ui/switch';
import { SectionLoading } from '@/components/ui/loading';
import { Plus, Trash2, Loader2, Check, ArrowLeft, Upload, Image as ImageIcon, X } from 'lucide-react';
import Link from 'next/link';
import { getCategories, getQuizForEdit, createQuiz, updateQuiz } from '@/lib/services/quiz';
import { DIFFICULTY_OPTIONS } from '@/lib/quiz/translations';
import { IconPicker } from '@/components/quiz/quiz-icons';
import { QuizImportDialog } from '@/components/quiz/quiz-import-dialog';
import { toast } from 'sonner';

interface QForm {
  questionTh: string;
  questionEn: string;
  optionsTh: string[];
  optionsEn: string[];
  correctAnswer: number;
  points: number;
  competency: string;
  imageUrl: string;
}

const emptyQuestion = (): QForm => ({
  questionTh: '', questionEn: '', optionsTh: ['', '', '', ''], optionsEn: ['', '', '', ''], correctAnswer: 0, points: 10, competency: '', imageUrl: '',
});

// resize/compress an image client-side before upload (max width, jpeg quality)
function resizeImage(file: File, maxW = 1000, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no canvas ctx'));
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('resize failed'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')); };
    img.src = url;
  });
}

export default function QuizEditor({ quizId }: { quizId?: string }) {
  const router = useRouter();
  const isEdit = !!quizId;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  const [titleTh, setTitleTh] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [icon, setIcon] = useState('FileText');
  const [difficulty, setDifficulty] = useState('ปานกลาง');
  const [categoryId, setCategoryId] = useState('none');
  const [questionCount, setQuestionCount] = useState(''); // '' = ทำทุกข้อ
  const [isActive, setIsActive] = useState(true);
  const [questions, setQuestions] = useState<QForm[]>([emptyQuestion()]);
  const [showImport, setShowImport] = useState(false);
  const [uploadingQi, setUploadingQi] = useState<number | null>(null);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!quizId) return;
    getQuizForEdit(quizId)
      .then(({ quiz, questions }) => {
        setTitleTh(quiz.title_th || quiz.title || '');
        setTitleEn(quiz.title_en || '');
        setIcon(quiz.icon || 'FileText');
        setDifficulty(quiz.difficulty || 'ปานกลาง');
        setCategoryId(quiz.category_id || 'none');
        setQuestionCount(quiz.question_count ? String(quiz.question_count) : '');
        setIsActive(quiz.is_active !== false);
        setQuestions(
          (questions || []).map((q: any) => ({
            questionTh: q.question_th || q.question || '',
            questionEn: q.question_en || '',
            optionsTh: [...(q.options_th || q.options || []), '', '', '', ''].slice(0, 4),
            optionsEn: [...(q.options_en || []), '', '', '', ''].slice(0, 4),
            correctAnswer: q.correct_answer ?? 0,
            points: q.points ?? 10,
            competency: q.competency ?? '',
            imageUrl: q.image_url ?? '',
          }))
        );
      })
      .catch((e) => toast.error(e.message || 'โหลดข้อสอบไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [quizId]);

  const updateQ = (i: number, patch: Partial<QForm>) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const uploadImage = async (qi: number, file: File) => {
    setUploadingQi(qi);
    try {
      const blob = await resizeImage(file);
      const fd = new FormData();
      fd.append('file', new File([blob], 'question.jpg', { type: 'image/jpeg' }));
      fd.append('bucket', 'quiz-images');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'อัพโหลดไม่สำเร็จ');
      updateQ(qi, { imageUrl: json.url });
    } catch (e: any) {
      toast.error(e.message || 'อัพโหลดรูปไม่สำเร็จ');
    } finally {
      setUploadingQi(null);
    }
  };

  const setOption = (qi: number, oi: number, lang: 'th' | 'en', val: string) =>
    setQuestions((qs) => qs.map((q, idx) => {
      if (idx !== qi) return q;
      const key = lang === 'th' ? 'optionsTh' : 'optionsEn';
      const arr = [...q[key]]; arr[oi] = val;
      return { ...q, [key]: arr };
    }));

  const save = async () => {
    if (!titleTh.trim()) { toast.error('กรุณาระบุชื่อข้อสอบ (ไทย)'); return; }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionTh.trim()) { toast.error(`ข้อ ${i + 1}: ยังไม่มีคำถาม`); return; }
      if (q.optionsTh.filter((o) => o.trim()).length < 2) { toast.error(`ข้อ ${i + 1}: ต้องมีตัวเลือกอย่างน้อย 2 ข้อ`); return; }
      if (!q.optionsTh[q.correctAnswer]?.trim()) { toast.error(`ข้อ ${i + 1}: ตัวเลือกที่เป็นคำตอบถูกยังว่าง`); return; }
    }
    setSaving(true);
    try {
      const payload = {
        titleTh: titleTh.trim(), titleEn: titleEn.trim() || undefined, icon, difficulty,
        categoryId: categoryId && categoryId !== 'none' ? categoryId : undefined, isActive,
        questionCount: questionCount ? parseInt(questionCount) : undefined,
        questions: questions.map((q, i) => ({
          sortOrder: i + 1,
          questionTh: q.questionTh.trim(),
          questionEn: q.questionEn.trim() || undefined,
          optionsTh: q.optionsTh,
          optionsEn: q.optionsEn.some((o) => o.trim()) ? q.optionsEn : [],
          correctAnswer: q.correctAnswer,
          points: q.points,
          competency: q.competency.trim() || undefined,
          imageUrl: q.imageUrl || undefined,
        })),
      };
      if (isEdit) await updateQuiz(quizId!, payload);
      else await createQuiz(payload);
      toast.success(isEdit ? 'บันทึกข้อสอบแล้ว' : 'สร้างข้อสอบแล้ว');
      router.push('/quizzes');
    } catch (e: any) {
      toast.error(e.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SectionLoading />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/quizzes"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="text-xl sm:text-2xl font-bold">{isEdit ? 'แก้ไขข้อสอบ' : 'สร้างข้อสอบ'}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}><Upload className="h-4 w-4 mr-2" />นำเข้า Excel</Button>
          <Button onClick={save} disabled={saving} className="bg-red-500 hover:bg-red-600">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}บันทึก
          </Button>
        </div>
      </div>

      {/* meta */}
      <Card>
        <CardHeader><CardTitle className="text-lg">ข้อมูลพื้นฐาน</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>ชื่อข้อสอบ (ไทย)</Label><Input value={titleTh} onChange={(e) => setTitleTh(e.target.value)} placeholder="เช่น Python คาบ 1" /></div>
            <div className="space-y-2"><Label>ชื่อ (English)</Label><Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="optional" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ระดับ</Label>
              <FormSelect value={difficulty} onValueChange={setDifficulty} options={DIFFICULTY_OPTIONS.map((d) => ({ value: d.value, label: d.th }))} />
            </div>
            <div className="space-y-2">
              <Label>หมวด</Label>
              <FormSelect value={categoryId} onValueChange={setCategoryId} options={[{ value: 'none', label: '— ไม่ระบุ —' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>ไอคอน</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <div className="space-y-1">
            <Label>จำนวนข้อที่สุ่มมาให้ทำ</Label>
            <Input type="number" min={1} value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} placeholder="เว้นว่าง = ทำทุกข้อ" className="w-48" />
            <p className="text-xs text-gray-500">ใส่ตัวเลขเพื่อสุ่มเลือกข้อจากคลังทั้งหมด (กันเด็กลอก/ท่อง) — เว้นว่างคือทำครบทุกข้อ · ลำดับข้อและตัวเลือกจะสลับทุกครั้งอยู่แล้ว</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">เปิดให้ทำข้อสอบ</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      {/* questions */}
      {questions.map((q, qi) => (
        <Card key={qi}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">ข้อ {qi + 1}</CardTitle>
            {questions.length > 1 && (
              <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">คำถาม (ไทย)</Label><Textarea value={q.questionTh} onChange={(e) => updateQ(qi, { questionTh: e.target.value })} rows={2} /></div>
              <div className="space-y-1"><Label className="text-xs">คำถาม (EN)</Label><Textarea value={q.questionEn} onChange={(e) => updateQ(qi, { questionEn: e.target.value })} rows={2} placeholder="optional" /></div>
            </div>

            {/* question image (optional, resized on upload) */}
            <div className="space-y-1">
              <Label className="text-xs">รูปประกอบคำถาม (ไม่บังคับ)</Label>
              {q.imageUrl ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={q.imageUrl} alt="" className="max-h-40 rounded-lg border" />
                  <button type="button" onClick={() => updateQ(qi, { imageUrl: '' })} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow" title="ลบรูป">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full sm:w-64 h-20 rounded-lg border-2 border-dashed cursor-pointer hover:bg-gray-50 text-sm text-gray-500">
                  {uploadingQi === qi ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  {uploadingQi === qi ? 'กำลังอัพโหลด...' : 'อัพโหลดรูป'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingQi === qi}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(qi, f); e.target.value = ''; }} />
                </label>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">ตัวเลือก (เลือกข้อที่ถูก)</Label>
              {[0, 1, 2, 3].map((oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateQ(qi, { correctAnswer: oi })}
                    className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${q.correctAnswer === oi ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 text-gray-500'}`}
                    title="ตั้งเป็นคำตอบที่ถูก"
                  >
                    {String.fromCharCode(65 + oi)}
                  </button>
                  <Input value={q.optionsTh[oi]} onChange={(e) => setOption(qi, oi, 'th', e.target.value)} placeholder={`ตัวเลือก ${String.fromCharCode(65 + oi)} (ไทย)`} className="flex-1" />
                  <Input value={q.optionsEn[oi]} onChange={(e) => setOption(qi, oi, 'en', e.target.value)} placeholder="EN (optional)" className="flex-1" />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs">คะแนน</Label>
                <Input type="number" min={1} value={q.points} onChange={(e) => updateQ(qi, { points: parseInt(e.target.value) || 1 })} className="w-20" />
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                <Label className="text-xs whitespace-nowrap">ตัวชี้วัด</Label>
                <Input value={q.competency} onChange={(e) => updateQ(qi, { competency: e.target.value })} placeholder="เช่น Logic, Loops (ไม่บังคับ)" className="flex-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" className="w-full" onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}>
        <Plus className="h-4 w-4 mr-2" />เพิ่มคำถาม
      </Button>

      <QuizImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImport={(imported) => {
          setQuestions((qs) => {
            const base = qs.length === 1 && !qs[0].questionTh.trim() ? [] : qs;
            return [...base, ...imported.map((q) => ({ ...q, imageUrl: '' }))];
          });
          toast.success(`นำเข้า ${imported.length} ข้อ`);
        }}
      />
    </div>
  );
}
