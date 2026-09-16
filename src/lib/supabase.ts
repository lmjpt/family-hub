// Supabase 연결. 값은 .env.local 에서 읽습니다 (git 에 올라가지 않습니다).
//
// 여기 쓰는 키는 브라우저에 그대로 실려 나가는 '공개' 키입니다. 비밀이 아닙니다.
// 실제 보호는 supabase/schema.sql 에 있는 RLS 정책이 합니다.
// service_role 키는 절대 여기에 넣으면 안 됩니다.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** 설정이 비어 있거나 안내 문구가 그대로 남아 있으면 false */
export const isSupabaseConfigured =
  url.startsWith('http') && key.length > 20 && !key.startsWith('여기에')

// 설정이 없어도 앱이 흰 화면으로 죽지 않도록 더미 주소로 만들어 둡니다.
// 화면에서는 isSupabaseConfigured 를 보고 안내를 띄웁니다.
export const supabase = createClient(
  isSupabaseConfigured ? url : 'http://localhost',
  isSupabaseConfigured ? key : 'not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // 폰에 한 번 로그인해 두면 계속 유지되어야 합니다.
      storageKey: 'family-hub-auth',
    },
  },
)
