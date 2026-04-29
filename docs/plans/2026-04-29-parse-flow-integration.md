# Parse 链路打通实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 打通后端 parse API + 前端三栏布局过渡动画，让用户上传文件后能平滑进入编辑器。

**Architecture:** 后端补 parsing handler 接线已有 service；前端重构 ProjectDetail 为单页面三栏布局，用 CSS Grid transition 实现 intake→parsing→editing 的平滑过渡。

**Tech Stack:** Go + Gin (后端), React + TypeScript + Tailwind CSS + TipTap (前端)

**Design doc:** `docs/plans/2026-04-29-parse-flow-integration-design.md`

---

### Task 1: 后端 — parsing handler 单元测试

**Files:**
- Create: `backend/internal/modules/parsing/handler_test.go`
- Read: `backend/internal/modules/parsing/handler.go` (will be created in Task 3)
- Read: `backend/internal/modules/intake/handler.go` (pattern reference)

**Context:** parsing 模块错误码段为 2001-2999，定义在 types.go 中。`UserIDFromContext(c)` 返回 `string`。Handler 结构体持有 `*ParsingService`。Service 的 `Parse(projectID uint)` 返回 `([]ParsedContent, error)`。

**Step 1: Write the failing test**

```go
// backend/internal/modules/parsing/handler_test.go
package parsing

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/UN-Self/ResumeGenius/backend/internal/shared/middleware"
	"github.com/UN-Self/ResumeGenius/backend/internal/shared/models"
)

func init() {
	gin.SetMode(gin.TestMode)
}

type mockParseService struct {
	result []ParsedContent
	err    error
}

func (m *mockParseService) Parse(projectID uint) ([]ParsedContent, error) {
	return m.result, m.err
}

func setupRouter(svc *ParsingService) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(middleware.ContextUserID, "user-123")
		c.Next()
	})
	h := NewHandler(svc)
	r.POST("/parsing/parse", h.ParseProject)
	return r
}

func TestParseProject_Success(t *testing.T) {
	svc := &ParsingService{
		projectExists:     func(uint) (bool, error) { return true, nil },
		listProjectAssets: func(uint) ([]models.Asset, error) { return nil, nil },
	}
	// Use the mock by overriding the parse method through a real parser stub
	pdfParser := &stubPdfParser{result: &ParsedContent{Text: "hello"}}
	svc.pdfParser = pdfParser
	svc.listProjectAssets = func(uint) ([]models.Asset, error) {
		path := "test.pdf"
		return []models.Asset{{ID: 1, Type: AssetTypeResumePDF, URI: &path}}, nil
	}

	r := setupRouter(svc)
	body, _ := json.Marshal(parseRequest{ProjectID: 1})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/parsing/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["code"].(float64) != 0 {
		t.Fatalf("expected code 0, got %v", resp["code"])
	}
}

func TestParseProject_InvalidBody(t *testing.T) {
	r := setupRouter(&ParsingService{})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/parsing/parse", bytes.NewReader([]byte("invalid")))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestParseProject_ProjectNotFound(t *testing.T) {
	svc := &ParsingService{
		projectExists: func(uint) (bool, error) { return false, nil },
	}
	r := setupRouter(svc)
	body, _ := json.Marshal(parseRequest{ProjectID: 99})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/parsing/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestParseProject_NoUsableAssets(t *testing.T) {
	svc := &ParsingService{
		projectExists:     func(uint) (bool, error) { return true, nil },
		listProjectAssets: func(uint) ([]models.Asset, error) { return []models.Asset{}, nil },
	}
	r := setupRouter(svc)
	body, _ := json.Marshal(parseRequest{ProjectID: 1})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/parsing/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestParseProject_Unauthorized(t *testing.T) {
	r := gin.New()
	// No middleware setting user_id
	h := NewHandler(&ParsingService{})
	r.POST("/parsing/parse", h.ParseProject)
	body, _ := json.Marshal(parseRequest{ProjectID: 1})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/parsing/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %d", w.Code, w.Body.Len())
	}
}
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && go test ./internal/modules/parsing/... -run TestParseProject -v`
Expected: FAIL — `NewHandler` not defined, `parseRequest` not defined

**Step 3: Commit test file**

```bash
git add backend/internal/modules/parsing/handler_test.go
git commit -m "test: add parsing handler unit tests"
```

---

### Task 2: 后端 — parsing handler 实现

