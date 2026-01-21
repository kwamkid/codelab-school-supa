'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { User as SupabaseUser, Session, SupabaseClient } from '@supabase/supabase-js';
import { getClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Database } from '@/types/supabase';

// Extended User type for Firebase compatibility (adds uid as alias for id)
export interface User extends SupabaseUser {
  uid: string; // Alias for id (Firebase compatibility)
  photoURL?: string | null; // Alias for user_metadata.avatar_url
  displayName?: string | null; // Alias for user_metadata.display_name or email
}

// Helper to convert Supabase user to our compatible User type
function toCompatibleUser(supabaseUser: SupabaseUser | null): User | null {
  if (!supabaseUser) return null;
  return {
    ...supabaseUser,
    uid: supabaseUser.id, // Add uid alias
    photoURL: supabaseUser.user_metadata?.avatar_url || null,
    displayName: supabaseUser.user_metadata?.display_name || supabaseUser.email || null,
  };
}

// Types matching the actual admin_users table schema
interface AdminUserData {
  id: string;
  auth_user_id: string | null;
  email: string;
  display_name: string;
  role: 'super_admin' | 'branch_admin' | 'teacher';
  branch_ids: string[];
  teacher_id: string | null;
  // Flat permission columns (not nested object)
  can_manage_users: boolean | null;
  can_manage_settings: boolean | null;
  can_view_reports: boolean | null;
  can_manage_all_branches: boolean | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
}

interface TeacherData {
  id: string;
  name: string;
  nickname: string;
  email: string | null;
  phone: string | null;
  line_id: string | null;
  specialties: string[];
  available_branches: string[];
  is_active: boolean;
}

