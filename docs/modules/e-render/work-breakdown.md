# 模块 E 工作明细：版本管理与 PDF 导出

更新时间：2026-04-23

本文档列出模块 E 负责人的全部开发任务。契约定义见 [contract.md](./contract.md)。

## 1. 概述

模块 E 负责版本管理和 PDF 导出。每次用户保存或 AI 修改确认后自动创建 HTML 快照，用户可以查看版本历史、回退到旧版本，以及导出 PDF。

**核心交付**：HTML 快照版本管理 + chromedp 服务端 PDF 导出。

## 2. 前端任务

### 2.1 组件

| # | 组件 | 说明 |
|---|---|---|
| 1 | `VersionList` | 版本历史列表：版本号 + 标签 + 时间 |
| 2 | `VersionItem` | 单条版本记录，点击可预览该版本 |
| 3 | `RollbackDialog` | 回退确认弹窗：「确定回退到版本 X？」 |
| 4 | `ExportButton` | 导出 PDF 按钮，触发 chromedp |
| 5 | `ExportStatus` | 导出状态指示：导出中 / 导出成功 / 导出失败 |

### 2.2 前端技术要点

- 版本历史以弹窗或侧边抽屉形式展示
- 版本列表按时间倒序
- 回退操作需要二次确认弹窗
- 导出按钮点击后显示 loading 状态
- 导出完成后自动触发浏览器下载
- 导出响应是 PDF 二进制流，需要用 `blob` + `URL.createObjectURL` 处理

## 3. 后端任务

### 3.1 API 端点（4 个）

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 1 | GET | `/api/v1/drafts/{id}/versions` | 版本列表 |
| 2 | POST | `/api/v1/drafts/{id}/versions` | 手动创建快照 |
| 3 | POST | `/api/v1/drafts/{id}/rollback` | 回退到指定版本 |
| 4 | POST | `/api/v1/drafts/{id}/export` | 导出 PDF |

### 3.2 后端服务

| # | 服务 | 说明 |
|---|---|---|
| 1 | `VersionService` | 版本快照 CRUD |
| 2 | `ExportService` | chromedp PDF 导出 |

### 3.3 后端技术要点

- 版本快照只存 HTML，不存 diff
- 回退是将指定版本的 html_snapshot 加载回编辑器（返回给前端），不修改当前草稿
- chromedp 导出：
  - 启动 Chromium 实例
  - 设置页面为 A4 尺寸（210mm × 297mm）
  - 加载 HTML
  - 调用 `page.PrintToPDF()` 生成 PDF
  - 返回 PDF 二进制流
  - 释放 Chromium
- 并发控制：用互斥锁，同一时间只允许一个导出任务
- v1 不做导出权限校验，后续商业化时添加

## 4. 数据库表

| 表名 | 说明 |
|---|---|
| `versions` | 版本快照（id, draft_id, html_snapshot, label, created_at） |

- `html_snapshot` 存完整 HTML（约 5-10KB）
- `label` 为自动生成或用户手动输入的标签

## 5. 测试任务

### 5.1 后端单元测试

| # | 测试 | 说明 |
|---|---|---|
| 1 | 版本创建 | 创建快照，验证 html_snapshot 正确 |
| 2 | 版本列表 | 返回按时间倒序的版本列表 |
| 3 | 回退 | 返回指定版本的 html_snapshot |
| 4 | PDF 导出 | 用预设 PDF mock 测试流程 |
| 5 | 并发控制 | 两个导出请求，第二个返回排队 |
| 6 | 版本不存在 | 返回 05004 |

### 5.2 前端测试

| # | 测试 | 说明 |
|---|---|---|
| 1 | 版本列表 | 展示版本记录 |
| 2 | 回退确认 | 点击回退 → 弹窗确认 → 回退成功 |
| 3 | 导出下载 | 点击导出 → loading → 下载 PDF |

### 5.3 Mock 策略

- 不需要其他模块的服务
- PDF 导出可用预设 PDF 文件 mock
- chromedp 需要 Chromium 环境，开发时可用 mock

## 6. 交付 Checklist

- [ ] 前端：5 个组件（集成在工作台）
- [ ] 后端：4 个 API 端点
- [ ] 后端服务：2 个核心服务（VersionService + ExportService）
- [ ] 数据库：1 张表（versions）
- [ ] chromedp PDF 导出功能
- [ ] 测试：6 个后端单元测试 + 3 个前端测试
- [ ] 错误码使用 05xxx 范围