**Files:**
- Create: `backend/internal/modules/parsing/handler.go`
- Read: `backend/internal/modules/intake/handler.go` (pattern reference)
- Read: `backend/internal/shared/response/response.go` (response helpers)
- Read: `backend/internal/shared/middleware/user.go` (UserIDFromContext)

**Step 1: Implement handler.go**

```go
// backend/internal/modules/parsing/handler.go
package parsing

import (
	"errors"
	"net/http"

	"github.com/UN-Self/ResumeGenius/backend/internal/shared/middleware"
	"github.com/UN-Self/ResumeGenius/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	CodeProjectNotFound = 2003
	CodeNoUsableAssets  = 2004
	CodeParseFailed     = 2001
	CodeParamInvalid    = 2000
	CodeInternalError   = 50001
)

type Handler struct {
	service *ParsingService
}

func NewHandler(service *ParsingService) *Handler {
	return &Handler{service: service}
}

type parseRequest struct {
	ProjectID uint `json:"project_id" binding:"required"`
}

func userID(c *gin.Context) string {
	return middleware.UserIDFromContext(c)
}

func (h *Handler) ParseProject(c *gin.Context) {
	uid := userID(c)
	if uid == "" {
		response.Error(c, 40100, "unauthorized")
		return
	}

	var req parseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, CodeParamInvalid, "project_id is required")
		return
	}

	// Verify project belongs to current user
	var project models.Project
	if err := h.service.db.Where("user_id = ? AND id = ?", uid, req.ProjectID).First(&project).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Error(c, CodeProjectNotFound, "project not found")
			return
		}
		response.Error(c, CodeInternalError, "internal server error")
		return
	}

	parsedContents, err := h.service.Parse(req.ProjectID)
	if err != nil {
		switch {
		case errors.Is(err, ErrProjectNotFound):
			response.Error(c, CodeProjectNotFound, "project not found")
		case errors.Is(err, ErrNoUsableAssets):
			response.Error(c, CodeNoUsableAssets, "project has no usable assets")
		default:
			response.Error(c, CodeParseFailed, "failed to parse project assets")
		}
		return
	}

	response.Success(c, gin.H{"parsed_contents": parsedContents})
}
```

**Step 2: Run tests to verify they pass**

Run: `cd backend && go test ./internal/modules/parsing/... -run TestParseProject -v`
Expected: ALL PASS

**Step 3: Run all backend tests to check for regressions**

Run: `cd backend && go test ./... -v`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add backend/internal/modules/parsing/handler.go
git commit -m "feat: implement parsing handler with user ownership check"
```

---

### Task 3: 后端 — 改造 routes.go 接入真实 handler

**Files:**
- Modify: `backend/internal/modules/parsing/routes.go`
- Read: `backend/internal/modules/parsing/pdf_parser.go` (NewPDFParser)
- Read: `backend/internal/modules/parsing/docx_parser.go` (NewDocxParser)

**Step 1: Replace stub with real handler**

```go
// backend/internal/modules/parsing/routes.go
package parsing

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterRoutes(rg *gin.RouterGroup, db *gorm.DB) {
	pdfParser := NewPDFParser()
	docxParser := NewDocxParser()
	service := NewParsingService(db, pdfParser, docxParser, nil)
	handler := NewHandler(service)
	rg.POST("/parsing/parse", handler.ParseProject)
}
```

**Step 2: Verify compilation**

Run: `cd backend && go build ./cmd/server/...`
Expected: Build succeeds

**Step 3: Run all tests**

Run: `cd backend && go test ./... -v`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add backend/internal/modules/parsing/routes.go
git commit -m "feat: wire parsing handler into routes"
```

---

### Task 4: 前端 — api-client.ts 新增 parsingApi

**Files:**
- Modify: `frontend/workbench/src/lib/api-client.ts`

**Step 1: Add ParsedContent types and parsingApi**

在 `api-client.ts` 文件末尾（`workbenchApi` 之后）添加：

```typescript
// Parsing types
export interface ParsedImage {
  description: string
  data_base64: string
}

export interface ParsedContent {
  asset_id: number
  type: string
  text: string
  images?: ParsedImage[]
}

export const parsingApi = {
  parseProject: (projectId: number) =>
    request<{ parsed_contents: ParsedContent[] }>('/parsing/parse', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId }),
    }),
}
```

**Step 2: Verify TypeScript compilation**

