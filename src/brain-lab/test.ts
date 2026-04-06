// 简单测试
import { World } from "./World.js"
import { Brain } from "./Brain.js"

console.log("=== Brain Lab 自检 ===")

const world = new World(10, 5)
const brain = new Brain(10, 5)

console.log("\n1. 初始状态:")
let state = world.getState()
console.log("  英雄:", state.hero)
console.log("  敌人:", state.enemies)
console.log("  y=0行:", state.grid[0].map(c => c === 2 ? "P" : c === 0 ? "." : c).join(""))
console.log("  y=1行:", state.grid[1].map(c => c === 2 ? "P" : c === 0 ? "." : c).join(""))
console.log("  y=2行:", state.grid[2].map(c => c === 2 ? "P" : c === 6 ? "B" : c === 0 ? "." : c).join(""))

console.log("\n2. 大脑思考:")
const decision = brain.think(state)
console.log("  选择:", decision.selectedAction)
console.log("  理由:", decision.reasoning)
console.log("  想象:", decision.imaginations.map(i => `${i.action}=>(${i.predictedState.hero.x},${i.predictedState.hero.y})`).join(", "))

console.log("\n3. 执行动作:")
const result = world.executeAction(decision.selectedAction)
state = world.getState()
console.log("  新位置:", state.hero)
console.log("  敌人:", state.enemies)
console.log("  到达终点:", result)

console.log("\n=== 自检完成 ===")
