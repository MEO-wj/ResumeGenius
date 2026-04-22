# 模块 C 工作明细：Agent 编辑链路

更新时间：2026-04-22

本文档列出模块 C 负责人的全部开发任务。契约定义见 [contract.md](./contract.md)。

## 1. 概述

模块 C 是 AI 编辑链路的核心，负责接收用户自然语言需求，通过多轮对话识别意图，生成结构化 Patch 建议。产出 `PatchEnvelope(source=agent)` 交给模块 E。

**核心交付**：用户能通过自然语言对话修改简历内容/样式，AI 返回可确认的建议卡片，确认后生成 Patch。

## 2. 前端任务

### 2.1 页面

| # | 页面 | 路由建议 | 说明 |
|---|---|---|---|
| 1 | Agent 对话页 | `/projects/[id]/agent` | 聊天界面 + 建议卡片 + 当前简历参数 |

### 2.2 组件

| # | 组件 | 说明 |
|---|---|---|
| 1 | `ChatWindow` | 聊天窗口：消息列表 + 输入框 |
| 2 | `ChatBubble` | 消息气泡：区分用户消息和 AI 回复，AI 回复支持 Markdown 渲染 |
| 3 | `SuggestionCard` | 建议卡片：显示 description + 变更摘要，底部有「确认」和「拒绝」按钮 |
| 4 | `SuggestionList` | 建议列表：一条 AI 回复可能包含多个建议 |
| 5 | `AgentStatus` | Agent 状态指示器：空闲 / 思考中 / 已生成建议 |
| 6 | `SessionList` | 对话会话列表（左侧栏），支持新建和切换 |
| 7 | `ChatInput` | 消息输入框：支持多行输入 + 发送按钮 + Enter 发送 / Shift+Enter 换行 |

### 2.3 前端技术要点

- 聊天消息列表需要自动滚动到底部
- AI 回复可能包含多个建议，用 `SuggestionCard` 逐个展示
- 建议"确认"后前端调用 `/confirm` API，获取 Patch 结果
- 建议"拒绝"后前端调用 `/reject` API，继续对话
- 当前有未处理建议时，禁止发送新消息（按钮灰显 + tooltip 提示）
- Agent 状态用 `AgentStatus` 组件展示，"思考中"显示 loading 动画
- 参考 ui-design-system.md：左侧资料列表+版本、中间对话流、右侧简历参数

## 3. 后端任务

### 3.1 API 端点（8 个）

**会话管理（4 个）**：

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 1 | POST | `/api/v1/agent/sessions` | 创建对话会话 |
| 2 | GET | `/api/v1/agent/sessions?project_id={id}` | 获取项目的会话列表 |
| 3 | GET | `/api/v1/agent/sessions/{session_id}` | 获取会话信息 |
| 4 | DELETE | `/api/v1/agent/sessions/{session_id}` | 删除会话 |

**对话交互（4 个）**：

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 5 | POST | `/api/v1/agent/sessions/{session_id}/chat` | 发送消息 |
| 6 | GET | `/api/v1/agent/sessions/{session_id}/history` | 获取对话历史 |
| 7 | POST | `/api/v1/agent/sessions/{session_id}/confirm` | 确认建议 |
| 8 | POST | `/api/v1/agent/sessions/{session_id}/reject` | 拒绝建议 |

### 3.2 后端服务

| # | 服务 | 说明 |
|---|---|---|
| 1 | `SessionService` | 会话 CRUD，关联 project 和 draft |
| 2 | `ChatService` | 消息收发，对话历史管理 |
| 3 | `IntentRecognizer` | 意图识别：content_modify / style_modify / mixed / clarification |
| 4 | `ProviderAdapter` | AI 模型调用封装（GLM-5 / GLM-5-Turbo），业务代码不直接调 SDK |
| 5 | `SuggestionBuilder` | AI 输出 → Suggestion 结构（description + PatchEnvelope） |
| 6 | `PatchComposer` | 根据 AI 输出的 patch_ops 构建完整 PatchEnvelope |

### 3.3 后端技术要点

