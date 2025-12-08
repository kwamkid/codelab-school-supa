'use client';

// Re-export everything from useSupabaseAuth for backwards compatibility
// This allows all existing imports from '@/hooks/useAuth' to work without changes
export {
  useAuth,
  useSupabaseAuth,
  AuthProvider,
  SupabaseAuthProvider,
  type AdminUser,
  type Teacher,
} from './useSupabaseAuth';
