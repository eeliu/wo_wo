import { supabase } from './supabase.js';

/**
 * Sign in to Supabase Auth with an email and password.
 */
export async function signInWithPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
}

/**
 * Create an email account.
 */
export async function signUpWithPassword(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { data, error };
}

/**
 * Sign out.
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

/**
 * Get the current user.
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    return data?.user ?? null;
}

/**
 * Subscribe to authentication state changes.
 * @param {Function} callback (event, session) => void
 * @returns {Function} Unsubscribe function
 */
export function onAuthChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
    return data.subscription.unsubscribe;
}
