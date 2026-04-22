# ResumeGenius 技术栈建议

更新时间：2026-04-22

## 1. 选型原则

- 以 5 人全栈并行开发为前提
- 优先稳定、文档成熟、易于招人和协作的栈
- Python 负责解析、Agent、渲染链路
- Web 端负责对话工作区、人工工作台、预览入口

## 2. 推荐技术栈

### 2.1 前端

- `Next.js + React + TypeScript`
- UI 层使用 `Tailwind CSS`
- 组件基底可用 `shadcn/ui`

推荐原因：

- 适合同时承载对话区、工作台、项目页和预览页
- React 对复杂交互和局部刷新控制更成熟
- TypeScript 有利于和后端协议联调

### 2.2 后端

- `FastAPI + Pydantic`
- 数据访问层使用 `SQLAlchemy 2.0`

推荐原因：

- Python 对文档解析、OCR、模型调用、LaTeX 编译链路更顺手
- Pydantic 适合承载强约束协议模型和 JSON Schema 导出
- SQLAlchemy 2.0 足够成熟，适合后续从 demo 过渡到正式工程

### 2.3 数据存储

- 主库：`PostgreSQL`
- 对象存储：本地文件系统起步，后续可切到 S3 兼容存储

主库建议存：

- 项目
- 资料元信息
- 草稿状态
- revision 记录
- patch 记录

### 2.4 异步任务

v1 demo 建议分两层：

- 先用 `FastAPI BackgroundTasks` 跑通慢任务
- 如果解析、OCR、LaTeX 编译开始阻塞，再上独立 worker + 队列

适合异步化的任务：

- 文件解析
- OCR
- Git 仓库抽取
- 初始简历生成
- PDF 编译

### 2.5 文档解析

- PDF：`PyMuPDF`
- DOCX：`python-docx`
- 图片/OCR：`PaddleOCR`

### 2.6 Agent 层

- 模型调用建议做 `Provider Adapter`，避免业务代码直接绑死单一模型
- v1 文本主链路保留你 PRD 里的 `GLM-5 / GLM-5-Turbo` 假设
- 先不引入 VLM 主链路

### 2.7 渲染导出

- 结构解算：Python 服务内完成
- 模板输出：LaTeX
- PDF 编译：TeX Live 或兼容发行版

## 3. 不建议的做法

- 不建议前后端都用 Node，把解析/OCR/LaTeX 硬塞进 JS 生态
- 不建议 v1 就做富文本自由编辑器
- 不建议一开始就引入微服务
- 不建议先做 VLM 主链路

## 4. 推荐落地形态

### 最小可跑版本

- 前端：Next.js
- 后端：FastAPI
- DB：PostgreSQL
- 解析：PyMuPDF / python-docx / PaddleOCR
- 导出：LaTeX

### 升级点

如果 demo 验证通过，再考虑增加：

- Redis 队列
- 独立 worker
- 对象存储
- 更完整的监控与日志

## 5. 参考资料

- Next.js App Router 文档：https://nextjs.org/docs/app
- FastAPI Background Tasks：https://fastapi.tiangolo.com/tutorial/background-tasks/
- Pydantic JSON Schema：https://docs.pydantic.dev/dev/concepts/json_schema/
- SQLAlchemy 2.0 Overview：https://docs.sqlalchemy.org/20/intro.html
- PyMuPDF 文档：https://pymupdf.readthedocs.io/
- python-docx 文档：https://python-docx.readthedocs.io/
- PaddleOCR Layout Analysis：https://www.paddleocr.ai/latest/en/version3.x/module_usage/layout_analysis.html
- Tailwind CSS 安装文档：https://tailwindcss.com/docs/installation/tailwind-cli
- shadcn/ui 文档：https://ui.shadcn.com/docs
