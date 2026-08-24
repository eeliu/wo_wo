import './style.css';
import { supabase } from './supabase.js';
import { signInWithGitHub, signOut, getCurrentUser, onAuthChange } from './auth.js';
import { fetchWords, addWord, updateWord, deleteWord } from './words.js';
import { renderMarkdown } from './markdown.js';
import { uploadImage, validateImage } from './upload.js';

// ========== DOM 引用 ==========
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const githubLoginBtn = document.getElementById('github-login-btn');
const authError = document.getElementById('auth-error');
const userEmail = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');

const addForm = document.getElementById('add-form');
const addCard = document.getElementById('add-card');
const toggleAddBtn = document.getElementById('toggle-add-btn');
const wordInput = document.getElementById('word-input');
const meaningInput = document.getElementById('meaning-input');
const exampleInput = document.getElementById('example-input');
const noteInput = document.getElementById('note-input');

const wordList = document.getElementById('word-list');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const filterBtns = document.querySelectorAll('.filter-btn');
const timeNavList = document.getElementById('time-nav-list');

const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const cancelEdit = document.getElementById('cancel-edit');
const editWord = document.getElementById('edit-word');
const editMeaning = document.getElementById('edit-meaning');
const editExample = document.getElementById('edit-example');
const editNote = document.getElementById('edit-note');
const editStatus = document.getElementById('edit-status');

// ========== 状态 ==========
let currentFilter = 'all';
let currentTimeFilter = 'all'; // 时间筛选：all / today / yesterday / thisWeek / thisMonth / YYYY-MM
let allWords = []; // 缓存所有单词，用于时间分组
let editingId = null;

// ========== 字符计数 ==========
function updateCharCount(textarea) {
    const counter = document.querySelector(`.char-count[data-for="${textarea.id}"]`);
    if (!counter) return;
    const len = textarea.value.length;
    const max = parseInt(textarea.maxLength, 10) || 0;
    counter.textContent = `${len} / ${max}`;
    counter.classList.toggle('near-limit', max > 0 && len > max * 0.8);
    counter.classList.toggle('at-limit', max > 0 && len >= max);
}

function initCharCounts() {
    document.querySelectorAll('textarea[maxlength]').forEach((textarea) => {
        updateCharCount(textarea);
        textarea.addEventListener('input', () => updateCharCount(textarea));
    });
}

// ========== Markdown 编辑/预览切换 ==========
function initMarkdownTabs() {
    document.querySelectorAll('.tab-buttons').forEach((tabGroup) => {
        const target = tabGroup.dataset.target;
        const textarea = document.getElementById(target);
        const preview = document.querySelector(`.md-preview[data-preview="${target}"]`);
        if (!textarea || !preview) return;

        tabGroup.querySelectorAll('.tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                // 切换按钮激活状态
                tabGroup.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');

                if (mode === 'edit') {
                    textarea.classList.remove('hidden');
                    preview.classList.add('hidden');
                } else {
                    // 预览模式：渲染 Markdown
                    preview.classList.add('markdown-body');
                    preview.innerHTML = renderMarkdown(textarea.value) || '<p class="md-empty">（暂无内容）</p>';
                    preview.classList.remove('hidden');
                    textarea.classList.add('hidden');
                }
            });
        });

        // 编辑时若处于预览模式，实时更新预览
        textarea.addEventListener('input', () => {
            if (!preview.classList.contains('hidden')) {
                preview.innerHTML = renderMarkdown(textarea.value) || '<p class="md-empty">（暂无内容）</p>';
            }
        });
    });
}

