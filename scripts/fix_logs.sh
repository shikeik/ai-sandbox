#!/bin/bash
cd /storage/emulated/0/AppProjects/html/ai-sandbox

# TrainingEntry
sed -i 's/console\.log("init()/console.log("TRAINING-ENTRY", "init()/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("生成数据/console.log("TRAINING-ENTRY", "生成数据/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("训练/console.log("TRAINING-ENTRY", "训练/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("应用快照/console.log("TRAINING-ENTRY", "应用快照/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("画布/console.log("TRAINING-ENTRY", "画布/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("点击/console.log("TRAINING-ENTRY", "点击/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("绘制结果/console.log("TRAINING-ENTRY", "绘制结果/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("paintCell/console.log("TRAINING-ENTRY", "paintCell/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("编辑器未初始化/console.log("TRAINING-ENTRY", "编辑器未初始化/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("配置/console.log("TRAINING-ENTRY", "配置/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("课程/console.log("TRAINING-ENTRY", "课程/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("学习模式/console.log("TRAINING-ENTRY", "学习模式/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("重置网络/console.log("TRAINING-ENTRY", "重置网络/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("播放动画/console.log("TRAINING-ENTRY", "播放动画/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("动画完成/console.log("TRAINING-ENTRY", "动画完成/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("编辑器画布/console.log("TRAINING-ENTRY", "编辑器画布/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("从 GridWorld/console.log("TRAINING-ENTRY", "从 GridWorld/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("同步地形/console.log("TRAINING-ENTRY", "同步地形/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("随机地形/console.log("TRAINING-ENTRY", "随机地形/g' src/terrain-lab/TrainingEntry.ts
sed -i 's/console\.log("重置视图/console.log("TRAINING-ENTRY", "重置视图/g' src/terrain-lab/TrainingEntry.ts

