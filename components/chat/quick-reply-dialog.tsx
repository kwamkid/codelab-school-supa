'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Plus, X, Trash2, Search, Loader2, ImagePlus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChatQuickReply } from '@/types/models';
import { getQuickReplies, createQuickReply, updateQuickReply, deleteQuickReply } from '@/lib/services/chat';
import { toast } from 'sonner';

interface QuickReplyDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (content: string, images?: string[]) => void;
}

export function QuickReplyDialog({ open, onClose, onSelect }: QuickReplyDialogProps) {
  const [replies, setReplies] = useState<ChatQuickReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'list' | 'form' | 'preview'>('list');
  const [editingReply, setEditingReply] = useState<ChatQuickReply | null>(null);
  const [previewReply, setPreviewReply] = useState<ChatQuickReply | null>(null);

  useEffect(() => {
    if (open) { loadReplies(); setMode('list'); setSearch(''); setEditingReply(null); setPreviewReply(null); }
  }, [open]);

  const loadReplies = async () => {
    setLoading(true);
    try { setReplies(await getQuickReplies()); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteQuickReply(id);
      setReplies(prev => prev.filter(r => r.id !== id));
      toast.success('ลบแล้ว');
    } catch { toast.error('ลบไม่สำเร็จ'); }
  };

  const handleEdit = (reply: ChatQuickReply, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingReply(reply);
    setMode('form');
  };

  const filtered = replies.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q);
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            {mode === 'list' ? 'Quick Replies' : mode === 'preview' ? 'ตัวอย่างก่อนส่ง' : editingReply ? 'แก้ไข Quick Reply' : 'สร้าง Quick Reply'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'preview' && previewReply ? (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
              <p className="text-xs text-gray-400 text-center mb-3">ข้อความที่จะส่ง</p>
              <div className="space-y-2 max-w-[320px] ml-auto">
                {previewReply.content.split('\n\n').filter(Boolean).map((block, i) => (
                  <div key={i} className="bg-blue-500 text-white px-4 py-2.5 rounded-2xl rounded-tr-md text-sm whitespace-pre-wrap">
                    {block}
                  </div>
                ))}
                {(previewReply.images?.length > 0 ? previewReply.images : previewReply.imageUrl ? [previewReply.imageUrl] : []).map((img, i) => (
                  <div key={`img-${i}`}>
                    <img src={img} alt="" className="rounded-2xl rounded-tr-md max-w-full border" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center px-5 py-3 border-t bg-white flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setMode('list')}>
                กลับ
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditingReply(previewReply); setMode('form'); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> แก้ไข
                </Button>
                <Button size="sm" className="bg-blue-500 hover:bg-blue-600"
                  onClick={() => {
                    const imgs = previewReply.images?.length > 0 ? previewReply.images : (previewReply.imageUrl ? [previewReply.imageUrl] : []);
                    onClose();
                    setTimeout(() => onSelect(previewReply.content, imgs.length > 0 ? imgs : undefined), 50);
                  }}
                >
                  ส่งเลย
                </Button>
              </div>
            </div>
          </>
        ) : mode === 'list' ? (
          <>
            <div className="px-5 pb-3 flex gap-2 flex-shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาตามชื่อหรือข้อความ..." className="pl-9" />
              </div>
              <Button onClick={() => { setEditingReply(null); setMode('form'); }} variant="outline" className="shrink-0">
                <Plus className="h-4 w-4 mr-1" /> เพิ่ม
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4 min-h-0">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Zap className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">{replies.length === 0 ? 'ยังไม่มี Quick Reply' : 'ไม่พบผลลัพธ์'}</p>
                  {replies.length === 0 && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => { setEditingReply(null); setMode('form'); }}>
                      <Plus className="h-4 w-4 mr-1" /> สร้างอันแรก
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map(reply => (
                    <div
                      key={reply.id}
                      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-200"
                      onClick={() => {
                        setPreviewReply(reply);
                        setMode('preview');
                      }}
                    >
                      {(reply.images?.length > 0 || reply.imageUrl) ? (
                        <div className="relative flex-shrink-0">
                          <img src={reply.images?.[0] || reply.imageUrl!} alt="" className="w-12 h-12 rounded-lg object-cover border" />
                          {reply.images?.length > 1 && (
                            <span className="absolute -bottom-1 -right-1 bg-gray-800 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                              +{reply.images.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center flex-shrink-0 border border-amber-100">
                          <Zap className="h-5 w-5 text-amber-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{reply.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{reply.content}</p>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-blue-500 hover:bg-blue-50"
                          onClick={(e) => handleEdit(reply, e)} title="แก้ไข">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50"
                          onClick={(e) => handleDelete(reply.id, e)} title="ลบ">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <QuickReplyForm
            reply={editingReply}
            onBack={() => { setMode('list'); setEditingReply(null); }}
            onSaved={() => { setMode('list'); setEditingReply(null); loadReplies(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==================== Add/Edit Form ====================

function QuickReplyForm({
  reply,
  onBack,
  onSaved,
}: {
  reply: ChatQuickReply | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!reply;
  const [title, setTitle] = useState(reply?.title || '');
  const [contentBlocks, setContentBlocks] = useState<string[]>(
    reply?.content ? reply.content.split('\n\n') : ['']
  );
  const [images, setImages] = useState<{ url: string; file?: File }[]>(
    (reply?.images || []).map(url => ({ url }))
  );
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addContentBlock = () => setContentBlocks(prev => [...prev, '']);
  const removeContentBlock = (i: number) => {
    if (contentBlocks.length <= 1) return;
    setContentBlocks(prev => prev.filter((_, idx) => idx !== i));
  };
  const updateContentBlock = (i: number, val: string) => {
    setContentBlocks(prev => prev.map((v, idx) => idx === i ? val : v));
  };

  const processFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) { toast.error(`${file.name} ไม่ใช่รูปภาพ`); continue; }
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} เกิน 5MB`); continue; }
      setImages(prev => [...prev, { url: URL.createObjectURL(file), file }]);
    }
  };

  const removeImage = (i: number) => {
    setImages(prev => {
      const removed = prev[i];
      if (removed.file) URL.revokeObjectURL(removed.url);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);
  const handleDragLeave = useCallback(() => setDragging(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }, []);

  const handleSave = async () => {
    if (!title.trim()) { toast.error('กรุณากรอกชื่อ'); return; }
    const joinedContent = contentBlocks.map(b => b.trim()).filter(Boolean).join('\n\n');
    if (!joinedContent) { toast.error('กรุณากรอกข้อความอย่างน้อย 1 ข้อความ'); return; }

    setSaving(true);
    try {
      // Upload new images
      const uploadedUrls: string[] = [];
      for (const img of images) {
        if (img.file) {
          const form = new FormData();
          form.append('file', img.file);
          form.append('bucket', 'chat-media');
          const res = await fetch('/api/upload', { method: 'POST', body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          uploadedUrls.push(data.url);
        } else {
          uploadedUrls.push(img.url); // existing URL
        }
      }

      if (isEdit && reply) {
        await updateQuickReply(reply.id, {
          title: title.trim(),
          content: joinedContent,
          images: uploadedUrls,
        });
        toast.success('บันทึกแล้ว');
      } else {
        await createQuickReply({
          title: title.trim(),
          content: joinedContent,
          images: uploadedUrls,
        });
        toast.success('สร้าง Quick Reply แล้ว');
      }

      onSaved();
    } catch (error: any) {
      toast.error(error.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">ชื่อ *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ทักทาย, แจ้งคอร์ส, โปรโมชั่น" />
      </div>

      {/* Content blocks */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">ข้อความ *</Label>
        {contentBlocks.map((block, i) => (
          <div key={i} className="relative">
            <Textarea
              value={block}
              onChange={(e) => updateContentBlock(i, e.target.value)}
              placeholder={i === 0 ? 'ข้อความหลัก...' : 'ข้อความเพิ่มเติม...'}
              rows={3}
            />
            {contentBlocks.length > 1 && (
              <button onClick={() => removeContentBlock(i)} className="absolute top-1.5 right-1.5 text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addContentBlock} className="text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" /> เพิ่มข้อความ
        </Button>
      </div>

      {/* Images */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">รูปภาพ</Label>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) processFiles(e.target.files); e.target.value = ''; }}
        />

        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img.url} alt="" className="w-16 h-16 rounded-lg object-cover border" />
                <button onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center gap-1 py-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            dragging ? 'border-amber-400 bg-amber-50' : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50/50'
          }`}
        >
          <ImagePlus className={`h-6 w-6 ${dragging ? 'text-amber-500' : 'text-gray-400'}`} />
          <p className="text-xs text-gray-500">คลิกหรือลากรูปมาวาง (หลายรูปได้)</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onBack} disabled={saving}>กลับ</Button>
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {isEdit ? 'บันทึก' : 'สร้าง'}
        </Button>
      </div>
    </div>
  );
}
