# Pislaka Agent 全面测试计划与优化建议

## 0. 当前检查结论

本轮已完成的工程检查：

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm run build`：通过，Next.js 生产构建成功。
- 自动浏览器视觉检查：未完成。in-app browser 连续两次在打开 `http://127.0.0.1:3000` 时附着超时，因此本计划把视觉验收列为后续必须补测项。

当前已有 `docs/agent-first-login-internal-test-plan.zh-CN.md`，覆盖了首次登录、房源、推广、线索、回复、日程的主闭环。本文件在其基础上补充更系统的测试矩阵、经纪人输入形态、UX/交互评估、代码结构和可扩展性检查。

## 1. 测试目标

本轮测试不应只验证“Agent 能不能回答”，而要验证它是否能作为经纪人的工作台入口稳定地完成业务动作：

1. 对话理解：识别经纪人口吻、Roman Urdu、英文、中文、语音转写、WhatsApp 粘贴文本、短指令和缺省上下文。
2. 实体安全：找不到或多候选时必须停住，不能静默使用最新 lead/listing。
3. 确认边界：所有写入、状态变更、日程变更、外部跳转、推广生成都必须有明确确认。
4. 业务闭环：房源 -> 推广链接 -> 买家 inquiry -> lead -> 回复 -> 跟进记录 -> 日程 -> 归因。
5. 用户体验：工作流是否顺手，卡片是否清楚，移动端是否可用，入口和状态反馈是否降低经纪人操作成本。
6. 工程质量：路由规则、实体解析、前端卡片、API 写入是否可测试、可扩展、可配置。

## 2. 经纪人工作流测试矩阵

### 2.1 房源工作流

| 场景 | 输入示例 | 预期 |
| --- | --- | --- |
| 新建出售房源 | `Create 1 kanal house in DHA Phase 6 Lahore, 5 beds, demand 8.5 crore.` | `create_listing_draft`，提取城市、区域、面积、价格、卧室，保存前预览 |
| 新建出租房源 | `2 bed furnished apartment Gulberg rent 1.8 lakh monthly.` | `create_listing_draft`，`listing_type=rent`，价格换算为 PKR |
| Roman Urdu | `Bhai 10 marla brand new house DHA 5 add karo, demand 4.25 crore.` | 识别为房源草稿，不应 general reply |
| 上传图片无文字 | 只拖入图片 | 要求补充房源描述或目标房源，不能挂到最新房源 |
| 修改当前房源 | `Owner flexible, change demand to 8.3 crore and add swimming pool.` | `update_listing_draft`，必须先解析当前/目标房源并确认 |
| 多候选修改 | 多套 DHA 6 后输入 `Change DHA Phase 6 price to 8 crore.` | 展示候选，不执行 |
| 发布状态 | `Publish this listing.` | 状态变更预览，确认后写 `published` |

### 2.2 推广和公开页闭环

| 场景 | 输入示例 | 预期 |
| --- | --- | --- |
| 生成多渠道推广 | `Promote this listing on WhatsApp, Facebook and Instagram.` | `create_campaign_links`，确认后生成对应 channel 卡片和 `/p/[code]` |
| 渠道词误判保护 | `Reply to Ahmed on WhatsApp.` | 必须是 `draft_lead_reply`，不是推广 |
| 外部发布措辞 | `Post it to Zameen.` | 生成可复制/可确认的推广内容或提示当前不支持，不声称已发布 |
| 不支持渠道 | `Make direct link also.` | 明确当前支持渠道，不创建不存在 channel |
| 公开页 inquiry | 买家提交姓名、电话、预算、看房时间 | 创建 lead，带 campaign/listing/channel 归因 |

### 2.3 线索和回复工作流

