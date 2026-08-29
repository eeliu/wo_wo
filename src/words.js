import { supabase } from './supabase.js';

/**
 * Fetch words with optional status and keyword filters.
 * @param {string} status Status filter: all / new / learning / mastered
 * @param {string} search Search keyword
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
 * Add a word.
 */
export async function addWord({ word, meaning, example = '', note = '', status = 'new' }) {
    // Get the signed-in user ID for RLS validation.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { data: null, error: { message: 'You must be signed in to add a word.' } };
    }

    const { data, error } = await supabase
        .from('words')
        .insert([{ user_id: user.id, word, meaning, example, note, status }])
        .select()
        .single();
    return { data, error };
}

/**
 * Update a word.
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
 * Delete a word.
 */
export async function deleteWord(id) {
    const { error } = await supabase.from('words').delete().eq('id', id);
    return { error };
}
