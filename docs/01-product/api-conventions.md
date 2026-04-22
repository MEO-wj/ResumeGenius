# ResumeGenius API 规约

更新时间：2026-04-22

本文档定义所有模块的统一 API 规范。所有模块必须遵循此规约，不得自行定义冲突规则。

## 1. 总则

### 1.1 风格

- RESTful API，JSON 序列化
- HTTP 方法语义：GET 读取、POST 创建、PUT 全量更新、PATCH 部分更新、DELETE 删除

### 1.2 版本

- 所有 API 路径以 `/api/v1/` 开头
- v1 稳定后不在此版本路径下做破坏性变更

### 1.3 字符编码

- 请求和响应统一 UTF-8
- Content-Type: `application/json; charset=utf-8`

## 2. 路径规范

### 2.1 格式

```
/api/v1/{module}/{resource}
```

各模块前缀：

| 模块 | 前缀 | 示例 |
|---|---|---|
| A 资料接入 | `/api/v1/assets/` | `POST /api/v1/assets/upload` |
| B 解析与初稿 | `/api/v1/parsing/` | `POST /api/v1/parsing/parse` |
| C Agent 编辑 | `/api/v1/agent/` | `POST /api/v1/agent/chat` |
| D 人工工作台 | `/api/v1/workbench/` | `PATCH /api/v1/workbench/content` |
| E 渲染导出 | `/api/v1/render/` | `POST /api/v1/render/pdf` |
| 项目管理 | `/api/v1/projects/` | `GET /api/v1/projects/{id}` |

### 2.2 命名规则

- 路径用小写 + 短横线：`/source-asset`
- 资源名用复数：`/projects`、`/drafts`
- 路径参数用单数：`/projects/{project_id}`
- ID 类参数带 `_id` 后缀：`project_id`、`draft_id`

## 3. 统一响应格式

### 3.1 成功响应

```json
{
  "code": 0,
  "data": { ... },
  "message": "ok"
}
```

### 3.2 列表响应（带分页）

```json
{
  "code": 0,
  "data": {
    "items": [ ... ],
    "total": 42,
    "page": 1,
    "page_size": 20
  },
  "message": "ok"
}
```

### 3.3 错误响应

```json
{
  "code": 40001,
  "data": null,
  "message": "文件格式不支持"
}
```

## 4. 错误码体系

### 4.1 错误码结构

5 位数字：`SSCCC`

- `SS`：模块编号（00 = 通用，与模块 A-E 对应 01-05）
- `CCC`：模块内错误编号

### 4.2 通用错误码（00xxx）

| 错误码 | HTTP 状态 | 含义 |
|---|---|---|
| 0 | 200 | 成功 |
| 40000 | 400 | 请求参数错误 |
| 40001 | 400 | 数据校验失败 |
| 40100 | 401 | 未认证（v1 预留） |
| 40300 | 403 | 无权限（v1 预留） |
| 40400 | 404 | 资源不存在 |
| 40900 | 409 | 资源冲突 |
| 50000 | 500 | 服务内部错误 |

### 4.3 模块错误码

| 模块 | 编号范围 | 示例 |
|---|---|---|
| A 资料接入 | 01xxx | 01001 = 文件格式不支持 |
| B 解析与初稿 | 02xxx | 02001 = PDF 解析失败 |
| C Agent 编辑 | 03xxx | 03001 = 模型调用超时 |
| D 人工工作台 | 04xxx | 04001 = 参数值越界 |
| E 渲染导出 | 05xxx | 05001 = LaTeX 编译失败 |

各模块在 contract.md 中定义自己的错误码明细。

## 5. 分页规范

- 请求参数：`page`（从 1 开始）、`page_size`（默认 20，最大 100）
- 排序参数：`sort_by`（字段名）、`sort_order`（`asc` / `desc`）
- 不支持游标分页（v1 不需要）

## 6. 认证

- v1 不实现认证，所有 API 无需 token
- 所有请求头预留 `Authorization: Bearer <token>` 位
- 认证上线后，未携带 token 的请求返回 40100

## 7. 异步任务

### 7.1 模式

长时间任务（解析、渲染）采用异步模式：

1. 客户端 POST 触发任务
2. 服务端立即返回任务 ID
3. 客户端轮询任务状态

### 7.2 任务创建响应

```json
{
  "code": 0,
  "data": {
    "task_id": "task_abc123",
    "status": "pending"
  },
  "message": "ok"
}
```

### 7.3 任务状态查询

`GET /api/v1/{module}/tasks/{task_id}`

```json
{
  "code": 0,
  "data": {
    "task_id": "task_abc123",
    "status": "completed",
    "progress": 100,
    "result": { ... }
  },
  "message": "ok"
}
```

任务状态枚举：`pending` → `running` → `completed` / `failed`

## 8. 请求/字段命名

- JSON 字段统一用 `snake_case`：`project_id`、`created_at`
- 日期时间用 ISO 8601：`2026-04-22T20:00:00Z`
- 布尔值用 `is_` / `has_` 前缀：`is_visible`、`has_education`
- 枚举值用 `snake_case`：`source_type = "resume_pdf"`

## 9. 各模块 API 端点

详细端点定义见各模块的 `contract.md` 文件。本文档只定义规约，不定义具体端点。