// ========== Markdown 工具栏 ==========
// 每种操作：前缀 + 选中文本 + 后缀，以及光标位置调整
const TOOL_ACTIONS = {
    bold: { prefix: '**', suffix: '**', placeholder: '加粗文本' },
    italic: { prefix: '*', suffix: '*', placeholder: '斜体文本' },
    strike: { prefix: '~~', suffix: '~~', placeholder: '删除线文本' },
    h2: { prefix: '## ', suffix: '', placeholder: '标题', block: true },
    ul: { prefix: '- ', suffix: '', placeholder: '列表项', block: true, newline: true },
    ol: { prefix: '1. ', suffix: '', placeholder: '列表项', block: true, newline: true },
    quote: { prefix: '> ', suffix: '', placeholder: '引用内容', block: true, newline: true },
    code: { prefix: '`', suffix: '`', placeholder: '代码' },
    link: { prefix: '[', suffix: '](https://)', placeholder: '链接文字' },
    image: { prefix: '![', suffix: '](https://图片地址)', placeholder: '图片描述' },
};

function insertMarkdown(textarea, action) {
    const cfg = TOOL_ACTIONS[action];
    if (!cfg) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end) || cfg.placeholder;
    const value = textarea.value;

    let newValue;
    let cursorPos;

    if (cfg.block) {
        // 块级元素：插入到行首
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const indent = cfg.newline ? '\n' : '';
        const insertText = cfg.prefix + selected + cfg.suffix;
        newValue = value.slice(0, lineStart) + insertText + indent + value.slice(lineStart);
        cursorPos = lineStart + insertText.length;
    } else {
        // 行内元素：包裹选中文本
        const insertText = cfg.prefix + selected + cfg.suffix;
        newValue = value.slice(0, start) + insertText + value.slice(end);
        cursorPos = start + cfg.prefix.length + selected.length;
    }

    textarea.value = newValue;
    textarea.focus();
    textarea.setSelectionRange(cursorPos, cursorPos);
    // 触发 input 事件，更新字符计数和预览
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function initMarkdownToolbar() {
    document.querySelectorAll('.md-toolbar').forEach((toolbar) => {
        const target = toolbar.dataset.target;
        const textarea = document.getElementById(target);
        if (!textarea) return;

        toolbar.querySelectorAll('.tool-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                // 上传图片按钮特殊处理
                if (btn.dataset.action === 'upload') {
                    handleImageUpload(textarea);
                    return;
                }
                insertMarkdown(textarea, btn.dataset.action);
            });
        });
    });
}

// ========== 图片上传 ==========
// 创建一个全局隐藏的文件输入框
const imageFileInput = document.createElement('input');
imageFileInput.type = 'file';
imageFileInput.accept = 'image/*';
imageFileInput.style.display = 'none';
document.body.appendChild(imageFileInput);

let uploadTargetTextarea = null;

async function handleImageUpload(textarea) {
    uploadTargetTextarea = textarea;
    imageFileInput.value = '';
    imageFileInput.click();
}

// 上传图片并插入 Markdown 语法到光标位置
async function uploadAndInsertImage(textarea, file) {
    if (!file || !textarea) return;

    // 校验文件
    const check = validateImage(file);
    if (!check.valid) {
        alert(check.message);
        return;
    }

    // 显示上传中提示
    const originalBtn = document.querySelector(`.tool-btn[data-upload="${textarea.id}"]`);
    const originalText = originalBtn ? originalBtn.textContent : '';
    if (originalBtn) originalBtn.textContent = '⏳';

    try {
        const { url, error } = await uploadImage(file);
        if (error) {
            console.error('上传失败:', error);
            alert('图片上传失败，请重试');
            return;
        }

        // 在光标位置插入 Markdown 图片语法
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = textarea.value.substring(start, end) || '图片';
        const insertText = `![${selected}](${url})`;
        const newValue = textarea.value.slice(0, start) + insertText + textarea.value.slice(end);
        textarea.value = newValue;
        textarea.focus();
        textarea.setSelectionRange(start + insertText.length, start + insertText.length);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    } finally {
        if (originalBtn) originalBtn.textContent = originalText;
    }
}

imageFileInput.addEventListener('change', async () => {
    const file = imageFileInput.files[0];
    const ta = uploadTargetTextarea;
    if (!file || !ta) return;
    await uploadAndInsertImage(ta, file);
});

