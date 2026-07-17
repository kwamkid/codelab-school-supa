// app/api/team/line-callback/route.ts
// Alias of the standard LINE web-login callback. Kept because this URL is
// registered in the LINE console and may be the redirect_uri of in-flight
// logins; the shared handler derives redirect_uri from the called path, so
// both URLs behave identically. New config should use /api/auth/callback/line.

export { GET, dynamic } from '@/app/api/auth/callback/line/route'
