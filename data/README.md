# 单词数据导入说明

本目录包含从 `Words.docx` 拆分出的结构化单词数据。

## 数据来源

`Words.docx`（约 55,000 字符，1161 段落）记录了 40 个单词/短语及其详细解释（词根词缀、联想、语境例句、近反义词等），并包含 11 张配图。

## 文件说明

```
data/
  words.json               # 结构化单词数据（40 条）
public/
  word-images/             # 从 docx 提取的 11 张配图
supabase/
  seed.sql                 # 可导入 Supabase 的 SQL 种子文件
scripts/
  parse_words.py           # 解析脚本（可重复运行）
```

## 数据格式

`data/words.json` 是一个数组，每条记录对应项目 `words` 表的一行：

```json
{
  "word": "reluctant",          // 单词/短语
  "meaning": "词根词缀记忆法...", // 释义
  "example": "He was reluctant...", // 例句（多行，\n 分隔）
  "note": "re-: 前缀...",        // 备注（含 Markdown 图片引用）
  "images": []                   // 关联的图片文件名
}
```

- `meaning` / `example` / `note` 均支持 Markdown（项目用 `marked` + `DOMPurify` 渲染）。
- 配图以 Markdown 语法 `![描述](word-images/文件名)` 嵌入 `note` 字段开头。
- 图片存放在 `public/word-images/`，Vite 构建后会作为静态资源输出到 `dist/word-images/`。

## 图片与单词对应关系

| 单词 | 图片 |
|------|------|
| stub | stub-1.png, stub-2.jpeg |
| Sweep | sweep-1.png |
| peek | peek-1.jpeg |
| 比较级汇总 | comparative-superlative-1~7.jpeg |

## 如何导入到 Supabase

### 方式一：SQL 种子文件（推荐）

1. 打开 Supabase Dashboard → SQL Editor
2. 打开 `supabase/seed.sql`
3. 将文件中的 `auth.uid()` 替换为你的实际用户 UUID（在 Authentication → Users 中查看）
4. 执行

> 注意：`auth.uid()` 只有在已登录的会话中才有效。若在 SQL Editor 直接执行，
> 需手动替换为具体的 UUID，例如：
> `insert into public.words (user_id, ...) values ('你的UUID', ...);`

## 图片显示方案（方案 A：静态资源）

图片存放在 `public/word-images/`，作为 Vite 静态资源随项目部署：

1. 构建：`npm run build` → 图片自动复制到 `dist/word-images/`
2. 部署 `dist/` 到 Cloudflare Pages
3. 图片 URL 为 `https://你的域名/word-images/xxx.png`
4. seed.sql 中的 Markdown 引用 `![描述](word-images/xxx.png)` 为相对路径，
   浏览器会基于页面 URL 解析为静态资源路径，**无需修改 seed.sql**

> 前提：应用部署在站点根路径（如 `https://域名/`）。若部署在子路径，
> 相对路径会解析错误，需改为绝对 URL。

### 方式二：通过应用界面手动添加

图片需先上传到 Supabase Storage 的 `word-images` bucket，然后在 Markdown 中引用。

## 重新生成

修改 `scripts/parse_words.py` 后运行：

```bash
python3 scripts/parse_words.py
```

会重新生成 `data/words.json`、`public/word-images/` 和 `supabase/seed.sql`。
