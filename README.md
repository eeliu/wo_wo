# 📖 单词记录本

一个个人单词记录工具：把不认识的单词写入网站，系统记录下来，支持搜索、筛选和复习状态管理。

## 技术栈

- **前端**：HTML + JavaScript + Vite
- **托管**：Cloudflare Pages
- **数据**：Supabase (PostgreSQL)
- **认证**：Supabase Auth（GitHub OAuth）

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Supabase

1. 前往 [supabase.com](https://supabase.com) 创建一个新项目
2. 在 Supabase Dashboard → **SQL Editor** 中运行 [`supabase/schema.sql`](supabase/schema.sql)（创建表 + RLS 安全策略）
3. 在 Supabase Dashboard → **SQL Editor** 中运行 [`supabase/storage.sql`](supabase/storage.sql)（创建图片存储桶 + 权限策略）
4. 在 **Project Settings → API** 获取 `Project URL` 和 `anon public` key
5. 复制 `.env.example` 为 `.env` 并填入：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. 配置 GitHub OAuth 登录

1. 前往 [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**
2. 填写：
   - **Application name**：单词记录本
   - **Homepage URL**：`http://localhost:5173`（本地）或你的线上地址
   - **Authorization callback URL**：`https://<你的项目>.supabase.co/auth/v1/callback`
3. 创建后复制 **Client ID** 和 **Client Secret**（Client Secret 保密，不要提交到 Git）
4. 回到 Supabase Dashboard → **Authentication → Providers** → 启用 **GitHub**，填入 Client ID 和 Client Secret
5. 在 **Authentication → URL Configuration** 中，把 `http://localhost:5173` 加入 **Redirect URLs**

### 4. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173`，点击「使用 GitHub 登录」即可。

## 构建

```bash
npm run build
```

产物输出到 `dist/` 目录。

## 部署到 Cloudflare Pages

### 方式一：通过 Git 集成（推荐）

1. 将代码推送到 GitHub / GitLab 仓库
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. 进入 **Workers & Pages → Create → Pages → Connect to Git**
4. 选择你的仓库，配置：
   - **Framework preset**：`Vite`
   - **Build command**：`npm run build`
   - **Build output directory**：`dist`
5. 在 **Settings → Environment variables** 中添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. 点击 **Save and Deploy**

### 方式二：Wrangler CLI

```bash
npm install -g wrangler
wrangler login

# 部署（需在部署环境设置环境变量）
wrangler pages deploy dist
```

### 绑定自定义域名（可选）

在 Pages 项目 → **Custom domains** 中添加你的域名。如果域名也在 Cloudflare 上，会自动配置 DNS 和 HTTPS。

## 安全说明

本项目采用 **Supabase Auth + Row Level Security (RLS)** 保证数据安全：

1. **RLS 强制开启**：`words` 表启用了行级安全，每个用户只能通过 `auth.uid() = user_id` 访问自己的数据。即使拿到 anon key 也无法读取他人数据。
2. **前端只用 anon key**：`service_role` key（拥有全部权限）绝不暴露给前端。
3. **环境变量隔离**：Supabase 密钥通过 `.env` 管理，且已加入 `.gitignore`，不会提交到仓库。
4. **HTTPS**：Cloudflare Pages 自动提供 HTTPS 加密。
5. **OAuth 安全**：登录使用 GitHub OAuth，应用不接触密码，密码由 GitHub 管理。GitHub 的 Client Secret 只配置在 Supabase 后台，绝不写入前端。

> ⚠️ **重要**：切勿将 `service_role` key 写入前端代码或提交到 Git 仓库，否则任何人都能绕过 RLS 直接操作数据库。

## 数据模型

### words 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| user_id | uuid | 所属用户（关联 auth.users） |
| word | text | 单词 |
| meaning | text | 释义 |
| example | text | 例句（可选） |
| note | text | 备注（可选） |
| status | text | new / learning / mastered |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

## 功能

- ✅ GitHub OAuth 一键登录 / 登出
- ✅ 添加、编辑、删除单词
- ✅ 按状态筛选（新词 / 学习中 / 已掌握）
- ✅ 关键词搜索
- ✅ 一键标记"已掌握"
- ✅ 数据按用户隔离
- ✅ Markdown 编辑（加粗、斜体、列表、引用、代码等）
- ✅ 编辑/预览双模式
- ✅ 图片上传（Supabase Storage，插入到 Markdown 中显示）
- ✅ 左侧时间导航栏（按今天/昨天/本周/本月/月份快速回顾）
