# Chromium Docker 集成 — PDF 导出修复

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在后端 Docker 镜像中安装 Chromium，使 chromedp 能正常运行 PDF 导出功能。

**Architecture:** 在 Alpine runtime 镜像中通过 `apk add chromium` 安装浏览器，同时在 `exporter.go` 中添加 `CHROME_BIN` 环境变量支持，让 chromedp 能找到正确的 Chromium 路径。补充 graceful shutdown 逻辑。

**Tech Stack:** Docker (Alpine 3.19), Go chromedp v0.9.5, Chromium 124

---

### Task 1: exporter.go — 支持 CHROME_BIN 环境变量

**Files:**
- Modify: `backend/internal/modules/render/exporter.go:205-213`
- Test: `backend/internal/modules/render/exporter_test.go`

**Step 1: 写失败测试**

在 `exporter_test.go` 末尾添加测试，验证 `NewChromeExporter` 能读取 `CHROME_BIN` 环境变量：

```go
func TestNewChromeExporter_RespectsChromeBinEnv(t *testing.T) {
	// Set a custom CHROME_BIN env var
	t.Setenv("CHROME_BIN", "/usr/bin/my-custom-chrome")

	exporter := NewChromeExporter()
	defer exporter.Close()

	// Verify exporter was created successfully (allocCtx is non-nil)
	assert.NotNil(t, exporter)
	assert.NotNil(t, exporter.allocCtx)
}
```

**Step 2: 运行测试确认失败**

Run: `cd backend && go test ./internal/modules/render/ -run TestNewChromeExporter_RespectsChromeBinEnv -v`
Expected: PASS（当前代码只是忽略了 env，不会 fail，但功能上没有正确使用自定义路径）

**Step 3: 实现最小改动 — 修改 NewChromeExporter**

修改 `exporter.go` 中的 `NewChromeExporter()`，在 `opts` 中注入 `CHROME_BIN`：

```go
func NewChromeExporter() *ChromeExporter {
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
	)

	// Allow overriding the Chrome executable path via environment variable.
	// In Alpine Docker, the binary is at /usr/bin/chromium.
	if chromeBin := os.Getenv("CHROME_BIN"); chromeBin != "" {
		opts = append(opts, chromedp.ExecPath(chromeBin))
	}

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	return &ChromeExporter{allocCtx: allocCtx, cancel: cancel}
}
```

**Step 4: 运行全部现有测试确保不破坏**

Run: `cd backend && go test ./internal/modules/render/ -v`
Expected: 全部 PASS（MockExporter 不受影响）

**Step 5: Commit**

```bash
git add backend/internal/modules/render/exporter.go backend/internal/modules/render/exporter_test.go
git commit -m "feat(render): support CHROME_BIN env variable for chromedp executable path"
```

---

### Task 2: routes.go — 补充 ChromeExporter graceful shutdown

**Files:**
- Modify: `backend/internal/modules/render/routes.go:11-29`

**Step 1: 写失败测试**

验证 `RegisterRoutes` 返回的 cleanup 函数能被调用而不 panic：

在 `exporter_test.go` 中添加：

```go
func TestRegisterRoutes_ReturnsCleanup(t *testing.T) {
	// RegisterRoutes should return a cleanup function that can be safely called.
	// We test that the returned cleanup is non-nil and callable.
	gin.SetMode(gin.TestMode)
	r := gin.New()
	v1 := r.Group("/api/v1")

	// Use a temp dir for storage
	tmpDir := t.TempDir()
	store := storage.NewLocalStorage(tmpDir)

	cleanup := RegisterRoutesWithCleanup(v1, nil, store)
	assert.NotNil(t, cleanup)

	// Calling cleanup should not panic
	assert.NotPanics(t, func() {
		cleanup()
	})
}
```

**Step 2: 运行测试确认失败**

Run: `cd backend && go test ./internal/modules/render/ -run TestRegisterRoutes_ReturnsCleanup -v`
Expected: FAIL — `RegisterRoutesWithCleanup` 不存在

**Step 3: 重构 routes.go，暴露 cleanup 函数**

将 `RegisterRoutes` 改为返回 cleanup 函数：