// Mapped types for compatibility with existing code
export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: 'super_admin' | 'branch_admin' | 'teacher';
  branchIds: string[];
  teacherId?: string;
  permissions?: {
    canManageUsers?: boolean;
    canManageSettings?: boolean;
    canViewReports?: boolean;
    canManageAllBranches?: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface Teacher {
  id: string;
  name: string;
  nickname: string;
  email?: string;
  phone?: string;
  lineId?: string;
  specialties: string[];
  availableBranches: string[];
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  adminUser: AdminUser | null;
  teacher: Teacher | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  canAccessBranch: (branchId: string) => boolean;
  isSuperAdmin: () => boolean;
  isBranchAdmin: () => boolean;
  canManageSettings: () => boolean;
  isTeacher: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to map Supabase admin user to our AdminUser type
function mapAdminUser(data: AdminUserData): AdminUser {
  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    branchIds: data.branch_ids || [],
    teacherId: data.teacher_id || undefined,
    // Map flat permission columns to nested object
    permissions: {
      canManageUsers: data.can_manage_users ?? false,
      canManageSettings: data.can_manage_settings ?? false,
      canViewReports: data.can_view_reports ?? false,
      canManageAllBranches: data.can_manage_all_branches ?? false,
    },
    isActive: data.is_active,
    createdAt: new Date(data.created_at),
    createdBy: data.created_by,
    updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    updatedBy: data.updated_by || undefined,
  };
}

// Helper to map Supabase teacher to our Teacher type
function mapTeacher(data: TeacherData): Teacher {
  return {
    id: data.id,
    name: data.name,
    nickname: data.nickname,
    email: data.email || undefined,
    phone: data.phone || undefined,
    lineId: data.line_id || undefined,
    specialties: data.specialties || [],
    availableBranches: data.available_branches || [],
    isActive: data.is_active,
  };
}

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Prevent duplicate loadAdminUser calls
  const loadingAdminRef = useRef(false);
  const loadedEmailRef = useRef<string | null>(null);

  // Load teacher data helper
  const loadTeacherData = useCallback(async (client: SupabaseClient<Database>, teacherId: string) => {
    try {
      const { data, error } = await client
        .from('teachers')
        .select('*')
        .eq('id', teacherId)
        .single();

      if (!error && data) {
        setTeacher(mapTeacher(data as unknown as TeacherData));
      }
    } catch (error) {
      console.error('Error loading teacher data:', error);
    }
  }, []);

  // Load admin user data from Supabase
  const loadAdminUser = useCallback(async (client: SupabaseClient<Database>, authUserId: string, userEmail?: string) => {
    try {
      // Use provided email or fetch it
      let email = userEmail;

      if (!email) {
        const { data: userData } = await client.auth.getUser();
        email = userData?.user?.email;
      }

      if (!email) {
        console.error('[loadAdminUser] No user email found');
        return;
      }

      const emailLower = email.toLowerCase();

      // Skip if already loaded for this email
      if (loadedEmailRef.current === emailLower) {
        return;
      }

      // Prevent duplicate concurrent calls
      if (loadingAdminRef.current) {
        return;
      }

      loadingAdminRef.current = true;

      // Use fetch directly to avoid Supabase client issues
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      let adminDataArray;

      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/admin_users?email=eq.${encodeURIComponent(emailLower)}&select=*`,
          {
            method: 'GET',
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${supabaseKey!}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
          }
        );

        if (!response.ok) {
          console.error('[loadAdminUser] Fetch error:', response.status);
          loadingAdminRef.current = false;
          return;
        }

        adminDataArray = await response.json();
      } catch (queryError) {
        console.error('[loadAdminUser] Query exception:', queryError);
        loadingAdminRef.current = false;
        return;
      }

      if (!adminDataArray || adminDataArray.length === 0) {
        console.error('[loadAdminUser] No admin user found for email:', emailLower);
        loadingAdminRef.current = false;
        return;
      }

      const adminData = adminDataArray[0];
      const mappedAdmin = mapAdminUser(adminData as unknown as AdminUserData);

      // Add default permissions for super_admin
      if (mappedAdmin.role === 'super_admin') {
        mappedAdmin.permissions = {
          canManageUsers: true,
          canManageSettings: true,
          canViewReports: true,
          canManageAllBranches: true,
          ...mappedAdmin.permissions
        };
      }

      setAdminUser(mappedAdmin);

      // Mark as successfully loaded only after setting admin user
      loadedEmailRef.current = email;

      // Load teacher data if role is teacher
      if (adminData.role === 'teacher' && adminData.teacher_id) {
        await loadTeacherData(client, adminData.teacher_id);
      }

      loadingAdminRef.current = false;
    } catch (error) {
      console.error('Exception in loadAdminUser:', error);
      loadingAdminRef.current = false;
    }
  }, [loadTeacherData]);

  // Initialize auth state - only runs on client side
  useEffect(() => {
    let mounted = true;
    let supabase;

    // Reset refs on mount
    loadingAdminRef.current = false;
    loadedEmailRef.current = null;

    try {
      supabase = getClient();
    } catch (error) {
      console.error('Failed to create Supabase client:', error);
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (!mounted) return;

        setSession(session);
        setUser(toCompatibleUser(session?.user ?? null));

        if (session?.user) {
          await loadAdminUser(supabase, session.user.id, session.user.email);
        }

        if (!mounted) return;
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('getSession failed:', err);
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        setSession(session);
        setUser(toCompatibleUser(session?.user ?? null));

        if (session?.user) {
          await loadAdminUser(supabase, session.user.id, session.user.email);
        } else {
          setAdminUser(null);
          setTeacher(null);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getClient();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        // Check if user is active admin
        const { data: adminData, error: adminError } = await supabase
          .from('admin_users')
          .select('is_active')
          .eq('auth_user_id', data.user.id)
          .single();

        // Also try by email if not found by auth_user_id
        if (adminError) {
          const { data: adminByEmail } = await supabase
            .from('admin_users')
            .select('is_active')
            .eq('email', email.toLowerCase())
            .single();

          if (adminByEmail && !adminByEmail.is_active) {
            await supabase.auth.signOut();
            throw new Error('บัญชีถูกระงับการใช้งาน');
          }
        } else if (adminData && !adminData.is_active) {
          await supabase.auth.signOut();
          throw new Error('บัญชีถูกระงับการใช้งาน');
        }

        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw error;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // router is used but stable in Next.js

  const signOut = useCallback(async () => {
    try {
      // Clear local state first
      setAdminUser(null);
      setTeacher(null);
      setUser(null);
      setSession(null);

      // Clear localStorage
      if (typeof window !== 'undefined') {
        // Clear all Supabase auth tokens
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key);
          }
        });
      }

      // Navigate to login
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if there's an error, still clear state and redirect
      setAdminUser(null);
      setTeacher(null);
      setUser(null);
      setSession(null);
      router.push('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // router is used but stable in Next.js

  const canAccessBranch = useCallback((branchId: string) => {
    if (!adminUser) return false;
    if (adminUser.role === 'super_admin') return true;
    if (adminUser.branchIds.length === 0) return true; // empty = all branches
    return adminUser.branchIds.includes(branchId);
  }, [adminUser]);

  const isSuperAdmin = useCallback(() => {
    return adminUser?.role === 'super_admin';
  }, [adminUser]);

  const isBranchAdmin = useCallback(() => {
    return adminUser?.role === 'branch_admin';
  }, [adminUser]);

  const canManageSettings = useCallback(() => {
    if (!adminUser) return false;
    if (adminUser.role === 'super_admin') return true;
    return adminUser.permissions?.canManageSettings || false;
  }, [adminUser]);

  const isTeacher = useCallback(() => {
    return adminUser?.role === 'teacher';
  }, [adminUser]);

  const value = useMemo(() => ({
    user,
    session,
    adminUser,
    teacher,
    loading,
    signIn,
    signOut,
    canAccessBranch,
    isSuperAdmin,
    isBranchAdmin,
    canManageSettings,
    isTeacher
  }), [user, session, adminUser, teacher, loading]); // Only primitive state, functions are stable via useCallback

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
}

// Re-export as useAuth for drop-in replacement
export { useSupabaseAuth as useAuth, SupabaseAuthProvider as AuthProvider };
