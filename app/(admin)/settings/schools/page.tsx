'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SectionLoading } from '@/components/ui/loading';
import { School as SchoolIcon, Plus, Edit, Trash2 } from 'lucide-react';
import { getSchools, createSchool, updateSchool, deleteSchool, type School } from '@/lib/services/schools';
import { toast } from 'sonner';

const empty = { name: '', nameEn: '', abbreviation: '', aliasesText: '', province: '' };

export default function SchoolsSettingsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setSchools(await getSchools()); }
    catch (e: any) { toast.error(e.message || 'โหลดไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...empty }); setOpen(true); };
  const openEdit = (s: School) => {
    setEditing(s);
    setForm({ name: s.name, nameEn: s.name_en || '', abbreviation: s.abbreviation || '', aliasesText: (s.aliases || []).join(', '), province: s.province || '' });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('กรุณาระบุชื่อโรงเรียน'); return; }
    const payload = {
      name: form.name.trim(),
      nameEn: form.nameEn.trim() || undefined,
      abbreviation: form.abbreviation.trim() || undefined,
      aliases: form.aliasesText.split(',').map((a) => a.trim()).filter(Boolean),
      province: form.province.trim() || undefined,
    };
    setSaving(true);
    try {
      if (editing) await updateSchool(editing.id, payload);
      else await createSchool(payload);
      toast.success('บันทึกแล้ว');
      setOpen(false);
      await load();
    } catch (e: any) { toast.error(e.message || 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  const remove = async (s: School) => {
    try { await deleteSchool(s.id); toast.success('ลบแล้ว'); await load(); }
    catch (e: any) { toast.error(e.message || 'ลบไม่สำเร็จ'); }
  };

  const filtered = schools.filter((s) => {
    const q = search.toLowerCase();
    return [s.name, s.name_en, s.abbreviation, ...(s.aliases || [])].some((v) => (v || '').toLowerCase().includes(q));
  });

  if (loading) return <SectionLoading />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
            <SchoolIcon className="h-7 w-7 text-indigo-500" /> จัดการโรงเรียน
          </h1>
          <p className="text-gray-600 mt-1">ชื่อหลัก + ชื่ออังกฤษ / ตัวย่อ / ชื่อรอง (alias) — ใช้รองรับทั้งชื่อเต็มและชื่อย่อตอนค้นหา/เข้าทำ quiz</p>
        </div>
        <Button onClick={openCreate} className="bg-red-500 hover:bg-red-600"><Plus className="h-4 w-4 mr-2" />เพิ่มโรงเรียน</Button>
      </div>

      <Card>
        <CardHeader>
          <SearchInput placeholder="ค้นหาชื่อ / ตัวย่อ / alias..." value={search} onChange={setSearch} className="max-w-sm" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อหลัก (ที่แสดง)</TableHead>
                <TableHead>อังกฤษ</TableHead>
                <TableHead>ตัวย่อ</TableHead>
                <TableHead>ชื่อรอง (alias)</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-gray-600">{s.name_en || '-'}</TableCell>
                  <TableCell>{s.abbreviation ? <Badge variant="secondary">{s.abbreviation}</Badge> : '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(s.aliases || []).map((a, i) => <Badge key={i} variant="outline" className="text-xs">{a}</Badge>)}
                      {(!s.aliases || s.aliases.length === 0) && '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteTarget(s)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-500">ไม่พบโรงเรียน</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'แก้ไขโรงเรียน' : 'เพิ่มโรงเรียน'}</DialogTitle>
            <DialogDescription>ชื่อหลักคือชื่อที่จะแสดง/บันทึก · ตัวย่อ/alias ไว้ให้ค้นหาเจอ</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>ชื่อหลัก (ไทยเต็ม)</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น กรุงเทพคริสเตียนวิทยาลัย" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>ชื่ออังกฤษ</Label><Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="Bangkok Christian College" /></div>
              <div className="space-y-1"><Label>ตัวย่อ</Label><Input value={form.abbreviation} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} placeholder="BCC" /></div>
            </div>
            <div className="space-y-1">
              <Label>ชื่อรอง / alias (คั่นด้วย ,)</Label>
              <Input value={form.aliasesText} onChange={(e) => setForm({ ...form, aliasesText: e.target.value })} placeholder="กรุงเทพคริสเตียน, ร.ร.กรุงเทพคริสเตียน" />
            </div>
            <div className="space-y-1"><Label>จังหวัด (ไม่บังคับ)</Label><Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></div>
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
            <AlertDialogTitle>ลบโรงเรียน</AlertDialogTitle>
            <AlertDialogDescription>ลบ "{deleteTarget?.name}"? (ไม่กระทบชื่อโรงเรียนที่บันทึกในข้อมูลนักเรียน)</AlertDialogDescription>
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
