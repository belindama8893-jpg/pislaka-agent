# Pislaka Agent 意图规则手册

## 目标

Pislaka Agent 是为巴基斯坦房地产经纪人设计的业务意图路由器。聊天框不是一个通用聊天机器人。它必须把经纪人的消息分类到具体业务流程，收集所需实体，展示正确的预览，并且只在用户确认后执行动作。

## 核心原则

1. PostgreSQL 是唯一事实来源。Agent 记忆、聊天文本和 LLM 输出都不是最终业务状态。
2. LLM 输出只是动作提案。数据库写入和外部动作必须通过类型化的后端 API 执行。
3. 不允许静默兜底。如果找不到用户请求的实体，Agent 必须说明没有找到，并在展示相近记录或最新记录前询问用户。
4. 渠道是参数，不是意图。WhatsApp、Facebook、Instagram、portal 等只用于修饰已经识别出的业务流程。
5. 高风险动作必须显式确认。
6. 搜索和更新必须限定在当前经纪人名下。
7. 遇到歧义必须停止执行。Agent 可以追问或展示候选项，但不能静默选择。

## 意图领域

### 信息管理

这个领域负责创建、查询或更新经纪人拥有的记录。

| Intent | 用户示例 | 必需实体 | 输出 | 确认 |
| --- | --- | --- | --- | --- |
| `create_listing_draft` | “Create a 10 marla villa in DHA Phase 5” | 房源事实 | 可编辑房源预览 | 保存前必须确认 |
| `update_listing_draft` | “Change this listing price to 1.2 crore” | 房源目标 + 修改字段 | 可编辑更新预览 | 必须确认 |
| `list_leads` | “Show my hot leads” | 线索筛选条件 | 线索列表或无匹配提示 | 只读，不需要确认 |
| `update_lead_status` | “Mark Ahmed as hot lead” | 精确线索目标 + 新状态 | 状态更新预览 | 必须确认 |
| `create_schedule_event` | “Schedule viewing with Ahmed tomorrow 3pm” | 事件类型 + 时间 + 参与人 | 日程预览 | 必须确认 |
| `list_schedule_events` | “What do I have today?” | 日期/筛选条件 | 日程列表 | 只读，不需要确认 |

### 内容生成

这个领域生成可编辑内容。未经确认，不得发送消息或对外发布。

| Intent | 用户示例 | 必需实体 | 输出 | 确认 |
| --- | --- | --- | --- | --- |
| `draft_lead_reply` | “Reply to Ahmed on WhatsApp” | 精确线索目标 | WhatsApp 回复草稿 | 打开/发送前必须确认 |
| `create_campaign_links` | “Promote my DHA 5 villa on WhatsApp and Facebook” | 精确房源目标 + 渠道 | 分渠道推广包 | 必须确认 |
| `generate_contract_draft` | “Make an agreement for this buyer” | 房源 + 买家 + 协议类型 | 文档草稿 | 导出/分享前必须确认 |
| `generate_social_copy` | “Write Instagram copy for this listing” | 房源目标 + 渠道 | 渠道文案 | 发布/分享前必须确认 |

### 分析和决策支持

这个领域读取并总结数据。它可以生成建议，但不能自己更新记录。

| Intent | 用户示例 | 必需实体 | 输出 | 确认 |
| --- | --- | --- | --- | --- |
| `analyze_market` | “How is DHA Phase 5 demand?” | 市场范围 | 市场总结 | 不需要确认 |
| `analyze_leads` | “Which leads are most likely to close?” | 线索筛选条件 | 排名分析 | 不需要确认 |
| `analyze_listings` | “Which listings are underperforming?” | 房源筛选条件 | 房源分析 | 不需要确认 |
| `show_basic_attribution` | “Which channel brought these leads?” | 日期/房源/渠道筛选条件 | 归因总结 | 不需要确认 |

## 路由优先级

路由器必须按以下顺序评估意图：

1. 安全和外部动作检测。
2. 线索回复和沟通意图。
3. 线索状态更新意图。
4. 日程和提醒意图。
5. 明确的推广或内容生成意图。
6. 线索/房源/日程查询意图。
7. 房源创建或更新意图。
8. 普通回复或澄清问题。

