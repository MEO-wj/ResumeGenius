# 模块 E 工作明细：状态管理与渲染导出

更新时间：2026-04-22

本文档列出模块 E 负责人的全部开发任务。契约定义见 [contract.md](./contract.md)。

## 1. 概述

模块 E 是整条管线的终点和状态中枢，负责两件大事：一是接收 Patch 并原子性地应用到 ResumeDraftState（唯一修改状态的入口），二是将草稿解算为确定性对象并编译为 PDF。

**核心交付**：C/D 的 Patch 能正确应用（含版本冲突检测），ResumeDraftState 能解算为 ResolvedResumeSpec 并通过 LaTeX 编译为 PDF。

## 2. 前端任务

### 2.1 页面

| # | 页面 | 路由建议 | 说明 |
|---|---|---|---|
| 1 | 预览页 | `/projects/[id]/preview` | PDF 预览 + 版本历史 + 导出操作 |
| 2 | 版本历史页 | `/projects/[id]/revisions` | 完整版本列表，支持回退 |

### 2.2 组件

| # | 组件 | 说明 |
|---|---|---|
| 1 | `PdfPreview` | PDF 预览组件，用 iframe 或 react-pdf 渲染 |
| 2 | `RevisionList` | 版本历史列表：revision 号 + 来源 (agent/manual) + 摘要 + 时间 |
| 3 | `RevisionItem` | 单条版本记录，点击可查看该版本草稿 |
| 4 | `RollbackDialog` | 回退确认弹窗：「确定回退到版本 X？」 |
| 5 | `ExportButton` | 导出 PDF 按钮，触发编译 + 下载 |
| 6 | `CompileStatus` | 编译状态指示：编译中 / 编译成功 / 编译失败 |
| 7 | `TaskPoller` | 通用异步任务轮询组件（同模块 B） |

### 2.3 前端技术要点

- PDF 预览用 iframe 加载 PDF URL，或用 `react-pdf` 渲染
- 编译是异步任务，前端轮询 task 状态
- 版本历史按时间倒序展示
- 回退操作需要二次确认弹窗
- 导出按钮点击后显示编译状态，编译完成后自动触发下载
- 预览可跟随当前 revision，切换版本时重新加载

## 3. 后端任务

### 3.1 API 端点（9 个）

**状态管理（4 个）**：

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 1 | POST | `/api/v1/render/apply-patch` | 应用 Patch |
| 2 | GET | `/api/v1/render/drafts/{draft_id}` | 获取最新草稿状态 |
| 3 | GET | `/api/v1/render/drafts/{draft_id}/revisions` | 获取版本历史 |
| 4 | POST | `/api/v1/render/drafts/{draft_id}/rollback` | 回退到指定版本 |

**渲染导出（5 个）**：

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 5 | POST | `/api/v1/render/resolve` | 触发解算（异步） |
| 6 | GET | `/api/v1/render/tasks/{task_id}` | 查询解算/编译状态 |
| 7 | POST | `/api/v1/render/preview` | 生成预览 |
| 8 | POST | `/api/v1/render/pdf` | 触发 PDF 编译（异步） |
| 9 | GET | `/api/v1/render/pdfs/{task_id}/download` | 下载 PDF |

### 3.2 后端服务

| # | 服务 | 说明 |
|---|---|---|
| 1 | `PatchEngine` | Patch 应用引擎：校验 → 执行 → 生成新状态 |
| 2 | `PatchValidator` | Patch 校验：base_revision 匹配、TargetRef 存在、数值范围 |
| 3 | `RevisionManager` | 版本管理：记录 RevisionRecord、支持回退 |
| 4 | `ResolveEngine` | 解算引擎：ResumeDraftState → ResolvedResumeSpec |
| 5 | `LaTeXService` | LaTeX 模板填充 + 编译 |
| 6 | `TemplateManager` | LaTeX 模板管理（不同 theme 对应不同 .tex 模板） |

### 3.3 Patch 应用流程（核心逻辑）

```
接收 PatchEnvelope
       │
       ▼
  base_revision 校验 ── 失败 ──▶ 返回 05005 版本冲突
       │
     成功
       │
       ▼
  逐个校验 TargetRef ── 失败 ──▶ 返回 05006 节点不存在
       │
     成功
       │
       ▼
  逐个校验 value 范围 ── 失败 ──▶ 返回 05006 值越界
       │
     成功
       │
       ▼
  执行全部 ops（内存中）── 失败 ──▶ 回滚，返回 05006
       │
     成功
       │
       ▼
  生成新 ResumeDraftState (revision + 1)
       │
       ▼
  写入 RevisionRecord
       │
       ▼
  持久化新 ResumeDraftState
       │
       ▼
  返回成功
```

关键：**整包原子性**，任一 op 失败则整包回滚。

### 3.4 解算流程

ResumeDraftState → ResolvedResumeSpec：

