# Pislaka Agent 技术规格草案

## 技术栈

### Frontend

- Next.js Web App / PWA。
- 移动端优先响应式布局。
- 第一版从现有 `index.html`、`style.css`、`app.js` 原型迁移为组件。

### Backend

- Next.js API Routes 或 Server Actions。
- TypeScript 作为主语言。
- 后续如需要长任务编排，可增加独立 worker。

### Auth

- Supabase Auth。
- MVP 支持：
  - Email + Password。
  - Google OAuth。
- 预留：
  - Phone OTP。
  - WhatsApp OTP。

### Database

- Supabase Postgres。
- PostgreSQL 是唯一事实源。
- LLM 不直接写库，所有写入必须通过后端 tool executor。

### Storage

- Supabase Storage。
- 存储 listing photos、voice messages。

### AI

- DeepSeek：主对话、意图识别、工具调用、房源文案、线索回复草稿。
- STT：OpenAI Speech-to-Text 或 Google Speech-to-Text，用于 Urdu/Roman Urdu/English 语音转写。
- Vision：OpenAI Vision 或同类视觉模型，用于房源图片特征提取；MVP 可先作为可选增强。

### Sharing

- WhatsApp deep link。
- Facebook share URL。
- 自建 campaign tracking link。

### Deployment

- Vercel：Next.js 应用。
- Supabase：Auth、Postgres、Storage。

## 核心设计原则

### 1. PostgreSQL 是 Source of Truth

聊天上下文、LLM 输出、向量记忆和外部平台状态都不能作为事实源。真实业务状态以 PostgreSQL 为准。

### 2. LLM 只能提出动作

DeepSeek 返回结构化 action proposal，例如：

```json
{
  "intent": "create_listing_draft",
  "requires_confirmation": true,
  "payload": {
    "title": "1 Kanal Villa in DHA Phase 6",
    "city": "Lahore",
    "area": "1 Kanal",
    "price": "8.5 Crore PKR"
  }
}
```

后端校验 payload，通过 tool executor 执行，执行结果再写入数据库和聊天流。

### 2.1 意图路由规则

Agent 的意图判断以 `AGENT_INTENT_RULES.md` 为准。核心约束：

- 渠道词不是意图，WhatsApp/Facebook/Instagram 只能作为已识别工作流的参数。
- 找不到明确实体时不能展示随机或最新记录，必须先告知未找到并请求确认。
- 多个候选匹配时必须让用户选择，不能自动替用户决定。
- 写入数据库、修改状态、生成推广链接、打开外部消息都必须先预览再确认。

### 3. 高风险动作必须人工确认

以下动作 MVP 必须用户点击确认：

- 保存房源入库。
- 发布房源。
- 生成推广链接。
- 向客户发送或打开 WhatsApp 回复。
- 修改价格、面积、位置等关键字段。

### 4. 所有 tool call 可审计

每次工具调用记录：

- user_id
- conversation_id
- tool_name
- input_payload
- output_payload
- status
- error_message
- created_at

### 5. 幂等执行

发布、生成链接、线索写入、消息发送等动作必须有 idempotency key，避免重复点击、网络重试或模型重复调用造成重复数据。

## 推荐目录结构

```text
app/
  auth/
  dashboard/
  listings/
  p/[code]/
  api/
    agent/
    voice/
    listings/
    leads/
    campaign-links/
components/
  chat/
  listings/
  leads/
  campaign/
  auth/
lib/
  supabase/
  ai/
  agent/
  tools/
  validators/
  analytics/
```

## 关键 API

### Auth

- `GET /auth/callback`
- Supabase managed auth endpoints。

### Agent

- `POST /api/agent/message`
  - 输入：conversation_id、message text、optional attachments。
  - 输出：assistant message、structured widgets、tool proposals。

### Voice

- `POST /api/voice/transcribe`
  - 输入：audio file。
  - 输出：transcript、language、confidence。

### Listings

- `POST /api/listings/draft`
- `PATCH /api/listings/:id`
- `POST /api/listings/:id/publish`
- `GET /api/listings`

### Campaign Links

- `POST /api/listings/:id/campaign-links`
- `GET /p/:code`
- `POST /api/tracking/click`

### Leads

- `POST /api/leads`
- `GET /api/leads`
- `POST /api/leads/:id/draft-reply`

## Agent 工具清单 MVP

### `create_listing_draft`

从用户文字、语音转写或图片分析结果创建房源草稿。

### `update_listing_draft`

更新房源草稿字段。

### `publish_listing`

将草稿转为库存房源。必须人工确认。

### `create_campaign_links`

为房源生成 WhatsApp/Facebook/Direct 追踪链接。必须人工确认。

### `list_leads`

查询当前经纪人的线索。

### `draft_lead_reply`

生成 WhatsApp 回复草稿。MVP 不自动发送。

### `show_basic_attribution`

返回 listing 或 broker 维度的点击、线索和转化率。

## 语音工作流

```text
record audio -> upload audio -> STT transcript -> normalize real estate terms -> agent router -> tool proposal -> user confirmation -> executor -> DB -> chat widget
```

需要重点处理：

- Urdu。
- Roman Urdu。
- English code-switching。
- Kanal/Marla。
- Crore/Lakh。
- DHA Phase、Bahria Town 等地名。

## 风险控制

- XSS：聊天卡片必须用组件渲染，禁止直接渲染未净化的 LLM HTML。
- Prompt injection：外部输入只能作为数据，不能作为系统指令。
- 幻觉：关键字段必须显示 confidence 和允许人工修改。
- 状态同步：DB 状态机优先于聊天文本。
- 外部平台失败：分享/发送动作必须有失败状态和重试策略。
- 隐私：电话、语音、聊天记录需要按用户租户隔离。
