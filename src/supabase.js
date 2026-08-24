import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
        '缺少 Supabase 配置。请复制 .env.example 为 .env 并填入 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