| 场景 | 输入示例 | 预期 |
| --- | --- | --- |
| 查询新线索 | `Show new leads from WhatsApp.` | `list_leads`，读操作不确认 |
| 今日跟进 | `follow up` / `Who should I follow up today?` | `list_today_followups`，不是普通 lead list |
| 起草回复 | `Reply to Ahmed on WhatsApp, ask if Sunday 4pm works.` | 解析 Ahmed，生成草稿，不更新 `last_contacted_at` |
| 打开 WhatsApp | 点击 open WhatsApp | 需要明确动作，打开不等于已发送 |
| 记录已发送 | `I sent message to Ahmed.` | `record_lead_followup`，只在确认/点击 Sent 后写 `message_sent` |
| 热线索 | `Ahmed is hot now.` | `qualified + high urgency`，不是写入 `hot` 状态 |
| 未找到线索 | `Mark Bilal as contacted.` 但 Bilal 不存在 | 明确找不到，不拿最新 lead 代替 |
| 多 Ahmed | 多个 Ahmed 后输入 `Reply to Ahmed.` | 候选卡选择后继续 |
| 手动新线索 | `New client Sara, WhatsApp 0300..., wants DHA 5.` | `create_lead`，保存前预览 |
| 缺联系方式 | `Add buyer, budget 5 crore.` | 要求补充姓名/电话/email，不能创建低质量匿名线索 |

### 2.4 WhatsApp 聊天导入

| 场景 | 输入形态 | 预期 |
| --- | --- | --- |
| 粘贴聊天无指令 | 多轮 WhatsApp 文本 | 默认分析 + 回复草稿，不写入 |
| 明确保存跟进 | `Save this as follow-up` + 聊天 | 匹配已有 lead，显示将写入的 summary 和状态建议 |
| 老客户新进展 | 现有 lead 已 qualified，新聊天提到看房时间 | 对比历史状态，推荐日程或跟进，不重复改状态 |
| 找不到客户 | 聊天中只有名字无电话 | 提示可能是新客户，建议补联系方式或创建 lead |
| 语气质量 | Roman Urdu/English 混合聊天 | 回复应保持经纪人口吻，短、自然、可复制到 WhatsApp |

### 2.5 日程和提醒

| 场景 | 输入示例 | 预期 |
| --- | --- | --- |
| 看房 | `Schedule viewing with Ahmed tomorrow at 4pm for this listing.` | 绑定 lead/listing，预览 start/end/reminder |
| 纯提醒 | `Remind me tomorrow 11am to call Sara.` | `follow_up` reminder，可只绑定 lead |
| 查询日程 | `What do I have tomorrow?` | `list_schedule_events`，不确认 |
| 时间解析 | `kal 5 baje`, `today evening`, `in 2 hours` | 按 broker timezone 解析 |
| 不完整日程 | `Schedule tomorrow.` | 要求补事项/时间，不创建 |
| 多候选绑定 | 多个 Sara 或多套 listing | 候选卡选择；可继续保存自然语言 reference，但不能结构化绑定错误记录 |

## 3. 输入形式和边界用例

必须覆盖这些输入形态：

- 极短指令：`follow up`、`promote it`、`reply him`、`save`、`confirm`。
- 混合语言：English + Roman Urdu、中文操作描述、Urdu script。
- 房产单位：`kanal`、`marla`、`sqft`、`lakh`、`crore`、`karor`、`cr`。
- 地名变体：`DHA 5`、`DHA Phase 5`、`DHA-V`、`Bahria`、`Bahria Town Lahore`。
- 电话变体：`0300 1234567`、`+92 300 1234567`、`3001234567`。
- 上下文代词：`this listing`、`it`、`him`、`刚才那套`、`这个客户`。
- 噪声文本：WhatsApp 转发头、时间戳、emoji、错别字、语音转写标点缺失。
- 权限状态：guest、资料未完善 broker、正常 broker、另一个 broker 的数据隔离。

## 4. UX 和视觉设计检查

### 4.1 Agent Workspace

重点检查：

- Composer 是否清楚表达“当前上下文”：已选 listing/lead chip 是否明显、可移除、不会在移动端挤占输入区。
- 附件菜单是否区分图片/视频、WhatsApp chat、普通文件，错误类型是否及时提示。
- 语音输入的状态是否完整：录音中、转写中、失败、可重试。
- Agent 卡片是否“一次只做一个决定”：保存房源、改状态、生成推广、创建日程不要混在一张复杂卡里。
- 确认按钮文案是否具体：`Save listing`、`Update Ahmed status`、`Create viewing` 优于泛泛的 `Confirm`。
- 找不到/多候选时是否用候选卡而不是长文本列表。
- 失败状态是否保留草稿，不能让经纪人重新输入长房源描述。

优化空间：

