import { supabase } from './supabase.js';

/**
 * 获取单词列表（按状态筛选 + 关键词搜索）
 * @param {string} status 状态筛选：all / new / learning / mastered
 * @param {string} search 搜索关键词
 * @returns {Promise<{data: Array, error: object|null}>}
 */
export async function fetchWords(status = 'all', search = '') {
    let query = supabase
        .from('words')
        .select('*')
        .order('created_at', { ascending: false });

    if (status !== 'all') {
        query = query.eq('status', status);
    }

    if (search.trim()) {
        query = query.ilike('word', `%${search.trim()}%`);
    }

    const { data, error } = await query;
    return { data, error };
}

/**
 * 添加单词
 */
export async function addWord({ word, meaning, example = '', note = '', status = 'new' }) {
    // 获取当前登录用户 ID，用于 RLS 校验
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { data: null, error: { message: '未登录，无法添加单词' } };
    }

    const { data, error } = await supabase
        .from('words')
        .insert([{ user_id: user.id, word, meaning, example, note, status }])
        .select()
        .single();
    return { data, error };
}

/**
 * 更新单词
 */
export async function updateWord(id, updates) {
    const { data, error } = await supabase
        .from('words')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    return { data, error };
}

/**
 * 删除单词
 */
export async function deleteWord(id) {
    const { error } = await supabase.from('words').delete().eq('id', id);
    return { error };
}
