# ResumeGenius 产品功能关系与用户逻辑图

更新时间：2026-04-23

本文档保存当前已经确认的系统关系图与用户流程图，作为后续功能拆分、技术架构和协议设计的基础。

## 1. 功能关系图

```mermaid
flowchart LR
    A[用户] --> B[AI 对话助手]
    A --> C[TipTap 编辑器]

    D[资料输入]
    D --> D1[文件上传]
    D --> D2[Git 仓库接入]
    D --> D3[补充文本资料]

    D1 --> E[文件解析]
    D2 --> E
    D3 --> E

    E --> F[提取文本内容]
    F --> G[AI 生成初始简历 HTML]

    G --> H[drafts 表]

    B --> I[AI 读取当前 HTML]
    I --> J[AI 返回修改后 HTML]

    C --> K[直接编辑 HTML DOM]

    H --> L[自动保存]
    J --> L
    K --> L

    L --> M[HTML 快照版本]
    L --> N[chromedp PDF 导出]
```

## 2. 用户使用逻辑图

```mermaid
flowchart TD
    A[进入系统] --> B{是否已有项目}
    B -- 是 --> C[打开已有简历项目]
    B -- 否 --> D[新建项目]

    D --> E{用户是否已有简历}
    E -- 有 --> F[上传简历文件]
    E -- 没有 --> G[提供相关资料]

    G --> G1[上传文件]
    G --> G2[连接 Git 仓库]
    G --> G3[填写补充信息]

    F --> H[文件解析]
    G1 --> H
    G2 --> H
    G3 --> H

    H --> I[提取文本内容]
    I --> J[AI 生成初始简历 HTML]
    C --> K[加载当前 HTML]
    J --> L[进入工作台]
    K --> L

    L --> M{选择修改方式}
    M -- AI 对话 --> N[输入自然语言需求]
    M -- 手动编辑 --> O[TipTap 编辑器]

    N --> P[AI 流式返回修改后 HTML]
    P --> Q{是否满意}
    Q -- 是 --> R[应用到简历]
    Q -- 否 --> S[继续对话]
    S --> N

    O --> T[自动保存]

    R --> T
    T --> U{是否继续修改}
    U -- 是 --> M
    U -- 否 --> V[导出 PDF]

    V --> W[chromedp 渲染]
    W --> X[下载 PDF]
```

## 3. AI 对话内部逻辑图

```mermaid
flowchart TD
    A[用户输入需求] --> B[读取当前简历 HTML]
    B --> C[加载对话历史]

    C --> D[构建 AI Prompt]
    D --> E[调用 GLM-5 模型]

    E --> F{SSE 流式响应}
    F --> G[先输出文字说明]
    G --> H[再输出修改后 HTML]

    H --> I[前端提取 HTML]
    I --> J[渲染预览]

    J --> K{用户操作}
    K -- 应用 --> L[替换编辑器 HTML]
    K -- 拒绝 --> M[继续对话]
    K -- 继续修改 --> N[发送新消息]
```

## 4. 当前已确认的结论

- HTML 是唯一数据源，零中间层
- AI 和 TipTap 编辑器是两条并行的编辑路径
- AI 直接返回修改后的完整 HTML，不经过 Patch 协议
- chromedp 服务端渲染 PDF，用于商业化权限控制
- 版本管理使用 HTML 快照，约 5-10KB 每份
- 部署目标：2C2G 服务器，Docker Compose 一键部署

## 5. 下一步建议

- 基于这些图继续收敛功能边界
- 冻结数据库表结构
- 各模块进入 contract.md 详细设计
