// lib/vex/supabase.ts
// Access the isolated Postgres `vex` schema with the service-role client (bypasses
// RLS — the vex schema has no policies, so only the secret key reaches it).
// types/supabase.ts has no `vex` schema → cast to any.
//
// GOLDEN RULE: never write to any public.* table through this client. The only
// public.* access anywhere in this feature is READ-ONLY (admin/parent identity,
// settings), and that goes through the existing rest.ts / admin-auth helpers.

import { createServiceClient } from '@/lib/supabase/server'

export function vexDb() {
  // Cast to any before .schema() — types/supabase.ts only knows the 'public'
  // schema, so the typed client rejects 'vex' as an argument.
  return (createServiceClient() as any).schema('vex')
}