- 每次 AI 调用传入：当前 ResumeDraftState JSON + 对话历史（最近 N 轮） + 用户消息 + 可选 EvidenceSet
- AI 返回结构化 JSON（reply + intent + suggestions），如果格式异常则降级为纯文本回复
- `ProviderAdapter` 是关键抽象：封装 prompt 构建、模型调用、响应解析、错误处理
- 对话历史存在数据库，支持翻页加载
- 建议状态管理：pending → confirmed / rejected，一个会话同一时间最多一组 pending 建议
- `mode=propose`：AI 生成建议展示给用户 → 用户确认后变为 `mode=apply` 的 Patch
- `current_revision` 随消息发送，用于乐观锁校验

### 3.4 AI Prompt 设计

需要设计的 prompt 模板：

| # | Prompt | 说明 |
|---|---|---|
| 1 | System Prompt | 角色定义（简历优化助手）+ 输出格式约束（JSON）+ 可用 action 列表 |
| 2 | Context Injection | 注入当前 ResumeDraftState 和 EvidenceSet |
| 3 | User Message Template | 包裹用户消息 + current_revision |

## 4. 数据库表

| 表名 | 关键字段 | 说明 |
|---|---|---|
| `agent_sessions` | `session_id`, `project_id`, `draft_id`, `created_at`, `last_message_preview` | 对话会话 |
| `agent_messages` | `message_id`, `session_id`, `role` (user/assistant), `content`, `intent`, `created_at` | 对话消息 |
| `agent_suggestions` | `suggestion_id`, `session_id`, `message_id`, `type`, `description`, `status` (pending/confirmed/rejected), `patch_ops` (JSON), `base_revision` | AI 建议 |

- `agent_messages.content`：用户消息存原文，AI 消息存 reply 字段
- `agent_suggestions.patch_ops`：存 AI 返回的 ops 数组（JSON），确认后组装为完整 PatchEnvelope

## 5. 测试任务

### 5.1 后端单元测试

| # | 测试 | 说明 |
|---|---|---|
| 1 | 会话 CRUD | 创建、查询、列表、删除会话 |
| 2 | 消息收发 | 发送消息 → 返回 reply + suggestions |
| 3 | 意图识别 | 验证 AI 对不同输入返回正确 intent |
| 4 | 建议确认 | confirm 后返回完整 PatchEnvelope (mode=apply) |
| 5 | 建议拒绝 | reject 后建议标记为 rejected，可继续对话 |
| 6 | 模型超时 | 模拟 AI 调用超时，返回 03001 |
| 7 | 格式异常 | 模拟 AI 返回非 JSON，验证降级处理 |
| 8 | 版本冲突 | 发送消息时 base_revision 不匹配，返回 03005 |
| 9 | 未处理建议锁定 | 有 pending 建议时发新消息，返回 03004 |
| 10 | Prompt 构建 | 验证不同场景下 prompt 注入的上下文正确 |

### 5.2 前端测试

| # | 测试 | 说明 |
|---|---|---|
| 1 | 聊天界面 | 消息发送、气泡渲染、自动滚动 |
| 2 | 建议卡片 | 展示 description、确认/拒绝按钮交互 |
| 3 | 状态指示 | 思考中动画、建议锁定时输入框灰显 |

### 5.3 Mock 策略

- 不依赖 B 的服务：直接读 `fixtures/resume_draft_state.json`
- AI 调用用 mock handler 替代：返回预设的 `{reply, intent, suggestions}` JSON
- 不需要 E 的服务
- 产出 fixture：`fixtures/patch_agent.json`
- 可用预设对话 JSON 测试前端聊天界面，不需要真实 AI 调用

## 6. 交付 Checklist

- [ ] 前端：1 个页面 + 7 个组件
- [ ] 后端：8 个 API 端点
- [ ] 后端服务：6 个核心服务（会话 + 聊天 + 意图识别 + ProviderAdapter + 建议构建 + Patch 组装）
- [ ] AI Prompt：3 个 prompt 模板
- [ ] 数据库：3 张表（agent_sessions, agent_messages, agent_suggestions）
- [ ] 测试：10 个后端单元测试 + 3 个前端测试
- [ ] 产出 fixture：`fixtures/patch_agent.json` 符合 PatchEnvelope schema
- [ ] 错误码使用 03xxx 范围
