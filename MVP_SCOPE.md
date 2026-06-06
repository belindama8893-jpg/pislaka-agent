# Pislaka Agent 一周 MVP 范围

## 目标

在一周内交付一个可内测的业务闭环版本，让真实房产经纪人可以完成：

语音/文字创建房源草稿 -> AI 生成文案 -> 人工确认入库 -> 生成推广链接 -> 买家留资 -> 线索入库 -> AI 起草 WhatsApp 回复 -> 基础归因查看。

这个版本不追求完全自动化 Agent，而是先做可信、可审计、可演示、可收集真实反馈的最小系统。

## MVP 必做

### 1. 登录与用户

- Email + Password 登录/注册。
- Google OAuth 登录。
- 首次登录后创建 broker profile。
- 用户字段：姓名、城市、agency、手机号、语言偏好。
- 预留 Phone/WhatsApp OTP 登录字段和后续扩展点。

### 2. 房源 Copilot

- 支持文字输入房源信息。
- 支持语音输入并转写为文本。
- 支持图片上传，第一版可先做图片存储，视觉识别作为可选增强。
- DeepSeek 根据文本/转写内容生成房源草稿。
- 房源草稿必须由用户确认后才能保存为 inventory。

### 3. 房源库存

- 保存房源标题、描述、价格、面积、面积单位、城市、区域、房型、状态、图片。
- 区分 draft 与 published 状态。
- 所有关键写入记录 audit log。

### 4. 推广链接

- 每个 published listing 生成渠道追踪链接。
- MVP 渠道：WhatsApp、Facebook、Direct。
- 支持 WhatsApp deep link 和 Facebook share URL。
- 记录点击事件，用于基础归因。

### 5. 公开房源页与线索

- 买家打开推广链接后可查看公开房源页。
- 买家可提交姓名、电话、需求备注。
- 线索写入数据库，并关联 listing、campaign link、channel。

### 6. Lead Assistant

- 经纪人可查看线索。
- DeepSeek 根据线索信息起草回复。
- 第一版不自动调用 WhatsApp Business API，只生成可复制文本或 WhatsApp deep link。

### 7. 聊天工作台

- 聊天消息持久化。
- 支持结构化卡片：房源草稿卡、推广卡、线索卡、基础归因卡。
- Agent 使用有限意图路由，不做复杂多 Agent 自主编排。

## MVP 暂缓

- React Native App。
- WhatsApp Business API 自动发送。
- Meta Graph API 自动发帖。
- Pinecone/Weaviate 独立向量数据库。
- 多 Agent 协作。
- 自动成交/合同/产权相关建议。
- 复杂多触点归因。
- 完整 CRM、团队权限和订阅计费。

## 一周开发节奏

### Day 1：项目骨架

- 创建 Next.js PWA 项目。
- 接入 Supabase。
- 搭建基础布局和原型迁移。
- 配置 Google OAuth 和 Email/Password。

### Day 2：数据库与库存

- 创建核心表结构。
- 实现 broker profile。
- 实现 listings CRUD。
- 实现保存草稿与确认入库。

### Day 3：AI 房源 Copilot + 语音输入

- 接入 DeepSeek。
- 实现房源草稿生成。
- 接入 STT 转写。
- 将语音 transcript 送入 Agent router。

### Day 4：推广链接与公开房源页

- 生成 campaign links。
- 实现公开房源页。
- 记录 click events。
- 支持买家留资。

### Day 5：Lead Assistant

- 实现线索列表。
- 实现 AI 回复草稿。
- 支持 WhatsApp deep link。

### Day 6：聊天工作台整合

- 将核心动作包装为聊天卡片。
- 实现 chat_messages 持久化。
- 增加基础 analytics 卡片。

### Day 7：打磨与内测

- 移动端 QA。
- 错误处理与 loading 状态。
- 部署到 Vercel。
- 准备 3-5 个真实经纪人测试脚本。

## 验收标准

- 用户可以通过 Google 或邮箱密码登录。
- 用户可以用文字或语音创建房源草稿。
- AI 生成的房源草稿可编辑并保存入库。
- 系统能为房源生成 WhatsApp/Facebook 推广链接。
- 买家可以通过链接提交线索。
- 经纪人能看到线索来源。
- AI 能为线索生成 WhatsApp 回复草稿。
- 所有数据库写入动作可追踪到用户和操作来源。
