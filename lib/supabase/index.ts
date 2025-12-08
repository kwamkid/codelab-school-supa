// Re-export all Supabase utilities
export { createClient, getClient } from './client'
export { createClient as createServerClient, createServiceClient } from './server'
export { updateSession } from './middleware'
