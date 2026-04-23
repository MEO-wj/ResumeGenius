# ResumeGenius v2 核心数据模型

更新时间：2026-04-23

## 1. 架构变更说明

v1 采用 6 层数据结构（Project -> SourceAssetSet -> EvidenceSet -> ResumeDraftState -> PatchEnvelope -> ResolvedResumeSpec）+ Patch 协议 + 解算引擎，开发复杂度高。

v2 的核心改变：**HTML 是唯一的数据源**。砍掉所有中间层，数据库只有 6 张表。

废弃的数据结构：

| 已废弃 | v2 替代方案 |
|---|---|
| SourceAssetSet | `assets` 表 |
| EvidenceSet | 不再需要，AI 直接读取原始文本生成 HTML |
| ResumeDraftState | `drafts.html_content`（纯 HTML） |
| PatchEnvelope / PatchOp / TargetRef | 不再需要，AI 直接返回完整 HTML |
| ResolvedResumeSpec | 不再需要，chromedp 直接渲染 HTML 生成 PDF |
| RevisionRecord | `versions` 表（HTML 快照） |

## 2. 数据库 ER 关系

```
projects 1──N assets
projects 1──N drafts
projects 1──1 current_draft (FK)
drafts   1──N versions
drafts   1──N ai_sessions
ai_sessions 1──N ai_messages
```

一个项目有多个资产（上传的文件、Git 仓库、补充文本），有一个当前编辑草稿。一个草稿有多个版本快照和多轮 AI 对话会话。

## 3. 表结构详细说明

### 3.1 projects

项目表，代表一个完整的简历编辑项目。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | 自增主键 |
| `title` | VARCHAR(200) | NOT NULL | 项目标题，如"前端工程师求职简历" |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'active' | `active` / `archived` |
| `current_draft_id` | INTEGER | FK -> drafts(id) | 当前编辑中的草稿 ID，可为 NULL（未生成初稿时） |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 最后更新时间 |

**Go GORM 模型**：

```go
type Project struct {
    ID             uint      `gorm:"primaryKey" json:"id"`
    Title          string    `gorm:"size:200;not null" json:"title"`
    Status         string    `gorm:"size:20;not null;default:'active'" json:"status"`
    CurrentDraftID *uint     `gorm:"" json:"current_draft_id"`
    CurrentDraft   *Draft    `gorm:"foreignKey:CurrentDraftID" json:"current_draft,omitempty"`
    Assets         []Asset   `gorm:"foreignKey:ProjectID" json:"assets,omitempty"`
    Drafts         []Draft   `gorm:"foreignKey:ProjectID" json:"drafts,omitempty"`
    CreatedAt      time.Time `json:"created_at"`
    UpdatedAt      time.Time `json:"updated_at"`
}
```

### 3.2 assets

资产表，存储用户上传的文件、Git 仓库和补充文本。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | 自增主键 |
| `project_id` | INTEGER | NOT NULL, FK -> projects(id) | 所属项目 |
| `type` | VARCHAR(50) | NOT NULL | 资产类型，见下方枚举 |
| `uri` | TEXT | 可为 NULL | 文件路径（本地磁盘）或 Git 仓库 URL |
| `content` | TEXT | 可为 NULL | 补充文本内容（type=note 时使用） |
| `label` | VARCHAR(100) | 可为 NULL | 补充文本的标签（type=note 时使用） |
| `metadata` | JSONB | 可为 NULL | 附加元信息，如文件大小、上传时间 |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 最后更新时间 |

#### asset.type 枚举值

| 类型 | uri | content | label | 说明 |
|---|---|---|---|---|
| `resume_pdf` | 本地文件路径 | NULL | NULL | 用户上传的 PDF 简历 |
| `resume_docx` | 本地文件路径 | NULL | NULL | 用户上传的 DOCX 简历 |
| `resume_image` | 本地文件路径 | NULL | NULL | 用户上传的头像或截图 |
| `git_repo` | Git 仓库 URL | NULL | NULL | GitHub/GitLab 仓库链接 |
| `note` | NULL | 文本内容 | 用户自定义标签 | 手动录入的补充信息 |

