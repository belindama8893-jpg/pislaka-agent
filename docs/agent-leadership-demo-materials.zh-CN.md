# Pislaka Agent 领导演示资料包

## 演示主线

建议使用一个演示账号完成两个连续业务场景：

- 场景一：客户 WhatsApp 聊天 -> Agent 生成回复 -> 保存客户 -> 设置下周一提醒。
- 场景二：已有房源链接/图片/文字 -> Agent 生成推广文案和 tracking links -> 买家通过链接报名 -> Agent 回复客户 -> 设置跟进提醒。

演示账号建议：

- Name: Ali Raza
- Agency: Raza Associates
- City: Lahore
- Phone: 0300 1234567
- Language: English + Roman Urdu / Urdu

## 场景一：客户聊天到客户管理

独立素材文件：

- English WhatsApp export: `docs/demo-assets/whatsapp-chat-omar-english.txt`
- Roman Urdu WhatsApp export: `docs/demo-assets/whatsapp-chat-omar-roman-urdu.txt`
- Roman Urdu chat screenshot PNG: `docs/demo-assets/whatsapp-chat-omar-roman-urdu-screenshot.png`
- Roman Urdu chat screenshot SVG source: `docs/demo-assets/whatsapp-chat-omar-roman-urdu-screenshot.svg`
- Voice prompts: `docs/demo-assets/demo-voice-prompts.zh-CN.md`

### 1A. WhatsApp 聊天记录 - English 版

复制下面整段到 Agent：

```text
WhatsApp chat with Ahmed Raza

Ahmed: Assalam o Alaikum Ali bhai, I saw your post about DHA Phase 5 houses.
Broker: Wa Alaikum Salam Ahmed bhai, yes available. What size are you looking for?
Ahmed: I need a 10 marla house for my family.
Ahmed: Budget is around 4.2 to 4.5 crore.
Ahmed: Prefer possession soon, not a file. It should be ready or near ready.
Broker: Okay, DHA Phase 5 or Phase 6 both can work?
Ahmed: Phase 5 preferred, but Phase 6 is okay if the location is good.
Ahmed: Can we visit this weekend? Sunday after 4pm is better.
Ahmed: Please send details and tell me if owner is negotiable.
```

语音指令：

```text
帮我分析这个客户想要什么，然后生成一个 WhatsApp 回复。回复要跟着他的语言，用 English，语气自然、简短一点。
```

预期展示：

- Agent 总结客户需求：10 marla、DHA Phase 5 preferred、budget 4.2-4.5 crore、possession soon、Sunday after 4pm viewing、询问 negotiable。
- Agent 生成英文 WhatsApp 回复。
- Agent 建议保存为 lead。

第二段语音指令：

```text
把 Ahmed 存成客户，并提醒我下周一上午 10 点回复他。
```

预期展示：

- Lead 保存预览。
- Follow-up reminder 预览。
- 确认后 Ahmed 进入 Leads，提醒进入 Schedule。

### 1B. WhatsApp 聊天记录 - Urdu / Roman Urdu 版

主推使用 Roman Urdu，语音识别和经纪人真实使用都更稳。需要视觉上展示 Urdu script 时，可以用下面 Urdu script 版作为备选。

#### Roman Urdu 版

复制下面整段到 Agent：

```text
WhatsApp chat with Ahmed Raza

Ahmed: Assalam o Alaikum Ali bhai, DHA Phase 5 mein 10 marla house available hai?
Broker: Wa Alaikum Salam Ahmed bhai, ji available options hain. Aap ka budget kya hai?
Ahmed: Budget 4.2 se 4.5 crore tak hai.
Ahmed: Family ke liye chahiye, possession jaldi mil jaye to best.
Broker: Phase 5 hi preferred hai ya Phase 6 bhi theek hai?
Ahmed: Phase 5 preferred hai, lekin Phase 6 good location ho to consider kar sakta hun.
Ahmed: Sunday 4 baje ke baad visit possible hai?
Ahmed: Owner negotiable hai to details bhej dein.
```

语音指令：

```text
Is customer ko analyze karo aur Roman Urdu mein short WhatsApp reply bana do. Natural broker tone honi chahiye.
```

预期回复方向：

```text
Ahmed bhai, ji 10 marla DHA Phase 5/6 ke kuch suitable options hain. Aap ka budget aur possession requirement clear hai. Main owner se negotiation confirm karke details bhej deta hun. Sunday 4 baje ke baad visit arrange kar lete hain.
```

第二段语音指令：

```text
Ahmed ko lead ke taur par save karo, aur next Monday 10 AM par follow up reminder laga do.
```

#### Urdu Script 版

复制下面整段到 Agent：

```text
WhatsApp chat with Ahmed Raza

Ahmed: السلام علیکم علی بھائی، کیا ڈی ایچ اے فیز 5 میں 10 مرلہ گھر available ہے؟
Broker: وعلیکم السلام احمد بھائی، جی options available ہیں۔ آپ کا budget کیا ہے؟
Ahmed: Budget تقریباً 4.2 سے 4.5 crore تک ہے۔
Ahmed: Family کے لیے چاہیے، possession جلدی مل جائے تو بہتر ہے۔
Broker: صرف Phase 5 چاہیے یا Phase 6 بھی دیکھ سکتے ہیں؟
Ahmed: Phase 5 preferred ہے، لیکن Phase 6 اچھی location ہو تو consider کر سکتا ہوں۔
Ahmed: Sunday 4 بجے کے بعد visit possible ہے؟
Ahmed: Owner negotiable ہو تو details بھیج دیں۔
```

