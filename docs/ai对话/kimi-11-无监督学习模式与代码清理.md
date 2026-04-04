# AI 交接文档：无监督学习模式与代码清理

> 编写时间：2026-04-04  
> 当前分支：`fix/code-cleanup`  
> 最后提交：`6e3b734`（指标布局改为竖排，探索率排第五位）

---

## 一、这一段我们做了什么

### 核心目标
1. 添加**无监督学习模式**（ε-贪心探索 + 奖励反馈）
2. 解决无监督学习 87% 合法率瓶颈，提升到 95%+
3. 代码重构：消除重复逻辑、硬编码，统一评估流程

### 已落地的功能清单

1. **学习模式切换**
   - 右栏新增「监督/无监督」切换按钮
   - `state.learningMode` 控制当前模式
   - 训练按钮根据模式调用不同训练函数

2. **无监督学习核心逻辑**
   - ε-贪心策略：以 ε 概率随机探索，否则选择概率最大的动作
   - 动态探索率：根据合法率历史窗口自动调整 ε（进步→降低，停滞→提高）
   - 过滤式监督学习：选中最优动作→监督学习更新；选中次优→权重0.3引导；选中非法→惩罚
   - 合法率饱和后（≥95%）加速降低探索率

3. **统一评估指标**
   - 所有训练模式共用 `evaluateDataset()` 函数
   - 统一显示：交叉熵损失 / 平均奖励 / 准确率 / 合法率 / 探索率ε
   - 布局改为两列网格（竖排：数据集/步数/准确率/合法率 | 探索率/损失/奖励）

4. **代码清理**
   - 删除 10 个过时测试文件，保留 3 个核心测试
   - 提取 `TRAIN_CONFIG`、`DATASET_SIZE`、`EVAL_SAMPLE_SIZE` 常量
   - 统一 `updateMetrics()` 函数，消除 `updateMetricsUnsupervised` 重复
   - 修复多处硬编码：`HIDDEN_DIM` 替代 `16`，`EMBED_DIM` 替代 `2`
   - 重置网络保留学习模式（不强制重置为监督模式）

5. **网络架构优化**
   - `hidden_dim`: 16 → 32
   - `learning_rate`: 0.05 → 0.1（匹配参数量翻倍）
   - 最终准确率：98.4% → 99.8%（训练步数相同）

---

## 二、关键文件变更

| 文件 | 说明 |
|---|---|
| `src/terrain-lab/constants.ts` | 新增 `TRAIN_CONFIG`、`DATASET_SIZE`、`EVAL_SAMPLE_SIZE`；`HIDDEN_DIM` 32；`LR` 0.1 |
| `src/terrain-lab/main.ts` | 新增 `trainUnsupervised()`、`evaluateDataset()`；统一 `updateMetrics()`；课程学习显示探索率 |
| `src/terrain-lab/unsupervised.ts` | 新增过滤式梯度累积、动态探索率调整逻辑 |
| `src/terrain-lab/supervised.ts` | 修复硬编码 `EMBED_DIM` |
| `src/terrain-lab/state.ts` | `resetState()` 不再重置 `learningMode` |
| `pages/terrain-lab.html` | 新增模式切换UI、探索率指标显示、两列布局 |

---

## 三、踩过的坑（非常重要）

### 坑 1：无监督学习合法率卡在 87%
**根因**：
- 训练时合法率统计的是「探索动作」（带随机性），而非「预测动作」
- 评估时显示的是「预测动作」合法率
- 两者不一致导致指标虚高，实际预测能力差

**修复**：
- 统一使用预测动作计算合法率
- 训练时的 ε-贪心仅用于学习和探索，不用于统计

### 坑 2：探索率饱和后不下降
**根因**：合法率达到 100% 后无法继续「进步」，探索率不再调整

**修复**：合法率 ≥95% 后进入「阶段2」，持续快速降低探索率直到最小值

### 坑 3：次优合法动作成为噪声
**根因**：早期版本对「次优但合法」动作也进行正向强化，导致网络学不到最优特征

**修复**：过滤式学习——只从「最优动作」学习，次优动作仅轻微引导，非法动作惩罚

### 坑 4：硬编码维度导致 hidden=32 时崩溃
**根因**：测试文件中多处 `Array(16)`、`Array(2)` 硬编码

**修复**：全部改为 `HIDDEN_DIM`、`EMBED_DIM` 常量

### 坑 5：重置网络强制变回监督模式
**根因**：`resetState()` 中 `learningMode = "supervised"`

**修复**：删除该赋值，保留用户选择

---

## 四、当前架构要点

### 训练流程（统一）
```
for each step (200 steps):
    batch sampling
    if supervised: accumulateSupervisedGrad(target=sample.y)
    if unsupervised: 
        action = epsilon_greedy_select()
        if action == optimal: accumulateSupervisedGrad(target=optimal)
        else if invalid: accumulateGradients(negative_reward)
        else: accumulateSupervisedGrad(target=optimal, weight=0.3)
    updateNetwork()
    if step % 20 == 0:
        evaluateDataset() → acc / validRate / loss
        adjustEpsilon(validRate)
        updateMetrics()
```

### 评估指标（统一）
```
evaluateDataset(dataset, net, limit=0):
    for sample in dataset[:limit] or dataset:
        forward → predicted
        accuracy += (predicted == sample.y)
        validRate += isActionValid(predicted)
        loss += crossEntropy(predicted, sample.y)
    return { accuracy, validRate, loss }
```

---

## 五、还没做的事（下一步）

### 高优先级
1. **无监督学习收敛可视化**
   - 当前只有数字指标，缺乏 embedding/概率演变可视化
   - 可参考监督学习的「执念曲线」设计

2. **探索率动态曲线**
   - 在页面上绘制 ε 随训练步数的变化曲线
   - 帮助用户直观理解探索策略

### 中优先级
3. **课程学习支持无监督模式**
   - 当前课程学习固定使用监督学习
   - 可让用户选择课程学习的训练模式

4. **无监督学习参数调优UI**
   - 暴露 `rewardOptimal`、`rewardValid`、`epsilonDecayStep` 等参数
   - 让用户实时调整观察影响

### 低优先级
5. **两种模式对比 Tab**
   - 左右分屏：左侧监督学习，右侧无监督学习
   - 同时训练，对比收敛速度和最终效果

---

## 六、给下一个 AI 的建议

1. **修改 `getLabel()` 动作优先级前**，确保 `ACTIONS` 数组顺序一致，否则标签会错位
2. **调整探索率逻辑时**，注意区分「合法率驱动」和「准确率驱动」两个阶段
3. **新增评估指标时**，直接加到 `evaluateDataset()`，所有模式自动生效
4. **修改网络架构**（如 hidden_dim）时，同步调整学习率（建议保持比例：LR × HIDDEN_DIM ≈ 3.2）
5. **运行验证**：`npm run dev` → 测试「生成数据 → 切换无监督模式 → 训练200步」，观察探索率是否下降
6. **清理测试文件时**，保留 `filtered-supervised-test.ts` 和 `convergence-test.ts`，这是核心验证
