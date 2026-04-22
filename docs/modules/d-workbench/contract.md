# 模块 D 契约：人工工作台

## 1. 角色定义

**负责**：

- 内容编辑 UI：section 文本编辑、bullet 增删改、顺序调整、显隐切换
- 样式编辑 UI：字号档位、行距档位、段距档位、主题切换、布局模式
- 参数校验（前端 + 后端双重校验）
- 生成 Manual Patch（`PatchEnvelope` with `source=manual`）

**不负责**：

- AI 对话和自动建议（C 的事）
- Patch 应用和状态管理（E 的事）
- 渲染和 PDF 导出（E 的事）
- 文件解析（B 的事）

## 2. 输入契约

| 数据 | 来源 | Mock fixture |
|---|---|---|
| `ResumeDraftState` | 模块 B | `fixtures/resume_draft_state.json` |
| 用户操作 | 前端交互 | 无需 mock |

## 3. 输出契约

产出 `PatchEnvelope`（`source=manual`）。Schema 见 [patch-schema.md](../../02-data-models/patch-schema.md)。

与 C 的区别：
- `source` 固定为 `manual`
- `mode` 固定为 `apply`（人工操作直接生效，无需确认环节）
- `reason` 字段可选（人工操作不强制填写原因）

Mock fixture：`fixtures/patch_manual.json`

## 4. API 端点

遵循 [api-conventions.md](../../01-product/api-conventions.md)。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/workbench/drafts/{draft_id}` | 获取当前草稿（含最新状态） |
| PATCH | `/api/v1/workbench/content` | 提交内容修改 |
| PATCH | `/api/v1/workbench/style` | 提交样式修改 |
| PATCH | `/api/v1/workbench/layout` | 提交布局修改 |
| GET | `/api/v1/workbench/style-presets` | 获取样式预设列表 |

### 关键端点详情

#### PATCH /api/v1/workbench/content

```
Request:
{
  "draft_id": "draft_03",
  "base_revision": 12,
  "ops": [
    {
      "action": "rewrite_text",
      "target": {
        "domain": "content",
        "section_id": "experience",
        "item_id": "exp_01",
        "bullet_id": "exp_01_bul_02",
        "field": "text"
      },
      "value": "设计组件库 30+ 组件，团队效率提升 40%"
    }
  ]
}

Response:
{
  "code": 0,
  "data": {
    "patch": { ... PatchEnvelope ... }
  }
}
```

#### PATCH /api/v1/workbench/style

```
Request:
{
  "draft_id": "draft_03",
  "base_revision": 12,
  "ops": [
    {
      "action": "batch_set",
      "target": { "domain": "style" },
      "value": {
        "typography.body.font_size": 11,
        "spacing.paragraph.after": 4
      }
    }
  ]
}

Response:
{
  "code": 0,
  "data": {
    "patch": { ... PatchEnvelope ... }
  }
}
```

#### GET /api/v1/workbench/style-presets

```
Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "preset_id": "clean_light",
        "name": "简洁浅色",
        "style": {
          "theme": "clean_light",
          "typography": { ... },
          "spacing": { ... }
        }
      },
      {
        "preset_id": "modern",
        "name": "现代风格",
        "style": { ... }
      },
      {
        "preset_id": "compact",
        "name": "紧凑风格",
        "style": { ... }
      }
    ]
  }
}
```

## 5. 前端组件结构

### 5.1 编辑器主区域

```
┌──────────────────────────────────────────┐
│  Section 导航栏（可拖拽排序）             │
├──────────────────────────────────────────┤
│                                          │
│  Section 内容编辑区                       │
│  · section 标题（可编辑）                 │
│  · item 卡片列表                         │
│    · 标题、副标题、日期（输入框）          │
│    · bullet 列表（可增删改、拖拽排序）     │
│  · 添加 item 按钮                        │
│                                          │
├──────────────────────────────────────────┤
│  操作栏：保存 / 撤销 / 重做              │
└──────────────────────────────────────────┘
```

### 5.2 样式参数面板（右侧栏）

```
┌──────────────────────┐
│  主题切换             │
│  ○ 简洁浅色           │
│  ○ 现代风格           │
│  ○ 紧凑风格           │
├──────────────────────┤
│  排版参数             │
│  正文字号  [9──●──14] │
│  行距      [1.0─●─2.0]│
│  段距      [0──●──20] │
│  标题字号  [14──●──24] │
├──────────────────────┤
│  布局参数             │
│  布局模式  [单栏 ▼]   │
│  栏比例    [0.2─●─0.5]│
├──────────────────────┤
│  Section 间距         │
│  section gap [0─●─30] │
└──────────────────────┘
```

### 5.3 交互规范

- 参数修改立即生成 Patch 并发送到后端
- 内容修改在失焦或按 Enter 时生成 Patch
- section 拖拽排序在释放时生成 `move_before` Patch
- 所有操作都走 Patch 机制，不直接修改全局状态
- 前端做即时乐观更新，后端校验失败时回退

## 6. 参数校验规则

| 参数 | 前端校验 | 后端校验 |
|---|---|---|
| 正文字号 | 滑块范围 9-14 | 必须在允许范围内 |
| 行距 | 滑块范围 1.0-2.0 | 必须在允许范围内 |
| 段距 | 滑块范围 0-20 | 必须在允许范围内 |
| 标题字号 | 滑块范围 14-24 | 必须在允许范围内 |
| 栏比例 | 滑块范围 0.2-0.5 | 必须在允许范围内 |
| 文本内容 | 非空（bullet） | 长度 ≤ 500 字符 |

## 7. 依赖与边界

### 上游

- 模块 B 产出 `ResumeDraftState`

### 下游

- 模块 E（渲染导出）消费 `PatchEnvelope(source=manual)`

### 可 mock 的边界

- **不需要 B 的服务**：直接读 `fixtures/resume_draft_state.json`
- **不需要 E 的服务**：D 只负责产出 Patch，不负责应用
- **前端可以完全独立开发**：用 mock 数据渲染编辑器，用 mock handler 拦截 API

## 8. 错误码

| 错误码 | HTTP | 含义 |
|---|---|---|
| 04001 | 400 | 参数值越界 |
| 04002 | 400 | 目标节点不存在 |
| 04003 | 409 | 版本冲突（base_revision 不匹配） |
| 04004 | 400 | 操作不合法（如删除必填 section 的最后一个 item） |
| 04005 | 400 | 文本长度超限 |

## 9. 测试策略

### 独立测试

- 用 `fixtures/resume_draft_state.json` 模拟草稿状态
- 测试各种编辑操作生成正确的 Patch
- 测试参数校验逻辑（前端 + 后端）
- 测试拖拽排序生成正确的 `move_before` Patch
- 不需要启动模块 B、C、E 的服务

### Mock 产出

确保产出的 `PatchEnvelope` JSON 符合 schema，可直接交给 E 作为测试输入。

### 前端测试

- 编辑器渲染：用 mock draft 数据渲染完整的 section/bullet 结构
- 参数面板：滑块交互、主题切换
- 拖拽排序：section 和 bullet 的拖拽
- 所有交互操作可以用 Storybook 独立开发和展示
