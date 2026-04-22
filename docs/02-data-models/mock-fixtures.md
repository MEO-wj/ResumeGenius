# Mock Fixture 策略

更新时间：2026-04-22

本文档定义每个模块的 mock 数据策略，确保每个人可以独立开发测试，不依赖上下游模块的实际实现。

## 1. 原则

- **每个模块只用 JSON 文件 mock**，不依赖真实服务或数据库
- **mock fixture 和契约绑定**，而不是和实现绑定
- **上游 mock = 下游的输入 fixture**，上下游的 fixture 必须和 `02-data-models/` 中的 schema 一致
- **每个模块自己决定内部测试数据**，只要外部契约对齐即可

## 2. Fixture 文件组织

```
fixtures/
  source_asset_set.json      # A 产出 / B 消费
  evidence_set.json           # B 产出 / C/D 消费
  resume_draft_state.json     # B 产出 / C/D/E 消费
  patch_agent.json            # C 产出 / E 消费
  patch_manual.json           # D 产出 / E 消费
  resolved_resume_spec.json   # E 产出（预览/导出消费）
```

每个模块的开发目录下可以有自己的测试 fixture 副本，但**契约 fixture**（上面的文件）由数据模型负责人维护，放在仓库根目录的 `fixtures/` 下。

## 3. 各模块 mock 策略

### 模块 A：资料接入

**上游**：无（A 是起点）

**自己测试用的 mock**：
- 用户上传 PDF 文件 → 本地放一个 `test_fixtures/sample_resume.pdf`
- 用户上传 DOCX → `test_fixtures/sample_resume.docx`

**产出的 fixture（给 B 用）**：

```json
// fixtures/source_asset_set.json
{
  "project_id": "mock_proj_01",
  "assets": [
    {
      "asset_id": "mock_asset_01",
      "type": "resume_pdf",
      "uri": "local://test_fixtures/sample_resume.pdf",
      "metadata": {
        "filename": "sample_resume.pdf",
        "size_bytes": 102400,
        "uploaded_at": "2026-04-22T20:00:00Z"
      }
    }
  ]
}
```

### 模块 B：解析与初稿生成

**输入 mock（替代 A 的输出）**：直接读 `fixtures/source_asset_set.json`

**自己测试用的 mock**：
- 模拟 PDF 解析结果（手动构造 ParsedBlock 列表）
- 模拟 OCR 低置信度场景

**产出的 fixture（给 C/D/E 用）**：

```json
// fixtures/evidence_set.json
{
  "project_id": "mock_proj_01",
  "evidence_items": [
    {
      "evidence_id": "mock_ev_01",
      "source_asset_id": "mock_asset_01",
      "kind": "profile",
      "title": "基本信息",
      "content": "张三 | 前端工程师 | zhangsan@email.com",
      "confidence": 0.95
    },
    {
      "evidence_id": "mock_ev_02",
      "source_asset_id": "mock_asset_01",
      "kind": "work_experience",
      "title": "ABC 科技",
      "content": "高级前端工程师，负责核心产品重构",
      "confidence": 0.88
    },
    {
      "evidence_id": "mock_ev_03",
      "source_asset_id": "mock_asset_01",
      "kind": "education",
      "title": "某大学",
      "content": "计算机科学与技术 本科 2018-2022",
      "confidence": 0.92
    },
    {
      "evidence_id": "mock_ev_04",
      "source_asset_id": "mock_asset_01",
      "kind": "skill",
      "title": "技能",
      "content": "TypeScript, React, Node.js, Python, PostgreSQL",
      "confidence": 0.85
    }
  ]
}
```

```json
// fixtures/resume_draft_state.json
{
  "draft_id": "mock_draft_01",
  "project_id": "mock_proj_01",
  "revision": 1,
  "content": {
    "sections": [
      {
        "section_id": "profile",
        "type": "profile",
        "title": "基本信息",
        "visible": true,
        "items": [
          {
            "item_id": "profile_01",
            "fields": {
              "name": "张三",
              "title": "前端工程师",
              "email": "zhangsan@email.com",
              "phone": "138xxxx1234"
            }
          }
        ]
      },
      {
        "section_id": "experience",
        "type": "work_experience",
        "title": "工作经历",
        "visible": true,
        "items": [
          {
            "item_id": "exp_01",
            "title": "ABC 科技",
            "subtitle": "高级前端工程师",
            "date_range": "2022.07 - 至今",
            "bullets": [
              {
                "bullet_id": "exp_01_bul_01",
                "text": "主导核心产品前端架构重构，将 jQuery 迁移至 React + TypeScript"
              },
              {
                "bullet_id": "exp_01_bul_02",
                "text": "设计并实现组件库，覆盖 30+ 业务组件，团队效率提升 40%"
              }
            ]
          }
        ]
      },
      {
        "section_id": "education",
        "type": "education",
        "title": "教育经历",
        "visible": true,
        "items": [
          {
            "item_id": "edu_01",
            "title": "某大学",
            "subtitle": "计算机科学与技术 本科",
            "date_range": "2018.09 - 2022.06"
          }
        ]
      },
      {
        "section_id": "skills",
        "type": "skills",
        "title": "专业技能",
        "visible": true,
        "items": [
          {
            "item_id": "skill_01",
            "tags": ["TypeScript", "React", "Node.js", "Python", "PostgreSQL"]
          }
        ]
      }
    ]
  },
  "style": {
    "theme": "clean_light",
    "layout": {
      "mode": "single_column",
      "column_ratio": 0.35
    },
    "typography": {
      "body": {
        "font_size": 10.5,
        "line_height": 1.3,
        "letter_spacing": 0
      },
      "heading": {
        "font_size": 16
      }
    },
    "spacing": {
      "paragraph": {
        "after": 6
      },
      "section_gap": 12
    }
  },
  "meta": {
    "target_role": "前端工程师",
    "language": "zh-CN"
  }
}
```

