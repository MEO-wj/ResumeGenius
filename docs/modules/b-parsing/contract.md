# 模块 B 契约：解析与初稿生成

## 1. 角色定义

**负责**：

- PDF / DOCX / 图片文件解析
- Git 仓库信息抽取
- 结构化证据归一化
- 从证据生成初始 `ResumeDraftState`

**不负责**：

- 文件上传和存储（A 的事）
- AI 对话编辑（C 的事）
- 人工工作台编辑（D 的事）
- 渲染和 PDF 导出（E 的事）

## 2. 输入契约

消费模块 A 产出的 `SourceAssetSet`。Schema 见 [core-data-model.md](../../02-data-models/core-data-model.md) §3。

Mock fixture：`fixtures/source_asset_set.json`

## 3. 输出契约

产出两份数据：

### 3.1 EvidenceSet

Schema 见 [core-data-model.md](../../02-data-models/core-data-model.md) §4。

Mock fixture：`fixtures/evidence_set.json`

### 3.2 ResumeDraftState

Schema 见 [core-data-model.md](../../02-data-models/core-data-model.md) §5。

Mock fixture：`fixtures/resume_draft_state.json`

这是整个系统的**核心对象**，C、D、E 三个模块都消费它。

## 4. API 端点

遵循 [api-conventions.md](../../01-product/api-conventions.md)。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/parsing/parse` | 触发解析（异步） |
| POST | `/api/v1/parsing/reparse` | 重新解析（重试） |
| GET | `/api/v1/parsing/tasks/{task_id}` | 查询解析状态 |
| GET | `/api/v1/parsing/evidences?project_id={id}` | 获取证据列表 |
| GET | `/api/v1/parsing/evidences/{evidence_id}` | 获取单条证据详情 |
| DELETE | `/api/v1/parsing/evidences/{evidence_id}` | 删除错误证据 |
| POST | `/api/v1/parsing/generate-draft` | 从证据生成初稿（异步） |
| GET | `/api/v1/parsing/drafts/{draft_id}` | 获取草稿状态 |

### 关键端点详情

#### POST /api/v1/parsing/parse

```
Request:
{
  "project_id": "proj_01",
  "asset_ids": ["asset_01"]
}

Response:
{
  "code": 0,
  "data": {
    "task_id": "task_parse_01",
    "status": "pending"
  }
}
```

#### POST /api/v1/parsing/reparse

```
Request:
{
  "project_id": "proj_01",
  "asset_ids": ["asset_01"],
  "reason": "previous_parse_failed"
}

Response:
{
  "code": 0,
  "data": {
    "task_id": "task_parse_02",
    "status": "pending"
  }
}
```

#### GET /api/v1/parsing/evidences/{evidence_id}

```
Response:
{
  "code": 0,
  "data": {
    "evidence_id": "ev_01",
    "source_asset_id": "asset_01",
    "kind": "work_experience",
    "title": "ABC 科技",
    "content": "高级前端工程师，负责核心产品重构",
    "confidence": 0.88,
    "created_at": "2026-04-22T20:05:00Z"
  }
}
```

#### DELETE /api/v1/parsing/evidences/{evidence_id}

```
Response:
{
  "code": 0,
  "data": null,
  "message": "ok"
}
```

#### POST /api/v1/parsing/generate-draft

```
Request:
{
  "project_id": "proj_01"
}

Response:
{
  "code": 0,
  "data": {
    "task_id": "task_draft_01",
    "status": "pending"
  }
}
```

#### GET /api/v1/parsing/drafts/{draft_id}

```
Response:
{
  "code": 0,
  "data": {
    "draft_id": "draft_03",
    "project_id": "proj_01",
    "revision": 1,
    "content": { "sections": [...] },
    "style": { ... },
    "meta": { ... }
  }
}
```

## 5. 解析策略

| 输入类型 | 主策略 | 备选策略 |
|---|---|---|
| PDF | PyMuPDF 原生解析 | OCR（低置信度时） |
| DOCX | python-docx 段落/表格/样式提取 | — |
| 图片 | PaddleOCR layout analysis + OCR | — |
| Git | clone → 抽 README + 项目名 + 技术栈 + 目录结构 | — |

## 6. 依赖与边界

### 上游

- 模块 A（资料接入）产出 `SourceAssetSet`

### 下游

- 模块 C（Agent 编辑）消费 `ResumeDraftState`
- 模块 D（人工工作台）消费 `ResumeDraftState`
- 模块 E（渲染导出）消费 `ResumeDraftState`

### 可 mock 的边界

- **不需要 A 的服务**：直接读 `fixtures/source_asset_set.json`，本地放测试文件
- **B 自己的解析逻辑**：可以跳过真实解析，用预设 JSON 模拟解析结果来测试"初稿生成"逻辑
- **AI 调用**（初稿生成可能调 AI）：可以用预设 JSON 替代真实模型调用

## 7. 错误码

| 错误码 | HTTP | 含义 |
|---|---|---|
| 02001 | 400 | PDF 解析失败 |
| 02002 | 400 | DOCX 解析失败 |
| 02003 | 400 | OCR 置信度过低 |
| 02004 | 400 | Git 仓库 clone 失败 |
| 02005 | 500 | 初稿生成失败 |
| 02006 | 404 | 资产不存在 |
| 02007 | 404 | 证据不存在 |

## 8. 测试策略

### 独立测试

- 用本地测试文件（`test_fixtures/`）测试各种格式的解析
- 用 `fixtures/source_asset_set.json` 模拟 A 的输出
- 不需要启动模块 A、C、D、E 的服务
- AI 调用用 mock 替代

### Mock 产出

确保产出的 `EvidenceSet` 和 `ResumeDraftState` JSON 符合 schema，可直接交给 C/D/E 作为测试输入。

### 前端测试

- 解析进度展示（轮询 task 状态）
- 初稿预览确认页

前端可以用 `fixtures/resume_draft_state.json` 直接渲染预览，不需要等 B 后端完成。
