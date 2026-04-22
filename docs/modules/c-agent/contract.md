# 模块 C 契约：Agent 编辑链路

## 1. 角色定义

**负责**：

- 接收用户自然语言需求
- AI 会话管理（多轮对话）
- 意图识别（内容修改 / 样式修改 / 混合修改 / 追问）
- 生成 Agent Patch（`PatchEnvelope` with `source=agent`）
- 建议展示（SuggestionSet → 用户确认 → Patch）

**不负责**：

- Patch 应用和状态管理（E 的事）
- 人工工作台交互（D 的事）
- 渲染和 PDF 导出（E 的事）
- 文件解析（B 的事）

## 2. 输入契约

| 数据 | 来源 | Mock fixture |
|---|---|---|
| `ResumeDraftState` | 模块 B | `fixtures/resume_draft_state.json` |
| `EvidenceSet` | 模块 B | `fixtures/evidence_set.json` |
| 用户自然语言消息 | 前端输入 | 无需 mock |

## 3. 输出契约

产出 `PatchEnvelope`（`source=agent`）。Schema 见 [patch-schema.md](../../02-data-models/patch-schema.md)。

两种模式：

- `mode=propose`：建议模式，展示给用户确认后再 apply
- `mode=apply`：直接应用（用户已确认）

Mock fixture：`fixtures/patch_agent.json`

## 4. API 端点

遵循 [api-conventions.md](../../01-product/api-conventions.md)。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/agent/sessions` | 创建对话会话 |
| GET | `/api/v1/agent/sessions?project_id={id}` | 获取项目的会话列表 |
| GET | `/api/v1/agent/sessions/{session_id}` | 获取会话信息 |
| DELETE | `/api/v1/agent/sessions/{session_id}` | 删除会话 |
| POST | `/api/v1/agent/sessions/{session_id}/chat` | 发送消息 |
| GET | `/api/v1/agent/sessions/{session_id}/history` | 获取对话历史 |
| POST | `/api/v1/agent/sessions/{session_id}/confirm` | 确认建议 |
| POST | `/api/v1/agent/sessions/{session_id}/reject` | 拒绝建议 |

### 关键端点详情

#### POST /api/v1/agent/sessions

```
Request:
{
  "project_id": "proj_01",
  "draft_id": "draft_03"
}

Response:
{
  "code": 0,
  "data": {
    "session_id": "sess_01",
    "project_id": "proj_01",
    "draft_id": "draft_03",
    "created_at": "2026-04-22T21:00:00Z"
  }
}
```

#### POST /api/v1/agent/sessions/{session_id}/chat

```
Request:
{
  "message": "帮我把工作经历压缩得更精炼一点",
  "current_revision": 12
}

Response:
{
  "code": 0,
  "data": {
    "reply": "我建议将第二条 bullet 精简为量化表述：...",
    "suggestions": [
      {
        "suggestion_id": "sug_01",
        "type": "content_rewrite",
        "description": "压缩工作经历第二条 bullet",
        "patch": { ... PatchEnvelope ... }
      }
    ]
  }
}
```

#### POST /api/v1/agent/sessions/{session_id}/confirm

```
Request:
{
  "suggestion_id": "sug_01"
}

Response:
{
  "code": 0,
  "data": {
    "patch": { ... PatchEnvelope with mode=apply ... }
  }
}
```

#### GET /api/v1/agent/sessions?project_id={id}

```
Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "session_id": "sess_01",
        "project_id": "proj_01",
        "draft_id": "draft_03",
        "created_at": "2026-04-22T21:00:00Z",
        "last_message_preview": "帮我把工作经历压缩一点..."
      }
    ],
    "total": 1
  }
}
```

#### DELETE /api/v1/agent/sessions/{session_id}

```
Response:
{
  "code": 0,
  "data": null,
  "message": "ok"
}
```

## 5. AI 调用规范

### 5.1 模型

- v1 使用 GLM-5 / GLM-5-Turbo
- 通过 Provider Adapter 封装，业务代码不直接调用模型 SDK

### 5.2 输入构建

每次 AI 调用需传入：

- 当前 `ResumeDraftState` 的完整 JSON（让 AI 理解上下文）
- 对话历史（最近 N 轮）
- 用户当前消息
- 可选：`EvidenceSet`（需要参考原始资料时）

### 5.3 输出解析

AI 返回结构化 JSON：

```json
{
  "reply": "给用户的回复文本",
  "intent": "content_modify | style_modify | mixed | clarification",
  "suggestions": [
    {
      "description": "变更描述",
      "patch_ops": [ ... PatchOp list ... ]
    }
  ]
}
```

如果 AI 返回格式异常，降级为纯文本回复（不生成 Patch）。

## 6. 依赖与边界

### 上游

- 模块 B 产出 `ResumeDraftState` 和 `EvidenceSet`

### 下游

- 模块 E（渲染导出）消费 `PatchEnvelope(source=agent)`

### 可 mock 的边界

- **不需要 B 的服务**：直接读 `fixtures/resume_draft_state.json`
- **AI 调用**：用预设 JSON 替代真实 GLM-5 调用，测试对话流程和 Patch 生成逻辑
- **不需要 E 的服务**：C 只负责产出 Patch，不负责应用

## 7. 错误码

| 错误码 | HTTP | 含义 |
|---|---|---|
| 03001 | 504 | 模型调用超时 |
| 03002 | 500 | 模型返回格式异常 |
| 03003 | 400 | 会话不存在 |
| 03004 | 409 | 当前有未处理的建议，不能发送新消息 |
| 03005 | 400 | 建议已过期（base_revision 不匹配） |

## 8. 测试策略

### 独立测试

- 用 `fixtures/resume_draft_state.json` 模拟草稿状态
- AI 调用用 mock handler 替代（返回预设的 Suggestion JSON）
- 测试多轮对话流程：消息发送 → 意图识别 → 建议生成 → 确认/拒绝
- 测试异常场景：模型超时、格式异常、版本冲突

### Mock 产出

确保产出的 `PatchEnvelope` JSON 符合 schema，可直接交给 E 作为测试输入。

### 前端测试

- 对话 UI（聊天气泡 + 建议卡片）
- 确认/拒绝按钮交互
- Agent 状态展示（思考中、已生成建议等）

前端可以用预设对话 JSON 渲染聊天界面，不需要等 C 后端完成。
