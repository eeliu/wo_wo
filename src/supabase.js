import { createClient } from '@supabase/supabase-js';

const CONFIG_STORAGE_KEY = 'bei-bei-recite:supabase-config';

function isUsableConfig(config) {
    try {
        const parsedUrl = new URL(config.url);
        return Boolean(
            config.anonKey &&
            parsedUrl.protocol === 'https:' &&
            parsedUrl.hostname.endsWith('.supabase.co')
        );
    } catch {
        return false;
    }
}

function readStoredConfig() {
    try {
        return JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY)) || {};
    } catch {
        return {};
    }
}

const storedConfig = readStoredConfig();

export let supabase = isUsableConfig(storedConfig)
    ? createClient(storedConfig.url, storedConfig.anonKey)
    : null;

export function getSupabaseConfig() {
    return { ...storedConfig };
}

export function configureSupabase(url, anonKey) {
    supabase = createClient(url, anonKey);
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ url, anonKey }));
    return supabase;
}
