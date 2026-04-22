# 模块 B 工作明细：解析与初稿生成

更新时间：2026-04-22

本文档列出模块 B 负责人的全部开发任务。契约定义见 [contract.md](./contract.md)。

## 1. 概述

模块 B 接收 A 产出的 `SourceAssetSet`，对各类资料进行解析和结构化，产出 `EvidenceSet` 和初始 `ResumeDraftState`。这是整条管线中最重解析的模块。

**核心交付**：用户上传的简历文件能被正确解析为结构化证据，并自动生成可编辑的初始简历草稿。

## 2. 前端任务

### 2.1 页面

| # | 页面 | 路由建议 | 说明 |
|---|---|---|---|
| 1 | 解析进度页 | `/projects/[id]/parsing` | 显示解析任务状态（轮询 task） |
| 2 | 证据列表页 | `/projects/[id]/evidences` | 查看解析出的证据，可删除错误证据 |
| 3 | 初稿预览页 | `/projects/[id]/draft-preview` | 初稿生成后的确认页，展示结构化简历 |

### 2.2 组件

| # | 组件 | 说明 |
|---|---|---|
| 1 | `ParseProgress` | 解析进度条 + 状态文字（pending → processing → done/failed） |
| 2 | `EvidenceCard` | 单条证据卡片：类型标签 + 标题 + 内容 + 置信度 |
| 3 | `EvidenceList` | 证据列表，按 kind 分组展示，支持删除 |
| 4 | `DraftPreview` | 初稿结构化预览（section 卡片布局，不是 PDF 预览） |
| 5 | `TaskPoller` | 通用异步任务轮询组件（查询 task 状态直到完成） |

### 2.3 前端技术要点

- 解析和初稿生成都是异步任务，前端用轮询 `GET /tasks/{task_id}` 方式获取状态
- 轮询间隔建议 2 秒，任务完成后停止
- 证据卡片按 `kind`（profile/work_experience/education/skill/...）分组展示
- 置信度低于 0.7 的证据用警告色标注
- 初稿预览页可展示为 section 卡片列表，不依赖 PDF 渲染
- 用 `fixtures/resume_draft_state.json` 即可渲染预览，不需要真实后端

## 3. 后端任务

### 3.1 API 端点（8 个）

**解析任务（3 个）**：

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 1 | POST | `/api/v1/parsing/parse` | 触发解析（异步） |
| 2 | POST | `/api/v1/parsing/reparse` | 重新解析（重试） |
| 3 | GET | `/api/v1/parsing/tasks/{task_id}` | 查询解析任务状态 |

**证据管理（3 个）**：

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 4 | GET | `/api/v1/parsing/evidences?project_id={id}` | 证据列表 |
| 5 | GET | `/api/v1/parsing/evidences/{evidence_id}` | 单条证据详情 |
| 6 | DELETE | `/api/v1/parsing/evidences/{evidence_id}` | 删除错误证据 |

**初稿生成（2 个）**：

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 7 | POST | `/api/v1/parsing/generate-draft` | 从证据生成初稿（异步） |
| 8 | GET | `/api/v1/parsing/drafts/{draft_id}` | 获取草稿状态 |

### 3.2 后端服务

| # | 服务 | 说明 |
|---|---|---|
| 1 | `ParsingService` | 解析任务编排（选策略、分发、汇总结果） |
| 2 | `PdfParser` | PyMuPDF 解析 PDF，提取文本块和布局信息 |
| 3 | `DocxParser` | python-docx 解析 DOCX，提取段落/表格/样式 |
| 4 | `ImageParser` | PaddleOCR 解析图片，含 layout analysis |
| 5 | `GitExtractor` | clone 仓库 → 抽 README + 项目名 + 技术栈 + 目录结构 |
| 6 | `EvidenceBuilder` | 解析结果 → EvidenceSet（归一化、去重、置信度评估） |
| 7 | `DraftGenerator` | EvidenceSet → ResumeDraftState（可能调 AI） |

