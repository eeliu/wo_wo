import { supabase } from './supabase.js';

/**
 * GitHub OAuth 登录
 * 跳转到 GitHub 授权页面，授权后回调到应用
 * @param {string} redirectTo 登录成功后的回调地址（可选）
 * @returns {Promise<{error: object|null}>}
 */
export async function signInWithGitHub(redirectTo) {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
            redirectTo: redirectTo || window.location.origin,
        },
    });
    return { data, error };
}

/**
 * 登出
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

/**
 * 获取当前用户
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    return data?.user ?? null;
}

/**
 * 订阅认证状态变化
 * @param {Function} callback (event, session) => void
 * @returns {Function} 取消订阅函数
 */
export function onAuthChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
    return data.subscription.unsubscribe;
}
