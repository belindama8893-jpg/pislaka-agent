# Pislaka Agent 首次登录经纪人内测脚本

## 1. 测试目标

这份脚本用于模拟一个真实 Lahore 房产经纪人第一次使用 Pislaka Agent 的完整工作日，而不是只测单个按钮。当前代码结构已经支持这些核心路径：

- `/` Agent Workspace：对话创建房源、创建线索、生成回复、推广、创建日程。
- `/listings`：查看已保存房源草稿、房源媒体和房源状态。
- `/leads`：查看买家线索、来源渠道、状态和 urgency。
- `/schedule`：查看和管理看房、跟进、签约、handover 等日程。
- `/p/[code]`：买家通过推广链接打开公开房源页并提交 inquiry。

本轮内测重点：

- Agent 是否能从真实经纪人口吻中识别业务 intent。
- Agent 是否能正确抽取 Pakistan 房产字段，例如 DHA Phase、kanal/marla、crore/lakh、demand、viewing、WhatsApp。
- 所有写入动作是否先给预览/确认，再保存。
- 房源、推广、公开页、线索、回复、日程是否能形成闭环。
- 模糊、找不到、缺字段时是否会澄清，而不是乱用最新记录。

## 2. 当前实现约束

测试时按当前代码能力判断，不要用未来功能做失败标准。

| 能力 | 当前实现要点 | 测试预期 |
| --- | --- | --- |
| Profile | 首次登录后，如果 `full_name`、`city`、`agency_name` 不完整，会显示 First-run setup | 保存后进入工作台 |
| 房源创建 | Agent 生成 listing draft，确认后调用 `/api/listings/draft` 保存，默认 `status=draft` | 不确认不入库 |
| 房源修改 | Agent 用 `update_listing_draft`，需要解析目标房源并确认 | 可改价格、features、状态等 |
| 媒体 | Composer 支持图片/视频附件，房源草稿确认后上传/关联 | 无文字只传图时应要求补房源信息 |
| 推广 | `/api/agent/promote-listing` 支持 `whatsapp`、`facebook`、`instagram`、`portal` | 当前没有 `direct` 渠道 |
| 公开页 | `/p/[code]` 会记录 click_events，并展示 inquiry 表单 | 打开链接也应产生归因点击 |
| 线索创建 | 支持公开页 campaign lead，也支持 Agent 手动 `create_lead` | 手动线索至少要有姓名/电话/email 之一 |
| 线索状态 | 状态值是 `new`、`contacted`、`qualified`、`closed`、`lost`；“hot lead”映射为 `qualified + high urgency` | 不存在 `hot` 这个状态值 |
| 线索详情 | 支持修改姓名、电话、email、message | 需要确认 |
| 线索绑定房源 | 支持 `update_lead_listing` | 需要同时解析 lead 和 listing |
| 回复草稿 | `/api/leads/reply-draft` 生成 WhatsApp 回复和 deep link | 生成草稿不等于自动发送 |
| 日程 | 支持 viewing、follow_up、contract_signing、handover、offer_deadline、document_expiry、weekly_review、monthly_client_review | 创建/修改/取消需要确认；查询不需要 |
| 批量 | 当前只对多选 lead 的批量状态更新有局部支持，批量回复/批量日程还会提示未完整支持 | 不要按完整批量 CRM 验收 |

## 3. 测试账号与基础资料

建议使用一个全新账号，模拟真实经纪人资料：

- Full name：Ali Raza
- City：Lahore
- Agency：Raza Associates
- Phone：0300 1234567
- Language：English + Roman Urdu

测试设备：

- 经纪人端：桌面浏览器登录 Agent Workspace。
- 买家端：无痕窗口或手机浏览器打开推广链接。
- 移动端补测：至少用手机宽度检查 `/`、`/listings`、`/leads`、`/schedule`、`/p/[code]`。

## 4. 主流程：真实经纪人一天的对话

### A. 首次登录和开场

| 步骤 | 经纪人操作 / 对话 | 预期结果 | 通过标准 |
| --- | --- | --- | --- |
| A1 | 注册/登录新账号 | 如果资料不完整，展示 First-run setup | 能保存姓名、城市、Agency、手机号、语言 |
| A2 | 填写上面的 Ali Raza 资料并保存 | 回到 Agent Workspace | Sidebar 或工作台能继续使用该 broker 上下文 |
| A3 | `Assalam o Alaikum, I am Ali from Raza Associates Lahore. I handle DHA and Bahria files. What can you help me with today?` | Agent 简短介绍可做房源、推广、线索、回复、日程 | 不应创建空房源，也不应跳到无关聊天 |

### B. 创建真实房源草稿

