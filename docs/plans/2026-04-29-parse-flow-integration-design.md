# Parse 链路打通设计：单页面三栏布局过渡

日期：2026-04-29

## 背景

用户在 ProjectDetail 页面上传文件后，无法进入下一步。后端 parsing 模块的 `ParsingService.Parse()` 已实现（commit `d8bbd08`），但路由层仍是 stub，前端无调用入口。

本次只打通 `POST /parsing/parse` 端点，不涉及 AI 初稿生成（`POST /parsing/generate`）。

## 设计方案：单页面 + CSS Grid 过渡动画

路由不变，保持在 `/projects/:projectId`，用一个 `phase` 状态驱动三栏布局的平滑过渡。

## 1. 状态机与布局架构

### 三个阶段

| Phase | Grid 布局 | 左侧面板 | 中间面板 | 右侧面板 |
|-------|-----------|----------|----------|----------|
| `intake` | `1fr 0 0` | 全屏上传界面（`max-w-2xl` 居中） | 隐藏 | 隐藏 |
| `parsing` | `320px 1fr 360px` | loading 转圈 | A4 骨架屏 | 聊天骨架屏 |
| `editing` | `320px 1fr 360px` | 解析结果侧栏 | TipTap 编辑器 | AI 面板占位 |

- 路由：保持在 `/projects/:projectId`，不新增路由
- 状态：`phase: 'intake' | 'parsing' | 'editing'` + `parsedContents: ParsedContent[]`
- 现有 `/projects/:projectId/edit` 路由后续可废弃或重定向

## 2. 后端改动

### 新建 `parsing/handler.go`

- `Handler` struct 持有 `*ParsingService`
- `ParseProject(c *gin.Context)` 方法：
  1. `ShouldBindJSON` → `{ project_id }`
  2. `userID(c)` 提取当前用户（`middleware.UserIDFromContext`）
  3. 校验项目归属（查 `project.user_id == userID`）
  4. 调用 `service.Parse(projectID)` → `[]ParsedContent`
  5. 错误映射：`ErrProjectNotFound→2003/404`, `ErrNoUsableAssets→2004/400`, 其他→2001/400`
  6. 返回 `response.Success(c, data)`

遵循 intake 模块的 handler 模式。

### 改造 `parsing/routes.go`

```go
func RegisterRoutes(rg *gin.RouterGroup, db *gorm.DB) {
    pdfParser  := NewRealPDFParser()
    docxParser := NewRealDocxParser()
    service    := NewParsingService(db, pdfParser, docxParser, nil)
    handler    := NewHandler(service)
    rg.POST("/parsing/parse", handler.ParseProject)
}
```

`main.go` 无需改动（函数签名不变）。

## 3. 前端改动

### `api-client.ts` 新增

```ts
export const parsingApi = {
  parseProject: (projectId: number) =>
    request<ParsedContent[]>(`/parsing/parse`, {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId }),
    }),
}

export interface ParsedContent {
  asset_id: number
  type: string
  text: string
  images?: ParsedImage[]
}
```

### 重构 `ProjectDetail.tsx` 为三栏布局

```
ProjectDetail (phase 状态机)
├── phase=intake  → 左侧渲染现有 intake 内容
├── phase=parsing → 三栏展开，各面板 loading/skeleton
└── phase=editing → 左 ParsedSidebar / 中 EditorCanvas / 右 AiPanelPlaceholder
```

### 新增组件（`components/intake/`）

| 组件 | 职责 |
|------|------|
| `ParsedSidebar` | 左侧解析结果展示，渲染 `ParsedContent[]` 列表 |
| `ParsedItem` | 单条解析结果的文本预览卡片 |

### 编辑器集成

editing 阶段中间面板复用 TipTap 编辑器逻辑（`useEditor` + `A4Canvas` + `useAutoSave`）。

## 4. CSS 与动画

### 布局容器

```css
.workspace {
  display: grid;
  height: 100vh;
  transition: grid-template-columns 300ms ease-in-out;
}
.phase-intake  { grid-template-columns: 1fr 0 0; }
.phase-parsing { grid-template-columns: 320px 1fr 360px; }
.phase-editing { grid-template-columns: 320px 1fr 360px; }
```

### 面板显隐

- 中间/右侧面板：`opacity: 0→1`，`transition-delay` 150ms/200ms
- parsing→editing 左侧内容切换：intake view `display:none`，sidebar view 交叉淡入

### 骨架屏

- 中间：A4 纸张轮廓 + shimmer 灰色条纹
- 右侧：聊天气泡骨架
- shimmer 动画：`background-size: 200%` + 横向扫光

### 设计规范对齐

- 面板展开 300ms `ease-in-out`
- 颜色取自 `ui-design-system.md` 色板
- 布局 transition 用自定义 CSS（Tailwind 原生不支持 Grid 动画），其余用 Tailwind

## 5. 文件变更汇总

| 类型 | 文件 | 说明 |
|------|------|------|
| 新建 | `backend/internal/modules/parsing/handler.go` | parse handler |
| 修改 | `backend/internal/modules/parsing/routes.go` | 接入真实 handler |
| 修改 | `frontend/workbench/src/lib/api-client.ts` | 加 parsingApi |
| 修改 | `frontend/workbench/src/pages/ProjectDetail.tsx` | 重构为三栏布局 |
| 新建 | `frontend/workbench/src/components/intake/ParsedSidebar.tsx` | 解析结果侧栏 |
| 新建 | `frontend/workbench/src/components/intake/ParsedItem.tsx` | 解析结果项 |
| 修改 | `frontend/workbench/src/pages/EditorPage.tsx` | 可能抽取共享 EditorCanvas |
| 删除 | `frontend/workbench/demo-layout-transition.html` | 原型演示文件 |
