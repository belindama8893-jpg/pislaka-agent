# Pislaka Agent - 产品需求文档 (PRD) 与架构简报

**致: Codex (AI 开发工程师 / 研发团队)**
**来自: 产品设计团队**

## 1. 产品概述
**Pislaka Agent** 是一款专为巴基斯坦市场房产经纪人设计的垂直领域 AI 助手 (SaaS)。产品的核心设计理念是 **"All-in-Chat (全交互式)"** 和 **"Mobile-First (移动端优先)"**。因为房产经纪人高度移动化，重度依赖聊天界面（如 WhatsApp）。该产品摒弃了复杂的多页面后台仪表盘，而是将单一、持续的 AI 聊天流作为主要的“工作台 (Command Center)”，周边的 UI 元素仅用于映射“结构化数据状态”（例如：活跃房源数、线索数）。

## 2. 核心功能与工作流
1. **AI 房源副驾 (Copilot)**：
   - 经纪人上传房屋照片或发送语音备忘录。
   - AI（视觉模型 + 大语言模型）自动提取特征（如：1 Kanal，DHA Phase 6）并生成高度本地化的营销文案。
2. **“上架入库”与“多渠道分发”解耦**：
   - **入库 (Inventory Upload)**：点击“发布”代表将房源录入 Pislaka 数据库，作为 Source of Truth（单一事实来源）。
   - **分发 (Multi-Channel Promotion)**：AI 会生成专属的“推广营销卡片”，为 Facebook、Twitter 和 WhatsApp 分别生成定制的文案和**独立的追踪链接 (UTM Tracking URL)**（如 `pislaka.com/p/123?utm=whatsapp`），支持一键分享。
3. **智能线索捕获与自动回复**：
   - 买家点击追踪链接后留资，系统自动将其捕获为线索 (Leads)。
   - 接入 WhatsApp Business API，AI 协助经纪人对客户进行跟进和自动回复。
4. **数据归因与分析 (Attribution Analytics)**：
   - 系统能追踪哪个渠道（WhatsApp vs. Facebook）带来了最多的线索，并在聊天界面内直接呈现可视化的数据报表和可执行的 AI 建议。

## 3. UI/UX 原型状态 (Current State)
我们已经开发了一套高保真的前端原型 (原生 HTML/CSS/JS)，完美演示了上述工作流。
- **核心 UI 元素**：毛玻璃风格 (Glassmorphism)，移动端优先的侧边栏（小屏幕下隐藏在汉堡菜单中），语音输入模拟，以及动态生成的聊天流组件 (Widgets)。
- **文件结构**：`index.html`, `style.css`, `app.js`。

## 4. 建议的技术架构 (Technical Architecture)
为了实现生产级应用，我们正在评估以下技术栈：
- **前端 (Frontend)**：移动端采用 React Native (Expo) 以支持 iOS/Android（对外勤经纪人至关重要）；Web 端采用 React/Next.js。
- **后端编排 (Backend Orchestration)**：Node.js (TypeScript) 或 Python (FastAPI) 用于处理 Agent Framework (意图路由、工具调用 / Tool Calling)。
- **数据库 (Database)**：PostgreSQL 用于存储结构化数据 (用户、房源、线索)；Pinecone/Weaviate (向量数据库) 用于 RAG 检索和长文本记忆。
- **AI 大脑 (AI Brain)**：
  - **推理/对话引擎**：DeepSeek API（提供高性价比、快速的逻辑处理、意图识别和工具调用）。
  - **视觉模型**：GPT-4o 或 Claude 3.5 Sonnet Vision API（严格限定仅用于房源图片的特征提取）。
- **外部集成 (Integrations)**：Meta Graph API (Facebook/IG)、WhatsApp Business API、自建短链追踪服务。

## 5. 对 Codex 的需求指令
请审阅这份 PRD 以及附带的前端原型文件 (`index.html`, `style.css`, `app.js`)。基于这些材料：
1. 请对我们提出的架构方案进行技术评估，指出优缺点。
2. 请为我们规划一份后端开发路线图 (Phase 1 MVP 与 Phase 2 进阶版的拆分)。
3. 请指出在实现这套“Agentic Workflow (智能体工作流)”时，可能遇到的技术盲区或风险点（例如：LLM 推理与 PostgreSQL 数据库之间的状态同步问题）。