原因：“Reply to Ahmed on WhatsApp” 包含渠道词，但主要动词是 reply。它必须是 `draft_lead_reply`，不能是 `create_campaign_links`。

安全触发条件包括欺诈或误导性请求、价格操控、越权访问其他 broker 数据、批量删除，以及高风险破坏性修改。外部动作触发条件包括发送 WhatsApp 消息、发布到 Zameen 或 OLX 等 portal、导出/分享文档，或在 Pislaka 外部发布内容。Agent 可以起草这些动作，但真正执行必须要求确认。

## 渠道规则

渠道词永远不能单独决定意图。

- `WhatsApp`、`Facebook`、`Instagram`、`portal`、`Zameen` 等都是渠道。
- 它们只有在业务流程被识别之后才相关。
- “Promote this listing on WhatsApp” 表示生成推广活动。
- “Reply to Ahmed on WhatsApp” 表示线索回复。
- “Share this with Ahmed on WhatsApp” 是沟通动作，必须要求确认。

推广和社媒文案的路由判断：

- `promote`、`advertise`、`market`、`campaign`、`推广` 或 `宣传` 加渠道词，表示 `create_campaign_links`。
- `write`、`copy`、`caption`、`post text`、`文案` 或 `标题` 加渠道词，表示 `generate_social_copy`。
- 如果用户只说想发到某个渠道，但没有说明想要什么输出，应追问是要 campaign links，还是要可发布文案。

## 媒体上传路由

图片和视频上传是房源创建或房源修改流程里的参数，不是独立导航标签，也不是单独 intent。

- 如果经纪人在当前有房源预览卡时上传 image/video 文件，应把它们识别为该预览卡的候选 `listing_media`，并展示在预览卡内部。
- 如果经纪人从聊天输入框选择 image/video 文件，应先把它们作为可删除缩略图保留在输入框里，直到经纪人点击发送。发送后，在用户消息中展示缩略图，并把文字和媒体作为同一次输入一起路由。
- 如果经纪人上传 image/video 文件时没有活跃房源预览，也没有解析到明确房源目标，应先把它们保留为待确认媒体，并追问房源描述或目标房源。不能静默挂到最新房源。
- 如果经纪人要求把媒体添加到已有房源，必须先按实体解析规则解析目标房源，再在持久化上传前要求经纪人明确确认。
- 如果上传文件不是图片或视频，应拒绝作为房源媒体，并提示用户选择图片或视频。
- MVP 阶段可以先用文件类型和对话上下文做分类。后续接入视觉分类时，可以进一步判断文件是否看起来像房源室内、外立面、地块、配套或 walkthrough 视频，再决定是否附加。

## 实体解析规则

### 优先精确匹配

Agent 在执行任何动作之前，必须先尝试精确或高置信度匹配：

- 人名或线索名。
- 电话号码。
- 房源标题。
- 区域 + 面积组合。
- Campaign/public code。
- 当前活跃预览卡，仅当用户说 “this”、“this listing”、“刚才”、“这套” 或类似表达时可用。

### 无匹配行为

如果找不到目标：

1. 说明没有找到确切实体。
2. 不展示随机记录或最新记录。
3. 询问用户是否要查看最新记录，或换关键词搜索。

示例：

> I could not find a lead named Ahmed. Do you want me to show the latest leads instead?

### 歧义匹配行为

如果匹配到多个目标：

1. 展示简短候选列表。
2. 要求用户选择其中一个。
3. 在用户确认精确目标之前，不执行动作。

## 确认规则

### 必须确认

- 保存或编辑房源。
- 发布房源。
- 生成或重新生成 campaign links。
- 修改线索状态或紧急程度。
- 创建、编辑或取消日程事件。
- 使用准备好的消息打开 WhatsApp。
- 导出/分享文档。
- 任何批量动作。

### 可以不确认直接执行

- 只读列表/搜索。
- 在聊天窗口中生成草稿内容。
- 展示分析总结。
- 展示预览卡。

## 意图示例

