import './style.css';
import { supabase, configureSupabase, getSupabaseConfig } from './supabase.js';
import { signInWithPassword, signUpWithPassword, signOut, getCurrentUser, onAuthChange } from './auth.js';
import { fetchWords, addWord, updateWord, deleteWord } from './words.js';
import { renderMarkdown } from './markdown.js';
import { uploadImage, validateImage } from './upload.js';

// ========== DOM references ==========
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const authError = document.getElementById('auth-error');
const supabaseConfigForm = document.getElementById('supabase-config-form');
const supabaseUrlInput = document.getElementById('supabase-url-input');
const supabaseKeyInput = document.getElementById('supabase-key-input');
const accountForm = document.getElementById('account-form');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const registerBtn = document.getElementById('register-btn');
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

// ========== State ==========
let currentFilter = 'all';
let currentTimeFilter = 'all'; // Time filter: all / today / yesterday / thisWeek / thisMonth / YYYY-MM
let allWords = []; // Cache all words for time grouping
let editingId = null;

// ========== Character count ==========
// Content over this length is auto-compressed (whitespace collapsed), never truncated.
const COMPRESS_THRESHOLD = 1024;

function updateCharCount(textarea) {
    const counter = document.querySelector(`.char-count[data-for="${textarea.id}"]`);
    if (!counter) return;
    const len = textarea.value.length;
    counter.textContent = `${len}`;
    // Highlight when the content is over the auto-compression threshold.
    counter.classList.toggle('over-threshold', len > COMPRESS_THRESHOLD);
}

function initCharCounts() {
    const targets = [
        'meaning-input', 'example-input', 'note-input',
        'edit-meaning', 'edit-example', 'edit-note',
    ];
    targets.forEach((id) => {
        const textarea = document.getElementById(id);
        if (!textarea) return;
        updateCharCount(textarea);
        textarea.addEventListener('input', () => updateCharCount(textarea));
    });
}

// ========== Auto-compression ==========
// Word / phrase (single-line input) is excluded from compression.
// meaning / example / note (markdown textareas) auto-compress when content
// exceeds the COMPRESS_THRESHOLD to keep entries concise.

/**
 * Compress text by collapsing excessive whitespace/newlines. Never truncates —
 * the full content is always preserved. Preserves Markdown structure where possible.
 * @param {string} text Raw text
 * @returns {string} Compressed text
 */
function compressText(text) {
    if (!text) return text;
    let result = text;

    // Collapse runs of 3+ newlines down to 2 (preserve paragraph breaks).
    result = result.replace(/\n{3,}/g, '\n\n');
    // Collapse multiple spaces/tabs (but not newlines) to a single space.
    result = result.replace(/[ \t]+/g, ' ');
    // Trim trailing/leading whitespace on each line.
    result = result
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .trim();

    return result;
}

// Auto-compress the markdown textareas (meaning/example/note) when they exceed
// the threshold. Fires on input so the user sees the compressed result live.
// Content is never truncated — only whitespace is collapsed.
function initAutoCompress() {
    const targets = [
        'meaning-input', 'example-input', 'note-input',
        'edit-meaning', 'edit-example', 'edit-note',
    ];
    targets.forEach((id) => {
        const textarea = document.getElementById(id);
        if (!textarea) return;
        textarea.addEventListener('input', () => {
            if (textarea.value.length <= COMPRESS_THRESHOLD) return;
            const compressed = compressText(textarea.value);
            if (compressed !== textarea.value) {
                const start = textarea.selectionStart;
                textarea.value = compressed;
                // Keep the cursor within bounds.
                const pos = Math.min(start, compressed.length);
                textarea.setSelectionRange(pos, pos);
                updateCharCount(textarea);
            }
        });
    });
}

// ========== Markdown edit/preview toggle ==========
function initMarkdownTabs() {
    document.querySelectorAll('.tab-buttons').forEach((tabGroup) => {
        const target = tabGroup.dataset.target;
        const textarea = document.getElementById(target);
        const preview = document.querySelector(`.md-preview[data-preview="${target}"]`);
        if (!textarea || !preview) return;

        tabGroup.querySelectorAll('.tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                // Toggle the active button state
                tabGroup.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');

                if (mode === 'edit') {
                    textarea.classList.remove('hidden');
                    preview.classList.add('hidden');
                } else {
                    // Preview mode: render Markdown
                    preview.classList.add('markdown-body');
                    preview.innerHTML = renderMarkdown(textarea.value) || '<p class="md-empty">(No content)</p>';
                    preview.classList.remove('hidden');
                    textarea.classList.add('hidden');
                }
            });
        });

        // Update the preview live while editing in preview mode
        textarea.addEventListener('input', () => {
            if (!preview.classList.contains('hidden')) {
                preview.innerHTML = renderMarkdown(textarea.value) || '<p class="md-empty">(No content)</p>';
            }
        });
    });
}