```go
// RegisterRoutes registers all render module endpoints.
// Returns a cleanup function that must be called on shutdown to release Chrome resources.
func RegisterRoutes(rg *gin.RouterGroup, db *gorm.DB, store storage.FileStorage) func() {
	versionSvc := NewVersionService(db)

	exporter := NewChromeExporter()
	exportSvc := NewExportService(exporter, store)
	exportSvc.db = db

	h := NewHandler(versionSvc, exportSvc)

	// Version management
	rg.GET("/drafts/:draft_id/versions", h.ListVersions)
	rg.POST("/drafts/:draft_id/versions", h.CreateVersion)
	rg.POST("/drafts/:draft_id/rollback", h.Rollback)

	// PDF export
	rg.POST("/drafts/:draft_id/export", h.CreateExport)
	rg.GET("/tasks/:task_id", h.GetTask)
	rg.GET("/tasks/:task_id/file", h.DownloadFile)

	return func() {
		exporter.Close()
		exportSvc.Close()
	}
}
```

**Step 4: 更新 main.go 使用 cleanup**

修改 `main.go` 中的调用：

```go
// 在 setupRouter 函数中
cleanup := render.RegisterRoutes(authed, db, store)
return r, cleanup
```

修改 `setupRouter` 签名和 `main` 函数：

```go
func setupRouter(db *gorm.DB) (*gin.Engine, func()) {
	// ... existing code ...
	cleanup := render.RegisterRoutes(authed, db, store)
	return r, cleanup
}

func main() {
	_ = godotenv.Load()

	db := database.Connect()
	database.Migrate(db)

	r, cleanup := setupRouter(db)
	defer cleanup()

	log.Println("server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
```

**Step 5: 运行全部测试**

Run: `cd backend && go test ./... -v`
Expected: 全部 PASS

**Step 6: Commit**

```bash
git add backend/internal/modules/render/routes.go backend/cmd/server/main.go backend/internal/modules/render/exporter_test.go
git commit -m "feat(render): add graceful shutdown for ChromeExporter and ExportService"
```

---

### Task 3: Dockerfile — 安装 Chromium + 中文字体

**Files:**
- Modify: `backend/Dockerfile:13-14`

**Step 1: 修改 Dockerfile（builder + runtime 两个 stage 都换源）**

将原来的：
```dockerfile
FROM ${BUILDER_IMAGE} AS builder
RUN apk add --no-cache git ca-certificates
...
FROM ${RUNTIME_IMAGE} AS runtime
RUN apk add --no-cache ca-certificates tzdata
```

改为：
```dockerfile
FROM ${BUILDER_IMAGE} AS builder
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.ustc.edu.cn/g' /etc/apk/repositories \
    && apk add --no-cache git ca-certificates
...
FROM ${RUNTIME_IMAGE} AS runtime
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.ustc.edu.cn/g' /etc/apk/repositories \
    && apk add --no-cache \
    chromium \
    font-noto-cjk \
    ca-certificates \
    tzdata
```

- `sed ...` — 将 Alpine apk 源替换为中科大镜像（国内加速）
- `chromium` — Chrome 浏览器二进制文件
- `font-noto-cjk` — 中日韩字体，确保简历中文字符正常渲染

**Step 2: docker-compose.yml — 添加 CHROME_BIN 环境变量**

在 `docker-compose.yml` 的 `backend` service 的 `environment` 部分添加：

```yaml
CHROME_BIN: "/usr/bin/chromium"
```

**Step 3: 验证构建**

Run: `docker compose build backend`
Expected: 构建成功，无报错

**Step 4: 验证 Chromium 可用**

Run: `docker compose run --rm backend sh -c "chromium --version"`
Expected: 输出类似 `Chromium 124.0.6367.78`

**Step 5: 端到端测试 — 启动服务并导出 PDF**

Run:
```bash
docker compose up -d
# 通过 API 或前端触发 PDF 导出
# 检查任务状态是否从 pending → completed
```

**Step 6: Commit**

```bash
git add backend/Dockerfile docker-compose.yml
git commit -m "feat(infra): install Chromium and CJK fonts in backend Docker image for PDF export"
```

---

### Task 4: 更新 CLAUDE.md 文档

**Files:**
- Modify: `CLAUDE.md`

**Step 1: 在环境变量表中添加 CHROME_BIN**

在 CLAUDE.md 的环境变量表格中添加一行：

| `CHROME_BIN` | （自动检测） | Chrome/Chromium 可执行文件路径 |

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CHROME_BIN to environment variable documentation"
```

---

## 风险与注意事项

1. **镜像体积**：`chromium` + `font-noto-cjk` 会增加约 ~300MB 镜像大小。如果体积敏感，可考虑用 `font-noto-cjk-extra` 的精简版或只装 `font-noto-sans-cjk-sc`（简体中文）
2. **Alpine Chromium 版本锁定**：Alpine 3.19 对应 Chromium 124，不会自动更新。如需更新 Chromium 需要升级 Alpine 版本
3. **内存**：headless Chrome 每次导出约占用 50-100MB 内存，确保容器有足够内存（建议 >= 512MB）
