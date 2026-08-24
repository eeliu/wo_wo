import { marked } from 'marked';
import DOMPurify from 'dompurify';

// 配置 marked：支持 GFM（表格、删除线、任务列表等）
marked.setOptions({
    gfm: true, // GitHub Flavored Markdown：表格、删除线、自动链接、任务列表
    breaks: true, // 支持单换行即换行
});

// 开启任务列表（GFM）
marked.use({
    gfm: true,
    breaks: true,
});

/**
 * 将 Markdown 文本渲染为安全的 HTML
 * 使用 DOMPurify 过滤，防止 XSS 攻击
 * @param {string} markdown 原始 Markdown 文本
 * @returns {string} 安全的 HTML 字符串
 */
export function renderMarkdown(markdown) {
    if (!markdown) return '';
    const rawHtml = marked.parse(markdown);
    return DOMPurify.sanitize(rawHtml);
}
