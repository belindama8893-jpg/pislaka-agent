# Pislaka Agent 回复卡片展示与操作升级需求

## 1. 背景

Pislaka Agent 的聊天回复已经不只是文本回答，而是承载了房源创建、线索管理、WhatsApp 跟进、日程、推广、分析等业务工作流。当前卡片能完成核心功能，但展示、字段层级、操作状态和交互模式分散在多个局部实现里，体验更像“功能补丁集合”，还没有形成统一的 Agent 操作界面。

本轮目标是重新整理所有 Agent 回复卡片的展示与操作，形成一套可扩展的卡片设计规范，并基于该规范重设计卡片布局、字段排布和交互方式。

这份文档用于给 Claude、Gemini 或设计/实现模型分别出方案。方案需要符合现有基本设计规范，但不需要沿用现有卡片布局。

## 2. 现状概览

主要实现位置：

- `components/agent/AgentWorkspace.tsx`：消息列表、卡片分支渲染、卡片内 API 操作、确认后追加消息。
- `components/agent/AgentOutputCard.tsx`：统一外壳组件，但目前 props 中的 `icon`、`summary` 没有真正渲染，外壳只输出 hint、body、actions、status。
- `components/agent/agent-action-response-handlers.ts`：按 intent 将 agent action 分发到不同 UI 预览或结果卡片。
- `lib/agent/registry/intents.ts`：每个 intent 已声明 `uiCard`、domain、risk、confirmation、availability、requiredEntities，可作为下一版卡片规范的数据源。
- `lib/agent/agent-ui-copy.ts`：英文、中文、乌尔都语/Roman Urdu 的卡片文案来源。
- `app/globals.css`：卡片样式散布在 `.agent-output-card`、`.chat-import-card`、`.lead-chat-row`、`.promotion-*`、`.schedule-*` 等选择器中。

现有业务原则：

- LLM 输出只是 action proposal，写入/外部动作必须确认。
- 实体必须先解析；找不到或有歧义时不能静默展示最新/随机记录。
- 读操作可以直接展示结果；写操作、外部 WhatsApp、日程、推广链接、批量操作必须有确认。
- `reply_drafted` 和 `whatsapp_opened` 不能更新 `last_contacted_at`，只有 `message_sent` 可以。
- 渠道是参数，不是 intent；WhatsApp/Facebook/Instagram/portal 不应变成独立业务 intent。

## 3. 当前卡片类型

### 房源类

- 房源草稿预览：展示 title、description、price、location、area、beds/baths，支持编辑字段、添加/移除媒体、确认保存。
- 房源已保存：展示保存后的标题、位置、媒体缩略图，支持打开房源、把房源带回 Agent 上下文。
- 房源更新确认：展示目标房源与变更字段 old -> new，支持确认更新。
- 房源选择：当多个房源候选时展示候选列表，支持选择一个继续。

主要问题：

- 草稿预览和编辑表单切换很硬，字段层级没有突出“最重要房源事实”。
- 媒体、字段、保存状态混在一张长卡里，移动端压力较大。
- 更新确认只展示 changed fields，缺少“这次会影响哪个对象、写入后结果是什么”的明确摘要。

### 线索类

- 线索列表/今日跟进：最多展示 5 条线索，含姓名、状态、时间、房源、渠道、内容摘要、建议回复，支持选择。
- 最新线索确认：当目标未找到时，要求确认后才展示最新线索。
- 线索状态确认：展示当前状态 -> 目标状态，确认后 PATCH 或记录 follow-up。
- 线索详情确认：展示姓名/电话/email/message 等字段变更。
- 新建线索确认：展示待保存线索字段，可附带 WhatsApp 跟进摘要。
- 批量线索状态确认：展示最多 6 条线索，统一确认状态更新。
- 线索主房源更新确认：展示 lead 与主房源 old -> new。
- 线索回复草稿：展示 WhatsApp 回复文本，支持复制、打开 WhatsApp。

主要问题：

- 线索卡有很多变体，但视觉语言高度相似，用户不容易区分“只读结果”“待确认写入”“回复草稿”“批量变更”。
- 字段标签有英文硬编码，例如 Time、Listing、Channel、Content，未完全接入多语言 copy。
- 操作按钮缺少一致的主次关系：有的确认按钮在顶部 actions，有的在卡片内部，有的只是 icon。