| 步骤 | 经纪人操作 / 对话 | 预期结果 | 通过标准 |
| --- | --- | --- | --- |
| B1 | `Create listing for sale: 1 kanal owner-built house in DHA Phase 6 Lahore, 5 beds, 6 baths, demand 8.5 crore, near park, basement, imported kitchen, solid wood doors. Owner says serious buyers only.` | `create_listing_draft`，展示房源草稿卡 | 提取 `sale`、Lahore、DHA Phase 6、1 kanal、8.5 crore、5/6 beds/baths、features |
| B2 | `Make the copy premium but not too filmy. Mention suitable for overseas Pakistani family.` | 更新当前草稿文案 | 仍是预览/草稿，不应保存到数据库 |
| B3 | 可选：上传 1-3 张房源图片，然后输入 `Use these photos for this listing.` | 图片显示在 composer 或草稿上下文中 | 图片不会单独成为 intent；应随房源确认保存 |
| B4 | 点击保存或输入 `Save this listing.` | 调用保存流程 | 保存成功后 `/listings` 能看到该房源，状态为 draft |
| B5 | 打开 `/listings` | 查看房源列表 | 标题、价格、区域、面积、状态、媒体数量正确 |

### C. 修改房源和发布状态

| 步骤 | 经纪人操作 / 对话 | 预期结果 | 通过标准 |
| --- | --- | --- | --- |
| C1 | 回到 Agent，对刚才房源说：`Owner is flexible now, change demand to 8.3 crore and add swimming pool.` | `update_listing_draft`，显示修改预览 | 不确认不写入 |
| C2 | `Confirm update.` | 保存修改 | `/listings` 中价格变为 PKR 8.3 Crore，features 增加 swimming pool |
| C3 | `Publish this listing.` | 识别为房源状态更新，要求确认 | 确认后状态应变为 `published`；如果当前实现只支持通过编辑状态，也应走预览 |
| C4 | 负向：`Change my DHA house demand to 7 crore.` 如果已有多套 DHA 房源 | 应要求选择具体房源 | 不能静默修改最新一套 |

### D. 生成推广包

| 步骤 | 经纪人操作 / 对话 | 预期结果 | 通过标准 |
| --- | --- | --- | --- |
| D1 | `Promote this DHA Phase 6 house on WhatsApp, Facebook and Instagram. Keep copy short for serious buyers.` | `create_campaign_links`，显示推广目标/确认 | 渠道应识别为 WhatsApp、Facebook、Instagram |
| D2 | 确认生成推广 | 调用 `/api/agent/promote-listing` | 每个 channel 生成 card、campaign code、landing URL；WhatsApp card 有 share URL |
| D3 | 打开 WhatsApp 或 Instagram 对应 landing URL | 进入 `/p/[code]` 公开页 | 页面显示 channel label、房源详情、lead form；打开页面记录 click_events |
| D4 | 负向：`Make direct link also.` | 当前渠道不支持 direct | Agent 不应生成不存在的 direct channel；可提示使用已有 landing URL |

### E. 买家端报名/留资

在买家端打开刚才生成的 WhatsApp 或 Instagram landing URL，填写：

- Name：Ahmed Raza
- Phone / WhatsApp：0300 1112223
- Email：留空或 `ahmed.raza@example.com`
- Budget：PKR 8 Crore
- Viewing：This weekend
- Need：Family home
- Contact：WhatsApp
- Question：`Is owner open for negotiation? I want a visit with family.`

| 步骤 | 操作 | 预期结果 | 通过标准 |
| --- | --- | --- | --- |
| E1 | 提交 inquiry | `/api/leads` 创建 campaign lead | lead 关联正确 campaign link、listing、channel |
| E2 | 回到经纪人端，打开 `/leads` | 出现 Ahmed Raza | status 为 `new`，source channel 正确，message 包含预算/看房时间/偏好 |
| E3 | 在 Agent 输入：`Show new leads from WhatsApp.` | `list_leads` | 返回 Ahmed 或说明无匹配；读操作不要求确认 |

### F. AI 回复和线索状态

| 步骤 | 经纪人操作 / 对话 | 预期结果 | 通过标准 |
| --- | --- | --- | --- |
| F1 | `Reply to Ahmed on WhatsApp. Tell him owner is slightly negotiable and ask if Sunday 4pm works for family visit.` | `draft_lead_reply` | 返回 WhatsApp 回复草稿，引用 Ahmed 的需求和房源 |
| F2 | `Make it shorter, Roman Urdu tone.` | 修改回复草稿 | 不自动发送 |
| F3 | 点击/确认打开 WhatsApp deep link | 外部动作前要求确认 | 不确认不打开/不发送 |
| F4 | `Mark Ahmed as contacted.` | `update_lead_status` 预览 | 确认后 status 变为 `contacted` |
| F5 | `Ahmed is a hot lead now.` | 显示状态/urgency 更新预览 | 确认后应变为 `qualified`，urgency 为 `high` |

