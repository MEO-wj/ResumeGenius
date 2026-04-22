# ResumeGenius 核心数据结构

更新时间：2026-04-22

## 1. 建议的对象分层

当前建议把数据结构拆成 6 层，而不是只保留 `SourceDoc -> ResumeSpec -> ResolvedResumeSpec` 三层。

1. `Project`
2. `SourceAssetSet`
3. `EvidenceSet`
4. `ResumeDraftState`
5. `PatchEnvelope`
6. `ResolvedResumeSpec`

这样拆的原因：

- 现在输入不只是文档，而是文件、Git 仓库和补充资料的组合
- Agent 和人工工作台都需要读“当前草稿状态”
- 渲染层需要一份完全确定性的结果对象

## 2. Project

代表一个完整简历项目。

```json
{
  "project_id": "proj_01",
  "title": "前端工程师求职简历",
  "status": "active",
  "current_revision": 12,
  "created_at": "2026-04-22T20:00:00Z"
}
```

## 3. SourceAssetSet

代表用户提供的原始资料集合。

```json
{
  "project_id": "proj_01",
  "assets": [
    {
      "asset_id": "asset_01",
      "type": "resume_pdf",
      "uri": "oss://bucket/resume.pdf"
    },
    {
      "asset_id": "asset_02",
      "type": "git_repo",
      "uri": "https://github.com/example/repo"
    },
    {
      "asset_id": "asset_03",
      "type": "note",
      "content": "目标岗位是全栈工程师"
    }
  ]
}
```

字段建议：

- `asset_id`
- `type`
- `uri` 或 `content`
- `metadata`

## 4. EvidenceSet

代表从资料中抽取出的结构化证据。

```json
{
  "project_id": "proj_01",
  "evidence_items": [
    {
      "evidence_id": "ev_01",
      "source_asset_id": "asset_02",
      "kind": "project_summary",
      "title": "ResumeGenius",
      "content": "简历编辑 Agent 项目",
      "confidence": 0.82
    }
  ]
}
```

典型 `kind`：

- `profile`
- `education`
- `work_experience`
- `project_summary`
- `skill`
- `award`
- `github_signal`

## 5. ResumeDraftState

代表当前可编辑的简历草稿状态，是系统最核心的对象。

```json
{
  "draft_id": "draft_03",
  "project_id": "proj_01",
  "revision": 12,
  "content": {},
  "style": {},
  "meta": {}
}
```

### 5.1 content

```json
{
  "sections": [
    {
      "section_id": "projects",
      "type": "projects",
      "title": "项目经历",
      "visible": true,
      "items": [
        {
          "item_id": "proj_01",
          "title": "ResumeGenius",
          "subtitle": "个人项目",
          "date_range": "2025.10 - 2026.04",
          "bullets": [
            {
              "bullet_id": "bul_01",
              "text": "负责简历编辑 Agent 的产品和系统设计"
            }
          ]
        }
      ]
    }
  ]
}
```

### 5.2 style

```json
{
  "theme": "clean_light",
  "layout": {
    "mode": "single_column"
  },
  "typography": {
    "body": {
      "font_size": 10.5,
      "line_height": 1.3,
      "letter_spacing": 0
    }
  },
  "spacing": {
    "paragraph": {
      "after": 6
    }
  }
}
```

### 5.3 meta

```json
{
  "target_role": "全栈工程师",
  "language": "zh-CN",
  "source_snapshot_id": "snapshot_01"
}
```

## 6. RevisionRecord

记录每次版本变更。

```json
{
  "revision": 12,
  "patch_id": "patch_03",
  "source": "manual",
  "summary": "调整字号和段距",
  "created_at": "2026-04-22T20:40:00Z"
}
```

## 7. ResolvedResumeSpec

代表进入渲染层前的确定性对象。

```json
{
  "draft_id": "draft_03",
  "revision": 12,
  "page": {
    "size": "A4",
    "margin_top": 18,
    "margin_bottom": 16
  },
  "blocks": [
    {
      "block_id": "blk_01",
      "section_id": "projects",
      "text_runs": [],
      "style_ref": "section_body"
    }
  ],
  "render_tokens": {
    "body_font_size": 10.5,
    "paragraph_after": 6
  }
}
```

要求：

- 所有样式参数数值化
- 所有 section 顺序确定
- 所有可见性确定
- 不保留歧义字段

## 8. 命名建议

建议未来文档统一用下面这组命名：

- `SourceAssetSet`
- `EvidenceSet`
- `ResumeDraftState`
- `RevisionRecord`
- `PatchEnvelope`
- `ResolvedResumeSpec`

不建议继续把所有输入都叫 `SourceDoc`，因为这个名字已经不足以表达 Git 仓库和补充资料。