### WhatsApp 导入与跟进类

- WhatsApp 聊天摘要：支持 zip/txt 选择、生成摘要、匹配 lead、选择下一步。
- 聊天回复卡：展示 reply draft，支持复制。
- 跟进建议卡：基于聊天建议保存 note、设置 reminder 或更新 status，支持 Yes/No。
- 选择 lead 卡：展示候选 lead 或创建新 lead。
- 保存跟进 note、提醒、状态卡：分别提供确认保存、时间编辑、状态选择。

主要问题：

- 很多 WhatsApp 相关卡片没有使用 `AgentOutputCard`，仍是 `.chat-import-card`、`.chat-reply-card` 等自定义外壳。
- 一张导入卡内混合了解析进度、身份匹配、摘要、下一步选择、候选列表，信息密度过高。
- Yes/No 的操作语义不够具体，应改为“保存跟进记录 / 暂不保存”“设置提醒 / 跳过”等业务动作。

### 日程类

- 日程预览：展示 title、description、category、event type、time、lead、listing，支持编辑与确认保存。
- 日程列表：展示 events 的时间、标题、类型、lead/listing/location。

主要问题：

- 日程预览与房源草稿共用很多 class，业务视觉不够清楚。
- 时间字段是最关键内容，但当前只是 fact chip 之一。
- 缺少“提醒时间/开始时间/关联对象”的优先级布局。

### 推广类

- 推广目标确认：展示目标 listing，选择渠道，确认生成 promotion pack。
- 推广包结果：按 channel 分组，展示标题、正文、CTA、landing URL、WhatsApp share URL，支持复制和分享到 WhatsApp。
- 社交文案与 trackable campaign links 的结果共用 promotion pack 形态。

主要问题：

- 渠道选择像普通 checkbox group，缺少“选了哪个渠道会产生什么”的预期。
- promotion card 内容长，复制、链接、分享操作散落在每个 option 内，缺少统一的 channel action bar。
- 普通社媒文案和 trackable links 在 UI 上区分不足，容易让用户误以为已经发布或已外发。

### 解析/选择/分析类

- 通用实体选择：lead/listing 候选选择，日程可不绑定继续。
- 分析摘要：复用 `AnalyticsSummaryCard compact`，没有统一 Agent 卡片外壳。

主要问题：

- 选择卡没有展示匹配原因、置信度、为何必须选择。
- 分析卡与其他 Agent 输出卡的视觉和操作体系不一致。

## 4. 需要重新设计的核心问题

1. 统一卡片骨架

所有 Agent 结构化回复都应有一致的信息架构：

- 顶部：类型、状态、风险/确认提示、对象名称。
- 主体：按业务优先级展示关键字段。
- 变更区：只在写入/更新类卡片出现，清楚表达 before -> after。
- 操作区：主操作、次操作、危险/外部操作分层。
- 状态区：保存中、已保存、失败、需要登录、已复制、已打开等反馈。

2. 区分卡片意图

用户必须一眼看出这张卡是：

- 只读结果：例如 lead list、schedule list、analytics。
- 草稿/内容生成：例如 listing draft、lead reply、social copy。
- 待确认写入：例如 create lead、update lead、save schedule、update listing。
- 外部/高风险动作：例如 open WhatsApp、generate tracking links、share to WhatsApp。
- 选择/解除歧义：例如 entity selection、listing selection。

3. 统一操作语义

下一版不要只有按钮外观统一，也要统一 action grammar：

- Primary：完成当前用户明确要求的下一步，如“确认保存”“生成推广包”“确认更新”。
- Secondary：编辑、复制、查看详情、打开对象、添加媒体。
- External：打开 WhatsApp、打开 landing page、分享到 WhatsApp，需要明确外部动作样式。
- Destructive/Cancel：跳过、不保存、取消绑定，避免和普通 secondary 混淆。
- Completed：动作完成后按钮进入完成态，不重复触发；必要时提供“打开结果”而不是再次保存。

4. 字段优先级重排

所有字段不应平均展示。每类卡片需要定义 hero facts、secondary facts、audit facts：

