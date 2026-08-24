# 单词记录工具 — 项目计划

## 项目概述

一个个人使用的单词记录工具。用户把不认识的单词写入网站，系统记录下来，方便日后查看、搜索和复习。

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | 纯 HTML + JavaScript + Vite | 轻量、无框架依赖、易于维护 |
| 托管 | Cloudflare Pages | 免费、全球 CDN、自动 HTTPS |
| 数据 | Supabase (PostgreSQL) | 免费额度、自动生成 REST API |
| 认证 | Supabase Auth（邮箱+密码） | 标准、安全、可扩展 |

## 安全验证方案（已决定）

采用 **Supabase Auth 邮箱+密码登录**，理由：
- 数据隔离：每个用户只能看到自己的单词
- 标准安全：Supabase 处理密码哈希、JWT、会话
- 可扩展：未来如需多人使用，无需改动架构
- 配合 **Row Level Security (RLS)** 策略，保证数据库层安全

### 安全要点
1. **RLS 强制开启**：所有表开启行级安全，`user_id = auth.uid()` 才能访问
2. **前端不暴露 service_role key**：只用 anon key（受 RLS 保护）
3. **环境变量管理**：Supabase URL 和 anon key 通过 `.env` 管理，不提交到 Git
4. **HTTPS**：Cloudflare 自动提供

## 数据模型

### 表：words
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK, default gen_random_uuid()) | 主键 |
| user_id | uuid (FK -> auth.users) | 所属用户 |
| word | text | 单词 |
| meaning | text | 释义 |
| example | text (可空) | 例句 |
| note | text (可空) | 备注 |
| status | text (default 'new') | 状态：new / learning / mastered |
| created_at | timestamptz (default now()) | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### RLS 策略
```sql
CREATE POLICY "Users can view own words" ON words
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own words" ON words
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own words" ON words
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own words" ON words
  FOR DELETE USING (auth.uid() = user_id);
```

## 功能清单

1. **用户认证**
   - 注册（邮箱+密码）
   - 登录 / 登出
   - 会话保持

2. **单词记录**
   - 添加单词（word, meaning, example, note）
   - 编辑单词
   - 删除单词

3. **列表与筛选**
   - 按状态筛选（全部 / 新词 / 学习中 / 已掌握）
   - 关键词搜索
   - 按时间排序

4. **复习状态**
   - 标记状态：new → learning → mastered

## 项目结构

```
bei_bei_recite/
├── index.html              # 主页面
├── package.json            # 依赖与脚本
├── vite.config.js          # Vite 配置
├── .env.example            # 环境变量示例
├── .gitignore
├── src/
│   ├── main.js             # 入口，初始化 Supabase
│   ├── supabase.js         # Supabase 客户端
│   ├── auth.js             # 认证逻辑
│   ├── words.js            # 单词 CRUD 逻辑
│   └── style.css           # 样式
├── supabase/
│   └── schema.sql          # 数据库表 + RLS 策略
└── README.md               # 部署与使用说明
```

## 部署流程（Cloudflare Pages）

1. 在 Supabase 创建项目，运行 `supabase/schema.sql`
2. 获取 Supabase URL 和 anon key
3. 本地配置 `.env`
4. 推送到 GitHub 仓库
5. Cloudflare Pages 连接仓库，配置构建命令 `npm run build`，输出目录 `dist`
6. 设置环境变量（Supabase URL、anon key）
7. 部署完成，绑定自定义域名（可选）

## 里程碑

- [ ] M1: 项目骨架 + Supabase 客户端
- [ ] M2: 数据库 schema + RLS
- [ ] M3: 认证功能
- [ ] M4: 单词 CRUD + 界面
- [ ] M5: 搜索筛选 + 状态管理
- [ ] M6: 部署文档 + 上线
