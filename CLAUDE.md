# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## TOP RULES
MUST USE SUPERPOWER
MUST SHOW A FEW PLAN AND ALSO RECOMMAND LOWER TECH-DEBT ONES

## 项目概览

ResumeGenius 是一个 AI 辅助简历编辑产品。核心理念：AI 负责"理解和建议"，确定性系统负责"布局和渲染"。用户可通过 AI 对话或手动工作台编辑简历，两条路径统一收敛到 Patch 机制，最终通过 LaTeX 渲染为 PDF。

**当前状态：预实现规划阶段，尚无应用代码。** 仓库目前只包含设计文档和一份 Claude skill 定义。

## 架构：5 模块流水线

```
[A 资料接入] → SourceAssetSet → [B 解析初稿] → EvidenceSet + ResumeDraftState
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

模块间通过契约解耦，可独立开发。Mock 优先策略：`USE_MOCK=true/false` 控制是否使用 fixtures JSON。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js (App Router) + React + TypeScript, Tailwind CSS, shadcn/ui |
| 后端 | FastAPI + Pydantic, SQLAlchemy 2.0 (async) |
| 数据库 | PostgreSQL >= 15 |
| 解析 | PyMuPDF (PDF), python-docx (DOCX), PaddleOCR (图片) |
| AI | GLM-5 / GLM-5-Turbo (通过 Provider Adapter) |
| 渲染 | LaTeX (ctexart) + TeX Live → PDF |
| 运行时 | Node.js >= 18, Python >= 3.11 |

## 计划项目结构

```
frontend/          # Next.js 前端
  src/app/         # App Router 页面
  src/components/  # 共享 + 模块组件
  src/lib/         # 工具函数、API client
backend/           # FastAPI 后端
  app/modules/     # a_intake/ b_parsing/ c_agent/ d_workbench/ e_render/
  app/shared/      # 共享 Pydantic 模型、工具
fixtures/          # 共享 mock JSON
docs/              # 设计文档
```

## 文档体系（当前核心产物）

契约驱动开发，文档是 source of truth：

- **共享规范层** `docs/01-product/`：技术选型、功能划分、UI 风格、API 规约、开发工作总览
- **共享数据模型** `docs/02-data-models/`：6 层核心数据结构 (Project → SourceAssetSet → EvidenceSet → ResumeDraftState → PatchEnvelope → ResolvedResumeSpec)、Patch Schema、Mock 策略
- **模块契约** `docs/modules/{a-intake,b-parsing,c-agent,d-workbench,e-render}/`：各模块 contract.md + work-breakdown.md

开发前必读顺序：tech-stack → api-conventions → ui-design-system → core-data-model → patch-schema → mock-fixtures → 对应模块 contract.md

## API 规约要点

- 统一前缀 `/api/v1/{module}/{resource}`
- 响应格式 `{code: 0, data: {...}, message: "ok"}`，错误码 5 位 `SSCCC`（SS=模块 01-05）
- JSON 字段 `snake_case`，日期 ISO 8601，布尔 `is_`/`has_` 前缀
- 异步任务：POST 触发 → 返回 task_id → 客户端轮询 `GET /tasks/{task_id}`
- v1 无认证，预留 Authorization header

## 协作规则

- 契约即文档：代码必须对齐 contract.md + core-data-model.md
- 改契约要通知所有模块负责人
- 错误码段：A=01xxx, B=02xxx, C=03xxx, D=04xxx, E=05xxx
- 前端不直接操作数据库，所有数据通过 API 获取

## 开发阶段

1. **基础搭建**：前端脚手架 + 三栏布局 Shell，后端脚手架 + 共享 Pydantic 模型，fixtures 就位
2. **核心功能并行**：各模块独立用 mock 开发
3. **逐步联调**：A→B → B→C/D → C/D→E → 端到端

## 现有 Claude Skill

`.claude/skills/resume-generator/` — 生成中文技术简历 LaTeX (ctexart) 单页 A4 PDF，独立于主项目，可直接使用。