- 房源 hero facts：价格、位置、面积、类型、beds/baths、媒体。
- 线索 hero facts：姓名/电话、状态/urgency、需求摘要、下一步。
- 日程 hero facts：时间、事件类型、对象、地点/提醒。
- 推广 hero facts：渠道、目标房源、文案标题、链接/CTA。
- 更新类 hero facts：对象 + 改了什么 + 写入影响。

5. 移动端与聊天上下文

Agent 卡片出现在聊天流里，不是完整页面。设计必须：

- 宽度适配当前消息列，移动端不能横向溢出。
- 长内容支持折叠或分组，不要把聊天流推得过长。
- 常用操作可单手完成，主操作在移动端占满宽度。
- 字段和值换行可读，不能依赖超宽表格。

## 5. 下一版卡片设计建议

### 5.1 统一卡片组件层级

建议抽象以下组件，而不是继续在 `AgentWorkspace.tsx` 写大段 JSX：

- `AgentCardShell`：统一标题、类型图标、状态 badge、risk badge、description/hint、actions、status。
- `AgentCardObjectHeader`：展示 lead/listing/schedule/promotion 的对象摘要。
- `AgentFactGrid`：2-4 个关键字段，适合房源/线索/日程。
- `AgentChangeList`：统一 old -> new 变更展示。
- `AgentCandidateList`：统一 lead/listing 选择列表。
- `AgentActionBar`：主次外部操作分层，支持 loading/success/error。
- `AgentCardStatus`：统一反馈区。

`AgentWorkspace.tsx` 应逐步只负责选择卡片类型和传入数据，卡片内部逻辑应拆到独立组件文件。

### 5.2 卡片视觉分层

建议每张卡片固定为以下结构：

```text
[Type icon] Card title                         [Draft/Confirm/Read/External badge]
Object line / short summary

Hero facts: 2-4 个最关键字段

Details / changes / generated content

Action bar: primary | secondary | external
Status feedback
```

颜色不应变成单一 hue。可以保留当前清爽浅色基调，但需要用低饱和中性色作为主体，业务类型只作为细节色：

- lead：绿色或青色少量用于状态。
- listing：深青/石墨，用图片或价格强化。
- schedule：蓝色或靛色少量用于时间。
- promotion：暖色/粉色少量用于渠道与 CTA。
- warning/external：琥珀色提示，不要大面积警告背景。

### 5.3 推荐卡片族

按 `lib/agent/registry/intents.ts` 中的 `uiCard` 建议归并为 10 个卡片族：

- `listing_draft`：房源草稿卡。
- `listing_update`：房源变更确认/选择卡。
- `promotion_pack`：推广目标确认、推广内容结果。
- `lead_create`：新线索确认。
- `lead_list`：线索结果/今日跟进。
- `lead_reply`：回复草稿。
- `lead_followup`：跟进摘要、保存 note、设置 reminder、聊天导入。
- `lead_update`：线索状态/详情/主房源更新。
- `schedule_event`：日程确认。
- `schedule_list`：日程结果列表。
- `attribution_summary`：分析摘要。

每个卡片族可有不同 variant，但 shell、action bar、status 反馈必须一致。

## 6. 各卡片的重设计需求

### 房源草稿卡

展示需求：

- 顶部显示“房源草稿 / 待保存”，对象标题用房源 title 或自动生成短标题。
- 首屏优先展示价格、位置、面积、类型、beds/baths。
- 媒体缩略图应紧跟 hero facts，可显示最多 3-4 张，更多用 `+N`。
- description 默认最多 3 行，支持展开。
- 缺失字段用低噪音提示，不要和已识别字段同等重量。

操作需求：

- 主操作：确认并保存。
- 次操作：编辑字段、添加媒体。
- 保存后主操作变成已保存，次操作变成打开房源/继续问 Agent。
- 保存过程要分别展示 listing 保存和媒体上传进度，失败时说明哪些媒体失败。

### 房源更新卡

展示需求：

- 顶部明确“即将更新：房源名”。
- 显示目标房源摘要，避免用户误更新错误房源。
- 变更字段使用统一 old -> new 列表；价格、面积、状态等关键字段可高亮。
- 如果候选房源多个，先展示选择卡，不出现确认写入按钮。

操作需求：

