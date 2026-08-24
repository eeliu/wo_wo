#!/usr/bin/env python3
"""
解析 Words.docx，拆分为项目数据格式（word/meaning/example/note），
并提取图片到 public/word-images/。

输出：
  - data/words.json        结构化单词数据（Markdown 格式）
  - public/word-images/    提取的图片
  - supabase/seed.sql      可导入的 SQL 种子文件
"""
import zipfile
import json
import os
import re
import sys
from xml.etree import ElementTree as ET

DOCX = 'Words.docx'

# 用户 UUID：从命令行参数读取，默认用 auth.uid()（需在登录会话中执行）
USER_ID = sys.argv[1] if len(sys.argv) > 1 else 'auth.uid()'
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'

# ---------- 1. 读取段落与图片关系 ----------
z = zipfile.ZipFile(DOCX)
xml = z.read('word/document.xml').decode('utf-8')
tree = ET.fromstring(xml)

# 关系映射 rId -> media 文件
rels = z.read('word/_rels/document.xml.rels').decode('utf-8')
rel_tree = ET.fromstring(rels)
rid_to_media = {}
for r in rel_tree:
    rid = r.get('Id')
    target = r.get('Target')
    if target and 'media' in target:
        rid_to_media[rid] = 'word/' + target

# 段落列表：每段 (text, [image_media_paths])
paras = []
for p in tree.iter(W + 'p'):
    text = ''.join(t.text or '' for t in p.iter(W + 't'))
    imgs = []
    for b in p.iter(A + 'blip'):
        rid = b.get(R + 'embed')
        if rid in rid_to_media:
            imgs.append(rid_to_media[rid])
    paras.append({'text': text, 'imgs': imgs})

# ---------- 工具函数 ----------
def normalize_ws(s):
    """把不换行空格、零宽空格、普通空格、制表符统一为普通空格并去首尾"""
    return re.sub(r'[\s\u00a0\u200b]+', ' ', s).strip()

def clean_word(word):
    """清理单词标题：去掉 IPA 音标、词性后缀等，保留核心单词"""
    word = re.sub(r'\s*/[^/]*/\s*', ' ', word)
    word = re.sub(r'\s+(determiner|pronoun|noun|verb|adjective|adverb|preposition)\b.*$', '', word)
    return word.strip()

# ---------- 2. 单词标题（按文档顺序，含重复段落） ----------
KNOWN_HEADINGS = [
    'reluctant', 'in term of', 'empathize 和 emphasize', 'thought',
    'appropriate', 'stub', 'Sweep', 'Reply', 'dedicated', 'laundry',
    'authorize', 'authority', 'either determiner, pronoun', 'via', 'demand',
    '发生 单词对比', 'emerge', 'elapse', 'Network jitter', 'histogram',
    '-gram -gram1', 'swap', 'cyclic', 'focus', 'peek', 'boost',
    'solution', 'flavour (flavor)', 'emit', 'a few Vs few',
    'replication', 'suspend', 'Draw vs Plot', '容易消失，易损的',
    'in terms of',
    '英语中 在某个 phase 中 用什么介词', '语法习惯', '比较级汇总',
    '使用习惯', '沟通收集',
]

KNOWN_NORM = {normalize_ws(h).lower() for h in KNOWN_HEADINGS}

def match_heading(s):
    if s.lower() in KNOWN_NORM:
        return True
    no_ipa = re.sub(r'\s*/[^/]*/\s*$', '', s).strip()
    return no_ipa.lower() in KNOWN_NORM

heading_indices = []
for i, p in enumerate(paras):
    s = normalize_ws(p['text'])
    if match_heading(s):
        heading_indices.append(i)
heading_indices = sorted(set(heading_indices))

# ---------- 3. 分组内容 ----------
def split_words(entries):
    result = []
    for idx, hi in enumerate(entries):
        start = hi
        end = entries[idx + 1] if idx + 1 < len(entries) else len(paras)
        raw_word = normalize_ws(paras[hi]['text'])
        word = clean_word(raw_word)
        lines = []
        imgs = []
        for j in range(start, end):
            t = paras[j]['text'].strip()
            if t and normalize_ws(t) != raw_word:
                lines.append(t)
            imgs.extend(paras[j]['imgs'])
        result.append({'word': word, 'lines': lines, 'imgs': imgs})
    return result