Run: `cd frontend/workbench && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/workbench/src/lib/api-client.ts
git commit -m "feat: add parsingApi to api-client"
```

---

### Task 5: 前端 — 新增 ParsedSidebar 和 ParsedItem 组件

**Files:**
- Create: `frontend/workbench/src/components/intake/ParsedSidebar.tsx`
- Create: `frontend/workbench/src/components/intake/ParsedItem.tsx`
- Read: `frontend/workbench/src/lib/api-client.ts` (ParsedContent type)
- Read: `docs/01-product/ui-design-system.md` (design tokens)

**Context:** 颜色使用 CSS 变量 `var(--color-xxx)`，字号/间距/圆角遵循设计规范。参考 AiPanelPlaceholder 的简洁风格。

**Step 1: Create ParsedItem component**

```tsx
// frontend/workbench/src/components/intake/ParsedItem.tsx
import type { ParsedContent } from '@/lib/api-client'

const TYPE_ICONS: Record<string, string> = {
  resume_pdf: '📄',
  resume_docx: '📝',
  note: '💬',
  git_repo: '💻',
}

const TYPE_LABELS: Record<string, string> = {
  resume_pdf: 'PDF',
  resume_docx: 'DOCX',
  note: '备注',
  git_repo: 'Git',
}

interface ParsedItemProps {
  content: ParsedContent
}

export default function ParsedItem({ content }: ParsedItemProps) {
  const icon = TYPE_ICONS[content.type] || '📄'
  const label = TYPE_LABELS[content.type] || content.type

  return (
    <div className="rounded-lg bg-[var(--color-page-bg)] p-3">
      <div className="mb-1.5 text-xs font-medium text-[var(--color-primary)]">
        {icon} {label}
      </div>
      <div className="max-h-48 overflow-y-auto text-[13px] leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap">
        {content.text}
      </div>
    </div>
  )
}
```

**Step 2: Create ParsedSidebar component**

```tsx
// frontend/workbench/src/components/intake/ParsedSidebar.tsx
import type { ParsedContent } from '@/lib/api-client'
import ParsedItem from './ParsedItem'

interface ParsedSidebarProps {
  contents: ParsedContent[]
}

export default function ParsedSidebar({ contents }: ParsedSidebarProps) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        解析结果
      </h2>
      <div className="flex flex-col gap-2">
        {contents.map((c) => (
          <ParsedItem key={c.asset_id} content={c} />
        ))}
      </div>
    </div>
  )
}
```

**Step 3: Verify TypeScript compilation**

Run: `cd frontend/workbench && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/workbench/src/components/intake/ParsedSidebar.tsx frontend/workbench/src/components/intake/ParsedItem.tsx
git commit -m "feat: add ParsedSidebar and ParsedItem components"
```

---

### Task 6: 前端 — 三栏布局 CSS 样式

**Files:**
- Modify: `frontend/workbench/src/styles/editor.css`
- Read: `frontend/workbench/demo-layout-transition.html` (prototype CSS reference)

**Step 1: Add workspace grid and phase classes to editor.css**

在 `editor.css` 文件末尾（`@media (prefers-reduced-motion: reduce)` 之前）添加：