### G. 手动添加线索

| 步骤 | 经纪人操作 / 对话 | 预期结果 | 通过标准 |
| --- | --- | --- | --- |
| G1 | `Add new buyer lead: Sara Malik, WhatsApp 0300 4445556, looking for 10 marla house in DHA Phase 5 or 6, budget 4.2 crore, wants possession soon.` | `create_lead`，显示保存预览 | 至少抽取 full_name、phone、message、status new、source manual |
| G2 | `Save this lead.` | 保存手动线索 | `/leads` 能看到 Sara Malik |
| G3 | `Update Sara phone to 0300 9998887.` | `update_lead_details` 预览 | 确认后 phone 更新 |
| G4 | `Attach Sara to this DHA Phase 6 listing.` | `update_lead_listing` | 如果当前有 listing context，确认后 Sara 绑定该 listing |
| G5 | 负向：`Add buyer, budget 5 crore.` | 缺少姓名/电话/email | 应要求补充，而不是创建匿名无联系方式线索 |

### H. 日程和提醒

| 步骤 | 经纪人操作 / 对话 | 预期结果 | 通过标准 |
| --- | --- | --- | --- |
| H1 | `Schedule viewing with Ahmed for this DHA Phase 6 house tomorrow at 4pm. Remind me one hour before.` | `create_schedule_event`，event_type viewing | 预览含 title、start_at、reminder_at、lead/listing reference；确认后保存 |
| H2 | `Confirm schedule.` | 创建 broker event | `/schedule` 能看到 viewing |
| H3 | `What do I have tomorrow?` | `list_schedule_events` | 直接返回 tomorrow 日程，不要求确认 |
| H4 | `Add follow up reminder for Sara tomorrow 11am to ask if she wants Phase 5 option.` | `create_schedule_event`，event_type follow_up | 确认后 `/schedule` 出现 reminder |
| H5 | `Schedule monthly client review every first Monday.` | recurring 类型 | 如果解析不完整，应预览或要求澄清 recurrence |
| H6 | 负向：`Schedule tomorrow.` | 缺少对象/事项/时间 | 应要求补充，不应创建事件 |

### I. 归因和下一步建议

| 步骤 | 经纪人操作 / 对话 | 预期结果 | 通过标准 |
| --- | --- | --- | --- |
| I1 | `Which leads should I follow up today?` | `list_leads` 或分析型回答 | 不改状态；可按 new/contacted/qualified 和 urgency 排序 |
| I2 | `Show attribution for this listing.` | `show_basic_attribution` 或归因摘要 | 能提到各 channel 点击/线索；数据不足时明确说明 |
| I3 | `How is this DHA Phase 6 listing performing?` | 房源表现摘要 | 如果无明确 listing context，要求选择房源 |

## 5. 可直接复制的主测试对话

按顺序复制到 Agent Workspace。需要点击确认的地方，先观察预览，再确认。

1. `Assalam o Alaikum, I am Ali from Raza Associates Lahore. I handle DHA and Bahria files. What can you help me with today?`
2. `Create listing for sale: 1 kanal owner-built house in DHA Phase 6 Lahore, 5 beds, 6 baths, demand 8.5 crore, near park, basement, imported kitchen, solid wood doors. Owner says serious buyers only.`
3. `Make the copy premium but not too filmy. Mention suitable for overseas Pakistani family.`
4. `Save this listing.`
5. `Show my listings.`
6. `Owner is flexible now, change demand to 8.3 crore and add swimming pool.`
7. `Confirm update.`
8. `Publish this listing.`
9. `Promote this DHA Phase 6 house on WhatsApp, Facebook and Instagram. Keep copy short for serious buyers.`
10. `Confirm.`
11. 打开一个 generated landing URL，在买家端提交 Ahmed Raza 的 inquiry。
12. `Show new leads from WhatsApp.`
13. `Reply to Ahmed on WhatsApp. Tell him owner is slightly negotiable and ask if Sunday 4pm works for family visit.`
14. `Make it shorter, Roman Urdu tone.`
15. `Mark Ahmed as contacted.`
16. `Confirm.`
17. `Ahmed is a hot lead now.`
18. `Confirm.`
19. `Schedule viewing with Ahmed for this DHA Phase 6 house tomorrow at 4pm. Remind me one hour before.`
20. `Confirm schedule.`
21. `What do I have tomorrow?`
22. `Add new buyer lead: Sara Malik, WhatsApp 0300 4445556, looking for 10 marla house in DHA Phase 5 or 6, budget 4.2 crore, wants possession soon.`
23. `Save this lead.`
24. `Update Sara phone to 0300 9998887.`
25. `Attach Sara to this DHA Phase 6 listing.`
26. `Add follow up reminder for Sara tomorrow 11am to ask if she wants Phase 5 option.`
27. `Which leads should I follow up today?`
28. `Show attribution for this listing.`