### 模块 C：Agent 编辑

**输入 mock（替代 B 的输出）**：直接读 `fixtures/resume_draft_state.json`

**自己测试用的 mock**：
- 模拟 AI 模型返回（不调真实 GLM-5，用预设 JSON 替代）

**产出的 fixture（给 E 用）**：

```json
// fixtures/patch_agent.json
{
  "patch_id": "mock_patch_agent_01",
  "project_id": "mock_proj_01",
  "draft_id": "mock_draft_01",
  "base_revision": 1,
  "source": "agent",
  "mode": "apply",
  "summary": "压缩工作经历第二条 bullet，使其更精炼",
  "ops": [
    {
      "op_id": "op_01",
      "action": "rewrite_text",
      "target": {
        "domain": "content",
        "section_id": "experience",
        "item_id": "exp_01",
        "bullet_id": "exp_01_bul_02",
        "field": "text"
      },
      "value": "设计组件库 30+ 组件，团队效率提升 40%",
      "reason": "原始 bullet 过长，建议精简为量化表述"
    }
  ],
  "created_at": "2026-04-22T21:00:00Z"
}
```

### 模块 D：人工工作台

**输入 mock（替代 B 的输出）**：直接读 `fixtures/resume_draft_state.json`

**自己测试用的 mock**：
- 模拟用户操作（拖拽排序、修改文本、调整参数）

**产出的 fixture（给 E 用）**：

```json
// fixtures/patch_manual.json
{
  "patch_id": "mock_patch_manual_01",
  "project_id": "mock_proj_01",
  "draft_id": "mock_draft_01",
  "base_revision": 1,
  "source": "manual",
  "mode": "apply",
  "summary": "将正文调为 11pt，减小段距至 4pt",
  "ops": [
    {
      "op_id": "op_01",
      "action": "set",
      "target": {
        "domain": "style",
        "field": "typography.body.font_size"
      },
      "value": 11,
      "unit": "pt"
    },
    {
      "op_id": "op_02",
      "action": "set",
      "target": {
        "domain": "style",
        "field": "spacing.paragraph.after"
      },
      "value": 4,
      "unit": "pt"
    }
  ],
  "created_at": "2026-04-22T21:10:00Z"
}
```

### 模块 E：状态管理与渲染导出

**输入 mock（替代 C/D 的输出）**：直接读 `fixtures/patch_agent.json` 和 `fixtures/patch_manual.json`

**自己测试用的 mock**：
- 手动构造 ResolvedResumeSpec（不依赖解算逻辑）
- 模拟 LaTeX 编译（用预设 PDF 替代真实编译）

**产出的 fixture**：

```json
// fixtures/resolved_resume_spec.json
{
  "draft_id": "mock_draft_01",
  "revision": 2,
  "page": {
    "size": "A4",
    "margin_top": 18,
    "margin_bottom": 16,
    "margin_left": 20,
    "margin_right": 20
  },
  "blocks": [
    {
      "block_id": "blk_profile",
      "section_id": "profile",
      "type": "profile",
      "text_runs": [
        { "text": "张三", "style_ref": "name" },
        { "text": " | ", "style_ref": "separator" },
        { "text": "前端工程师", "style_ref": "title" }
      ],
      "style_ref": "section_body"
    },
    {
      "block_id": "blk_experience",
      "section_id": "experience",
      "type": "work_experience",
      "text_runs": [],
      "style_ref": "section_body"
    }
  ],
  "render_tokens": {
    "body_font_size": 11,
    "heading_font_size": 16,
    "line_height": 1.3,
    "paragraph_after": 4,
    "section_gap": 12,
    "theme": "clean_light"
  }
}
```

## 4. 使用方式

### 开发阶段

```python
# 后端示例：用 fixture 替代上游模块
from pathlib import Path
import json

def load_mock_fixture(name: str) -> dict:
    path = Path("fixtures") / f"{name}.json"
    return json.loads(path.read_text(encoding="utf-8"))

# 不需要 A 模块上传功能，直接读 mock
source_asset_set = load_mock_fixture("source_asset_set")
```

```typescript
// 前端示例：用 fixture 替代 API 响应
import resumeDraft from '../../fixtures/resume_draft_state.json';

// 不需要 B 模块解析完成，直接用 mock 数据渲染
function EditorWithMock() {
  return <Editor draft={resumeDraft} />;
}
```

### 集成测试阶段

当上下游都完成后，通过环境变量切换 mock 和真实服务：

```python
import os

USE_MOCK = os.getenv("USE_MOCK", "true").lower() == "true"

if USE_MOCK:
    data = load_mock_fixture("source_asset_set")
else:
    data = await call_module_a_api()
```

## 5. 维护规则

- `fixtures/` 目录下的文件是**共享契约 fixture**，修改需通知所有模块负责人
- 每个模块内部可以有自己的 `test_fixtures/`，自由修改不影响他人
- fixture 文件必须符合 `02-data-models/` 中定义的 schema
- 任何人发现 fixture 与 schema 不一致，应立即修复并通知
