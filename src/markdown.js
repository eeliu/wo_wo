import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked with GFM support (tables, strikethrough, task lists, and more).
marked.setOptions({
    gfm: true, // GitHub Flavored Markdown: tables, strikethrough, autolinks, and task lists.
    breaks: true, // Treat single line breaks as line breaks.
});

// Enable task lists (GFM).
marked.use({
    gfm: true,
    breaks: true,
});

/**
 * Render Markdown text as safe HTML.
 * DOMPurify sanitizes the result to prevent XSS attacks.
 * @param {string} markdown Raw Markdown text
 * @returns {string} Safe HTML string
 */
export function renderMarkdown(markdown) {
    if (!markdown) return '';
    const rawHtml = marked.parse(markdown);
    return DOMPurify.sanitize(rawHtml);
}
