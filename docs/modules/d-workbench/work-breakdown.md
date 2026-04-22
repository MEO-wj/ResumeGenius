# 模块 D 工作明细：人工工作台

更新时间：2026-04-22

本文档列出模块 D 负责人的全部开发任务。契约定义见 [contract.md](./contract.md)。

## 1. 概述

模块 D 是人工编辑的核心 UI，提供轻量工作台让用户直接修改简历的内容和样式。所有操作生成 `PatchEnvelope(source=manual)` 交给模块 E。

**核心交付**：用户能在工作台中直接编辑简历的 section 文本、bullet 内容、section 顺序、显隐控制，以及调整字体、行距、主题等样式参数。

## 2. 前端任务

### 2.1 页面

| # | 页面 | 路由建议 | 说明 |
|---|---|---|---|
| 1 | 人工工作台 | `/projects/[id]/workbench` | 编辑器主界面（三栏：section 导航 + 编辑区 + 样式面板） |

### 2.2 组件

| # | 组件 | 说明 |
|---|---|---|
| 1 | `SectionNav` | 左侧 section 导航栏，支持拖拽排序，显示 section 标题和显隐开关 |
| 2 | `SectionEditor` | section 编辑器：标题可编辑、items 列表展示 |
| 3 | `ItemEditor` | 单个 item 编辑：title / subtitle / date_range + bullets 列表 |
| 4 | `BulletEditor` | bullet 文本编辑（textarea），支持增删排序 |
| 5 | `StylePanel` | 右侧样式参数面板：主题选择、字号、行距、段距、布局模式 |
| 6 | `SliderControl` | 通用滑块控件：带数值显示、范围限制、步进值 |
| 7 | `ThemeSelector` | 主题选择器：clean_light / modern / compact |
| 8 | `LayoutSelector` | 布局选择器：单栏 / 双栏 + 比例调节 |
| 9 | `WorkbenchToolbar` | 操作栏：保存、撤销、重做 |
| 10 | `VisibilityToggle` | section 显隐切换开关 |
| 11 | `SortHandle` | 拖拽排序手柄（用于 section 和 item 排序） |

### 2.3 前端技术要点

- **所有操作都生成 Patch**，前端不直接修改 ResumeDraftState，而是构建 PatchEnvelope 提交给后端
- **乐观更新**：前端先本地更新状态，后端校验失败时回滚
- 内容编辑触发时机：`onBlur`（失焦时提交，不是每次按键）
- 样式编辑触发时机：`onChange` 实时预览 + `onBlur` 或 `onMouseUp`（滑块松手时提交）
- 拖拽排序用 `@dnd-kit/core` 或类似库
- 参数范围校验参考 [patch-schema.md](../../02-data-models/patch-schema.md) §5
- 三栏布局：左侧 section 导航（240px）、中间编辑区（flex-1）、右侧样式面板（320px）
- 右侧面板可关闭以扩大编辑区

### 2.4 前端状态管理

工作台需要管理以下前端状态：

| 状态 | 说明 |
|---|---|
| `currentDraft` | 当前 ResumeDraftState（从 API 获取或 mock） |
| `localEdits` | 本地编辑中的临时状态（乐观更新用） |
| `pendingPatches` | 待提交的 Patch 队列 |
| `undoStack` | 撤销栈（存 PatchEnvelope） |
| `redoStack` | 重做栈 |

## 3. 后端任务

### 3.1 API 端点（5 个）

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 1 | GET | `/api/v1/workbench/drafts/{draft_id}` | 获取当前草稿 |
| 2 | PATCH | `/api/v1/workbench/content` | 提交内容变更 |
| 3 | PATCH | `/api/v1/workbench/style` | 提交样式变更 |
| 4 | PATCH | `/api/v1/workbench/layout` | 提交布局变更 |
| 5 | GET | `/api/v1/workbench/style-presets` | 获取样式预设列表 |

### 3.2 后端服务