- 主操作：确认更新。
- 次操作：选择其他房源/取消。
- 完成后显示更新成功，并提供打开房源。

### 线索列表/今日跟进卡

展示需求：

- 只读结果和今日跟进要区分：今日跟进应突出“推荐下一步”和“原因”。
- 每条 lead 展示姓名/电话、状态、需求、关联房源、最近联系/创建时间。
- 列表默认 3-5 条，支持“查看更多”或跳转 Leads 页面。
- 空状态要说明筛选条件，而不是泛泛说无结果。

操作需求：

- 每条 lead 的主操作：选择/作为上下文。
- 快捷操作：起草回复、记录跟进、安排提醒，可作为次级 inline action，但不要让卡片过载。

### 线索确认/更新卡

展示需求：

- 顶部显示“确认保存线索”“确认更新线索”“批量更新 N 条线索”。
- 对象 header 展示姓名、电话、当前状态、关联房源。
- 变更 old -> new 必须清楚；批量操作要展示数量和前几条对象。
- 对可能影响业务记录的动作显示 confirmation hint。

操作需求：

- 主操作：确认保存/确认更新/确认批量更新。
- 次操作：编辑字段、取消。
- guest 未登录时不要静默失败，应显示登录所需说明并触发登录。

### 回复草稿卡

展示需求：

- 明确标注“回复草稿”，不要让用户以为已发送。
- 展示目标 lead、渠道 WhatsApp/manual、回复正文、建议下一步。
- 长回复可折叠，但复制应复制全文。

操作需求：

- 主操作：复制。
- 外部操作：打开 WhatsApp，标注“打开，不代表已发送”。
- 可选操作：标记已发送，只有用户确认后才记录 `message_sent`。

### WhatsApp 导入/跟进卡

展示需求：

- 拆成步骤式卡片或分段：解析来源 -> 匹配 lead -> 聊天摘要 -> 推荐下一步。
- 匹配状态必须清楚：已匹配、多个候选、未匹配、需要补充。
- 聊天摘要展示客户需求、预算、区域、异议、看房意图、建议状态、下一步。
- 不要默认保存原始聊天文本；如提供选项，必须明确隐私影响。

操作需求：

- 匹配后：起草回复、保存跟进记录、设置提醒、更新状态。
- 未匹配：选择已有线索、创建新线索、暂不绑定。
- Yes/No 改成业务按钮，例如“保存跟进记录”“暂不保存”。

### 日程卡

展示需求：

- 时间是第一优先级：日期、时间、提醒时间要明显。
- 事件类型和对象分离展示：viewing/follow-up/signing 等 + lead/listing。
- 若时间缺失，卡片应进入“需要补充时间”状态，主按钮不可保存。

操作需求：

- 主操作：确认日程。
- 次操作：编辑时间/对象/备注。
- 保存后提供打开 Schedule 或查看今日安排。

### 推广卡

展示需求：

- 推广目标确认卡要先展示 listing 摘要，再展示渠道选择。
- 渠道选项应像 segment/toggle cards，显示渠道名称和会生成的内容类型。
- 结果卡按渠道分组，每个渠道有统一 header、内容、链接、CTA、操作栏。
- 明确区分：
  - 社交文案：只是 copy draft，未发布。
  - campaign links：生成 trackable landing links，可追踪线索。

操作需求：

- 目标确认主操作：生成推广包。
- 结果主操作：复制该渠道文案。
- 外部操作：打开 landing page、分享到 WhatsApp。
- 复制成功、链接生成失败、部分渠道失败都要有行内状态。

### 实体选择卡

展示需求：

- 标题要说明为何选择：例如“找到多个 Ahmed，请选择一个继续”。
- 候选展示匹配原因：电话、区域、房源、状态、最近更新时间。
- 如果允许“不绑定继续”，必须说明继续后会缺少什么。

操作需求：

- 主操作在每个候选上：选择。
- 次操作：不绑定继续，仅在业务允许时出现。
- 选择后卡片进入 completed 状态，不能重复选择。

### 分析摘要卡

展示需求：

- 与 Agent 卡片体系一致，顶部说明分析范围和时间窗口。
- 关键指标先展示，然后是洞察和建议动作。
- 如果数据缺失，应标注 partial，而不是看起来像完整结论。

操作需求：

