# ResumeGenius Docs

更新时间：2026-04-22

## 文档体系

文档分为两层：

- **共享规范层**（`01-product/` + `02-data-models/`）：所有模块必读，定义统一的技术选型、数据结构、UI 风格和 API 规约
- **模块契约层**（`modules/`）：5 份模块契约，每份对应一个人的全栈职责，独立可开发、独立可测试

## 目录结构

```text
docs/
  README.md
  01-product/                      # 共享规范
    product-logic-diagrams.md      # 功能关系图 + 用户流程图
    functional-breakdown.md        # 功能划分 + 5 人模块切分
    tech-stack.md                  # 技术栈选型
    ui-design-system.md            # UI 风格规范（NotebookLM 风格）
    api-conventions.md             # 统一 API 规约
  02-data-models/                  # 共享数据模型
    core-data-model.md             # 6 层核心数据结构
    patch-schema.md                # PatchEnvelope 完整定义
    mock-fixtures.md               # 每模块 mock 数据策略 + fixture 示例
  modules/                         # 5 人模块契约
    a-intake/contract.md           # 资料接入层
    b-parsing/contract.md          # 解析与初稿生成层
    c-agent/contract.md            # Agent 编辑链路
    d-workbench/contract.md        # 人工工作台
    e-render/contract.md           # 状态管理 + 渲染导出
```

## 模块分工总览

```
[A 接入] → SourceAssetSet → [B 解析] → EvidenceSet
                              │
                         ResumeDraftState
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              [C Agent 编辑]     [D 人工工作台]
                    │                   │
                    └── PatchEnvelope ──┘
                              │
                              ▼
                    [E 状态管理 + 渲染导出]
                              │
                   ResolvedResumeSpec → PDF
```

| 模块 | 负责人 | 产出 | 契约文档 |
|---|---|---|---|
| A 资料接入 | — | SourceAssetSet | [contract.md](./modules/a-intake/contract.md) |
| B 解析与初稿 | — | EvidenceSet + ResumeDraftState | [contract.md](./modules/b-parsing/contract.md) |
| C Agent 编辑 | — | PatchEnvelope(agent) | [contract.md](./modules/c-agent/contract.md) |
| D 人工工作台 | — | PatchEnvelope(manual) | [contract.md](./modules/d-workbench/contract.md) |
| E 渲染导出 | — | ResolvedResumeSpec + PDF | [contract.md](./modules/e-render/contract.md) |

## 共享规范入口

- 产品逻辑图：[product-logic-diagrams.md](./01-product/product-logic-diagrams.md)
- 功能划分：[functional-breakdown.md](./01-product/functional-breakdown.md)
- 技术栈：[tech-stack.md](./01-product/tech-stack.md)
- UI 风格：[ui-design-system.md](./01-product/ui-design-system.md)
- API 规约：[api-conventions.md](./01-product/api-conventions.md)
- 核心数据结构：[core-data-model.md](./02-data-models/core-data-model.md)
- Patch Schema：[patch-schema.md](./02-data-models/patch-schema.md)
- Mock 数据策略：[mock-fixtures.md](./02-data-models/mock-fixtures.md)
- 开发工作总览：[dev-work-breakdown.md](./01-product/dev-work-breakdown.md)

## 开发方式

每个模块的开发者：

1. 先读共享规范层（01-product + 02-data-models），理解全局约束
2. 读自己模块的 contract.md，明确输入/输出/API/测试策略
3. 用 `fixtures/` 中的 mock JSON 替代上下游，独立开发测试
4. 不需要等上下游模块完成，只要契约对齐即可

## 备注

-  `prd_v1.md` 继续保留为产品边界原始讨论稿，不作为功能文档主索引。
- Patch 协议的完整 Schema 定义见 [patch-schema.md](./02-data-models/patch-schema.md)。
