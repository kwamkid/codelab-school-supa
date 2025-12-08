'use client';

import { useState, useEffect } from 'react';
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
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { AdminUser, Branch } from '@/types/models';
import { useAuth } from '@/hooks/useAuth';
import { createAdminUser, updateAdminUser, checkEmailExists } from '@/lib/services/admin-users';
import { toast } from 'sonner';

const formSchema = z.object({
  displayName: z.string().min(1, 'กรุณาระบุชื่อ'),
  email: z.string().email('อีเมลไม่ถูกต้อง'),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร').optional(),
  role: z.enum(['super_admin', 'branch_admin']),
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

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser | null;
  branches: Branch[];
  onSuccess: () => void;
}

export default function UserFormDialog({
  open,
  onOpenChange,
  user: editingUser,
  branches,
  onSuccess
}: UserFormDialogProps) {
  const { user: currentUser, adminUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isEditing = !!editingUser;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
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

  // Load user data when editing
  useEffect(() => {
    if (editingUser) {
      form.reset({
        displayName: editingUser.email, // ใช้ email เป็น displayName
        email: editingUser.email,
        role: editingUser.role === 'teacher' ? 'branch_admin' : editingUser.role, // ถ้าเป็น teacher ให้เปลี่ยนเป็น branch_admin
        branchIds: editingUser.branchIds || [],
        permissions: editingUser.permissions || {
          canManageUsers: false,
          canManageSettings: false,
          canViewReports: false,
          canManageAllBranches: false,
        },
        isActive: editingUser.isActive,
      });
    } else {
      form.reset({
        displayName: '',
        email: '',
        password: '',
        role: 'branch_admin',
        branchIds: [],
        permissions: {
          canManageUsers: false,
          canManageSettings: false,
          canViewReports: false,
          canManageAllBranches: false,
        },
        isActive: true,
      });
    }
  }, [editingUser, form]);

  // Watch role changes
  const watchRole = form.watch('role');
  const watchCanManageAllBranches = form.watch('permissions.canManageAllBranches');

  // Auto-set permissions based on role
  useEffect(() => {
    if (watchRole === 'super_admin') {
      form.setValue('permissions', {
        canManageUsers: true,
        canManageSettings: true,
        canViewReports: true,
        canManageAllBranches: true,
      });
      form.setValue('branchIds', []);
    }
  }, [watchRole, form]);

  // Clear branch selection when canManageAllBranches is true
  useEffect(() => {
    if (watchCanManageAllBranches && watchRole !== 'super_admin') {
      form.setValue('branchIds', []);
    }
  }, [watchCanManageAllBranches, watchRole, form]);

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);

      if (isEditing) {
        // Update existing user
        await updateAdminUser(
          editingUser!.id,
          {
            displayName: data.email, // ใช้ email เป็น displayName
            role: data.role,
            branchIds: data.branchIds,
            permissions: data.permissions,
            isActive: data.isActive,
          },
          adminUser?.id || ''
        );
        toast.success('แก้ไขข้อมูลผู้ใช้งานเรียบร้อย');
      } else {
        // Check if email exists
        const exists = await checkEmailExists(data.email);
        if (exists) {
          form.setError('email', { message: 'อีเมลนี้มีผู้ใช้งานแล้ว' });
          setLoading(false);
          return;
        }

        // Create new user
        if (!data.password) {
          form.setError('password', { message: 'กรุณาระบุรหัสผ่าน' });
          setLoading(false);
          return;
        }

        // Get current user token
        if (!currentUser) {
          throw new Error('No authenticated user');
        }

        const { getClient } = await import('@/lib/supabase/client');
        const supabase = getClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No auth session');
        }
        const token = session.access_token;

        // สร้าง userData object โดยใช้ email เป็น displayName
        const userData = {
          displayName: data.email, // ใช้ email แทน displayName
          role: data.role,
          branchIds: data.branchIds,
          permissions: data.permissions,
          isActive: data.isActive,
        };

        // ใช้ userData ตรงนี้
        await createAdminUser(
          data.email,
          data.password,
          userData, // ส่ง userData ที่สร้างไว้
          adminUser?.id || '',
          token
        );
        
        toast.success('เพิ่มผู้ใช้งานเรียบร้อย');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving user:', error);
      
      // Error handling
      if (error.message?.includes('FIREBASE_ADMIN')) {
        toast.error('ไม่สามารถสร้างผู้ใช้ได้: กรุณาตั้งค่า Firebase Admin');
      } else if (error.message?.includes('auth/email-already-exists')) {
        toast.error('อีเมลนี้มีผู้ใช้งานแล้ว');
      } else if (error.message?.includes('auth/weak-password')) {
        toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      } else {
        toast.error(error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = watchRole === 'super_admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'แก้ไขข้อมูลและสิทธิ์การเข้าถึงของผู้ใช้งาน' : 'กรอกข้อมูลเพื่อสร้างผู้ใช้งานใหม่'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">ข้อมูลพื้นฐาน</h3>
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>อีเมล (ใช้เป็นชื่อผู้ใช้งานด้วย)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="email" 
                        disabled={isEditing}
                        onChange={(e) => {
                          field.onChange(e);
                          // ถ้ายังไม่ได้แก้ไข displayName ให้ใช้ email เป็น displayName
                          if (!form.getValues('displayName') || form.getValues('displayName') === form.getValues('email')) {
                            form.setValue('displayName', e.target.value);
                          }
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      {isEditing ? 'ไม่สามารถเปลี่ยนอีเมลได้' : 'ใช้สำหรับเข้าสู่ระบบและแสดงเป็นชื่อผู้ใช้'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isEditing && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รหัสผ่าน</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            {...field} 
                            type={showPassword ? 'text' : 'password'}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-500" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-500" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        อย่างน้อย 6 ตัวอักษร
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Role & Permissions */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">บทบาทและสิทธิ์</h3>
              
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>บทบาท</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                      disabled={isEditing && editingUser?.id === adminUser?.id}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                        <SelectItem value="branch_admin">Branch Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {field.value === 'super_admin' && 'มีสิทธิ์เข้าถึงและจัดการทุกอย่างในระบบ'}
                      {field.value === 'branch_admin' && 'จัดการเฉพาะสาขาที่ได้รับมอบหมาย'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isSuperAdmin && (
                <>
                  {/* Branch Selection */}
                  {!watchCanManageAllBranches && (
                    <FormField
                      control={form.control}
                      name="branchIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>สาขาที่ดูแล</FormLabel>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                            <div className="flex items-center space-x-2 pb-2 border-b">
                              <Checkbox
                                checked={field.value.length === 0}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([]);
                                  } else {
                                    // ถ้าไม่เลือกทุกสาขา ให้เลือกสาขาแรก
                                    if (branches.length > 0) {
                                      field.onChange([branches[0].id]);
                                    }
                                  }
                                }}
                              />
                              <label className="text-sm font-medium">
                                ทุกสาขา
                              </label>
                            </div>
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
                                  disabled={field.value.length === 0}
                                />
                                <label className="text-sm">{branch.name}</label>
                              </div>
                            ))}
                          </div>
                          <FormDescription>
                            {field.value.length === 0 
                              ? 'เลือก "ทุกสาขา" แล้ว - สามารถดูแลทุกสาขาได้' 
                              : `เลือกแล้ว ${field.value.length} สาขา`}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Permissions */}
                  <div className="space-y-4">
                    <FormLabel>สิทธิ์พิเศษ</FormLabel>
                    
                    <FormField
                      control={form.control}
                      name="permissions.canManageAllBranches"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">จัดการทุกสาขา</FormLabel>
                            <FormDescription>
                              สามารถดูและจัดการข้อมูลทุกสาขา (ไม่ต้องเลือกสาขาด้านบน)
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
                    
                    <FormField
                      control={form.control}
                      name="permissions.canManageSettings"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">จัดการตั้งค่า</FormLabel>
                            <FormDescription>
                              สามารถเข้าถึงหน้าตั้งค่าระบบ
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

                    <FormField
                      control={form.control}
                      name="permissions.canViewReports"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">ดูรายงาน</FormLabel>
                            <FormDescription>
                              สามารถดูรายงานและสถิติต่างๆ
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
                  </div>
                </>
              )}
            </div>

            {/* Status */}
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
                      disabled={isEditing && editingUser?.id === adminUser?.id}
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
                {isEditing ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มผู้ใช้งาน'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}