entries = split_words(heading_indices)

# ---------- 4. 合并重复（文档后半部分重复了部分单词） ----------
seen = {}
deduped = []
for e in entries:
    key = e['word'].lower()
    if key in seen:
        seen[key]['imgs'] = list(dict.fromkeys(seen[key]['imgs'] + e['imgs']))
        if not seen[key]['lines'] and e['lines']:
            seen[key]['lines'] = e['lines']
    else:
        seen[key] = e
        deduped.append(seen[key])
entries = deduped

# ---------- 5. 图片重命名并复制 ----------
IMG_DIR = 'public/word-images'
os.makedirs(IMG_DIR, exist_ok=True)

def make_slug(word):
    """生成文件名 slug，中文用映射兜底"""
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', word.lower()).strip('-')
    if not slug:
        # 中文标题的英文兜底
        slug_map = {
            '容易消失，易损的': 'ephemeral-fragile',
            '英语中 在某个 phase 中 用什么介词': 'phase-preposition',
            '语法习惯': 'grammar',
            '比较级汇总': 'comparative-superlative',
            '使用习惯': 'usage',
            '沟通收集': 'communication',
            '发生 单词对比': 'happen-compare',
        }
        slug = slug_map.get(word, 'word')
    return slug

media_new_name = {}
counter = {}
for e in entries:
    for m in e['imgs']:
        base = os.path.basename(m)
        stem, ext = os.path.splitext(base)
        slug = make_slug(e['word'])
        counter[slug] = counter.get(slug, 0) + 1
        new_name = f"{slug}-{counter[slug]}{ext}"
        media_new_name[m] = new_name

for m, new_name in media_new_name.items():
    with open(os.path.join(IMG_DIR, new_name), 'wb') as f:
        f.write(z.read(m))

# ---------- 6. 生成结构化数据 ----------
def build_record(e):
    word = e['word']
    lines = e['lines']
    imgs = e['imgs']

    img_md = []
    for m in imgs:
        new_name = media_new_name.get(m)
        if new_name:
            img_md.append(f'![{word}](word-images/{new_name})')

    meaning = lines[0] if lines else ''
    examples = []
    notes = []
    for l in lines[1:]:
        # 含英文标点 + 中文的视为例句
        if re.search(r'[.!?]', l) and any('\u4e00' <= c <= '\u9fff' for c in l):
            examples.append(l)
        else:
            notes.append(l)

    if img_md:
        notes = img_md + notes

    return {
        'word': word,
        'meaning': meaning,
        'example': '\n'.join(examples),
        'note': '\n'.join(notes),
        'images': [media_new_name[m] for m in imgs if m in media_new_name],
    }

records = [build_record(e) for e in entries]

# 过滤掉完全空的条目（纯章节标题，无内容）
records = [r for r in records if r['meaning'].strip() or r['example'].strip() or r['note'].strip()]

# ---------- 7. 输出 JSON ----------
os.makedirs('data', exist_ok=True)
with open('data/words.json', 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

# ---------- 8. 输出 SQL 种子 ----------
def sql_escape(s):
    return s.replace("'", "''")

sql_lines = [
    "-- ============================================",
    "-- 单词种子数据（由 parse_words.py 生成）",
    "-- 在 Supabase SQL Editor 中执行",
    "-- user_id 已替换为实际用户 UUID",
    "-- ============================================",
    "",
]
for r in records:
    word = sql_escape(r['word'])
    meaning = sql_escape(r['meaning'])
    example = sql_escape(r['example'])
    note = sql_escape(r['note'])
    user_id_expr = f"'{USER_ID}'" if USER_ID != 'auth.uid()' else 'auth.uid()'
    sql_lines.append(
        f"insert into public.words (user_id, word, meaning, example, note, status) "
        f"values ({user_id_expr}, '{word}', '{meaning}', '{example}', '{note}', 'new');"
    )

with open('supabase/seed.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))

# ---------- 汇总输出 ----------
print(f"总段落数: {len(paras)}")
print(f"识别单词标题数: {len(entries)}")
print(f"提取图片数: {len(media_new_name)}")
print("\n=== 单词列表 ===")
for r in records:
    img_tag = f" [图片x{len(r['images'])}]" if r['images'] else ""
    print(f"  - {r['word']}{img_tag}")