语音指令：

```text
这个客户用乌尔多语在聊。帮我总结需求，并用同样的语言生成一个简短 WhatsApp 回复。
```

## 场景二：房源推广到报名跟进

### 2A. 房源资料 - 文字输入版

复制下面内容，或用语音口述：

```text
I want to promote this property:
10 marla house in DHA Phase 5 Lahore.
4 bedrooms, 5 bathrooms.
Demand 4.35 crore.
Near park, renovated kitchen, solid wood doors, good natural light.
Ready possession, good for family buyer.
Please create WhatsApp and Facebook promotion copy with tracking links and a lead page.
```

语音版推荐话术：

```text
我要推广一套 DHA Phase 5 Lahore 的 10 marla house，4 bedrooms，5 bathrooms，demand 4.35 crore，near park，renovated kitchen，ready possession，适合 family buyer。帮我生成 WhatsApp 和 Facebook 推广文案，并生成 tracking links 和报名链接。
```

预期展示：

- Agent 识别房源信息。
- 生成推广资产预览。
- 确认后生成 WhatsApp/Facebook 文案和专属报名链接。

### 2B. 房源资料 - 链接识别版

如果要展示“链接也可以识别”，建议现场使用一个稳定、内容清晰的房源详情页链接。演示话术：

```text
Use this property link and create WhatsApp and Facebook promotion copy with tracking links:
[paste property link here]
```

如果外部网页抓取不稳定，使用下面“模拟链接 + 文字补充”的兜底话术：

```text
Use this property link as the source and prepare promotion:
https://example.com/listings/dha-phase-5-10-marla-family-house

If the link is not readable, use these details:
10 marla house in DHA Phase 5 Lahore, 4 beds, 5 baths, demand 4.35 crore, near park, renovated kitchen, ready possession, suitable for family buyer.
Create WhatsApp and Facebook promotion copy with tracking links.
```

### 2C. 房源资料 - 图片识别版

图片建议准备 3 张，最好是真实或接近真实的房源图：

- 外立面/门面图。
- 客厅或 drawing room。
- 厨房或卧室。

上传图片后语音说：

```text
根据这些图片帮我识别房源特点，生成一个推广文案。房源是 DHA Phase 5 Lahore 的 10 marla house，demand 4.35 crore，适合 family buyer。生成 WhatsApp 和 Facebook 文案，还有 tracking links。
```

预期展示：

- Agent 从图片中提到外观、室内、厨房、光线等可见特点。
- Agent 结合语音补充的 area/price/size 生成推广内容。

## 买家报名资料

打开生成的 lead page，用买家身份提交：

```text
Name: Sara Malik
Phone / WhatsApp: 0300 4445556
Email: sara.malik@example.com
Budget: PKR 4.2 Crore
Viewing: Tomorrow after 5pm
Need: Family home, ready possession preferred
Question: Is owner negotiable? Can we visit tomorrow evening?
Preferred contact: WhatsApp
```

回到 Agent 后输入或语音说：

```text
Show new leads from this promotion.
```

预期展示：

- Sara 出现在 lead 列表。
- 来源关联到刚才的房源和推广渠道。

### 根据报名回复客户

语音指令：

```text
给 Sara 生成 WhatsApp 回复，告诉她 owner slightly negotiable，明天下午 5 点可以看房，问她是否方便。回复要简短自然。
```

预期回复方向：

```text
Hi Sara, owner is slightly negotiable for serious buyers. Tomorrow 5pm viewing can be arranged. Please confirm if this time works for you and I will share the exact location.
```

继续语音：

```text
保存这次跟进，并提醒我明天下午 4 点半联系 Sara 确认看房。
```

预期展示：

- 保存 follow-up 预览。
- 创建 reminder / viewing 预览。
- 确认后写入。

## 现场演示顺序

1. 粘贴 English WhatsApp 聊天。
2. 语音：分析客户并生成 English 回复。
3. 语音：保存 Ahmed，设置下周一 10 点提醒。
4. 粘贴 Roman Urdu 或 Urdu Script 聊天。
5. 语音：用同样语言生成回复，展示语言跟随能力。
6. 语音口述房源，或上传图片/粘贴链接。
7. Agent 生成推广文案和 tracking links。
8. 打开报名链接，提交 Sara。
9. 回到 Agent：展示新 lead。
10. 语音：生成 Sara 回复。
11. 语音：保存跟进并设置提醒。

## 现场注意事项

- 主演示建议用文本聊天记录，截图/图片识别作为加分展示。
- Urdu 主演示建议用 Roman Urdu，更稳定；Urdu script 适合展示语言能力但转写和模型输出可能更不可控。
- 房源链接识别可能受外部网页结构和网络影响，必须准备文字兜底。
- 所有写入动作都要停在确认卡片，让领导看到 Agent 有业务安全边界。
- 语音输入建议提前练习三段固定话术：客户分析、保存提醒、房源推广。