#### metadata JSONB 示例

```json
// resume_pdf / resume_docx / resume_image
{
  "filename": "zhangsan_resume.pdf",
  "size_bytes": 102400,
  "mime_type": "application/pdf",
  "uploaded_at": "2026-04-23T10:00:00Z"
}

// git_repo
{
  "repo_url": "https://github.com/zhangsan/project",
  "connected_at": "2026-04-23T10:05:00Z",
  "branch": "main"
}
```

**Go GORM 模型**：

```go
type Asset struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    ProjectID uint      `gorm:"not null;index" json:"project_id"`
    Type      string    `gorm:"size:50;not null" json:"type"`
    URI       *string   `gorm:"type:text" json:"uri,omitempty"`
    Content   *string   `gorm:"type:text" json:"content,omitempty"`
    Label     *string   `gorm:"size:100" json:"label,omitempty"`
    Metadata  JSONB     `gorm:"type:jsonb" json:"metadata,omitempty"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}
```

### 3.3 drafts

草稿表，v2 的核心表。HTML 是唯一数据源。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | 自增主键 |
| `project_id` | INTEGER | NOT NULL, FK -> projects(id) | 所属项目 |
| `html_content` | TEXT | NOT NULL | 简历 HTML 内容（唯一数据源） |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 最后更新时间（每次保存/修改时更新） |

**说明**：
- `html_content` 存储完整的简历 HTML（含 `<style>` 标签），可直接在浏览器中渲染
- 前端 TipTap 编辑器加载此 HTML 进行编辑
- AI 修改也直接返回完整 HTML，用户确认后替换此字段
- 一份典型简历 HTML 约 5-10KB，使用 TEXT 类型完全足够

**Go GORM 模型**：

```go
type Draft struct {
    ID          uint      `gorm:"primaryKey" json:"id"`
    ProjectID   uint      `gorm:"not null;index" json:"project_id"`
    HTMLContent string    `gorm:"type:text;not null" json:"html_content"`
    Project     Project   `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
    Versions    []Version `gorm:"foreignKey:DraftID" json:"versions,omitempty"`
    AISessions  []AISession `gorm:"foreignKey:DraftID" json:"ai_sessions,omitempty"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}
