# 模块 A 工作明细：资料接入层

更新时间：2026-04-22

本文档列出模块 A 负责人的全部开发任务。契约定义见 [contract.md](./contract.md)。

## 1. 概述

模块 A 是整条管线的起点，负责把用户的原始资料（文件、Git 仓库、补充文本）接进来，统一管理，产出 `SourceAssetSet` 交给模块 B。

**核心交付**：用户能创建项目、上传文件、接入 Git 仓库、录入补充文本，并查看和管理所有资料。

## 2. 前端任务

### 2.1 页面

| # | 页面 | 路由建议 | 说明 |
|---|---|---|---|
| 1 | 项目首页 | `/` | 项目列表 + 新建项目入口 |
| 2 | 项目详情页 | `/projects/[id]` | 该项目的资料列表 + 操作入口 |
| 3 | 文件上传页 | `/projects/[id]/upload` | 拖拽/点击上传文件 |
| 4 | 补充文本页 | `/projects/[id]/notes` | 录入和编辑补充文本 |

### 2.2 组件

| # | 组件 | 说明 |
|---|---|---|
| 1 | `ProjectCard` | 项目卡片，显示标题、创建时间、状态 |
| 2 | `ProjectCreateDialog` | 新建项目弹窗（输入标题即可） |
| 3 | `FileUploader` | 拖拽上传组件，支持 PDF/DOCX/PNG/JPG，显示上传进度 |
| 4 | `AssetList` | 资料列表，区分文件/Git/文本类型，支持删除 |
| 5 | `GitRepoForm` | Git 仓库 URL 输入表单 + 校验 |
| 6 | `NoteEditor` | 补充文本编辑器（textarea + label 标签） |
| 7 | `AssetDetail` | 单个资料的详情展示（文件名、大小、上传时间等） |

### 2.3 前端技术要点

- 文件上传用 `multipart/form-data`，显示上传进度条
- 拖拽上传用 HTML5 Drag and Drop API 或 react-dropzone
- 文件大小限制 v1 为 20MB，前端先校验，后端再校验
- Git URL 前端正则校验格式（`https://github.com/...`），后端再做连通性校验
- 删除操作需要二次确认弹窗
- 参考 [ui-design-system.md](../../01-product/ui-design-system.md) 的三栏布局：左侧项目列表、中间上传/详情区、右侧资料属性

## 3. 后端任务

### 3.1 API 端点（15 个）

**项目 CRUD（5 个）**：

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 1 | POST | `/api/v1/projects` | 创建项目 |
| 2 | GET | `/api/v1/projects` | 项目列表 |
| 3 | GET | `/api/v1/projects/{project_id}` | 项目详情 |
| 4 | PUT | `/api/v1/projects/{project_id}` | 更新项目 |
| 5 | DELETE | `/api/v1/projects/{project_id}` | 删除项目 |

**文件资料（3 个）**：

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 6 | POST | `/api/v1/assets/upload` | 上传文件（multipart） |
| 7 | GET | `/api/v1/assets?project_id={id}` | 项目资料列表 |
| 8 | DELETE | `/api/v1/assets/{asset_id}` | 删除资料 |

**单个资料（1 个）**：

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 9 | GET | `/api/v1/assets/{asset_id}` | 资料详情 |

**Git 仓库（2 个）**：

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 10 | POST | `/api/v1/assets/git` | 接入 Git 仓库 |
| 11 | PUT | `/api/v1/assets/git/{asset_id}` | 更新 Git 仓库地址 |

**补充文本（4 个）**：

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 12 | POST | `/api/v1/assets/notes` | 录入补充文本 |
| 13 | GET | `/api/v1/assets/notes?project_id={id}` | 补充文本列表 |
| 14 | PUT | `/api/v1/assets/notes/{asset_id}` | 编辑补充文本 |
| 15 | DELETE | `/api/v1/assets/notes/{asset_id}` | 删除补充文本 |

### 3.2 后端服务

| # | 服务 | 说明 |
|---|---|---|
| 1 | `ProjectService` | 项目 CRUD 业务逻辑 |
| 2 | `AssetService` | 资料统一管理（文件/Git/文本） |
| 3 | `FileStorageService` | 文件存储（v1 本地文件系统，路径 `local://uploads/{project_id}/{filename}`） |
| 4 | `SourceAssetSetBuilder` | 聚合项目的所有资料，产出 `SourceAssetSet` JSON |

### 3.3 后端技术要点

- 文件存储 v1 用本地文件系统：`uploads/{project_id}/{filename}`
- 文件类型校验：只接受 `.pdf`, `.docx`, `.png`, `.jpg`, `.jpeg`
- 文件大小校验：≤ 20MB
- Git URL 校验：格式校验 + 可选的连通性检测
- 删除项目时级联删除所有关联资料和文件
- `SourceAssetSet` 不是数据库表，而是根据项目资料动态构建的 JSON 视图

## 4. 数据库表

| 表名 | 关键字段 | 说明 |
|---|---|---|
| `projects` | `project_id`, `title`, `status`, `current_revision`, `created_at` | 项目 |
| `assets` | `asset_id`, `project_id`, `type` (resume_pdf/resume_docx/resume_image/git_repo/note), `uri`, `content`, `metadata` (JSON), `created_at` | 资料统一表 |

- `type` 区分资料类型
- 文件类资料：`uri` 存文件路径，`metadata` 存文件名、大小等
- Git 类资料：`uri` 存仓库 URL
- 文本类资料：`content` 存文本内容，`metadata.label` 存标签

## 5. 测试任务

### 5.1 后端单元测试

| # | 测试 | 说明 |
|---|---|---|
| 1 | 项目 CRUD | 创建、查询、更新、删除项目 |
| 2 | 文件上传 | 上传合法文件、拒绝非法格式、拒绝超大文件 |
| 3 | Git 接入 | 合法 URL、非法 URL |
| 4 | 补充文本 | 增删改查 |
| 5 | SourceAssetSet 构建 | 验证产出 JSON 符合 schema |
| 6 | 级联删除 | 删除项目时关联资料是否清理 |

### 5.2 前端测试

| # | 测试 | 说明 |
|---|---|---|
| 1 | 项目创建表单 | 输入标题 → 提交 → 列表刷新 |
| 2 | 文件上传 | 拖拽上传、点击上传、进度条、格式校验提示 |
| 3 | 资料列表 | 展示不同类型资料、删除确认 |

### 5.3 Mock 策略

- 不依赖 B/C/D/E 任何服务
- 用 `fixtures/source_asset_set.json` 验证产出格式
- 本地放 `test_fixtures/sample_resume.pdf` 等测试文件
- 数据库用 SQLite 内存库即可

## 6. 交付 Checklist

- [ ] 前端：4 个页面 + 7 个组件
- [ ] 后端：15 个 API 端点
- [ ] 数据库：2 张表（projects, assets）
- [ ] 测试：6 个后端单元测试 + 3 个前端测试
- [ ] 产出 fixture：`fixtures/source_asset_set.json` 符合 schema
- [ ] API 响应格式符合 [api-conventions.md](../../01-product/api-conventions.md)
- [ ] UI 风格符合 [ui-design-system.md](../../01-product/ui-design-system.md)
- [ ] 错误码使用 01xxx 范围
