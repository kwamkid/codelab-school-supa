'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { FormSelect } from '@/components/ui/form-select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SectionLoading } from '@/components/ui/loading';
import { ArrowLeft, Plus, Edit, Trash2, FolderCog } from 'lucide-react';
import { QuizIcon, IconPicker, CATEGORY_COLORS } from '@/components/quiz/quiz-icons';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/lib/services/quiz';
import { toast } from 'sonner';

const emptyForm = { name: '', description: '', icon: 'BookOpen', color: CATEGORY_COLORS[0].value };

export default function QuizCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setCategories(await getCategories()); }
    catch { toast.error('โหลดหมวดหมู่ไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description || '', icon: c.icon || 'BookOpen', color: c.color || CATEGORY_COLORS[0].value });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('กรุณาระบุชื่อหมวด'); return; }
    setSaving(true);
    try {
      if (editing) await updateCategory(editing.id, form);
      else await createCategory(form);
      toast.success('บันทึกแล้ว');
      setOpen(false);
      await load();
    } catch (e: any) { toast.error(e.message || 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  const remove = async (c: any) => {
    try { await deleteCategory(c.id); toast.success('ลบแล้ว'); await load(); }
    catch (e: any) { toast.error(e.message || 'ลบไม่สำเร็จ'); }
  };

  if (loading) return <SectionLoading />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/quizzes"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><FolderCog className="h-6 w-6 text-amber-500" />จัดการหมวดหมู่</h1>
        </div>
        <Button onClick={openCreate} className="bg-red-500 hover:bg-red-600"><Plus className="h-4 w-4 mr-2" />เพิ่มหมวด</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {categories.map((c) => (
          <Card key={c.id} className="overflow-hidden">
            <div className={`h-2 bg-gradient-to-r ${c.color || 'from-gray-300 to-gray-400'}`} />
            <CardContent className="pt-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className={`w-10 h-10 rounded-lg bg-gradient-to-br ${c.color} text-white flex items-center justify-center shrink-0`}>
                  <QuizIcon name={c.icon} className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-medium">{c.name}</div>
                  {c.description && <div className="text-sm text-gray-500">{c.description}</div>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {categories.length === 0 && <p className="text-gray-500 col-span-full text-center py-8">ยังไม่มีหมวดหมู่</p>}
      </div>

      {/* create/edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'แก้ไขหมวด' : 'เพิ่มหมวด'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>ชื่อหมวด</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>คำอธิบาย</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>ไอคอน</Label><IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} /></div>
            <div className="space-y-2">
              <Label>สีธีม</Label>
              <FormSelect value={form.color} onValueChange={(color) => setForm({ ...form, color })} options={CATEGORY_COLORS.map((c) => ({ value: c.value, label: c.label }))} />
              <div className={`h-6 rounded bg-gradient-to-r ${form.color}`} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={save} disabled={saving} className="bg-red-500 hover:bg-red-600">บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบหมวด</AlertDialogTitle>
            <AlertDialogDescription>ลบหมวด "{deleteTarget?.name}"? ข้อสอบในหมวดนี้จะไม่มีหมวด (ไม่ถูกลบ)</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (deleteTarget) remove(deleteTarget); }}>ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