| Message | 正确 intent | 说明 |
| --- | --- | --- |
| “Reply to Ahmed on WhatsApp” | `draft_lead_reply` | WhatsApp 是渠道参数 |
| “Mark Ahmed as hot lead” | `update_lead_status` | 必须先精确匹配 Ahmed |
| “Show hot leads” | `list_leads` | 只读 |
| “Promote my DHA 5 10 marla villa on WhatsApp and Facebook” | `create_campaign_links` | 需要确认房源和渠道 |
| “Create a listing for 1 kanal DHA Phase 6 8.5 crore” | `create_listing_draft` | 保存前展示可编辑预览 |
| “Schedule viewing with Ahmed tomorrow at 3pm” | `create_schedule_event` | 保存前展示日程预览 |
| “What do I have today?” | `list_schedule_events` | 只读日程列表，不需要确认 |
| “Which leads should I follow up today?” | `analyze_leads` 或 `list_leads` | 只读，可按紧急程度排序 |
| “How is this listing performing?” | `analyze_listings` | 需要当前房源或明确房源目标 |

## 未知或弱意图

如果消息信息不足，Agent 应该只问一个简短的追问。

示例：

- “Promote it” 但没有当前房源：询问是哪套房源。
- “Reply to him” 但没有活跃线索上下文：询问是哪位线索。
- “Schedule tomorrow” 但没有时间或对象：询问给谁安排、几点安排。
- 弱意图或不支持的消息必须返回 `general_reply`，不能强行生成房源草稿。
- 本地兜底只有在消息同时包含房源动作/房源类型和具体房源事实时，才可以创建 listing draft。具体事实包括位置、面积、价格、卧室数、sale/rent 等。

## 实现契约

后端路由器应该返回一个标准化对象：

```json
{
  "intent": "draft_lead_reply",
  "requires_confirmation": true,
  "confidence": 0.86,
  "entities": {
    "lead_name": "Ahmed",
    "channel": "whatsapp"
  },
  "resolution": {
    "status": "matched",
    "target_id": "uuid"
  },
  "response": "I found Ahmed. Please review this WhatsApp reply before sending.",
  "payload": {}
}
```

Resolution status 应为以下之一：

- `matched`
- `no_match`
- `ambiguous`
- `needs_clarification`

状态含义：

- `matched`：找到一个精确或高置信度目标。
- `no_match`：用户已经说出或描述了目标，但当前 broker 名下没有匹配记录。
- `ambiguous`：用户已经说出或描述了目标，并匹配到 2-5 个可能候选；执行必须暂停，让用户选择。
- `needs_clarification`：用户没有提供足够目标信息，且没有可用当前上下文，例如 “reply to him” 或 “schedule tomorrow”。

只有 `matched` 加上所需用户确认，才能进入执行 API。

## 当前实现状态

已经实现：

- `routeAgentMessage()` 返回类型化 `AgentAction`，并支持可选 `resolution`。
- 本地兜底会把弱意图/未知消息归为 `general_reply`。
- 本地兜底只有在消息看起来像房源请求时，才创建 `create_listing_draft`。
- 后端 lead resolution 已覆盖 `draft_lead_reply` 和 `update_lead_status`，在 action proposal 之后执行。
- 后端 lead resolution 可以返回 `matched`、`ambiguous`、`no_match` 或 `needs_clarification`。
- 后端 listing resolution 已覆盖 `create_campaign_links`，可以使用显式/当前 listing id、用户明确要求的最新 listing，或强房源细节进行匹配。
- 后端 schedule event resolution 已覆盖 `create_schedule_event`，可以在展示日程预览前解析参与线索、关联房源，或同时解析两者。
- 前端确认日程预览时会保留已解析的 `lead_id` 和 `listing_id`。
- 日程时间按照用户当前浏览器时区进行解析、展示、编辑和查询；数据库中仍保存 ISO 绝对时间。
- 前端可以把 `list_schedule_events` 作为只读 `/api/events` 查询执行，并在聊天中展示日程列表。
- Schedule 工作台页面可以列表、筛选、编辑、完成和取消 broker events。
- 当前经纪人存在活跃房源上下文时，前端会发送 `current_listing_id`。
- 当 `resolution` 缺失时，前端仍保留本地 lead scoring 作为兼容兜底。
- 当 `resolution` 缺失时，前端仍保留本地 listing scoring 作为兼容兜底。

尚未实现：

- listing update flows 的后端 listing resolution。
- 响应契约中的 confidence scoring。
- ambiguous resolution 的完整候选选择 UI；当前只是要求用户补充信息。
