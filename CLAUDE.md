# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## TOP RULES
MUST USE SUPERPOWER
MUST SHOW A FEW PLAN AND ALSO RECOMMAND LOWER TECH-DEBT ONES
USE TDD TO DEVELOP THE PROJECT (REG)

## 项目概览

ResumeGenius 是一个 AI 辅助简历编辑产品。核心理念：**HTML 是唯一数据源**，AI 直接操作 HTML，用户通过 TipTap 所见即所得编辑器直接编辑简历，最终通过 chromedp 服务端渲染导出 PDF。

**当前状态：预实现规划阶段，尚无应用代码。** 仓库目前只包含设计文档和一份 Claude skill 定义。

## 架构：v2（HTML 单一数据源）

```
[A 项目管理] → 文件/资料 → [B 解析初稿] → HTML 初稿
                                       │
                              ┌─────────┴─────────┐
                              ▼                   ▼
                        [C AI 对话]          [D TipTap 编辑]
                        AI 返回 HTML          直接编辑 HTML
                              │                   │
                              └─────────┬─────────┘
                                        ▼
                              [E 版本管理 + PDF 导出]
                                HTML 快照 / chromedp
```

零中间层：没有 SourceAssetSet、EvidenceSet、ResumeDraftState、PatchEnvelope、ResolvedResumeSpec、LaTeX。HTML 直接存数据库，直接编辑，直接导出。

## 技术栈

| 层 | 技术 |
|---|---|
| 营销站（SEO） | Astro |
| 工作台（编辑器） | Vite + React + TypeScript + Tailwind CSS + shadcn/ui |
| 富文本编辑器 | TipTap（基于 ProseMirror） |
| 后端 | Gin + Go |
| ORM | GORM |
| 数据库 | PostgreSQL >= 15 |
| 文件存储 | 本地文件系统（起步） |
| PDF 解析 | ledongthuc/pdf（纯 Go） |
| DOCX 解析 | nguyenthenguyen/docx（纯 Go） |
| PDF 导出 | chromedp（Go 原生库，按需启动 Chromium） |
| AI 模型 | GLM-5 / GLM-5-Turbo（HTTP API 调用） |

## 计划项目结构

```
frontend/
  marketing/         # Astro 营销站
    src/pages/
  workbench/         # Vite + React 工作台
    src/
      pages/         # 页面路由
      components/    # 共享 + 模块组件
      lib/           # 工具函数、API client
backend/
  cmd/               # 入口
  internal/
    modules/         # a_intake/ b_parsing/ c_agent/ d_workbench/ e_render/
    shared/          # 共享 Go 模型、工具
fixtures/            # 共享 mock 数据
docs/                # 设计文档
```

## 文档体系

契约驱动开发，文档是 source of truth：

- **共享规范层** `docs/01-product/`：技术选型、功能划分、UI 风格、API 规约、开发工作总览
- **数据模型** `docs/02-data-models/`：数据库表结构（6 表）、Mock 策略
- **模块契约** `docs/modules/{a-intake,b-parsing,c-agent,d-workbench,e-render}/`：各模块 contract.md + work-breakdown.md
- **架构设计** `docs/superpowers/specs/2026-04-23-architecture-v2-design.md`：v2 架构设计（已批准）

开发前必读顺序：tech-stack → api-conventions → ui-design-system → core-data-model → mock-fixtures → 对应模块 contract.md

## API 规约要点

- 统一前缀 `/api/v1/{module}/{resource}`
- 响应格式 `{code: 0, data: {...}, message: "ok"}`，错误码 5 位 `SSCCC`（SS=模块 01-05）
- JSON 字段 `snake_case`，日期 ISO 8601
- AI 对话用 SSE 流式响应，PDF 导出用异步任务模式
- v1 无认证，预留 Authorization header

## 数据库表

6 张核心表：projects、assets、drafts、versions、ai_sessions、ai_messages

详见 `docs/02-data-models/core-data-model.md`

## 协作规则

- 契约即文档：代码必须对齐 contract.md + core-data-model.md
- 改契约要通知所有模块负责人
- 错误码段：A=01xxx, B=02xxx, C=03xxx, D=04xxx, E=05xxx
- 前端不直接操作数据库，所有数据通过 API 获取

## 开发阶段

1. **基础搭建**：前端脚手架 + 工作台布局，后端脚手架 + 共享 Go 模型，fixtures 就位
2. **核心功能并行**：各模块独立用 mock 开发
3. **逐步联调**：A→B → B→C/D → C/D→E → 端到端

## 现有 Claude Skill

`.claude/skills/resume-generator/` — 生成中文技术简历单页 A4 PDF（独立 Skill，与 v2 主项目无关）。
