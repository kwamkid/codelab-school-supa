'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Loader2, Info } from 'lucide-react';
import { Branch } from '@/types/models';
import { useAuth } from '@/hooks/useAuth';
import { createAdminUserSimple } from '@/lib/services/admin-users';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

const formSchema = z.object({
  userId: z.string().min(1, 'กรุณาระบุ User ID'),
  email: z.string().email('อีเมลไม่ถูกต้อง'),
  displayName: z.string().min(1, 'กรุณาระบุชื่อ'),
  role: z.enum(['super_admin', 'branch_admin', 'teacher']),
  branchIds: z.array(z.string()),
  permissions: z.object({
    canManageUsers: z.boolean(),
    canManageSettings: z.boolean(),
    canViewReports: z.boolean(),
    canManageAllBranches: z.boolean(),
  }),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface AddRightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  onSuccess: () => void;
}

export default function AddRightsDialog({
  open,
  onOpenChange,
  branches,
  onSuccess
}: AddRightsDialogProps) {
  const { adminUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: '',
      email: '',
      displayName: '',
      role: 'branch_admin',
      branchIds: [],
      permissions: {
        canManageUsers: false,
        canManageSettings: false,
        canViewReports: false,
        canManageAllBranches: false,
      },
      isActive: true,
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);

      await createAdminUserSimple(
        data.userId,
        {
          email: data.email,
          displayName: data.displayName,
          role: data.role,
          branchIds: data.branchIds,
          permissions: data.permissions,
          isActive: data.isActive,
        },
        adminUser?.id || ''
      );

      toast.success('เพิ่มสิทธิ์ผู้ใช้งานเรียบร้อย');
      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      console.error('Error adding rights:', error);
      toast.error('เกิดข้อผิดพลาดในการเพิ่มสิทธิ์');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>เพิ่มสิทธิ์ให้ผู้ใช้ที่มีอยู่</DialogTitle>
          <DialogDescription>
            สำหรับผู้ใช้ที่สร้างใน Firebase Auth แล้ว
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>วิธีใช้:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>ไปที่ Firebase Console &gt; Authentication</li>
              <li>คลิก "Add user" และกรอก email/password</li>
              <li>คัดลอก User UID</li>
              <li>กลับมากรอกข้อมูลด้านล่าง</li>
            </ol>
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User ID (UID)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="คัดลอกจาก Firebase Console" />
                  </FormControl>
                  <FormDescription>
                    User UID จาก Firebase Authentication
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>อีเมล</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ชื่อผู้ใช้งาน</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>บทบาท</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="branch_admin">Branch Admin</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Branch Selection */}
            {form.watch('role') !== 'super_admin' && (
              <FormField
                control={form.control}
                name="branchIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>สาขาที่ดูแล</FormLabel>
                    <div className="space-y-2">
                      {branches.map((branch) => (
                        <div key={branch.id} className="flex items-center space-x-2">
                          <Checkbox
                            checked={field.value.includes(branch.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...field.value, branch.id]);
                              } else {
                                field.onChange(field.value.filter(id => id !== branch.id));
                              }
                            }}
                          />
                          <label className="text-sm">{branch.name}</label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">สถานะการใช้งาน</FormLabel>
                    <FormDescription>
                      {field.value ? 'บัญชีใช้งานได้ปกติ' : 'บัญชีถูกระงับการใช้งาน'}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                ยกเลิก
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="bg-red-500 hover:bg-red-600"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                เพิ่มสิทธิ์
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}