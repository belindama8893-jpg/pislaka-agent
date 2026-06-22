# Agent 卡片系统接入规则

## 目标

所有 Agent 结构化回复必须走同一条展示与数据拼接管线，避免每次新增卡片时重新手写外壳、字段布局、按钮区和状态区。

## 强制规则

1. 顶层卡片只能使用 `AgentOutputCard` 或 `components/agent/cards/*` 中封装好的业务卡片。
2. 新卡片不得在 `AgentWorkspace.tsx` 中直接拼完整 JSX。`AgentWorkspace.tsx` 只负责选择卡片、维护当前交互状态、传入标准化数据。
3. 候选列表必须使用 `AgentCandidateList`，并继承 `listing-update-list` / `listing-update-row` 的行间距、分隔线和文字层级；字段展示使用 `AgentInfoGrid` 或 `AgentFieldList`；对象摘要使用 `AgentObjectSummary` 或业务卡片内的 object header。
4. 操作按钮必须放在卡片 actions/action primitive 中，语义按 `primary`、`secondary`、`external`、`danger`、`complete` 分层。
5. 保存中、已保存、失败、需要登录、已复制等反馈必须进入统一 status 区，不在正文里临时插入样式不同的提示。
6. 业务类型只能通过 `tone` 表达：`lead`、`listing`、`schedule`、`promotion`、`default`。不要为单张卡新增外壳颜色、阴影、圆角。

## 数据拼接规则

每张业务卡片先把原始 payload 转成标准 view model，再渲染：

```ts
type AgentCardViewModel = {
  title: ReactNode;
  subtitle?: ReactNode;
  tone: AgentCardTone;
  intent: AgentCardIntent;
  object?: {
    title: ReactNode;
    meta?: ReactNode;
    description?: ReactNode;
    badge?: ReactNode;
  };
  facts?: AgentFieldItem[];
  changes?: AgentFieldItem[];
  candidates?: AgentCandidateCardItem[];
  actions?: AgentCardAction[];
  status?: AgentCardStatus;
};
```

拼接顺序固定为：

1. shell metadata：`tone`、`intent`、icon、domain。
2. title/summary：一句话说明这张卡在做什么。
3. object：这次影响的 lead/listing/schedule/promotion 对象。
4. hero facts：2 到 4 个最重要字段。
5. details/changes/candidates/generated content：按业务组件渲染。
6. actions：主操作优先，外部动作明确标识。
7. status：只展示当前动作反馈。

## 新卡片接入流程

1. 在 `components/agent/cards/` 新建或扩展业务卡片组件。
2. 在组件内只使用 `AgentOutputCard` 和 `AgentCardPrimitives`。
3. 在 `AgentWorkspace.tsx` 中把原始 preview/action 转成 view model。
4. 不新增 `listing-choice-card`、`chat-*card`、裸 `article` 候选项等局部视觉结构。
5. 更新 dev showcase 时复用真实业务组件，避免展示稿和生产组件分叉。

## Selection row 规则

选择类卡片的候选项不是新的视觉族，必须遵守已确认的 listing update row 展示标准：

1. 容器使用 `listing-update-list`。
2. 每个候选项使用 `listing-update-row agent-card-candidate`。
3. 标题、描述、meta 只用标准文本层级，不新增头像、pills、卡片内嵌卡片。
4. 操作按钮使用标准 `outline-button small`；选中/完成后才切换到 `primary-button small`。
5. 多个候选项之间只用标准 row border 分隔，不额外加阴影、背景块或独立圆角。