- 在 Agent 首页增加“今天要处理的队列”：新线索、今日跟进、即将看房、待确认草稿。经纪人每天打开后先看到可行动事项。
- 对每个确认卡增加“将写入字段”小表格，尤其是 lead 状态、last_contacted_at、schedule 时间。
- 对 WhatsApp 回复卡增加三种快速语气切换：short、Roman Urdu、professional English。
- 对外部动作统一标识：`opens WhatsApp only`，避免用户误以为已经发送。

### 4.2 Listings

重点检查：

- 卡片是否能快速扫到：区域、面积、价格、状态、媒体数、最近更新时间。
- 编辑时价格输入是 PKR 原始数字，容易让经纪人出错；应考虑显示 crore/lakh 辅助格式。
- 推广生成入口在 listing panel 内已存在，但需要确认渠道选择、生成中、失败、复制后的反馈是否足够清楚。
- 媒体上传应支持多选、排序、封面图选择；当前单文件上传会让真实经纪人批量房源录入较慢。

优化空间：

- 增加 listing 状态筛选：draft/published/archived。
- 增加缺失质量提示：无价格、无图片、无描述、无面积。
- 显示推广表现摘要：点击数、线索数、最近来源 channel。

### 4.3 Leads

重点检查：

- 当前列表有搜索、状态和渠道筛选，适合基础使用。
- 需要强化“下一步”：每行显示建议动作，如 Reply、Schedule viewing、Mark contacted。
- `Last contact` 和 `Next follow-up` 应作为排序维度，不只是信息展示。
- 手机端每行信息多，需验证是否出现按钮换行、文字挤压和横向滚动。

优化空间：

- 增加默认视图：Needs reply、Today follow-up、Hot、New。
- 在 lead 详情页展示 timeline：inquiry、回复草稿、WhatsApp opened、message_sent、status_changed、schedule。
- 对 high urgency lead 增加视觉优先级，但不要只靠颜色。

### 4.4 Schedule

重点检查：

- 默认视图应是未来 7 天，不只今天。
- 看房、跟进、签约、handover 等 event type 应有稳定颜色/图标。
- 日程创建后应能从 event 回跳 lead/listing。
- 移动端顶部指标卡不能超过首屏太多，否则经纪人看不到当天事项。

优化空间：

- 增加日程冲突提示。
- 增加快速完成/推迟按钮。
- 对 `reminder_at` 展示本地时间和相对时间，例如 `1 hour before`。

### 4.5 Public Lead Page

重点检查：

- `/p/[code]` 必须移动端优先，买家应能 30 秒内提交。
- 电话/WhatsApp 字段应适配 Pakistan 手机号格式。
- 提交成功页要明确“broker will contact you on WhatsApp”，并避免重复提交。
- 房源图片、价格、位置必须首屏可见。

优化空间：

- 增加 sticky WhatsApp/contact CTA。
- 表单减少必填项，优先姓名和电话；预算/看房时间可选。
- 显示 campaign channel label 但不要让买家感到被追踪。

## 5. 代码结构和性能优化建议

### 5.1 Agent 路由可测试性

当前核心逻辑分布在：

- `lib/agent/intent-router.ts`：本地正则分类和提取。
- `lib/agent/deepseek.ts`：LLM prompt、本地 fallback、normalize。
- `lib/agent/entity-resolution.ts`：lead/listing/schedule 解析。
- `components/agent/AgentWorkspace.tsx`：大量 action/card orchestration。

建议：

- 给 `intent-router.ts` 增加表驱动单元测试，覆盖至少 80 条真实经纪人输入。
- 把 prompt 中的 supported intents、routing priority、confirmation matrix 抽到单独配置或 rulebook，并在测试里校验本地规则和 prompt 枚举一致。
- 把 `AgentWorkspace.tsx` 中各类 preview/confirm handler 拆成 domain hooks 或 action controllers，例如 `useLeadActions`、`useListingActions`、`useScheduleActions`。
- 引入统一 `AgentActionHandler` 映射，避免每新增 intent 都在前端主组件里继续膨胀。

### 5.2 实体解析和安全

建议：

- 为 no_match、ambiguous、needs_clarification 建立统一 UI contract。
- 解析结果里保留 score 和命中原因，便于调试真实误判。
- listing/lead resolution 的“最新记录”只能在用户明确说 latest/most recent 时使用，测试要防止上下文误用。
- 对 schedule 的 lead/listing binding 建立“可保存自然语言 reference，但不能写结构化 id”的清晰规则。