// ========== Markdown toolbar ==========
// Each action wraps the selection with a prefix and suffix and adjusts the cursor.
const TOOL_ACTIONS = {
    bold: { prefix: '**', suffix: '**', placeholder: 'bold text' },
    italic: { prefix: '*', suffix: '*', placeholder: 'italic text' },
    strike: { prefix: '~~', suffix: '~~', placeholder: 'strikethrough text' },
    h2: { prefix: '## ', suffix: '', placeholder: 'Heading', block: true },
    ul: { prefix: '- ', suffix: '', placeholder: 'List item', block: true, newline: true },
    ol: { prefix: '1. ', suffix: '', placeholder: 'List item', block: true, newline: true },
    quote: { prefix: '> ', suffix: '', placeholder: 'Quote', block: true, newline: true },
    code: { prefix: '`', suffix: '`', placeholder: 'Code' },
    link: { prefix: '[', suffix: '](https://)', placeholder: 'Link text' },
    image: { prefix: '![', suffix: '](https://image-url)', placeholder: 'Image description' },
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
        // Block element: insert at the start of the line
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const indent = cfg.newline ? '\n' : '';
        const insertText = cfg.prefix + selected + cfg.suffix;
        newValue = value.slice(0, lineStart) + insertText + indent + value.slice(lineStart);
        cursorPos = lineStart + insertText.length;
    } else {
        // Inline element: wrap the selected text
        const insertText = cfg.prefix + selected + cfg.suffix;
        newValue = value.slice(0, start) + insertText + value.slice(end);
        cursorPos = start + cfg.prefix.length + selected.length;
    }

    textarea.value = newValue;
    textarea.focus();
    textarea.setSelectionRange(cursorPos, cursorPos);
    // Trigger input to update the character count and preview
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function initMarkdownToolbar() {
    document.querySelectorAll('.md-toolbar').forEach((toolbar) => {
        const target = toolbar.dataset.target;
        const textarea = document.getElementById(target);
        if (!textarea) return;

        toolbar.querySelectorAll('.tool-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                // Handle the image upload button separately
                if (btn.dataset.action === 'upload') {
                    handleImageUpload(textarea);
                    return;
                }
                insertMarkdown(textarea, btn.dataset.action);
            });
        });
    });
}

// ========== Image upload ==========
// Create a global hidden file input.
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

// Upload an image and insert Markdown at the cursor position.
async function uploadAndInsertImage(textarea, file) {
    if (!file || !textarea) return;

    // Validate the file
    const check = validateImage(file);
    if (!check.valid) {
        alert(check.message);
        return;
    }

    // Show an upload-in-progress indicator
    const originalBtn = document.querySelector(`.tool-btn[data-upload="${textarea.id}"]`);
    const originalText = originalBtn ? originalBtn.textContent : '';
    if (originalBtn) originalBtn.textContent = '⏳';

    try {
        const { url, error } = await uploadImage(file);
        if (error) {
            console.error('Image upload failed:', error);
            alert('Image upload failed. Please try again.');
            return;
        }

        // Insert Markdown image syntax at the cursor position
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = textarea.value.substring(start, end) || 'image';
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

// ========== Image paste support ==========
function initImagePaste() {
    // Listen for paste events on all textareas.
    document.querySelectorAll('textarea').forEach((textarea) => {
        textarea.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            // Look for an image in the clipboard.
            for (const item of items) {
                if (item.type && item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        e.preventDefault(); // Prevent the default text paste.
                        uploadAndInsertImage(textarea, file);
                        return;
                    }
                }
            }
        });
    });
}

// ========== Authentication UI ==========
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
    authError.classList.remove('success-message');
}

function handleOAuthError() {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get('error_code');
    if (!errorCode) return;

    const messages = {
        bad_oauth_state: 'The sign-in link has expired. Please return to the app and try again.',
        access_denied: 'Sign-in was cancelled. Please try again.',
    };
    showError(messages[errorCode] || params.get('error_description') || 'Sign-in failed. Please try again.');
    window.history.replaceState({}, document.title, window.location.pathname);
}

function showConfiguredAuth() {
    supabaseConfigForm.classList.remove('hidden');
    accountForm.classList.remove('hidden');
}

function showConfigForm() {
    supabaseConfigForm.classList.remove('hidden');
    accountForm.classList.add('hidden');
}

