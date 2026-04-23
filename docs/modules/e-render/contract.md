# 模块 E 契约：版本管理与 PDF 导出

更新时间：2026-04-23

## 1. 角色定义

**负责**：

- HTML 快照版本管理
- 版本列表（版本号 + 时间 + 标签）
- 回退：将历史快照加载回编辑器
- PDF 导出（chromedp 服务端渲染）
- 导出权限校验（商业化预留）

**不负责**：

- HTML 编辑（D 的事）
- AI 对话（C 的事）
- 文件解析（B 的事）

## 2. 输入契约

| 数据 | 来源 | 说明 |
|---|---|---|
| `drafts.html_content` | 模块 D | 当前编辑器 HTML |

## 3. 输出契约

### 3.1 版本快照

每次保存或 AI 修改确认后，自动创建 HTML 快照存入 versions 表。

一份 HTML 约 5-10KB。

### 3.2 PDF 文件

chromedp 以 A4 尺寸渲染 HTML → `page.PrintToPDF()` → 返回 PDF 二进制流。

## 4. API 端点

遵循 [api-conventions.md](../../01-product/api-conventions.md)。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/drafts/{id}/versions` | 版本列表 |
| POST | `/api/v1/drafts/{id}/versions` | 手动创建快照 |
| POST | `/api/v1/drafts/{id}/rollback` | 回退到指定版本 |
| POST | `/api/v1/drafts/{id}/export` | 导出 PDF |

### 关键端点详情

#### GET /api/v1/drafts/{id}/versions

```
Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": 1,
        "label": "AI 初始生成",
        "created_at": "2026-04-23T20:00:00Z"
      },
      {
        "id": 2,
        "label": "手动保存",
        "created_at": "2026-04-23T20:10:00Z"
      },
      {
        "id": 3,
        "label": "AI 修改：精简项目经历",
        "created_at": "2026-04-23T20:15:00Z"
      }
    ],
    "total": 3
  }
}
```

#### POST /api/v1/drafts/{id}/versions

手动创建一个快照。

```
Request:
{
  "label": "精简版"
}

Response:
{
  "code": 0,
  "data": {
    "id": 4,
    "label": "精简版",
    "created_at": "2026-04-23T20:20:00Z"
  }
}
```

#### POST /api/v1/drafts/{id}/rollback

将指定版本快照加载回编辑器。

```
Request:
{
  "version_id": 1
}

Response:
{
  "code": 0,
  "data": {
    "html_snapshot": "<!DOCTYPE html>...该版本的 HTML..."
  }
}
```

#### POST /api/v1/drafts/{id}/export

导出 PDF。

```
Request:
{
  "html_content": "<!DOCTYPE html>...当前编辑器 HTML..."
}

Response: application/pdf (binary)
```

v1 不做权限校验，直接返回 PDF。后续商业化时添加付费校验（40300）。

## 5. 版本自动创建

以下操作自动创建版本快照：

| 触发 | 来源 | label |
|---|---|---|
| AI 初稿生成 | 模块 B | "AI 初始生成" |
| AI 对话修改确认 | 模块 C | "AI 修改：{用户需求摘要}" |
| 用户手动保存 | 模块 D | "手动保存" |

自动创建通过调用 `POST /api/v1/drafts/{id}/versions` 实现。

## 6. chromedp PDF 导出流程

```
接收 HTML
     │
     ▼
校验导出权限 ── 失败 ──▶ 返回 40300
     │
   成功
     │
     ▼
检查并发锁 ── 已占用 ──▶ 返回 05003 排队中
     │
   空闲
     │
     ▼
启动 Chromium 实例
     │
     ▼
设置 A4 尺寸页面
     │
     ▼
加载 HTML
     │
     ▼
调用 page.PrintToPDF()
     │
     ▼
返回 PDF 二进制流
     │
     ▼
释放 Chromium 进程
```

并发控制：同一时间只允许一个导出任务，其余排队等待。

## 7. 依赖与边界

### 上游

- 模块 D 更新 drafts.html_content

### 下游

- 用户（下载 PDF、查看版本历史）

### 可 mock 的边界

- 不需要其他模块的服务
- PDF 导出可用预设 PDF 文件替代真实 chromedp

## 8. 错误码

| 错误码 | HTTP | 含义 |
|---|---|---|
| 05001 | 500 | PDF 导出失败 |
| 05002 | 404 | 草稿不存在 |
| 05003 | 409 | 导出任务排队中 |
| 05004 | 404 | 版本不存在 |

## 9. 测试策略

### 独立测试

- 版本创建和列表用内存测试
- PDF 导出可用预设 PDF mock，先测试流程
- 有 Chromium 环境时测试完整导出

### 前端测试

- 版本历史列表
- 回退确认弹窗
- 导出下载按钮
