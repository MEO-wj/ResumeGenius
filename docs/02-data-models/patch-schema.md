# PatchEnvelope Schema

更新时间：2026-04-22

本文档定义 PatchEnvelope 的完整数据结构。它是 C（Agent 编辑）和 D（人工工作台）的统一输出格式，也是 E（渲染导出）的统一输入格式。

详细的协议设计原则和应用流程见 [patch-protocol.md](../04-editing/patch-protocol.md)。

## 1. PatchEnvelope

```json
{
  "patch_id": "patch_01",
  "project_id": "proj_01",
  "draft_id": "draft_03",
  "base_revision": 12,
  "source": "agent",
  "mode": "apply",
  "summary": "压缩项目经历并收紧整体段距",
  "ops": [],
  "created_at": "2026-04-22T20:50:00Z"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `patch_id` | string | 是 | 全局唯一 ID |
| `project_id` | string | 是 | 所属项目 |
| `draft_id` | string | 是 | 所属草稿 |
| `base_revision` | integer | 是 | 变更基准版本号 |
| `source` | enum | 是 | `agent` / `manual` / `system` |
| `mode` | enum | 是 | `apply`（直接应用）/ `propose`（建议，需确认） |
| `summary` | string | 是 | 面向用户的变更摘要 |
| `ops` | PatchOp[] | 是 | 操作列表，不可为空 |
| `created_at` | string | 是 | ISO 8601 |

## 2. PatchOp

```json
{
  "op_id": "op_01",
  "action": "set",
  "target": {},
  "value": null,
  "unit": "pt",
  "reason": "整体信息密度偏低"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `op_id` | string | 是 | Patch 内唯一 |
| `action` | enum | 是 | 见 §3 |
| `target` | TargetRef | 是 | 见 §4 |
| `value` | any | 视 action | 新值 |
| `unit` | string | 否 | 单位：`pt`、`px`、`%`、`null` |
| `reason` | string | 否 | 变更原因，agent 模式建议必填 |

## 3. Action 枚举

### 3.1 内容类（domain = content）

| Action | 说明 | value 类型 | target 最低要求 |
|---|---|---|---|
| `set` | 设置字段值 | string/number/bool | domain + field |
| `insert_after` | 在节点后插入 | object（新节点完整数据） | domain + section_id + 位置参考 ID |
| `remove` | 删除节点 | null | domain + item_id 或 bullet_id |
| `move_before` | 移动节点顺序 | string（目标位置 ID） | domain + item_id |
| `rewrite_text` | 改写文本 | string | domain + field + bullet_id |

### 3.2 样式类（domain = style）

| Action | 说明 | value 类型 | target 最低要求 |
|---|---|---|---|
| `set` | 修改单个样式字段 | number/string | domain + field |
| `batch_set` | 一次修改多组样式 | object（field→value 映射） | domain |

### 3.3 布局类（domain = layout）

| Action | 说明 | value 类型 | target 最低要求 |
|---|---|---|---|
| `set` | 修改布局参数 | number/string | domain + field |

### 3.4 元信息类（domain = meta）

| Action | 说明 | value 类型 | target 最低要求 |
|---|---|---|---|
| `set` | 修改元信息字段 | string | domain + field |

## 4. TargetRef

```json
{
  "domain": "content",
  "section_id": "projects",
  "item_id": "proj_02",
  "bullet_id": "bul_01",
  "field": "text"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `domain` | enum | 是 | `content` / `style` / `layout` / `meta` |
| `section_id` | string | 视 domain | section 稳定 ID（content/layout 必填） |
| `item_id` | string | 视 domain | section 内条目 ID |
| `bullet_id` | string | 视 domain | bullet ID |
| `field` | string | 视 action | 具体字段路径（支持点号分隔：`typography.body.font_size`） |

## 5. 样式字段路径一览

### 5.1 typography

| 路径 | 值类型 | 允许范围 | 默认 |
|---|---|---|---|
| `typography.body.font_size` | number | 9 – 14 (pt) | 10.5 |
| `typography.body.line_height` | number | 1.0 – 2.0 | 1.3 |
| `typography.body.letter_spacing` | number | -1 – 3 (pt) | 0 |
| `typography.heading.font_size` | number | 14 – 24 (pt) | 16 |

### 5.2 spacing

| 路径 | 值类型 | 允许范围 | 默认 |
|---|---|---|---|
| `spacing.paragraph.after` | number | 0 – 20 (pt) | 6 |
| `spacing.section_gap` | number | 0 – 30 (pt) | 12 |

### 5.3 layout

| 路径 | 值类型 | 允许范围 | 默认 |
|---|---|---|---|
| `layout.mode` | string | `single_column` / `two_column` | `single_column` |
| `layout.column_ratio` | number | 0.2 – 0.5（左栏占比） | 0.35 |

### 5.4 theme

| 路径 | 值类型 | 允许范围 | 默认 |
|---|---|---|---|
| `theme` | string | `clean_light` / `modern` / `compact` | `clean_light` |

## 6. 校验规则摘要

- ops 数组不可为空
- 所有 TargetRef 中引用的 ID 必须在当前 ResumeDraftState 中存在
- 样式数值必须在允许范围内（见 §5）
- base_revision 必须等于当前草稿最新版本号（乐观锁）
- 整包原子性：任一 op 失败则整包回滚