// ========== Word UI ==========
const STATUS_LABELS = {
    new: 'New',
    learning: 'Learning',
    mastered: 'Mastered',
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

        // Card header is always visible and toggles the details.
        const head = document.createElement('div');
        head.className = 'word-head';
        head.innerHTML = `
      <h3>${escapeHtml(w.word)}</h3>
      <span class="status-badge status-${w.status}">${STATUS_LABELS[w.status] || w.status}</span>
      <span class="expand-icon">▸</span>
    `;
        main.appendChild(head);

        // Details are collapsed by default.
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

        // Status toggle button
        const statusBtn = document.createElement('button');
        statusBtn.className = 'icon-btn';
        statusBtn.textContent = w.status === 'mastered' ? '↩️ Reset' : '✅ Mark mastered';
        statusBtn.addEventListener('click', () => {
            const nextStatus = w.status === 'mastered' ? 'new' : 'mastered';
            handleStatusChange(w.id, nextStatus);
        });

        const editBtn = document.createElement('button');
        editBtn.className = 'icon-btn';
        editBtn.textContent = '✏️ Edit';
        editBtn.addEventListener('click', () => openEditModal(w));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn danger';
        deleteBtn.textContent = '🗑️ Delete';
        deleteBtn.addEventListener('click', () => handleDelete(w.id, w.word));

        actions.appendChild(statusBtn);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(main);
        card.appendChild(actions);
        wordList.appendChild(card);

        // Toggle details when the card header is clicked.
        const toggleExpand = () => {
            const isCollapsed = details.classList.contains('collapsed');
            details.classList.toggle('collapsed', !isCollapsed);
            card.classList.toggle('expanded', isCollapsed);
            head.querySelector('.expand-icon').textContent = isCollapsed ? '▾' : '▸';
        };

        head.addEventListener('click', toggleExpand);
        // Start collapsed.
        details.classList.add('collapsed');
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ========== Time grouping and navigation ==========
// Determine the time bucket for a date.
function getTimeBucket(date) {
    const now = new Date();
    const d = new Date(date);

    // Today (compare calendar dates).
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (d >= startOfToday) return { key: 'today', label: 'Today' };
    if (d >= startOfYesterday) return { key: 'yesterday', label: 'Yesterday' };
    if (d >= startOfWeek) return { key: 'thisWeek', label: 'This week' };
    if (d >= startOfMonth) {
        // Within the current month, group by day.
        const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayLabel = `${d.getMonth() + 1}/${d.getDate()}`;
        return { key: dayKey, label: dayLabel };
    }
    // Older entries are grouped by month.
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = `${d.getFullYear()}/${d.getMonth() + 1}`;
    return { key: monthKey, label: monthLabel };
}

// Check whether a word matches the current time filter.
function matchesTimeFilter(word) {
    if (currentTimeFilter === 'all') return true;
    const bucket = getTimeBucket(word.created_at);
    return bucket.key === currentTimeFilter;
}

// Render the time navigation.
function renderTimeNav(words) {
    if (!timeNavList) return;

    // Count entries in each time bucket.
    const buckets = new Map();
    words.forEach((w) => {
        const bucket = getTimeBucket(w.created_at);
        if (!buckets.has(bucket.key)) {
            buckets.set(bucket.key, { label: bucket.label, count: 0 });
        }
        buckets.get(bucket.key).count++;
    });

    // Build navigation items in reverse chronological order.
    const order = ['today', 'yesterday', 'thisWeek'];
    const items = [];
    order.forEach((key) => {
        if (buckets.has(key)) {
            items.push({ key, ...buckets.get(key) });
        }
    });
    // Sort current-month days (YYYY-MM-DD) in descending order.
    const dayKeys = [...buckets.keys()]
        .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
        .sort((a, b) => (a < b ? 1 : -1));
    dayKeys.forEach((key) => {
        items.push({ key, ...buckets.get(key) });
    });
    // Sort older months (YYYY-MM) in descending order.
    const monthKeys = [...buckets.keys()]
        .filter((k) => /^\d{4}-\d{2}$/.test(k))
        .sort((a, b) => (a < b ? 1 : -1));
    monthKeys.forEach((key) => {
        items.push({ key, ...buckets.get(key) });
    });

    timeNavList.innerHTML = '';

    // "All" option
    const allItem = document.createElement('button');
    allItem.className = 'time-nav-item' + (currentTimeFilter === 'all' ? ' active' : '');
    allItem.dataset.time = 'all';
    allItem.innerHTML = `<span>All</span><span class="time-nav-count">${words.length}</span>`;
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
        console.error('Failed to load words:', error);
        return;
    }
    allWords = data || [];
    renderTimeNav(allWords);
    renderWords(allWords.filter(matchesTimeFilter));
}

// ========== Event handlers ==========
async function handleStatusChange(id, status) {
    const { error } = await updateWord(id, { status });
    if (error) {
        console.error('Failed to update status:', error);
        alert('Failed to update status. Please try again.');
        return;
    }
    loadWords();
}