| # | 服务 | 说明 |
|---|---|---|
| 1 | `WorkbenchService` | 接收前端 Patch 请求，校验参数，组装 PatchEnvelope |
| 2 | `ContentValidator` | 内容变更校验：TargetRef 存在性、value 合法性 |
| 3 | `StyleValidator` | 样式变更校验：数值范围、字段路径合法性 |
| 4 | `PresetService` | 样式预设管理（v1 可硬编码几套预设） |

### 3.3 后端技术要点

- 后端接收前端的变更请求，校验后组装为 `PatchEnvelope(source=manual)` 并转发给模块 E 的 apply-patch API
- 或者后端只做校验，返回 PatchEnvelope 让前端提交给 E —— 取决于架构选择
- 样式参数范围必须和 [patch-schema.md](../../02-data-models/patch-schema.md) §5 一致
- 样式预设 v1 可以硬编码 3-5 套（clean_light 默认值、紧凑版、宽松版等）
- 内容 action 类型：set / insert_after / remove / move_before / rewrite_text
- 样式 action 类型：set / batch_set

### 3.4 参数校验规则

| 参数 | 路径 | 类型 | 范围 | 默认 |
|---|---|---|---|---|
| 正文字号 | `typography.body.font_size` | number | 9 – 14 pt | 10.5 |
| 行高 | `typography.body.line_height` | number | 1.0 – 2.0 | 1.3 |
| 字距 | `typography.body.letter_spacing` | number | -1 – 3 pt | 0 |
| 标题字号 | `typography.heading.font_size` | number | 14 – 24 pt | 16 |
| 段后距 | `spacing.paragraph.after` | number | 0 – 20 pt | 6 |
| section 间距 | `spacing.section_gap` | number | 0 – 30 pt | 12 |
| 布局模式 | `layout.mode` | string | single_column / two_column | single_column |
| 栏宽比 | `layout.column_ratio` | number | 0.2 – 0.5 | 0.35 |
| 主题 | `theme` | string | clean_light / modern / compact | clean_light |

## 4. 数据库表

模块 D 本身不需要独立的数据库表。它读写 `drafts` 表（由模块 B 创建、模块 E 维护 revision）。

如果样式预设需要持久化：

| 表名 | 关键字段 | 说明 |
|---|---|---|
| `style_presets` | `preset_id`, `name`, `style` (JSON), `is_default` | 样式预设（v1 可硬编码不建表） |

## 5. 测试任务

### 5.1 后端单元测试

| # | 测试 | 说明 |
|---|---|---|
| 1 | 内容变更校验 | 合法 set/insert_after/remove 操作 |
| 2 | 样式变更校验 | 数值在范围内、超出范围拒绝 |
| 3 | Patch 组装 | 验证产出 PatchEnvelope 符合 schema |
| 4 | 参数越界 | 各参数低于最小值/高于最大值时返回错误 |
| 5 | 样式预设 | 返回预设列表，验证结构 |

### 5.2 前端测试

| # | 测试 | 说明 |
|---|---|---|
| 1 | Section 导航 | 列表展示、拖拽排序、显隐切换 |
| 2 | 内容编辑 | 文本编辑失焦提交、bullet 增删 |
| 3 | 样式面板 | 滑块操作、数值实时显示、范围限制 |
| 4 | 撤销/重做 | 操作后撤销、撤销后重做 |
| 5 | 乐观更新 | 提交后本地立即更新、失败回滚 |

### 5.3 Mock 策略

- 不依赖 B 的服务：直接读 `fixtures/resume_draft_state.json` 作为初始草稿
- 不需要 C 的服务
- 不需要 E 的服务：用 mock handler 拦截 apply-patch 调用
- 产出 fixture：`fixtures/patch_manual.json`
- 前端可完全独立开发，用 mock 数据渲染工作台

## 6. 交付 Checklist

- [ ] 前端：1 个页面 + 11 个组件
- [ ] 后端：5 个 API 端点
- [ ] 后端服务：4 个核心服务（工作台 + 内容校验 + 样式校验 + 预设）
- [ ] 测试：5 个后端单元测试 + 5 个前端测试
- [ ] 产出 fixture：`fixtures/patch_manual.json` 符合 PatchEnvelope schema
- [ ] 参数校验范围与 patch-schema.md §5 一致
- [ ] 错误码使用 04xxx 范围
