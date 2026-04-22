# 开发工作总览

更新时间：2026-04-22

本文档是 5 人并行开发的总入口，定义公共工作、交付顺序和协作方式。每人读本文档 + 自己模块的 `work-breakdown.md` 即可开工。

## 1. 项目结构

```
ResumeGenius/
  frontend/                  # Next.js 前端
    src/
      app/                   # 页面路由
      components/            # 共享组件 + 各模块组件
      lib/                   # 工具函数、API client
    ...
  backend/                   # FastAPI 后端
    app/
      modules/               # 5 个模块各自独立目录
        a_intake/
        b_parsing/
        c_agent/
        d_workbench/
        e_render/
      shared/                # 共享模型、工具
    ...
  fixtures/                  # 共享 mock fixture（JSON）
  docs/                      # 本文档体系
```

## 2. 公共工作（所有人必做）

### 2.1 环境搭建

| 项目 | 说明 |
|---|---|
| Node.js | ≥ 18 LTS |
| Python | ≥ 3.11 |
| PostgreSQL | ≥ 15 |
| TeX Live | E 模块需要，其他人可选装 |

### 2.2 公共文档必读

按顺序读：

1. [tech-stack.md](./tech-stack.md) — 技术选型
2. [api-conventions.md](./api-conventions.md) — API 规约
3. [ui-design-system.md](./ui-design-system.md) — UI 风格
4. [core-data-model.md](../02-data-models/core-data-model.md) — 数据结构
5. [patch-schema.md](../02-data-models/patch-schema.md) — Patch 协议
6. [mock-fixtures.md](../02-data-models/mock-fixtures.md) — Mock 策略
7. 自己模块的 `contract.md` + `work-breakdown.md`

### 2.3 公共代码

前端和后端各有一份公共部分需要先搭好：

**前端公共**（建议 A 负责搭建，其他人复用）：

| 内容 | 说明 |
|---|---|
| Next.js 项目脚手架 | App Router、TypeScript、Tailwind CSS、shadcn/ui |
| 三栏布局 Shell | 左侧栏 + 主工作区 + 右侧面板（见 ui-design-system.md §2） |
| API Client 封装 | 统一请求/响应拦截、错误处理 |
| 路由结构 | 各模块页面占位 |
| 色彩/字号/间距变量 | Tailwind config 中按 ui-design-system.md 配好 |

**后端公共**（建议 E 负责搭建，其他人复用）：

| 内容 | 说明 |
|---|---|
| FastAPI 项目脚手架 | 路由注册、中间件、CORS |
| Pydantic 共享模型 | `SourceAssetSet`、`EvidenceSet`、`ResumeDraftState`、`PatchEnvelope`、`ResolvedResumeSpec` |
| 统一响应格式 | `{code, data, message}` 封装 |
| 错误码注册表 | `SSCCC` 格式 |
| 数据库连接 | SQLAlchemy 2.0 async session |

## 3. 模块交付物总览

| 模块 | 负责人 | 前端页面 | 后端 API 数 | 产出数据 |
|---|---|---|---|---|
| A 资料接入 | — | 4 页 | 15 个 | SourceAssetSet |
| B 解析与初稿 | — | 3 页 | 8 个 | EvidenceSet + ResumeDraftState |
| C Agent 编辑 | — | 2 页 | 8 个 | PatchEnvelope(agent) |
| D 人工工作台 | — | 1 页 | 5 个 | PatchEnvelope(manual) |
| E 渲染导出 | — | 2 页 | 9 个 | ResolvedResumeSpec + PDF |

## 4. 开发顺序建议

### 阶段一：基础搭建（所有人）

1. 搭前端脚手架 + 三栏布局
2. 搭后端脚手架 + 共享 Pydantic 模型
3. 确认 fixtures/ 目录的 mock JSON 全部就位
4. 每人跑通自己模块的"hello world"页面 + API

### 阶段二：核心功能（并行）

- A：项目 CRUD + 文件上传
- B：PDF/DOCX 解析 + 初稿生成
- C：对话 UI + AI mock 调通
- D：编辑器 UI + Patch 生成逻辑
- E：Patch 应用 + 解算 + LaTeX 模板

### 阶段三：联调（逐步）

1. A → B 联调：真实文件上传 → 解析 → 初稿
2. B → C/D 联调：真实初稿 → 编辑
3. C/D → E 联调：真实 Patch → 应用 → 渲染
4. 端到端跑通：创建项目 → 上传 → 解析 → AI 编辑 → 预览 → 导出 PDF

## 5. 协作规则

- **契约即文档**：API 和数据结构以 `contract.md` + `core-data-model.md` 为准，代码实现必须对齐
- **改契约要通知**：任何人修改共享 schema 或 API 格式，必须在群里通知所有模块负责人
- **Mock 优先**：开发阶段用 fixtures/ 下的 JSON，不依赖真实服务
- **环境变量切 mock**：用 `USE_MOCK=true/false` 控制是否使用 mock 数据
- **前端不直接操作数据库**：所有数据通过 API 获取
- **错误码不冲突**：A=01xxx, B=02xxx, C=03xxx, D=04xxx, E=05xxx

## 6. 模块工作明细

| 模块 | 工作明细文档 |
|---|---|
| A 资料接入 | [modules/a-intake/work-breakdown.md](../modules/a-intake/work-breakdown.md) |
| B 解析与初稿 | [modules/b-parsing/work-breakdown.md](../modules/b-parsing/work-breakdown.md) |
| C Agent 编辑 | [modules/c-agent/work-breakdown.md](../modules/c-agent/work-breakdown.md) |
| D 人工工作台 | [modules/d-workbench/work-breakdown.md](../modules/d-workbench/work-breakdown.md) |
| E 渲染导出 | [modules/e-render/work-breakdown.md](../modules/e-render/work-breakdown.md) |
