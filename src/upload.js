import { supabase } from './supabase.js';

const BUCKET = 'word-images';

/**
 * 上传图片到 Supabase Storage
 * 文件路径：{user_id}/{timestamp}-{filename}
 * @param {File} file 图片文件
 * @returns {Promise<{url: string|null, error: object|null}>} 公开 URL
 */
export async function uploadImage(file) {
    // 获取当前用户
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { url: null, error: { message: '未登录，无法上传图片' } };
    }

    // 生成唯一文件名（时间戳 + 随机数 + 原文件名）
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${user.id}/${timestamp}-${random}-${safeName}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (uploadError) {
        return { url: null, error: uploadError };
    }

    // 获取公开 URL
    const { data } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(filePath);

    return { url: data.publicUrl, error: null };
}

/**
 * 校验文件是否为图片且大小合适
 * @param {File} file
 * @returns {{valid: boolean, message: string}}
 */
export function validateImage(file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

    if (!file) {
        return { valid: false, message: '未选择文件' };
    }
    if (!allowedTypes.includes(file.type)) {
        return { valid: false, message: '仅支持 JPG、PNG、GIF、WEBP、SVG 图片' };
    }
    if (file.size > maxSize) {
        return { valid: false, message: '图片大小不能超过 5MB' };
    }
    return { valid: true, message: '' };
}