### 3.3 后端技术要点

- 异步任务用 FastAPI BackgroundTasks，后续可升级 worker+queue
- 解析策略选择：根据文件类型自动选择 parser
- PDF 低置信度时自动降级到 OCR
- Evidence 的 `kind` 类型：profile / work_experience / education / skill / project_summary / award / github_signal
- 初稿生成可能需要调 AI（用 Provider Adapter 封装），v1 可用规则模板替代
- 解析结果持久化到 evidence 表，初稿持久化到 draft 表

## 4. 数据库表

| 表名 | 关键字段 | 说明 |
|---|---|---|
| `parse_tasks` | `task_id`, `project_id`, `status` (pending/processing/done/failed), `error_message`, `created_at` | 解析任务 |
| `evidences` | `evidence_id`, `project_id`, `source_asset_id`, `kind`, `title`, `content`, `confidence`, `created_at` | 结构化证据 |
| `draft_tasks` | `task_id`, `project_id`, `status`, `created_at` | 初稿生成任务 |
| `drafts` | `draft_id`, `project_id`, `revision`, `content` (JSON), `style` (JSON), `meta` (JSON), `created_at` | 简历草稿 |

- `drafts.content` / `drafts.style` / `drafts.meta` 用 JSON 字段存储 ResumeDraftState 的三部分
- `drafts.revision` 初始为 1，后续由模块 E 管理

## 5. 测试任务

### 5.1 后端单元测试

| # | 测试 | 说明 |
|---|---|---|
| 1 | PDF 解析 | 用 `test_fixtures/sample_resume.pdf` 测试文本提取 |
| 2 | DOCX 解析 | 用 `test_fixtures/sample_resume.docx` 测试段落/表格提取 |
| 3 | 图片 OCR | 用 `test_fixtures/sample_resume.png` 测试 OCR（需安装 PaddleOCR） |
| 4 | Git 抽取 | 用公开仓库测试 README + 技术栈提取 |
| 5 | Evidence 构建 | 验证产出 EvidenceSet 符合 schema |
| 6 | 初稿生成 | 验证产出 ResumeDraftState 符合 schema，sections 结构正确 |
| 7 | 低置信度降级 | 模拟 PDF 解析低置信度，验证是否降级到 OCR |
| 8 | 证据删除 | 删除证据后列表更新 |
| 9 | 重新解析 | reparse 生成新 task，旧证据可选保留 |

### 5.2 前端测试

| # | 测试 | 说明 |
|---|---|---|
| 1 | 解析进度展示 | 轮询 task 状态，状态文字和进度条正确更新 |
| 2 | 证据列表 | 按 kind 分组展示，低置信度警告色 |
| 3 | 初稿预览 | 用 mock JSON 渲染 section 卡片 |

### 5.3 Mock 策略

- 不依赖 A 的服务：直接读 `fixtures/source_asset_set.json`
- AI 调用用 mock 替代：返回预设的初稿 JSON
- 不需要 C/D/E 的服务
- 产出两个 fixture：`fixtures/evidence_set.json` 和 `fixtures/resume_draft_state.json`
- 本地测试文件放 `test_fixtures/`：`sample_resume.pdf`, `sample_resume.docx`, `sample_resume.png`

## 6. 交付 Checklist

- [ ] 前端：3 个页面 + 5 个组件
- [ ] 后端：8 个 API 端点
- [ ] 后端服务：7 个核心服务（4 个解析器 + 1 个编排 + 1 个证据构建 + 1 个初稿生成）
- [ ] 数据库：4 张表（parse_tasks, evidences, draft_tasks, drafts）
- [ ] 测试：9 个后端单元测试 + 3 个前端测试
- [ ] 产出 fixture：`evidence_set.json` + `resume_draft_state.json` 符合 schema
- [ ] 解析策略覆盖：PDF / DOCX / 图片 / Git 四种类型
- [ ] 错误码使用 02xxx 范围