## 6. 真实经纪人口吻补充用例

这些话术用于测试 English + Roman Urdu 混合输入。

| 场景 | 输入 | 预期 |
| --- | --- | --- |
| 房源 | `Bhai new file add karo: 10 marla brand new house DHA Phase 5 Lahore, 4 beds, demand 4.25 crore, owner abroad hai.` | 创建房源草稿 |
| 租赁 | `Create rental listing: 2 bed apartment Gulberg Lahore, rent 1.8 lakh per month, furnished, good for small family.` | listing_type 为 rent，价格约 180000 |
| 线索 | `New client Bilal, number 0321 5556677, wants Bahria Town 5 marla around 1.6 crore, urgent hai.` | 创建 lead，urgency 可为 high |
| 回复 | `Bilal ko WhatsApp reply draft karo, bolo kal 2 options dikha sakta hun.` | draft_lead_reply |
| 日程 | `Kal 5 baje Bilal ke sath Bahria viewing rakh do.` | create_schedule_event |
| 状态 | `Sara qualified buyer hai, budget confirm ho gaya.` | update_lead_status 为 qualified |

## 7. 负向和边界测试

| 用例 | 输入 | 预期 |
| --- | --- | --- |
| 无上下文推广 | `Promote it on WhatsApp.` | 没有当前 listing 时要求选择房源 |
| 无上下文回复 | `Reply to him.` | 没有当前 lead 时要求说明要回复谁 |
| 找不到线索 | `Mark Bilal as contacted.` 如果 Bilal 不存在 | 提示找不到，不更新其他 lead |
| 多候选线索 | 有多个 Ahmed 时输入 `Reply to Ahmed.` | 展示候选或要求澄清 |
| 多候选房源 | 有多个 DHA Phase 6 房源时输入 `Change DHA Phase 6 price to 8 crore.` | 要求选择具体 listing |
| 渠道词误判 | `Reply to Ahmed on WhatsApp.` | 必须是回复线索，不是推广 |
| 推广 vs 文案 | `Write Facebook copy for this listing.` | 只生成文案/内容，不应直接生成 campaign links，除非用户说 promote/campaign |
| 不支持 direct | `Promote on direct link.` | 不应创建 direct channel；当前支持 whatsapp/facebook/instagram/portal |
| 缺线索联系方式 | `Add a lead named interested buyer.` | 应提示缺少电话/email 等有效联系方式或保存前明确预览缺字段 |
| 缺日程信息 | `Schedule follow up.` | 应要求补充对象和时间 |
| 外部动作 | `Send this WhatsApp now.` | 需要确认；当前应是 deep link/草稿，不是自动发送 |
| 数据隔离 | 用另一个 broker 登录查看 `/listings`、`/leads`、`/schedule` | 看不到 Ali Raza 账号的数据 |

## 8. 页面级检查清单

| 页面 | 检查点 |
| --- | --- |
| `/` Agent Workspace | 最近房源和线索能作为 context；对话消息持久化；附件 chips 可移除；确认卡片清楚 |
| `/listings` | 新房源、更新后价格、状态、媒体预览正确；只显示当前 broker 数据 |
| `/leads` | campaign lead 和 manual lead 都显示；status/urgency/source channel/listing 关联正确 |
| `/schedule` | viewing 和 follow_up 可见；状态过滤/移动端指标不拥挤；缺 migration 时提示清楚 |
| `/p/[code]` | channel label 正确；表单字段可提交；提交成功文案清楚；移动端不遮挡 |

## 9. 缺陷记录模板

```text
Bug ID:
测试账号:
页面/流程:
前置数据:
用户输入:
实际结果:
预期结果:
是否确认过:
截图/录屏:
严重程度: P0/P1/P2/P3
是否阻塞主流程: 是/否
备注:
```

## 10. 内测通过标准

- A 到 I 主流程完整跑通一次。
- 房源创建、房源修改、推广生成、手动线索创建、线索状态更新、线索详情更新、线索绑定房源、创建日程这些写入动作都有预览/确认。
- 公开推广链接至少产生一次点击记录和一条可归因线索。
- Agent 能正确区分 `Reply to Ahmed on WhatsApp` 和 `Promote this listing on WhatsApp`。
- “hot lead”最终落到 `qualified + high urgency`，而不是写入不存在的 hot 状态。
- 无上下文、找不到、多候选时不会静默操作最新记录。
- 桌面端和移动端各完成一次视觉检查。
- 没有 P0/P1 后，再邀请真实经纪人试用。
