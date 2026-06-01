'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SectionLoading } from '@/components/ui/loading';
import { Plus, MoreHorizontal, Edit, Trash2, QrCode, Copy, BarChart3, FileText, FolderCog } from 'lucide-react';
import { QuizIcon } from '@/components/quiz/quiz-icons';
import { getQuizzes, deleteQuiz } from '@/lib/services/quiz';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

const DIFF_COLOR: Record<string, string> = {
  'ง่าย': 'bg-green-100 text-green-700 border-green-200',
  'ปานกลาง': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'ยาก': 'bg-red-100 text-red-700 border-red-200',
};

export default function QuizzesPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [qrQuiz, setQrQuiz] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setQuizzes(await getQuizzes());
    } catch (e) {
      console.error(e);
      toast.error('โหลดรายการข้อสอบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const studentUrl = (id: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/quiz/${id}` : '';

  const copyLink = async (id: string) => {
    try { await navigator.clipboard.writeText(studentUrl(id)); toast.success('คัดลอกลิงก์แล้ว'); }
    catch { toast.error('คัดลอกไม่สำเร็จ'); }
  };

  const handleDelete = async (q: any) => {
    try {
      await deleteQuiz(q.id);
      toast.success('ลบข้อสอบเรียบร้อย');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'ลบไม่สำเร็จ');
    }
  };

  const filtered = quizzes.filter((q) => {
    const s = search.toLowerCase();
    return (q.title_th || q.title || '').toLowerCase().includes(s) || (q.categoryName || '').toLowerCase().includes(s);
  });

  if (loading) return <SectionLoading />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7 text-sky-500" />
            ข้อสอบ (Quiz)
          </h1>
          <p className="text-gray-600 mt-1">สร้างข้อสอบ แชร์ให้นักเรียน และดูคะแนน</p>
        </div>
        <div className="flex gap-2">
          <Link href="/quizzes/categories">
            <Button variant="outline"><FolderCog className="h-4 w-4 mr-2 text-amber-500" />หมวดหมู่</Button>
          </Link>
          <Link href="/quizzes/scores">
            <Button variant="outline"><BarChart3 className="h-4 w-4 mr-2 text-indigo-500" />ดูคะแนน</Button>
          </Link>
          <Link href="/quizzes/new">
            <Button className="bg-red-500 hover:bg-red-600"><Plus className="h-4 w-4 mr-2" />สร้างข้อสอบ</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <SearchInput placeholder="ค้นหาชื่อข้อสอบ/หมวด..." value={search} onChange={setSearch} className="max-w-sm" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ข้อสอบ</TableHead>
                <TableHead>หมวด</TableHead>
                <TableHead>ระดับ</TableHead>
                <TableHead className="text-center">คำถาม</TableHead>
                <TableHead>สร้างเมื่อ</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                        <QuizIcon name={q.icon} className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="font-medium">{q.title_th || q.title}</div>
                        {!q.is_active && <Badge variant="secondary" className="text-xs">ปิดใช้งาน</Badge>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{q.categoryName || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={DIFF_COLOR[q.difficulty] || ''}>{q.difficulty}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{q.questionCount}</TableCell>
                  <TableCell className="text-gray-500">{q.created_at ? formatDate(new Date(q.created_at), 'short') : '-'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/quizzes/${q.id}/edit`)}>
                          <Edit className="h-4 w-4 mr-2" />แก้ไข
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setQrQuiz(q)}>
                          <QrCode className="h-4 w-4 mr-2" />QR Code
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyLink(q.id)}>
                          <Copy className="h-4 w-4 mr-2" />คัดลอกลิงก์
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/quizzes/scores?quizId=${q.id}`)}>
                          <BarChart3 className="h-4 w-4 mr-2" />ดูคะแนน
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteTarget(q)}>
                          <Trash2 className="h-4 w-4 mr-2" />ลบ
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">ยังไม่มีข้อสอบ — กด "สร้างข้อสอบ"</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* QR modal */}
      <Dialog open={!!qrQuiz} onOpenChange={(o) => !o && setQrQuiz(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><QuizIcon name={qrQuiz?.icon} className="h-5 w-5" /> {qrQuiz?.title_th || qrQuiz?.title}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrQuiz && (
              <div className="bg-white p-4 rounded-lg border">
                <QRCodeSVG value={studentUrl(qrQuiz.id)} size={220} />
              </div>
            )}
            <p className="text-xs text-gray-500 break-all text-center">{qrQuiz && studentUrl(qrQuiz.id)}</p>
            <Button variant="outline" className="w-full" onClick={() => qrQuiz && copyLink(qrQuiz.id)}>
              <Copy className="h-4 w-4 mr-2" />คัดลอกลิงก์
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบข้อสอบ</AlertDialogTitle>
            <AlertDialogDescription>
              ลบ "{deleteTarget?.title_th || deleteTarget?.title}" และคำถามทั้งหมด? (คะแนนที่บันทึกแล้วยังอยู่)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (deleteTarget) handleDelete(deleteTarget); }}>ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