```

### 3.4 versions

版本快照表，记录草稿的历史版本。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | 自增主键 |
| `draft_id` | INTEGER | NOT NULL, FK -> drafts(id) | 所属草稿 |
| `html_snapshot` | TEXT | NOT NULL | 该版本的 HTML 快照 |
| `label` | VARCHAR(200) | 可为 NULL | 版本标签，如"AI 初始生成"、"手动保存"、"AI 修改：精简项目经历" |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 创建时间 |

**说明**：
- 每次用户手动保存或确认 AI 修改后，自动创建快照
- 版本快照只存 HTML，一份约 5-10KB，存储成本极低
- 回退操作：将指定版本的 `html_snapshot` 写回 `drafts.html_content`，并创建新的快照

**Go GORM 模型**：

```go
type Version struct {
    ID           uint      `gorm:"primaryKey" json:"id"`
    DraftID      uint      `gorm:"not null;index" json:"draft_id"`
    HTMLSnapshot string    `gorm:"type:text;not null" json:"html_snapshot"`
    Label        *string   `gorm:"size:200" json:"label,omitempty"`
    CreatedAt    time.Time `json:"created_at"`
}
```

### 3.5 ai_sessions

AI 对话会话表，每轮独立的 AI 对话。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | 自增主键 |
| `draft_id` | INTEGER | NOT NULL, FK -> drafts(id) | 关联的草稿 |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 创建时间 |

**说明**：
- 一个草稿可以有多轮 AI 对话会话
- 每次打开 AI 面板创建新会话，之前的会话保留用于查看历史
- 每个会话有自己的消息列表（ai_messages）

**Go GORM 模型**：

```go
type AISession struct {
    ID        uint        `gorm:"primaryKey" json:"id"`
    DraftID   uint        `gorm:"not null;index" json:"draft_id"`
    Draft     Draft       `gorm:"foreignKey:DraftID" json:"draft,omitempty"`
    Messages  []AIMessage `gorm:"foreignKey:SessionID" json:"messages,omitempty"`
    CreatedAt time.Time   `json:"created_at"`
}
```

### 3.6 ai_messages

AI 对话消息表，记录每条对话内容。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | 自增主键 |
| `session_id` | INTEGER | NOT NULL, FK -> ai_sessions(id) | 所属会话 |
| `role` | VARCHAR(20) | NOT NULL | `user` 或 `assistant` |
| `content` | TEXT | NOT NULL | 消息内容。assistant 消息中可能包含修改后的 HTML |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 创建时间 |

**说明**：
- `role=user`：用户发送的修改需求文本
- `role=assistant`：AI 回复内容。回复格式约定：
  - 先输出文字说明（修改建议的解读）
  - 以 `<!--RESUME_HTML_START-->` 分隔符标记 HTML 内容开始
  - 以 `<!--RESUME_HTML_END-->` 分隔符标记 HTML 内容结束
  - 前端据此提取 HTML 供用户预览和确认

**Go GORM 模型**：

```go
type AIMessage struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    SessionID uint      `gorm:"not null;index" json:"session_id"`
    Session   AISession `gorm:"foreignKey:SessionID" json:"session,omitempty"`
    Role      string    `gorm:"size:20;not null" json:"role"`  // "user" | "assistant"
    Content   string    `gorm:"type:text;not null" json:"content"`
    CreatedAt time.Time `json:"created_at"`
}
```

## 4. 数据关系说明

1. **项目 -> 资产**：一对多。一个项目可以有多个上传文件、Git 仓库和补充文本。删除项目时级联删除所有资产。
2. **项目 -> 草稿**：一对多。一个项目可以有多个草稿（历史版本），但 `current_draft_id` 指向当前编辑的那个。
3. **草稿 -> 版本快照**：一对多。每次保存操作产生一个快照。快照是只读的，不可修改。
4. **草稿 -> AI 会话**：一对多。一个草稿可以有多轮 AI 对话。
5. **AI 会话 -> AI 消息**：一对多。每条消息按时间顺序排列。

## 5. JSONB 自定义类型（Go）

GORM 默认不支持 JSONB，需要自定义类型：

```go
// JSONB 自定义类型，支持 GORM scan/value
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
    if j == nil {
        return nil, nil
    }
    return json.Marshal(j)
}

func (j *JSONB) Scan(value interface{}) error {
    if value == nil {
        *j = nil
        return nil
    }
    bytes, ok := value.([]byte)
    if !ok {
        return fmt.Errorf("failed to unmarshal JSONB value: %v", value)
    }
    return json.Unmarshal(bytes, j)
}
```

## 6. 索引建议

```sql
-- 高频查询索引
CREATE INDEX idx_assets_project_id ON assets(project_id);
CREATE INDEX idx_drafts_project_id ON drafts(project_id);
CREATE INDEX idx_versions_draft_id ON versions(draft_id);
CREATE INDEX idx_ai_sessions_draft_id ON ai_sessions(draft_id);
CREATE INDEX idx_ai_messages_session_id ON ai_messages(session_id);

-- 排序查询索引（版本列表按时间倒序）
CREATE INDEX idx_versions_draft_id_created ON versions(draft_id, created_at DESC);

-- AI 消息排序
CREATE INDEX idx_ai_messages_session_id_created ON ai_messages(session_id, created_at ASC);
```
