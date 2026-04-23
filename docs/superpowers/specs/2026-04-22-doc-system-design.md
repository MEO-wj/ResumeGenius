# Contract-First 文档体系设计规格

日期：2026-04-22
状态：已批准（v2 架构已对齐）

## 背景

ResumeGenius 项目由 5 人全栈团队并行开发。需要一套文档体系确保：
1. 统一规范（技术选型、数据结构、UI 风格）提前冻结
2. 每个模块可独立开发和测试，不依赖上下游实现

## 设计决策

### 方案选择：Contract-First

选择文档契约模式而非共享代码库模式，原因：
- 数据结构仍可能调整，文档更灵活
- 零耦合，改文档即改规范
- 等接口稳定后再收拢成共享 Go struct / TS 类型库

### 文档结构

```
docs/
  01-product/                    # 共享规范层（所有人必读）
    tech-stack.md                ✅
    product-logic-diagrams.md    ✅
    functional-breakdown.md      ✅
    ui-design-system.md          ✅
    api-conventions.md           ✅
    dev-work-breakdown.md        ✅

  02-data-models/                # 数据模型层
    core-data-model.md           ✅ v2：6 张数据库表
    mock-fixtures.md             ✅ v2：HTML fixture
    patch-schema.md              ❌ 已废弃（v2 不需要 Patch 协议）

  modules/                       # 5 份模块契约（每份一人负责）
    a-intake/contract.md
    b-parsing/contract.md
    c-agent/contract.md
    d-workbench/contract.md
    e-render/contract.md

  superpowers/specs/             # 架构设计规格
    2026-04-23-architecture-v2-design.md   ✅ v2 架构（已批准）
```

### v2 架构变更

v2 核心改变：**HTML 是唯一数据源**，砍掉所有中间层。

| 维度 | v1 | v2 |
|---|---|---|
| 数据源 | 6 层数据结构 | HTML（唯一） |
| 编辑方式 | 结构化表单 + Patch 协议 | TipTap 所见即所得 |
| AI 编辑 | 生成 PatchOp → 应用 | 直接返回 HTML |
| 导出 | LaTeX → xelatex → PDF | chromedp → PDF |
| 中间数据结构 | 6 层 | 0 层 |
| 开发复杂度 | 高 | 低 |

### 共享规范

- **UI 风格**：参考 NotebookLM，左侧 A4 画布 + 右侧 AI 面板，shadcn/ui + Tailwind
- **API 规约**：RESTful + JSON，统一响应格式，预留认证位，SSE 流式（AI 对话）
- **数据模型**：6 张数据库表（projects, assets, drafts, versions, ai_sessions, ai_messages）
- **Mock 策略**：HTML fixture + 测试文件 + AI 响应 mock

### 模块契约统一结构

每份 contract.md 包含：角色定义、输入契约、输出契约、API 端点、依赖边界、错误码、测试策略。

### 5 人模块分工

| 模块 | 负责人 | 产出 |
|---|---|---|
| A 项目管理 | 待分配 | projects + assets 表操作 |
| B 解析与初稿 | 待分配 | 文本提取 + AI 生成 HTML |
| C AI 对话 | 待分配 | SSE 流式对话 |
| D 编辑器 | 待分配 | TipTap 集成 + 自动保存 |
| E 版本导出 | 待分配 | HTML 快照 + chromedp PDF |