// ========== 粘贴图片支持 ==========
function initImagePaste() {
    // 监听所有 textarea 的粘贴事件
    document.querySelectorAll('textarea').forEach((textarea) => {
        textarea.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            // 查找剪贴板中的图片
            for (const item of items) {
                if (item.type && item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        e.preventDefault(); // 阻止默认粘贴文本
                        uploadAndInsertImage(textarea, file);
                        return;
                    }
                }
            }
        });
    });
}

// ========== 认证 UI ==========
function showAuthView() {
    authView.classList.remove('hidden');
    appView.classList.add('hidden');
}

function showAppView() {
    authView.classList.add('hidden');
    appView.classList.remove('hidden');
}

function showError(message) {
    authError.textContent = message;
    authError.classList.remove('hidden');
}

function clearError() {
    authError.classList.add('hidden');
    authError.textContent = '';
}

// ========== 单词 UI ==========
const STATUS_LABELS = {
    new: '新词',
    learning: '学习中',
    mastered: '已掌握',
};

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderWords(words) {
    wordList.innerHTML = '';

    if (!words || words.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    words.forEach((w) => {
        const card = document.createElement('div');
        card.className = 'word-card';

        const main = document.createElement('div');
        main.className = 'word-main';

        // 卡片头部（始终显示，点击切换展开/收起）
        const head = document.createElement('div');
        head.className = 'word-head';
        head.innerHTML = `
      <h3>${escapeHtml(w.word)}</h3>
      <span class="status-badge status-${w.status}">${STATUS_LABELS[w.status] || w.status}</span>
      <span class="expand-icon">▸</span>
    `;
        main.appendChild(head);

        // 详细内容（默认折叠）
        const details = document.createElement('div');
        details.className = 'word-details';

        const meaning = document.createElement('div');
        meaning.className = 'word-meaning markdown-body';
        meaning.innerHTML = renderMarkdown(w.meaning);
        details.appendChild(meaning);

        if (w.example) {
            const example = document.createElement('div');
            example.className = 'word-example markdown-body';
            example.innerHTML = renderMarkdown(w.example);
            details.appendChild(example);
        }

        if (w.note) {
            const note = document.createElement('div');
            note.className = 'word-note markdown-body';
            note.innerHTML = renderMarkdown(w.note);
            details.appendChild(note);
        }

        const date = document.createElement('p');
        date.className = 'word-date';
        date.textContent = `🕐 ${formatDate(w.created_at)}`;
        details.appendChild(date);

        main.appendChild(details);

        const actions = document.createElement('div');
        actions.className = 'word-actions';

        // 状态切换按钮
        const statusBtn = document.createElement('button');
        statusBtn.className = 'icon-btn';
        statusBtn.textContent = w.status === 'mastered' ? '↩️ 重置' : '✅ 标记掌握';
        statusBtn.addEventListener('click', () => {
            const nextStatus = w.status === 'mastered' ? 'new' : 'mastered';
            handleStatusChange(w.id, nextStatus);
        });

        const editBtn = document.createElement('button');
        editBtn.className = 'icon-btn';
        editBtn.textContent = '✏️ 编辑';
        editBtn.addEventListener('click', () => openEditModal(w));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn danger';
        deleteBtn.textContent = '🗑️ 删除';
        deleteBtn.addEventListener('click', () => handleDelete(w.id, w.word));

        actions.appendChild(statusBtn);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(main);
        card.appendChild(actions);
        wordList.appendChild(card);

        // 点击卡片头部切换展开/收起
        const toggleExpand = () => {
            const isCollapsed = details.classList.contains('collapsed');
            details.classList.toggle('collapsed', !isCollapsed);
            card.classList.toggle('expanded', isCollapsed);
            head.querySelector('.expand-icon').textContent = isCollapsed ? '▾' : '▸';
        };

        head.addEventListener('click', toggleExpand);
        // 初始为折叠状态
        details.classList.add('collapsed');
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ========== 时间分组与导航 ==========
// 判断日期属于哪个时间段
function getTimeBucket(date) {
    const now = new Date();
    const d = new Date(date);

    // 今天（比较年月日）
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (d >= startOfToday) return { key: 'today', label: '今天' };
    if (d >= startOfYesterday) return { key: 'yesterday', label: '昨天' };
    if (d >= startOfWeek) return { key: 'thisWeek', label: '本周' };
    if (d >= startOfMonth) {
        // 本月内：按天分组（如 8月15日）
        const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayLabel = `${d.getMonth() + 1}月${d.getDate()}日`;
        return { key: dayKey, label: dayLabel };
    }
    // 更早：按月分组
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    return { key: monthKey, label: monthLabel };
}

// 判断单词是否属于当前时间筛选
function matchesTimeFilter(word) {
    if (currentTimeFilter === 'all') return true;
    const bucket = getTimeBucket(word.created_at);
    return bucket.key === currentTimeFilter;
}

// 生成左侧时间导航栏
function renderTimeNav(words) {
    if (!timeNavList) return;

    // 统计每个时间段的数量
    const buckets = new Map();
    words.forEach((w) => {
        const bucket = getTimeBucket(w.created_at);
        if (!buckets.has(bucket.key)) {
            buckets.set(bucket.key, { label: bucket.label, count: 0 });
        }
        buckets.get(bucket.key).count++;
    });

    // 生成导航项（按时间倒序）
    const order = ['today', 'yesterday', 'thisWeek'];
    const items = [];
    order.forEach((key) => {
        if (buckets.has(key)) {
            items.push({ key, ...buckets.get(key) });
        }
    });
    // 本月的天数（YYYY-MM-DD 格式）按日期倒序
    const dayKeys = [...buckets.keys()]
        .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
        .sort((a, b) => (a < b ? 1 : -1));
    dayKeys.forEach((key) => {
        items.push({ key, ...buckets.get(key) });
    });
    // 更早的月份（YYYY-MM 格式）按月份倒序
    const monthKeys = [...buckets.keys()]
        .filter((k) => /^\d{4}-\d{2}$/.test(k))
        .sort((a, b) => (a < b ? 1 : -1));
    monthKeys.forEach((key) => {
        items.push({ key, ...buckets.get(key) });
    });

    timeNavList.innerHTML = '';

    // "全部" 选项
    const allItem = document.createElement('button');
    allItem.className = 'time-nav-item' + (currentTimeFilter === 'all' ? ' active' : '');
    allItem.dataset.time = 'all';
    allItem.innerHTML = `<span>全部</span><span class="time-nav-count">${words.length}</span>`;
    allItem.addEventListener('click', () => {
        currentTimeFilter = 'all';
        renderWords(words.filter(matchesTimeFilter));
        renderTimeNav(words);
    });
    timeNavList.appendChild(allItem);

    items.forEach((item) => {
        const btn = document.createElement('button');
        btn.className = 'time-nav-item' + (currentTimeFilter === item.key ? ' active' : '');
        btn.dataset.time = item.key;
        btn.innerHTML = `<span>${item.label}</span><span class="time-nav-count">${item.count}</span>`;
        btn.addEventListener('click', () => {
            currentTimeFilter = item.key;
            renderWords(words.filter(matchesTimeFilter));
            renderTimeNav(words);
        });
        timeNavList.appendChild(btn);
    });
}

async function loadWords() {
    const { data, error } = await fetchWords(currentFilter, searchInput.value);
    if (error) {
        console.error('加载单词失败:', error);
        return;
    }
    allWords = data || [];
    renderTimeNav(allWords);
    renderWords(allWords.filter(matchesTimeFilter));
}

// ========== 事件处理 ==========
async function handleStatusChange(id, status) {
    const { error } = await updateWord(id, { status });
    if (error) {
        console.error('更新状态失败:', error);
        alert('更新状态失败，请重试');
        return;
    }
    loadWords();
}

async function handleDelete(id, word) {
    if (!confirm(`确定删除单词 "${word}" 吗？`)) return;
    const { error } = await deleteWord(id);
    if (error) {
        console.error('删除失败:', error);
        alert('删除失败，请重试');
        return;
    }
    loadWords();
}

function openEditModal(word) {
    editingId = word.id;
    editWord.value = word.word;
    editMeaning.value = word.meaning;
    editExample.value = word.example || '';
    editNote.value = word.note || '';
    editStatus.value = word.status;
    editModal.classList.remove('hidden');
    // 更新编辑弹窗内的字符计数
    [editMeaning, editExample, editNote].forEach((el) => updateCharCount(el));
}

function closeEditModal() {
    editModal.classList.add('hidden');
    editingId = null;
}

// ========== 事件绑定 ==========
githubLoginBtn.addEventListener('click', async () => {
    clearError();
    const { error } = await signInWithGitHub();
    if (error) {
        showError(error.message || 'GitHub 登录失败，请重试');
    }
});

logoutBtn.addEventListener('click', async () => {
    await signOut();
});

// ========== 添加表单折叠/展开 ==========
function toggleAddForm(force) {
    const shouldExpand = force !== undefined ? force : addCard.classList.contains('collapsed');
    if (shouldExpand) {
        addCard.classList.remove('collapsed');
        toggleAddBtn.classList.add('active');
        toggleAddBtn.querySelector('.add-toggle-icon').textContent = '−';
        // 展开后聚焦单词输入框
        setTimeout(() => wordInput.focus(), 50);
    } else {
        addCard.classList.add('collapsed');
        toggleAddBtn.classList.remove('active');
        toggleAddBtn.querySelector('.add-toggle-icon').textContent = '＋';
    }
}

toggleAddBtn.addEventListener('click', () => {
    toggleAddForm();
});

addForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const word = wordInput.value.trim();
    const meaning = meaningInput.value.trim();
    if (!word || !meaning) return;

    const { error } = await addWord({
        word,
        meaning,
        example: exampleInput.value.trim(),
        note: noteInput.value.trim(),
    });

    if (error) {
        console.error('添加失败:', error);
        alert('添加失败，请重试');
        return;
    }

    // 清空表单
    addForm.reset();
    // 重置字符计数和预览
    [meaningInput, exampleInput, noteInput].forEach((el) => {
        updateCharCount(el);
        const preview = document.querySelector(`.md-preview[data-preview="${el.id}"]`);
        if (preview) {
            preview.classList.add('hidden');
            preview.innerHTML = '';
        }
        // 重置 tab 到编辑模式
        const tabGroup = document.querySelector(`.tab-buttons[data-target="${el.id}"]`);
        if (tabGroup) {
            tabGroup.querySelectorAll('.tab-btn').forEach((b) => {
                b.classList.toggle('active', b.dataset.mode === 'edit');
            });
        }
        el.classList.remove('hidden');
    });
    // 添加成功后收起表单，方便阅读单词
    toggleAddForm(false);
    loadWords();
});

searchInput.addEventListener('input', () => {
    loadWords();
});

filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.status;
        loadWords();
    });
});

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingId) return;

    const { error } = await updateWord(editingId, {
        word: editWord.value.trim(),
        meaning: editMeaning.value.trim(),
        example: editExample.value.trim(),
        note: editNote.value.trim(),
        status: editStatus.value,
    });

    if (error) {
        console.error('更新失败:', error);
        alert('更新失败，请重试');
        return;
    }

    closeEditModal();
    loadWords();
});

cancelEdit.addEventListener('click', closeEditModal);

// 点击弹窗背景关闭
editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
});

// ========== 初始化 ==========
function getUserDisplayName(user) {
    // 优先显示 GitHub 用户名，其次邮箱
    const meta = user?.user_metadata || {};
    return meta.user_name || meta.name || user?.email || '用户';
}

async function init() {
    const user = await getCurrentUser();
    if (user) {
        userEmail.textContent = getUserDisplayName(user);
        showAppView();
        loadWords();
    } else {
        showAuthView();
    }
}

onAuthChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
        userEmail.textContent = getUserDisplayName(session.user);
        showAppView();
        loadWords();
    } else if (event === 'SIGNED_OUT') {
        showAuthView();
        clearError();
    }
});

initCharCounts();
initMarkdownTabs();
initMarkdownToolbar();
initImagePaste();
init();