### 5.3 API 和数据一致性

建议：

- 所有写入 API 增加 idempotency key 或 action message id，防止重复点击确认造成重复记录。
- `reply_drafted`、`whatsapp_opened`、`message_sent` 的副作用用数据库约束或服务层函数固定下来，不能只依赖前端约定。
- 对 promotion generation 加 channel allowlist，避免 LLM 或前端传入未支持 channel。
- 增加 audit log：broker_id、intent、payload、resolution、confirmed_by、created_at。

### 5.4 性能

当前构建显示 `/` First Load JS 约 231 kB，是全站最高。建议：

- 拆分 Agent Workspace 的重型功能：WhatsApp import、voice、promotion cards、media preview 可以动态加载。
- Server Component 页面里多处重复签名 listing media URL，可抽成共享查询函数，并控制只签首图或当前可见图。
- Lead/listing 默认列表目前限制 20/30/100，需要随着数据量增加引入分页、游标和服务端筛选。
- 图片预览应使用尺寸约束和懒加载，避免大量 signed image 一次性加载。

### 5.5 可扩展 Agent 产品化

建议抽离这些配置：

- `intent registry`：intent 名称、domain、required entities、confirmation policy、handler。
- `channel registry`：WhatsApp/Facebook/Instagram/portal 的 copy 模板、可执行能力、外部动作说明。
- `locale registry`：English、Roman Urdu、Urdu script、中文的 UI copy 和 fallback 文案。
- `market config`：Pakistan 单位、货币、城市/区域 alias、电话格式。
- `workflow policies`：哪些动作可读、哪些必须确认、哪些必须人工选择实体。

目标结构：

```text
lib/agent/
  registry/
    intents.ts
    channels.ts
    confirmation-policy.ts
    locale-copy.ts
    market-pk.ts
  routing/
    classify-local.ts
    normalize-llm-action.ts
    entity-resolution.ts
  handlers/
    listings.ts
    leads.ts
    schedule.ts
    promotions.ts
```

## 6. 自动化测试分层

### P0：必须自动化

- Intent classification 表驱动测试。
- Entity resolution no_match/ambiguous/matched 测试。
- Confirmation policy 测试：写入动作必须 `requires_confirmation=true`。
- API 权限测试：broker 只能读写自己的 listings/leads/events。
- `last_contacted_at` 副作用测试：只有 `message_sent` 更新。

### P1：建议自动化

- Playwright 主流程：创建房源 -> 保存 -> 推广 -> public inquiry -> lead 出现 -> 回复草稿 -> 日程。
- 移动端 viewport：`/`、`/listings`、`/leads`、`/schedule`、`/p/[code]`。
- WhatsApp chat import fixture：existing lead、新 lead、多候选、无联系方式。
- 失败恢复：LLM 超时、本地 fallback、生成功能 25 秒超时、Supabase API 失败。

### P2：人工内测

- 真实经纪人口吻是否自然。
- 回复是否适合 WhatsApp 发送。
- 是否减少经纪人日常操作步骤。
- 首次使用是否知道下一步做什么。
- 买家公开页是否愿意提交手机号。

## 7. 建议验收顺序

1. 先跑静态检查：`npm run typecheck`、`npm run lint`、`npm run build`。
2. 用 seed 数据准备：至少 3 套 DHA listing、2 个 Ahmed、1 个 Sara、1 条 campaign lead、3 条 schedule event。
3. 跑 P0 intent/entity 单元测试。
4. 跑主闭环 Playwright。
5. 桌面和移动端视觉检查。
6. 邀请 2-3 个真实经纪人按真实话术测试，不给他们脚本，只记录输入和卡住点。
7. 把误判输入加入 regression examples，再修 router/entity rules。

## 8. 缺陷优先级

- P0：错误写入别人的 lead/listing、无确认执行外部动作、数据隔离失败、生产构建失败。
- P1：intent 误判导致主流程阻塞、找不到实体却使用最新记录、确认后写错字段、公开页无法提交。
- P2：回复语气不自然、候选卡信息不足、移动端拥挤、状态反馈不清楚。
- P3：文案 polish、空状态优化、图标一致性、微交互。

