# 模块 A 契约：资料接入层

## 1. 角色定义

**负责**：

- 项目创建与管理
- 文件上传（PDF / DOCX / PNG / JPG）
- Git 仓库 URL 接入
- 补充文本资料录入
- 资料元信息存储
- 产出 `SourceAssetSet`

**不负责**：

- 文件内容解析（B 的事）
- 证据抽取（B 的事）
- 简历生成（B 的事）

## 2. 输入契约

本模块是管线起点，输入来自用户操作：

| 输入 | 来源 | 格式 |
|---|---|---|
| 创建项目 | 用户操作 | `{ title: string }` |
| 上传文件 | 用户操作 | multipart/form-data |
| Git 仓库 | 用户操作 | `{ repo_url: string }` |
| 补充文本 | 用户操作 | `{ content: string, label?: string }` |

## 3. 输出契约

产出 `SourceAssetSet`，供模块 B 消费。Schema 见 [core-data-model.md](../../02-data-models/core-data-model.md) §3。

Mock fixture：`fixtures/source_asset_set.json`

## 4. API 端点

遵循 [api-conventions.md](../../01-product/api-conventions.md)。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/projects` | 创建项目 |
| GET | `/api/v1/projects` | 项目列表 |
| GET | `/api/v1/projects/{project_id}` | 项目详情 |
| PUT | `/api/v1/projects/{project_id}` | 更新项目（改名等） |
| DELETE | `/api/v1/projects/{project_id}` | 删除项目 |
| POST | `/api/v1/assets/upload` | 上传文件（multipart） |
| GET | `/api/v1/assets?project_id={id}` | 项目资料列表 |
| GET | `/api/v1/assets/{asset_id}` | 资料详情 |
| DELETE | `/api/v1/assets/{asset_id}` | 删除资料 |
| POST | `/api/v1/assets/git` | 接入 Git 仓库 |
| PUT | `/api/v1/assets/git/{asset_id}` | 更新 Git 仓库地址 |
| POST | `/api/v1/assets/notes` | 录入补充文本 |
| GET | `/api/v1/assets/notes?project_id={id}` | 补充文本列表 |
| PUT | `/api/v1/assets/notes/{asset_id}` | 编辑补充文本 |
| DELETE | `/api/v1/assets/notes/{asset_id}` | 删除补充文本 |

### 关键端点详情

#### POST /api/v1/projects

```
Request:
{
  "title": "前端工程师求职简历"
}

Response:
{
  "code": 0,
  "data": {
    "project_id": "proj_01",
    "title": "前端工程师求职简历",
    "status": "active",
    "current_revision": 0,
    "created_at": "2026-04-22T20:00:00Z"
  }
}
```

#### POST /api/v1/assets/upload

```
Request: multipart/form-data
  - file: (binary)
  - project_id: "proj_01"
  - type: "resume_pdf" | "resume_docx" | "resume_image"

Response:
{
  "code": 0,
  "data": {
    "asset_id": "asset_01",
    "type": "resume_pdf",
    "uri": "local://uploads/proj_01/resume.pdf",
    "metadata": {
      "filename": "resume.pdf",
      "size_bytes": 102400
    }
  }
}
```

#### POST /api/v1/assets/notes

```
Request:
{
  "project_id": "proj_01",
  "content": "目标岗位是全栈工程师，偏重后端",
  "label": "求职意向"
}

Response:
{
  "code": 0,
  "data": {
    "asset_id": "asset_02",
    "type": "note",
    "content": "目标岗位是全栈工程师，偏重后端",
    "label": "求职意向",
    "created_at": "2026-04-22T20:10:00Z"
  }
}
```

#### PUT /api/v1/projects/{project_id}

```
Request:
{
  "title": "全栈工程师求职简历 v2"
}

Response:
{
  "code": 0,
  "data": {
    "project_id": "proj_01",
    "title": "全栈工程师求职简历 v2",
    "status": "active",
    "current_revision": 12
  }
}
```

#### PUT /api/v1/assets/notes/{asset_id}

```
Request:
{
  "content": "目标岗位是全栈工程师，偏重基础设施",
  "label": "求职意向"
}

Response:
{
  "code": 0,
  "data": {
    "asset_id": "asset_02",
    "type": "note",
    "content": "目标岗位是全栈工程师，偏重基础设施",
    "label": "求职意向"
  }
}
```

#### DELETE /api/v1/projects/{project_id}

```
Response:
{
  "code": 0,
  "data": null,
  "message": "ok"
}
```

#### PUT /api/v1/assets/git/{asset_id}

```
Request:
{
  "repo_url": "https://github.com/example/new-repo"
}

Response:
{
  "code": 0,
  "data": {
    "asset_id": "asset_git_01",
    "type": "git_repo",
    "uri": "https://github.com/example/new-repo"
  }
}
```

## 5. 依赖与边界

### 上游

- 无（用户直接交互）

### 下游

- 模块 B（解析与初稿生成）消费 `SourceAssetSet`

### 可 mock 的边界

- B 不需要启动 A 的服务，直接读 `fixtures/source_asset_set.json`
- A 不需要知道 B 如何消费，只要 `SourceAssetSet` 结构符合 schema

## 6. 错误码

| 错误码 | HTTP | 含义 |
|---|---|---|
| 01001 | 400 | 文件格式不支持 |
| 01002 | 400 | 文件大小超限（v1 限制 20MB） |
| 01003 | 400 | Git 仓库 URL 无效 |
| 01004 | 404 | 项目不存在 |
| 01005 | 409 | 资料已存在（重复上传同文件） |
| 01006 | 404 | 资料不存在 |

## 7. 测试策略

### 独立测试

- 用本地测试文件（`test_fixtures/sample_resume.pdf` 等）测试上传和存储
- 不需要启动模块 B 的服务
- 不需要数据库（可用 SQLite 内存库替代 PostgreSQL）

### Mock 产出

确保产出的 `SourceAssetSet` JSON 符合 schema，可直接交给 B 的开发人员作为测试输入。

### 前端测试

- 项目创建表单
- 文件上传组件（拖拽 + 点击）
- Git 仓库输入表单
- 资料列表展示

这些 UI 组件可以独立开发和测试，不需要后端 API，前端用 mock handler 拦截请求即可。