- 打开 Analytics 页面。
- 针对某条洞察继续追问或生成下一步行动。

## 7. 状态与交互规范

每个可操作卡片至少支持这些状态：

- idle：可操作。
- editing：字段编辑中。
- loading/saving/generating：主操作处理中，禁用重复触发。
- success/completed：完成后不可重复写入。
- error：显示具体错误和可恢复操作。
- auth_required：说明需要登录，触发登录入口。
- partial_success：例如 listing 保存成功但部分媒体上传失败。

按钮规范：

- 每张卡最多一个 primary。
- 外部动作不要伪装成普通 primary。
- 已完成动作按钮文案变成“已保存/已更新/已生成/已复制”，并禁用或切换为打开结果。
- 移动端 action bar 纵向排列，按钮全宽。

确认规范：

- 写入、状态更新、日程、推广链接、外部 WhatsApp、批量操作必须确认。
- 只读列表、草稿生成、分析摘要不需要确认。
- 任何“打开 WhatsApp”都不等于已发送；UI 必须避免暗示已发送。

## 8. 多语言与文案

当前已有 `getAgentCardCopy`、`getLeadCardCopy`、`getScheduleCardCopy`，下一版必须：

- 移除卡片内硬编码英文 label，统一进入 copy layer。
- 中文、英文、Urdu/Roman Urdu 都能展示核心操作。
- 文案短、动作明确，避免解释性长句塞进按钮。
- 风险/确认提示使用 hint/status，不要占据主体视觉。

## 9. 技术重构建议

优先级建议：

1. 先补强 `AgentOutputCard`，真正渲染 title、icon、summary/badge，并定义统一 action/status 区。
2. 把所有仍使用 `.chat-import-card`、`.chat-reply-card` 的 WhatsApp 卡片迁到统一 shell。
3. 从 `AgentWorkspace.tsx` 中拆出卡片组件到 `components/agent/cards/`。
4. 建立统一数据适配层，把 `uiCard`、intent、risk、confirmation 映射成卡片 tone、badge、required confirmation。
5. 建立 Storybook 或内部 dev fixtures，覆盖每类卡片的 idle/loading/success/error/mobile 状态。
6. 补测试：卡片选择、确认写入、外部 WhatsApp、guest auth、实体选择后的 continuing flow。

建议目录：

```text
components/agent/cards/
  AgentCardShell.tsx
  AgentActionBar.tsx
  AgentFactGrid.tsx
  AgentChangeList.tsx
  ListingCards.tsx
  LeadCards.tsx
  WhatsAppFollowupCards.tsx
  ScheduleCards.tsx
  PromotionCards.tsx
  EntitySelectionCard.tsx
```

## 10. 设计交付要求

让 Claude/Gemini 出方案时，请要求他们至少交付：

- 卡片设计原则。
- 所有卡片族的信息架构。
- 每类卡片字段优先级。
- 每类卡片操作分层。
- 移动端布局说明。
- 关键状态设计：loading、success、error、auth required、partial success。
- 外部动作和确认动作的安全设计。
- 可以落地到当前代码的组件拆分建议。

不要只提交单张漂亮卡片。方案必须覆盖 Agent 回复中所有结构化卡片。

## 11. 验收标准

功能验收：

- 所有现有结构化回复仍能展示。
- 所有写入动作仍必须确认。
- 实体未找到/多候选时不会展示错误对象。
- guest 写入动作会触发登录提示。
- 打开 WhatsApp 不会记录为 message sent。
- promotion copy 与 campaign links 在 UI 上可区分。

体验验收：

- 用户能在 2 秒内判断卡片是只读、草稿、待确认、外部动作还是选择卡。
- 卡片首屏只展示最关键字段，长内容可展开。
- 操作按钮主次清楚，移动端不挤压、不溢出。
- 完成/失败状态明确，不需要用户猜测有没有保存成功。
- 中文、英文、Urdu/Roman Urdu 不出现明显硬编码缺口。

工程验收：

- 卡片组件从 `AgentWorkspace.tsx` 拆出，主文件显著变薄。
- 新增统一 shell/action/fact/change 组件。
- 关键卡片有测试或 fixture 覆盖。
- CSS 不再大量依赖卡片私有 class 互相覆盖。