## 9. 下一步建议

短期先做三件事：

1. 增加 `intent-router` 和 `entity-resolution` 的 fixture 测试，先锁住安全边界。
2. 给 Agent Workspace 主流程加一条 Playwright E2E，覆盖房源、推广、lead、回复、日程。
3. 把 `AgentWorkspace.tsx` 的 action handlers 按 domain 拆分，降低继续扩展 intent 的成本。

## 10. 自动化测试执行记录（2026-06-13）

本轮在电脑锁屏、不做页面视觉检查的前提下，已完成 P0/P1 中不依赖浏览器的自动化测试入口建设。

### 10.1 已新增测试能力

- 引入 Vitest，新增 `npm run test` 和 `npm run test:watch`。
- 新增 `vitest.config.ts`，支持 `@/` 路径别名。
- 抽离可测试模块：
  - `lib/agent/confirmation-policy.ts`
  - `lib/leads/followup-effects.ts`
  - `lib/leads/lead-api-schemas.ts`
  - `lib/promotions/promotion-api-schemas.ts`

### 10.2 已覆盖测试文件

当前共有 10 个测试文件、89 条测试：

- `tests/agent/intent-router.test.ts`
  - 覆盖 reply/promote 区分、lead query、status update、schedule、listing draft/update 等经纪人常见输入。
- `tests/agent/entity-resolution.test.ts`
  - 覆盖 lead/listing 的 matched、ambiguous、no_match，以及不能静默使用 latest 记录。
- `tests/agent/confirmation-policy.test.ts`
  - 覆盖读操作、草稿操作、写入操作、promotion、schedule、lead update 的确认策略。
- `tests/agent/agent-message-route.test.ts`
  - 覆盖匿名用户、无 broker profile、已登录 broker 的 agent message route 分支。
- `tests/leads/followup-effects.test.ts`
  - 覆盖 `last_contacted_at` 副作用规则：只有 `message_sent` 更新。
- `tests/leads/followup-activities-route.test.ts`
  - 覆盖 follow-up activity API 的 400/401/404/500、草稿不算已联系、发送才算已联系、原始聊天保存条件。
- `tests/leads/lead-api-schemas.test.ts`
  - 覆盖手动 lead 创建条件、lead update 字段限制、拒绝直接 PATCH `last_contacted_at`。
- `tests/leads/leads-route.test.ts`
  - 覆盖手动创建 lead、更新 lead、未授权、找不到 lead、audit log 写入。
- `tests/promotions/promotion-api-schemas.test.ts`
  - 覆盖 promotion channel allowlist、拒绝 `direct`、渠道数量和 instruction 长度。
- `tests/promotions/promote-listing-route.test.ts`
  - 覆盖 promotion API 的 400/401/404/500、默认渠道、campaign link 创建、WhatsApp share URL、audit log。

### 10.3 本轮发现并修正的规则问题

- `Show new leads...` 曾可能被误判为 `create_lead`，已增加 read-verb guard。
- `Show hot leads` 曾可能被误判为 `update_lead_status`，已增加 read-verb guard。
- schedule read regex 增加大小写不敏感匹配。
- lead update schema 已禁止普通 PATCH 直接写入 `last_contacted_at`，该字段只能通过 follow-up activity 的 `message_sent` 副作用更新。
- promotion request schema 已集中到 `lib/promotions/promotion-api-schemas.ts`，并锁定支持渠道为 `whatsapp`、`facebook`、`instagram`、`portal`。

### 10.4 已执行命令和结果

- `npm run test`：通过，10 个测试文件、89 条测试。
- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm run build`：通过，Next.js 生产构建成功。

### 10.5 后续未完成项

这些测试需要电脑解锁或可用浏览器环境后继续：

- Agent Workspace 页面 E2E：聊天输入 -> 确认卡 -> 保存/更新。
- Listing 主流程 E2E：创建房源 -> 保存 -> 生成推广。
- Public lead page E2E：`/p/[code]` 提交买家表单 -> lead 出现。
- Leads 页面 E2E：筛选、查看详情、回复草稿、记录已发送。
- Schedule 页面 E2E：创建提醒/看房、完成/延期、移动端布局。
- 移动端视觉回归：`/`、`/listings`、`/leads`、`/schedule`、`/p/[code]`。
