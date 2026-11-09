export interface CloudflareBindings {
  QUOTA_KV?: KVNamespace;
  DB?: D1Database;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  JWT_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  FREE_DAILY_LIMIT?: string;
  AUTH_DAILY_LIMIT?: string;
}
