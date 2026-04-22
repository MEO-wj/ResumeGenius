# 模块 E 契约：状态管理与渲染导出

## 1. 角色定义

**负责**：

- 接收 Patch 并应用到 ResumeDraftState（唯一修改状态的入口）
- Patch 校验（原子性、版本冲突检测）
- 版本记录（RevisionRecord）
- 撤销/回退
- ResumeDraftState → ResolvedResumeSpec 解算
- LaTeX 模板填充 + PDF 编译
- 预览生成

**不负责**：

- 生成 Patch（C 或 D 的事）
- 文件解析（B 的事）
- AI 对话（C 的事）
- 编辑器 UI（D 的事）

## 2. 输入契约

| 数据 | 来源 | Mock fixture |
|---|---|---|
| `ResumeDraftState` | 模块 B（初始）/ 自身（更新后） | `fixtures/resume_draft_state.json` |
| `PatchEnvelope(source=agent)` | 模块 C | `fixtures/patch_agent.json` |
| `PatchEnvelope(source=manual)` | 模块 D | `fixtures/patch_manual.json` |

## 3. 输出契约

### 3.1 新的 ResumeDraftState

Patch 应用后生成的新草稿状态。每应用一个 Patch，revision +1。

### 3.2 ResolvedResumeSpec

从 ResumeDraftState 解算出的确定性渲染对象。Schema 见 [core-data-model.md](../../02-data-models/core-data-model.md) §7。

Mock fixture：`fixtures/resolved_resume_spec.json`

### 3.3 PDF 文件

LaTeX 编译后的最终输出。

## 4. API 端点

遵循 [api-conventions.md](../../01-product/api-conventions.md)。

### 4.1 状态管理端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/render/apply-patch` | 应用 Patch |
| GET | `/api/v1/render/drafts/{draft_id}` | 获取最新草稿状态 |
| GET | `/api/v1/render/drafts/{draft_id}/revisions` | 获取版本历史 |
| POST | `/api/v1/render/drafts/{draft_id}/rollback` | 回退到指定版本 |

### 4.2 渲染导出端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/render/resolve` | 触发解算（异步） |
| GET | `/api/v1/render/tasks/{task_id}` | 查询解算/编译状态 |
| POST | `/api/v1/render/preview` | 生成预览 |
| POST | `/api/v1/render/pdf` | 触发 PDF 编译（异步） |
| GET | `/api/v1/render/pdfs/{task_id}/download` | 下载 PDF |

### 关键端点详情

#### POST /api/v1/render/apply-patch

```
Request:
{
  ... 完整 PatchEnvelope ...
}

Response (成功):
{
  "code": 0,
  "data": {
    "draft_id": "draft_03",
    "revision": 13,
    "summary": "压缩项目经历并收紧整体段距"
  }
}

Response (版本冲突):
{
  "code": 04003,
  "data": null,
  "message": "版本冲突：当前最新版本为 13，Patch 基于版本 12"
}
```

#### POST /api/v1/render/resolve

```
Request:
{
  "draft_id": "draft_03",
  "revision": 13
}

Response:
{
  "code": 0,
  "data": {
    "task_id": "task_resolve_01",
    "status": "pending"
  }
}
```

#### POST /api/v1/render/pdf

```
Request:
{
  "draft_id": "draft_03",
  "revision": 13
}

Response:
{
  "code": 0,
  "data": {
    "task_id": "task_pdf_01",
    "status": "pending"
  }
}
```

## 5. Patch 应用流程

```
接收 PatchEnvelope
       │
       ▼
  base_revision 校验 ── 失败 ──▶ 返回 04003 版本冲突
       │
    成功
       │
       ▼
  逐个校验 TargetRef ── 失败 ──▶ 返回 04002 节点不存在
       │
    成功
       │
       ▼
  逐个校验 value 范围 ── 失败 ──▶ 返回 04001 值越界
       │
    成功
       │
       ▼
  执行全部 ops（内存中）
       │
       ▼
  生成新 ResumeDraftState (revision +1)
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

## 6. 解算流程

ResumeDraftState → ResolvedResumeSpec：

1. 读取当前 ResumeDraftState
2. 将 `style` 中的意图型参数映射为确定性数值
3. 将 `content` 中的 section 结构展平为 block 列表
4. 补全页面参数（margin、page size）
5. 生成 `render_tokens`（LaTeX 模板变量映射）
6. 输出 ResolvedResumeSpec

## 7. LaTeX 渲染流程

1. 读取 ResolvedResumeSpec
2. 填充 LaTeX 模板（Jinja2 或字符串替换）
3. 写入 .tex 文件
4. 调用 TeX Live 编译
5. 返回 PDF 文件路径

## 8. 依赖与边界

### 上游

- 模块 C 产出 `PatchEnvelope(source=agent)`
- 模块 D 产出 `PatchEnvelope(source=manual)`
- 模块 B 产出初始 `ResumeDraftState`

### 下游

- 用户（下载 PDF、查看预览）

### 可 mock 的边界

- **不需要 C/D 的服务**：直接读 `fixtures/patch_agent.json` 和 `fixtures/patch_manual.json`
- **不需要 B 的服务**：直接读 `fixtures/resume_draft_state.json`
- **LaTeX 编译**：开发时可以用预设 PDF 文件替代真实编译，只测试解算逻辑
- **数据库**：可以用 SQLite 内存库替代 PostgreSQL

## 9. 错误码

| 错误码 | HTTP | 含义 |
|---|---|---|
| 05001 | 500 | LaTeX 编译失败 |
| 05002 | 500 | 解算失败（参数无法确定化） |
| 05003 | 404 | 草稿不存在 |
| 05004 | 404 | 版本不存在 |
| 05005 | 409 | 版本冲突（乐观锁） |
| 05006 | 400 | Patch 校验失败 |

## 10. 测试策略

### 独立测试

- 用 `fixtures/resume_draft_state.json` 作为初始草稿
- 用 `fixtures/patch_agent.json` 测试 Patch 应用流程
- 用 `fixtures/patch_manual.json` 测试 Patch 应用流程
- 测试版本冲突场景（连续两个 Patch 使用同一 base_revision）
- 测试回退功能
- 解算逻辑用单元测试覆盖
- LaTeX 编译可用预设 PDF mock，先只测解算输出

### Mock 产出

确保解算产出的 `ResolvedResumeSpec` JSON 符合 schema，可作为 LaTeX 模板的输入验证。

### 前端测试

- PDF 预览组件（用预设 PDF 渲染）
- 版本历史列表
- 回退确认弹窗
- 导出下载按钮

前端可以用 mock PDF 文件测试预览，不需要等 E 后端完成 LaTeX 编译。
