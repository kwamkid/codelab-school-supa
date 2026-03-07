'use client';

import { useState, useCallback } from 'react';
import { Search, UserPlus, Link as LinkIcon, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { searchParentsUnified, createParent, ParentSearchResult } from '@/lib/services/parents';
import { linkContactToParent } from '@/lib/services/chat';
import { toast } from 'sonner';

interface LinkParentModalProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  contactName?: string;
  contactPhone?: string;
  onLinked: (parentId: string) => void;
}

interface SearchResult {
  id: string;
  displayName: string;
  phone?: string;
  students: { id: string; name: string; nickname?: string }[];
}

export function LinkParentModal({
  open,
  onClose,
  contactId,
  contactName,
  contactPhone,
  onLinked,
}: LinkParentModalProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleSearch = useCallback(async () => {
    const term = search.trim();
    if (term.length < 2) return;

    try {
      setSearching(true);
      const searchResults = await searchParentsUnified(term);

      const mapped: SearchResult[] = searchResults.map((r) => ({
        id: r.parent.id,
        displayName: r.parent.displayName || '',
        phone: r.parent.phone,
        students: (r.students || []).map(s => ({ id: s.id, name: s.name, nickname: s.nickname })),
      }));

      setResults(mapped);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('เกิดข้อผิดพลาดในการค้นหา');
    } finally {
      setSearching(false);
    }
  }, [search]);

  const handleLink = async (parentId: string) => {
    try {
      setLinking(true);
      await linkContactToParent(contactId, parentId);
      toast.success('ผูกกับผู้ปกครองสำเร็จ');
      onLinked(parentId);
      onClose();
    } catch (error) {
      console.error('Link error:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setLinking(false);
    }
  };

  const handleCreateAndLink = async () => {
    if (!contactPhone && !contactName) {
      toast.error('ต้องมีชื่อหรือเบอร์โทรเพื่อสร้างผู้ปกครอง');
      return;
    }

    try {
      setCreating(true);
      const parentId = await createParent({
        displayName: contactName || 'ผู้ปกครอง',
        phone: contactPhone || '',
      });
      await linkContactToParent(contactId, parentId);
      toast.success('สร้างและผูกผู้ปกครองสำเร็จ');
      onLinked(parentId);
      onClose();
    } catch (error) {
      console.error('Create parent error:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้างผู้ปกครอง');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">เชื่อมกับผู้ปกครอง</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="ค้นหาชื่อ / เบอร์โทร..."
              className="pl-9 text-base"
            />
          </div>
          <Button onClick={handleSearch} disabled={searching || search.trim().length < 2}>
            {searching ? 'กำลังค้น...' : 'ค้นหา'}
          </Button>
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto space-y-2">
          {results.length === 0 && search.trim().length >= 2 && !searching && (
            <p className="text-sm text-gray-400 text-center py-4">ไม่พบผู้ปกครอง</p>
          )}

          {results.map((parent) => (
            <div
              key={parent.id}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-slate-700 dark:border-slate-600 transition-colors"
            >
              <Avatar className="w-10 h-10 shrink-0">
                <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                  {(parent.displayName || '?').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {parent.displayName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{parent.phone}</p>
                {parent.students && parent.students.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {parent.students.map((s) => (
                      <Badge key={s.id} variant="secondary" className="text-[10px]">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => handleLink(parent.id)}
                disabled={linking}
                className="shrink-0"
              >
                <LinkIcon className="w-3 h-3" />
                ผูก
              </Button>
            </div>
          ))}
        </div>

        {/* Create new parent */}
        <div className="pt-3 border-t dark:border-slate-700">
          <Button
            variant="outline"
            onClick={handleCreateAndLink}
            disabled={creating}
            className="w-full"
          >
            <UserPlus className="w-4 h-4" />
            {creating ? 'กำลังสร้าง...' : `สร้างผู้ปกครองใหม่${contactName ? ` (${contactName})` : ''}`}
          </Button>
          {contactPhone && (
            <p className="text-xs text-gray-400 text-center mt-1">
              จะสร้างจาก: {contactName || '-'} / {contactPhone}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
