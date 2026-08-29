import { supabase } from './supabase.js';

const BUCKET = 'word-images';

/**
 * Upload an image to Supabase Storage.
 * File path: {user_id}/{timestamp}-{filename}
 * @param {File} file Image file
 * @returns {Promise<{url: string|null, error: object|null}>} Short-lived signed URL
 */
export async function uploadImage(file) {
    // Get the current user.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { url: null, error: { message: 'You must be signed in to upload an image.' } };
    }

    // Generate a unique filename from the timestamp, random value, and original name.
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

    // Create a short-lived URL. Storage RLS authorizes access to this user's path.
    const { data, error: signedUrlError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, 60 * 60);

    if (signedUrlError) {
        return { url: null, error: signedUrlError };
    }

    return { url: data.signedUrl, error: null };
}

/**
 * Validate the image type and size.
 * @param {File} file
 * @returns {{valid: boolean, message: string}}
 */
export function validateImage(file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

    if (!file) {
        return { valid: false, message: 'No file selected.' };
    }
    if (!allowedTypes.includes(file.type)) {
        return { valid: false, message: 'Only JPG, PNG, GIF, WEBP, and SVG images are supported.' };
    }
    if (file.size > maxSize) {
        return { valid: false, message: 'Images must be 5 MB or smaller.' };
    }
    return { valid: true, message: '' };
}
