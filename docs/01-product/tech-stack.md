# ResumeGenius 技术栈建议

更新时间：2026-04-23

## 1. 选型原则

- 以 5 人全栈并行开发为前提
- 优先稳定、文档成熟、易于招人和协作的栈
- 部署目标为 2C2G 低配服务器，Docker Compose 一键部署
- Go 负责全部后端逻辑，零 Python 运行时依赖
- 前端拆分：营销站（SEO）+ 工作台（高性能交互）

## 2. 推荐技术栈

### 2.1 前端

**营销站（SEO 优先）：**

- `Astro`
- 构建产物为纯静态 HTML，默认零 JS
- 适合落地页、功能介绍、定价、帮助文档等需要搜索引擎收录的页面

**工作台（交互优先）：**

- `Vite + React + TypeScript`
- UI 层使用 `Tailwind CSS`
- 组件基底可用 `shadcn/ui`

推荐原因：

- Astro 是当前营销站最佳实践，SEO 满分，几乎不占服务器内存
- Vite 相比 Next.js 不需要 Node.js 运行时，Docker 镜像极小（~30MB）
- React 对复杂交互和局部刷新控制更成熟
- TypeScript 有利于和后端协议联调

部署方式：同一个 nginx 容器，`/` 路由到 Astro 产物，`/app/*` 路由到 Vite SPA 产物。

### 2.2 后端

- `Gin + Go`
- 数据访问层使用 `GORM`

推荐原因：

- Go 单二进制部署，内存占用 ~50MB，2C2G 服务器友好
- Gin 高性能 HTTP 框架，适合 API 服务
- GORM 成熟的 Go ORM，支持 PostgreSQL
- 文档解析用 Go 原生库（`ledongthuc/pdf`、`nguyenthenguyen/docx`），无需 Python 运行时
- AI 对话通过 HTTP 调用智谱 API，不依赖 Python ML 框架

### 2.3 数据存储

- 主库：`PostgreSQL` >= 15
- 对象存储：本地文件系统起步，后续可切到 S3 兼容存储

主库建议存：

- 项目（projects）
- 资产元信息（assets）
- 草稿 HTML（drafts）
- 版本快照（versions）
- AI 对话（ai_sessions、ai_messages）

### 2.4 异步任务

v1 用 Go 原生 goroutine + channel 处理异步任务：

- AI 初稿生成（5-15 秒）
- PDF 导出（chromedp，2-5 秒）

如果任务量增长，后续可升级为独立 worker + Redis 队列。

### 2.5 文档解析

- PDF：`github.com/ledongthuc/pdf`（纯 Go，文本提取 + 图片提取）
- DOCX：`github.com/nguyenthenguyen/docx`（纯 Go，段落/表格/样式提取）
- 图片 OCR：v1 先不做本地 OCR，扫描件场景后续通过云端 API（阿里云 OCR）兜底

### 2.6 Agent 层

- 模型调用建议做 `Provider Adapter`，避免业务代码直接绑死单一模型
- 通过 OpenAI-compatible HTTP API 调用，支持任意兼容模型（Deepseek、GLM 等）
- Prompt / Skill / 工具调用均在 Go 侧自行实现
- AI 对话使用 SSE（Server-Sent Events）流式响应
- 先不引入 VLM 主链路

### 2.7 渲染导出

- chromedp（Go 原生库，控制 Chromium）
- 按需启动 Chromium 进程
- 以固定 A4 尺寸渲染 HTML → 调用 page.PrintToPDF() → 返回 PDF
- 并发控制：同一时间只允许一个导出任务
- 导出完成后释放 Chromium 进程（临时增加 ~300MB 内存，2-5 秒后释放）

## 3. 不建议的做法

- 不建议引入 Python 运行时（增加部署复杂度和内存开销）
- 不建议用 Next.js（需要 Node.js 运行时，2C2G 下不划算）
- 不建议用 LaTeX / TeX Live（镜像 1-5GB，部署重，编译慢）
- 不建议一开始就引入微服务
- 不建议先做 VLM 主链路

## 4. 推荐落地形态

### 最小可跑版本

- 前端营销站：Astro（纯静态）
- 前端工作台：Vite + React（纯静态）
- 后端：Gin（Go 单二进制）
- DB：PostgreSQL
- 解析：ledongthuc/pdf + nguyenthenguyen/docx
- 导出：chromedp

### 部署架构

```yaml
# docker-compose.yml
services:
  nginx:          # Astro + Vite 静态文件托管 + API 反代，~10MB
  gin:            # Go API 服务，~50MB
  postgres:       # 数据库，~500MB
```

三个容器，`docker-compose up` 一键启动，总内存 ~560MB（空闲），2C2G 完全够用。

### 升级点

如果 demo 验证通过，再考虑增加：

- Redis 队列 + 独立 worker
- 对象存储（S3 兼容）
- 云端 OCR API（覆盖扫描件场景）
- 更完整的监控与日志

## 5. 参考资料

- Gin 文档：https://gin-gonic.com/docs/
- GORM 文档：https://gorm.io/docs/
- chromedp 文档：https://github.com/chromedp/chromedp
- ledongthuc/pdf 文档：https://github.com/ledongthuc/pdf
- nguyenthenguyen/docx 文档：https://github.com/nguyenthenguyen/docx
- Astro 文档：https://docs.astro.build/
- Vite 文档：https://vitejs.dev/
- Tailwind CSS 安装文档：https://tailwindcss.com/docs/installation/tailwind-cli
- shadcn/ui 文档：https://ui.shadcn.com/docs
- TipTap 文档：https://tiptap.dev/
