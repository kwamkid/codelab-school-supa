'use client';

import { useState, useEffect, useRef } from 'react';
import { Zap, Plus, X, Trash2, Send, Upload, Loader2, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChatQuickReply } from '@/types/models';
import { getQuickReplies, createQuickReply, deleteQuickReply } from '@/lib/services/chat';
import { toast } from 'sonner';

interface QuickReplyPanelProps {
  open: boolean;
  onClose: () => void;
  onSelect: (content: string, imageUrl?: string) => void;
}

export function QuickReplyPanel({ open, onClose, onSelect }: QuickReplyPanelProps) {
  const [replies, setReplies] = useState<ChatQuickReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    if (open) loadReplies();
  }, [open]);

  const loadReplies = async () => {
    setLoading(true);
    try {
      const data = await getQuickReplies();
      setReplies(data);
    } catch (error) {
      console.error('Error loading quick replies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteQuickReply(id);
      setReplies(prev => prev.filter(r => r.id !== id));
      toast.success('ลบแล้ว');
    } catch (error) {
      toast.error('ไม่สามารถลบได้');
    }
  };

  const categories = [...new Set(replies.map(r => r.category))];
  const filtered = replies.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q);
  });

  if (!open) return null;

  return (
    <>
    <div className="border-t bg-white dark:bg-slate-800 max-h-[280px] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">ข้อความสำเร็จรูป</span>
          <Badge variant="secondary" className="text-xs">{replies.length}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setShowAddDialog(true)} className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            เพิ่ม
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-1.5">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหา..."
          className="h-7 text-sm"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <p className="text-sm text-gray-500 text-center py-4">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            {replies.length === 0 ? 'ยังไม่มีข้อความสำเร็จรูป กด "เพิ่ม" เพื่อสร้าง' : 'ไม่พบผลลัพธ์'}
          </p>
        ) : (
          <div className="space-y-0.5">
            {categories.filter(cat => filtered.some(r => r.category === cat)).map(cat => (
              <div key={cat}>
                <p className="text-[10px] text-gray-400 font-semibold px-2 pt-1.5 uppercase tracking-wider">{cat}</p>
                {filtered.filter(r => r.category === cat).map(reply => (
                  <div
                    key={reply.id}
                    className="group flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    onClick={() => {
                      onSelect(reply.content, reply.imageUrl);
                      onClose();
                    }}
                  >
                    {/* Thumbnail */}
                    {reply.imageUrl ? (
                      <img src={reply.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <Zap className="h-4 w-4 text-amber-400" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{reply.title}</p>
                      <p className="text-xs text-gray-500 truncate">{reply.content}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        title="ลบ"
                        onClick={(e) => handleDelete(reply.id, e)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Add Dialog */}
    <AddQuickReplyDialog
      open={showAddDialog}
      onClose={() => setShowAddDialog(false)}
      onCreated={loadReplies}
    />
    </>
  );
}

// ======= Add Quick Reply Dialog =======

function AddQuickReplyDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory('general');
    setImageUrl('');
    setImagePreview('');
    setPendingFile(null);
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('รองรับเฉพาะรูปภาพ');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('รูปต้องไม่เกิน 5MB');
      return;
    }
    setPendingFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageUrl('');
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('กรุณากรอกชื่อและเนื้อหา');
      return;
    }

    setSaving(true);
    try {
      let finalImageUrl = imageUrl;

      // Upload pending file
      if (pendingFile) {
        const form = new FormData();
        form.append('file', pendingFile);
        form.append('bucket', 'chat-media');
        const res = await fetch('/api/upload', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        finalImageUrl = data.url;
      }

      await createQuickReply({
        title: title.trim(),
        content: content.trim(),
        imageUrl: finalImageUrl || undefined,
        category: category.trim() || 'general',
      });

      toast.success('เพิ่มข้อความสำเร็จรูปแล้ว');
      resetForm();
      onClose();
      onCreated();
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถเพิ่มได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); resetForm(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            เพิ่มข้อความสำเร็จรูป
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Image upload */}
          <div className="space-y-2">
            <Label>รูปภาพ (ไม่บังคับ)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                e.target.value = '';
              }}
            />

            {(imagePreview || imageUrl) ? (
              <div className="relative inline-block">
                <img
                  src={imagePreview || imageUrl}
                  alt="Preview"
                  className="h-24 rounded-lg border object-cover"
                />
                <button
                  onClick={() => { setImagePreview(''); setImageUrl(''); setPendingFile(null); }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/50 transition-colors w-full"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-sm">เลือกรูปภาพ</span>
              </button>
            )}

            {/* Or paste URL */}
            {!pendingFile && !imagePreview && (
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="หรือวาง URL รูปภาพ"
                className="text-sm"
              />
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>ชื่อ *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ทักทาย, ขอบคุณ, แจ้งคอร์ส"
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label>เนื้อหาข้อความ *</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="ข้อความที่จะส่ง..."
              rows={4}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>หมวดหมู่</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="general"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { onClose(); resetForm(); }} disabled={saving}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={saving || !title.trim() || !content.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              เพิ่ม
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
