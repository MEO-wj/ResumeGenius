# Contract-First 文档体系设计规格

日期：2026-04-22
状态：已批准

## 背景

ResumeGenius 项目由 5 人全栈团队并行开发。需要一套文档体系确保：
1. 统一规范（技术选型、数据结构、UI 风格）提前冻结
2. 每个模块可独立开发和测试，不依赖上下游实现

## 设计决策

### 方案选择：Contract-First

选择文档契约模式而非共享代码库模式，原因：
- v1 数据结构仍可能调整，文档更灵活
- 零耦合，改文档即改规范
- 等 v1 接口稳定后再收拢成共享 Pydantic/TS 类型库

### 文档结构

```
docs/
  01-product/                    # 共享规范层（所有人必读）
    tech-stack.md                ✅
    product-logic-diagrams.md    ✅
    functional-breakdown.md      ✅
    ui-design-system.md          🆕 NotebookLM 风格
    api-conventions.md           🆕 统一 API 规约

  02-data-models/                # 共享契约层
    core-data-model.md           ✅
    patch-schema.md              🆕 PatchEnvelope 定义
    mock-fixtures.md             🆕 Mock 数据策略 + fixture 清单

  modules/                       # 5 份模块契约（每份一人负责）
    a-intake/contract.md
    b-parsing/contract.md
    c-agent/contract.md
    d-workbench/contract.md
    e-render/contract.md
```

### 共享规范

- **UI 风格**：参考 NotebookLM，三栏布局，浅色调，卡片式，shadcn/ui + Tailwind
- **API 规约**：RESTful + JSON，统一响应格式，预留认证位
- **数据模型**：6 层结构（Project → SourceAssetSet → EvidenceSet → ResumeDraftState → PatchEnvelope → ResolvedResumeSpec）
- **Mock 策略**：每个模块提供输入/输出/自测三类 JSON fixture

### 模块契约统一结构

每份 contract.md 包含：角色定义、输入契约、输出契约、API 端点、依赖边界、测试策略。

### 5 人模块分工

| 模块 | 负责人 | 产出 |
|---|---|---|
| A 资料接入 | 待分配 | SourceAssetSet |
| B 解析与初稿生成 | 待分配 | EvidenceSet + ResumeDraftState |
| C Agent 编辑 | 待分配 | PatchEnvelope(agent) |
| D 人工工作台 | 待分配 | PatchEnvelope(manual) |
| E 状态管理与渲染导出 | 待分配 | ResolvedResumeSpec + PDF |
