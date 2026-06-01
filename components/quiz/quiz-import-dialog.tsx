'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileDown, CheckCircle2, XCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface ImportedQuestion {
  questionTh: string;
  questionEn: string;
  optionsTh: string[];
  optionsEn: string[];
  correctAnswer: number;
  points: number;
  competency: string;
}

const HEADERS = [
  'คำถาม(TH)', 'คำถาม(EN)',
  'A(TH)', 'B(TH)', 'C(TH)', 'D(TH)',
  'A(EN)', 'B(EN)', 'C(EN)', 'D(EN)',
  'คำตอบ(A-D)', 'คะแนน', 'ตัวชี้วัด',
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImport: (questions: ImportedQuestion[]) => void;
}

export function QuizImportDialog({ open, onOpenChange, onImport }: Props) {
  const [parsed, setParsed] = useState<{ q: ImportedQuestion; valid: boolean; reason?: string }[]>([]);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      HEADERS,
      ['2 + 2 = ?', 'What is 2 + 2?', '3', '4', '5', '6', '3', '4', '5', '6', 'B', 10, 'Math'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Quiz');
    XLSX.writeFile(wb, 'quiz-template.xlsx');
  };

  const onFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 }) as any[][];
      const body = rows.slice(1).filter((r) => r && r.some((c) => String(c ?? '').trim()));
      const out = body.map((r) => {
        const questionTh = String(r[0] ?? '').trim();
        const optionsTh = [r[2], r[3], r[4], r[5]].map((x) => String(x ?? '').trim());
        const ansLetter = String(r[10] ?? '').trim().toUpperCase();
        const correctAnswer = { A: 0, B: 1, C: 2, D: 3 }[ansLetter] ?? -1;
        const q: ImportedQuestion = {
          questionTh,
          questionEn: String(r[1] ?? '').trim(),
          optionsTh,
          optionsEn: [r[6], r[7], r[8], r[9]].map((x) => String(x ?? '').trim()),
          correctAnswer: correctAnswer < 0 ? 0 : correctAnswer,
          points: Number(r[11]) || 10,
          competency: String(r[12] ?? '').trim(),
        };
        let valid = true; let reason = '';
        if (!questionTh) { valid = false; reason = 'ไม่มีคำถาม'; }
        else if (optionsTh.filter(Boolean).length < 2) { valid = false; reason = 'ตัวเลือกน้อยกว่า 2'; }
        else if (correctAnswer < 0) { valid = false; reason = 'คำตอบต้องเป็น A-D'; }
        return { q, valid, reason };
      });
      setParsed(out);
    } catch (e: any) {
      toast.error('อ่านไฟล์ไม่สำเร็จ: ' + (e.message || ''));
    }
  };

  const validList = parsed.filter((p) => p.valid).map((p) => p.q);

  const doImport = () => {
    if (validList.length === 0) { toast.error('ไม่มีคำถามที่ใช้ได้'); return; }
    onImport(validList);
    setParsed([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setParsed([]); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>นำเข้าจาก Excel</DialogTitle>
          <DialogDescription>
            คอลัมน์: คำถาม(TH/EN) · ตัวเลือก A-D (TH/EN) · คำตอบ(A-D) · คะแนน · ตัวชี้วัด
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" onClick={downloadTemplate} className="w-full">
            <FileDown className="h-4 w-4 mr-2" />ดาวน์โหลดเทมเพลต
          </Button>

          <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg py-8 cursor-pointer hover:bg-gray-50">
            <Upload className="h-6 w-6 text-gray-400 mb-2" />
            <span className="text-sm text-gray-500">เลือกไฟล์ .xlsx</span>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </label>

          {parsed.length > 0 && (
            <div className="space-y-1 max-h-60 overflow-y-auto text-sm">
              {parsed.map((p, i) => (
                <div key={i} className="flex items-start gap-2 rounded border p-2">
                  {p.valid ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
                  <span className="flex-1">{i + 1}. {p.q.questionTh || '(ว่าง)'} {!p.valid && <span className="text-red-500">— {p.reason}</span>}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={doImport} disabled={validList.length === 0} className="bg-red-500 hover:bg-red-600">
            นำเข้า {validList.length} ข้อ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