```css
/* === Project Workspace — Three-phase grid layout === */
.workspace {
  display: grid;
  height: 100vh;
  transition: grid-template-columns 300ms ease-in-out;
}

.workspace.phase-intake {
  grid-template-columns: 1fr 0 0;
}

.workspace.phase-parsing,
.workspace.phase-editing {
  grid-template-columns: 320px 1fr 360px;
}

.workspace .panel-left {
  background: var(--color-card);
  overflow-y: auto;
}

.workspace .panel-center {
  background: var(--color-page-bg);
  overflow: auto;
  padding: 24px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  opacity: 0;
  transition: opacity 400ms ease-in-out 150ms;
}

.workspace .panel-right {
  background: var(--color-card);
  border-left: 1px solid var(--color-divider);
  overflow-y: auto;
  opacity: 0;
  transition: opacity 400ms ease-in-out 200ms;
}

.workspace.phase-parsing .panel-center,
.workspace.phase-parsing .panel-right,
.workspace.phase-editing .panel-center,
.workspace.phase-editing .panel-right {
  opacity: 1;
}

/* Shimmer skeleton */
.skeleton {
  background: linear-gradient(90deg, #e8eaed 25%, #f1f3f4 50%, #e8eaed 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Step 2: Verify no build errors**

Run: `cd frontend/workbench && bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/workbench/src/styles/editor.css
git commit -m "feat: add workspace grid layout and skeleton styles"
```

---

### Task 7: 前端 — 重构 ProjectDetail.tsx 为三栏布局

**Files:**
- Modify: `frontend/workbench/src/pages/ProjectDetail.tsx`
- Read: `frontend/workbench/src/pages/EditorPage.tsx` (editor integration pattern)
- Read: `frontend/workbench/src/components/editor/A4Canvas.tsx` (A4 canvas)
- Read: `frontend/workbench/src/components/editor/WorkbenchLayout.tsx` (existing layout)
- Read: `frontend/workbench/src/components/editor/AiPanelPlaceholder.tsx` (AI panel)
- Read: `frontend/workbench/src/components/editor/ActionBar.tsx` (action bar)
- Read: `frontend/workbench/src/components/editor/FormatToolbar.tsx` (format toolbar)
- Read: `frontend/workbench/src/components/editor/SaveIndicator.tsx` (save indicator)
- Read: `frontend/workbench/src/hooks/useAutoSave.ts` (auto-save hook)

**Context:** 这是最大的一步。需要将现有的全屏 ProjectDetail 重构为三栏布局，并在 editing 阶段集成 TipTap 编辑器。现有 ProjectDetail 的所有 intake 功能保持不变，只是在不同的 phase 下渲染到不同位置。

**Step 1: Rewrite ProjectDetail.tsx**

要点：
- 添加 `phase` state: `'intake' | 'parsing' | 'editing'`
- 添加 `parsedContents` state: `ParsedContent[]`
- 保留所有现有的 intake 逻辑（load, handleUpload, dialogs 等）
- 新增 `handleParse` 函数：调用 `parsingApi.parseProject` → 设置 phase 到 `editing`
- 三栏布局用 `workspace` CSS class + `phase-{name}` modifier
- 左侧面板：intake phase 渲染现有内容（max-w-2xl 居中），editing phase 渲染 `<ParsedSidebar />`
- 中间面板：parsing phase 渲染 A4 骨架屏，editing phase 渲染 TipTap 编辑器（复用 EditorPage 的 useEditor + A4Canvas + useAutoSave）
- 右侧面板：parsing phase 渲染聊天骨架屏，editing phase 渲染 `<AiPanelPlaceholder />`
- editing phase 顶部显示 `<ActionBar />`
- editing phase 底部显示 `<FormatToolbar />`
- 解析失败时显示 toast 错误，phase 回退到 `intake`

完整的实现代码较长，请参考现有 `EditorPage.tsx` 的编辑器集成模式。`useEditor`、`A4Canvas`、`useAutoSave`、`SaveIndicator` 都直接从现有位置导入。

**Step 2: 验证 TypeScript 编译**

Run: `cd frontend/workbench && npx tsc --noEmit`
Expected: No errors

**Step 3: 验证 dev server 启动**

Run: `cd frontend/workbench && bun run dev`
Expected: Server starts on `:3000`

**Step 4: Commit**

```bash
git add frontend/workbench/src/pages/ProjectDetail.tsx
git commit -m "feat: refactor ProjectDetail into three-panel workspace layout"
```

---

### Task 8: 清理 — 删除原型文件

**Files:**
- Delete: `frontend/workbench/demo-layout-transition.html`

**Step 1: Delete demo file**

```bash
rm frontend/workbench/demo-layout-transition.html
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove layout transition demo prototype"
```

---

### Task 9: 端到端验证

**Step 1: 启动后端**

Run: `cd backend && go run cmd/server/main.go`
Expected: Server starts on `:8080`

**Step 2: 启动前端**

Run: `cd frontend/workbench && bun run dev`
Expected: Server starts on `:3000`

**Step 3: 手动测试完整流程**

1. 登录 → 创建项目
2. 上传一个 PDF 文件
3. 点击"下一步：开始解析"
4. 验证：左侧收缩 + 中间/右侧显示骨架屏
5. 解析完成后验证：左侧显示解析结果，中间显示编辑器，右侧显示 AI 面板占位
6. 在编辑器中输入内容，验证自动保存

**Step 4: 运行所有测试**

Run: `cd backend && go test ./... -v`
Run: `cd frontend/workbench && bunx vitest run`
Expected: ALL PASS