async function handleDelete(id, word) {
    if (!confirm(`Delete the word "${word}"?`)) return;
    const { error } = await deleteWord(id);
    if (error) {
        console.error('Failed to delete word:', error);
        alert('Failed to delete word. Please try again.');
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
    // Update character counts in the edit modal.
    [editMeaning, editExample, editNote].forEach((el) => updateCharCount(el));
}

function closeEditModal() {
    editModal.classList.add('hidden');
    editingId = null;
}

// ========== Event binding ==========
accountForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();
    const { error } = await signInWithPassword(emailInput.value.trim(), passwordInput.value);
    if (error) {
        showError(error.message || 'Sign-in failed. Check your email and password.');
    }
});

supabaseConfigForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    const url = supabaseUrlInput.value.trim().replace(/\/$/, '');
    const anonKey = supabaseKeyInput.value.trim();
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch {
        parsedUrl = null;
    }
    if (!parsedUrl || parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
        showError('Enter a valid Supabase Project URL.');
        return;
    }
    if (!anonKey || anonKey.toLowerCase().includes('service_role')) {
        showError('Use the anon public key, not the service_role key.');
        return;
    }

    configureSupabase(url, anonKey);
    supabaseUrlInput.value = url;
    showConfiguredAuth();
    initAuthListener();
    showError('Connection saved. You can now sign in or register.');
    authError.classList.remove('error');
    authError.classList.add('success-message');
});

registerBtn.addEventListener('click', async () => {
    clearError();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!emailInput.checkValidity() || password.length < 6) {
        showError('Enter a valid email address and a password of at least 6 characters.');
        return;
    }

    const { data, error } = await signUpWithPassword(email, password);
    if (error) {
        showError(error.message || 'Registration failed. Please try again.');
        return;
    }
    if (!data.session) {
        showError('Registration successful. Check your email to verify your account, then sign in.');
        return;
    }
    showError('Registration successful. Opening the app.');
});

logoutBtn.addEventListener('click', async () => {
    await signOut();
});

// ========== Add form collapse/expand ==========
function toggleAddForm(force) {
    const shouldExpand = force !== undefined ? force : addCard.classList.contains('collapsed');
    if (shouldExpand) {
        addCard.classList.remove('collapsed');
        toggleAddBtn.classList.add('active');
        toggleAddBtn.querySelector('.add-toggle-icon').textContent = '−';
        // Focus the word field after expanding.
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
        console.error('Failed to add word:', error);
        alert('Failed to add word. Please try again.');
        return;
    }

    // Clear the form.
    addForm.reset();
    // Reset character counts and previews.
    [meaningInput, exampleInput, noteInput].forEach((el) => {
        updateCharCount(el);
        const preview = document.querySelector(`.md-preview[data-preview="${el.id}"]`);
        if (preview) {
            preview.classList.add('hidden');
            preview.innerHTML = '';
        }
        // Reset the tab to edit mode.
        const tabGroup = document.querySelector(`.tab-buttons[data-target="${el.id}"]`);
        if (tabGroup) {
            tabGroup.querySelectorAll('.tab-btn').forEach((b) => {
                b.classList.toggle('active', b.dataset.mode === 'edit');
            });
        }
        el.classList.remove('hidden');
    });
    // Collapse the form after a successful add.
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
        console.error('Failed to update word:', error);
        alert('Failed to update word. Please try again.');
        return;
    }

    closeEditModal();
    loadWords();
});

cancelEdit.addEventListener('click', closeEditModal);

// Close the modal when its backdrop is clicked.
editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
});

// ========== Initialization ==========
function getUserDisplayName(user) {
    // Prefer the provider name, then the email address.
    const meta = user?.user_metadata || {};
    return meta.user_name || meta.name || user?.email || 'User';
}

async function init() {
    const config = getSupabaseConfig();
    if (!supabase || !config.url || !config.anonKey) {
        showAuthView();
        showConfigForm();
        return;
    }

    supabaseUrlInput.value = config.url;
    showConfiguredAuth();
    initAuthListener();
    const user = await getCurrentUser();
    if (user) {
        userEmail.textContent = getUserDisplayName(user);
        showAppView();
        loadWords();
    } else {
        showAuthView();
    }
}

let authListenerInitialized = false;
function initAuthListener() {
    if (authListenerInitialized || !supabase) return;
    authListenerInitialized = true;
    onAuthChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            userEmail.textContent = getUserDisplayName(session.user);
            showAppView();
            loadWords();
        } else if (event === 'SIGNED_OUT') {
            showAuthView();
            clearError();
            showConfiguredAuth();
        }
    });
}

initCharCounts();
initMarkdownTabs();
initMarkdownToolbar();
initImagePaste();
initAutoCompress();
init();