1. 读取当前 ResumeDraftState
2. `style` 中意图型参数映射为确定性数值（如 theme → 具体颜色、字号映射）
3. `content` 中 section 结构展平为 block 列表（按 visible 过滤、按顺序排列）
4. 补全页面参数（margin、page size）
5. 生成 `render_tokens`（LaTeX 模板变量映射）
6. 输出 ResolvedResumeSpec

### 3.5 LaTeX 渲染流程

1. 读取 ResolvedResumeSpec
2. 根据 `theme` 选择 LaTeX 模板
3. 用 Jinja2 或字符串替换填充模板变量
4. 写入 `.tex` 文件到临时目录
5. 调用 TeX Live（`xelatex`）编译
6. 编译成功 → 返回 PDF 路径；失败 → 记录日志，返回错误

### 3.6 后端技术要点

- Patch 校验是核心安全逻辑，必须严格按 [patch-schema.md](../../02-data-models/patch-schema.md) 的校验规则执行
- 版本回退不是删除记录，而是从 RevisionRecord 中找到目标版本的 ResumeDraftState 快照恢复
- LaTeX 编译需要 TeX Live 环境，v1 可用预设 PDF mock 编译结果
- ResolvedResumeSpec 必须是完全确定性的，不允许有未定义的样式参数
- 异步任务（resolve、pdf 编译）用 FastAPI BackgroundTasks

## 4. 数据库表

| 表名 | 关键字段 | 说明 |
|---|---|---|
| `revisions` | `revision`, `draft_id`, `patch_id`, `source` (agent/manual/system), `summary`, `snapshot` (JSON), `created_at` | 版本记录 |
| `render_tasks` | `task_id`, `draft_id`, `type` (resolve/pdf_compile), `status` (pending/processing/done/failed), `result_path`, `error_message`, `created_at` | 渲染任务 |
| `pdfs` | `pdf_id`, `draft_id`, `revision`, `file_path`, `file_size`, `created_at` | PDF 文件记录 |

- `revisions.snapshot` 存该版本的完整 ResumeDraftState JSON 快照（用于回退）
- `render_tasks.result_path` 存编译产物路径（PDF 或 ResolvedResumeSpec JSON）
- 模块 E 同时读写 `drafts` 表（由模块 B 创建，E 更新 revision）

## 5. 测试任务

### 5.1 后端单元测试

| # | 测试 | 说明 |
|---|---|---|
| 1 | Patch 应用（agent） | 用 `fixtures/patch_agent.json` 测试完整应用流程 |
| 2 | Patch 应用（manual） | 用 `fixtures/patch_manual.json` 测试完整应用流程 |
| 3 | 版本冲突 | 连续两个 Patch 使用同一 base_revision，第二个应失败 |
| 4 | TargetRef 不存在 | Patch 中引用不存在的 section_id/item_id |
| 5 | 数值越界 | 样式参数超出允许范围 |
| 6 | 原子性 | 多 op Patch 中某个 op 失败，验证全部回滚 |
| 7 | 版本历史 | 应用多个 Patch 后验证 revision 列表正确 |
| 8 | 回退 | 回退到旧版本，验证 ResumeDraftState 恢复正确 |
| 9 | 解算 | 验证 ResumeDraftState → ResolvedResumeSpec 映射正确 |
| 10 | 解算参数确定性 | 验证所有样式参数都被数值化，无遗漏 |
| 11 | LaTeX 模板填充 | 验证模板变量替换正确（可不用 TeX Live，只检查 .tex 内容） |
| 12 | PDF 编译 | 如有 TeX Live 环境，测试完整编译流程 |

### 5.2 前端测试

| # | 测试 | 说明 |
|---|---|---|
| 1 | PDF 预览 | 用预设 PDF 文件渲染预览 |
| 2 | 版本历史列表 | 展示多个版本记录 |
| 3 | 回退确认 | 点击回退 → 弹窗确认 → 回退成功 |
| 4 | 导出下载 | 点击导出 → 编译状态 → 下载 PDF |

### 5.3 Mock 策略

- 不依赖 C/D 的服务：直接读 `fixtures/patch_agent.json` 和 `fixtures/patch_manual.json`
- 不依赖 B 的服务：直接读 `fixtures/resume_draft_state.json` 作为初始草稿
- LaTeX 编译可用预设 PDF 文件 mock，先只测解算输出
- 数据库用 SQLite 内存库
- 产出 fixture：`fixtures/resolved_resume_spec.json`

## 6. 交付 Checklist

- [ ] 前端：2 个页面 + 7 个组件
- [ ] 后端：9 个 API 端点
- [ ] 后端服务：6 个核心服务（PatchEngine + Validator + RevisionManager + ResolveEngine + LaTeXService + TemplateManager）
- [ ] 数据库：3 张表（revisions, render_tasks, pdfs）+ 读写 drafts 表
- [ ] LaTeX 模板：至少 1 个基础模板（clean_light 主题）
- [ ] 测试：12 个后端单元测试 + 4 个前端测试
- [ ] 产出 fixture：`fixtures/resolved_resume_spec.json` 符合 schema
- [ ] Patch 校验逻辑严格对齐 patch-schema.md
- [ ] 错误码使用 05xxx 范围
