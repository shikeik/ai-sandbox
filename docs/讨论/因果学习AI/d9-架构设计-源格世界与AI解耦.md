# d9 架构设计：源格世界（Meta-Gridworld）与 AI 解耦

> 时间：2026-04-13  
> 讨论主题：将世界逻辑与 AI 彻底分离，建立干净的试验场

---

## 1. 核心原则：环境-智能体分离（Environment-Agent Separation）

当前 `causal-ai` 的一个隐性技术债务是：AI 逻辑与世界逻辑高度纠缠。为了让 d9 的元认知 AI 有一个干净的试验场，必须将二者彻底解耦。

**新架构的八字方针**：
> **源格世界不自知 AI 存在，AI 只能通过标准协议与世界交互。**

---

## 2. 源格世界（Meta-Gridworld）的定义

`meta-gridworld` 是一个纯粹的、与 AI 无关的网格世界模拟器。它只负责：

1. **维护世界状态**：地图、物体、agent 的位置和属性
2. **执行原子指令**：上/下/左/右/互/看/等
3. **返回观测结果**：agent 的局部视野、执行结果、奖励
4. **不提供任何智能**：不做规划、不学习、不推理

**源格世界不知道谁在控制它。** 它可以被人类通过 CLI 直接操作，也可以被旧 AI 操作，也可以被新 AI 操作。

---

## 3. AI 的位置：世界之外

AI 是一个**外部进程/模块**，它：
- 通过 CLI 或 API 向源格世界发送**原子指令**
- 接收源格世界返回的**观测数据**
- 基于观测进行学习、规划、决策
- **绝对不能**直接访问源格世界的内部状态（如 `world.agentState.pos`）

这意味着 AI 与世界的边界非常清晰：
```
┌─────────────────┐     原子指令      ┌─────────────────┐
│                 │ ───────────────> │                 │
│   AI（外部）     │                  │  Meta-Gridworld │
│                 │ <─────────────── │   （源格世界）   │
│                 │     观测结果      │                 │
└─────────────────┘                  └─────────────────┘
```

---

## 4. 旧 AI 与新 AI 的共存

**旧 AI（d1-d8）**：
- 保留为一个独立的分支/模块
- 通过同样的协议与源格世界交互
- 作为基线（baseline）存在

**新 AI（d9+）**：
- 基于元认知构建的自主学习体
- 同样通过协议与源格世界交互
- 可以与旧 AI 在相同地图、相同任务上进行对比测试

这种设计让"试验"变得干净：如果新 AI 行为异常，我们可以 100% 确定问题出在 AI 内部，而不是世界逻辑被污染了。

---

## 5. Web 的定位：纯展示器

Web 端不再包含任何 AI 逻辑。它的角色是：
- 连接到 `meta-gridworld`
- 可视化世界状态（渲染地图、agent、动画）
- 可选：作为"人类遥控器"直接发送原子指令
- 可选：作为"AI 直播画面"展示某个 AI 的运行过程

**Web 是观众席，不是竞技场。**

---

## 6. CLI 原子指令协议（草案）

源格世界暴露的 CLI 接口应该极其精简：

```
# 移动
上 / 下 / 左 / 右

# 交互
互

# 观察
看

# 等待/空动作
等

# 元指令
重置        # 重置当前地图
加载 <id>   # 加载指定地图
状态        # 获取完整世界状态（调试用，生产环境可限制）
```

**AI 能获取的观测信息**：
```typescript
interface Observation {
  agent: {
    pos: { x: number, y: number }
    facing: "上" | "下" | "左" | "右"
    inventory: string[]
  }
  localView: Tile[][]  // 相对坐标视野
  lastActionResult: {
    success: boolean
    message: string
    reward: number
  }
  stepCount: number
}
```

**关键约束**：AI 只能看到 `localView`，不能直接看到整个世界地图（除非通过"状态"指令作弊，但那是调试模式）。

---

## 7. 文件结构重构设想

```
src/causal-ai/
├── meta-gridworld/          # 源格世界：纯环境，无 AI
│   ├── index.ts             # 导出 MetaGridworld 类
│   ├── types.ts             # Tile, MapData, Action, Observation 等
│   ├── world-engine.ts      # 世界状态机（原 world.ts 的提纯版）
│   ├── action-handler.ts    # 原子指令执行器
│   ├── map-loader.ts        # 地图加载器
│   └── cli-server.ts        # CLI 入口/服务端
│
├── agents/                  # AI 智能体集合
│   ├── legacy/              # 旧 AI（d1-d8）
│   │   ├── index.ts
│   │   ├── planner.ts
│   │   ├── learner.ts
│   │   └── ...
│   └── d9/                  # 新 AI（元认知 AI）
│       ├── index.ts
│       ├── cognitive-loop.ts
│       ├── world-model.ts
│       ├── diff-engine.ts
│       ├── goal-parser.ts
│       └── means-end-planner.ts
│
├── shared/                  # 跨模块共享
│   ├── types.ts
│   └── utils.ts
│
└── cli/
    ├── main.ts              # CLI 主入口
    └── adapters/            # AI 与源格世界的适配器
        ├── legacy-agent-adapter.ts
        └── d9-agent-adapter.ts
```

---

## 8. 迁移策略

**不是重写，而是提纯：**
1. 从现有 `world.ts` 中提取"纯世界逻辑"，放入 `meta-gridworld/world-engine.ts`
2. 从现有 `command-executor.ts` 中提取"原子指令执行"，放入 `meta-gridworld/action-handler.ts`
3. 旧 AI 整体迁移到 `agents/legacy/`
4. 新 AI 在 `agents/d9/` 中从头开发，通过 adapter 与 `meta-gridworld` 交互
5. 保持测试覆盖：每迁移一个模块，对应测试一并迁移

---

## 9. 待确认问题

1. **协议形式**：CLI stdin/stdout 是否足够？还是需要用 socket/IPC 让 AI 与 world 通信？
2. **观测范围**：`localView` 的尺寸固定为 5×5 还是可配置？
3. **状态指令**：`状态` 指令是否对 AI 开放？如果开放，AI 就拥有了"上帝视角"，这与"局部观察"的元认知目标是否矛盾？
4. **迁移顺序**：是先完成 `meta-gridworld` 的提取，再开发 d9 AI，还是边提取边开发？
