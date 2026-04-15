import type { GameState, Scene, Action, ActionResult } from "./types.ts"

// ========== Roguelike 生存 DEMO：荒野七日 ==========

const TARGET_DAY = 7

interface EventDef {
	id: string
	title: string
	description: string
	actions: Action[]
}

const events = new Map<string, EventDef>([
	["find_food", {
		id: "find_food",
		title: "觅食",
		description: "胃袋空空作响。灌木丛里有颜色鲜艳的浆果，泥地上的足迹像是野兔，但你已经饿得眼冒金星。",
		actions: [
			{ id: "eat_berries", label: "采摘浆果充饥" },
			{ id: "set_trap", label: "花费体力设置陷阱" },
			{ id: "skip_food", label: "省点力气，今天不找了" },
		],
	}],
	["strange_sound", {
		id: "strange_sound",
		title: "夜中的呜咽",
		description: "林子里传来一阵低沉的呜咽声，树枝被踩断的脆响越来越近。你的帐篷单薄得像层纸。",
		actions: [
			{ id: "check_sound", label: "握紧木棍出去查看" },
			{ id: "hide_tent", label: "躲进帐篷保持安静" },
			{ id: "make_fire", label: "生起篝火威慑野兽" },
		],
	}],
	["beast_attack", {
		id: "beast_attack",
		title: "野兽夜袭",
		description: "一头体型硕大的黑熊闯入了营地！它人立而起，发出震耳的咆哮。逃跑已经来不及了。",
		actions: [
			{ id: "fight_bear", label: "举起木棍拼命反抗" },
			{ id: "climb_tree", label: "往最近的大树爬" },
			{ id: "play_dead", label: "躺倒在地装死" },
		],
	}],
	["abandoned_hut", {
		id: "abandoned_hut",
		title: "废弃小屋",
		description: "巡逻时你发现了一座摇摇欲坠的猎人小屋，门半掩着，里面漆黑一片。",
		actions: [
			{ id: "search_hut", label: "小心地进去搜索" },
			{ id: "leave_hut", label: "看起来太危险，离开" },
		],
	}],
	["heavy_rain", {
		id: "heavy_rain",
		title: "暴雨突袭",
		description: "天空骤然阴沉，豆大的雨点砸了下来。你的帐篷开始渗水，体温正在快速流失。",
		actions: [
			{ id: "fix_tent", label: "冒雨加固帐篷" },
			{ id: "curl_up", label: "蜷缩在睡袋里熬过去" },
			{ id: "collect_water", label: "淋雨收集饮用水" },
		],
	}],
	["helicopter", {
		id: "helicopter",
		title: "搜救直升机",
		description: "正午时分，你听到了螺旋桨的轰鸣声！一架搜救直升机正在远处的山脊上空盘旋，但它似乎并没有发现你。",
		actions: [
			{ id: "signal_fire", label: "立刻生起狼烟求救" },
			{ id: "shout_help", label: "大声呼喊挥手" },
			{ id: "chase_heli", label: "朝山脊狂奔追过去" },
		],
	}],
	["dead_body", {
		id: "dead_body",
		title: "遇难者",
		description: "树丛后躺着一具穿着登山服的尸体，已经开始腐烂。他的背包就在手边，但苍蝇环绕，气味令人作呕。",
		actions: [
			{ id: "loot_body", label: "搜刮背包里的物资" },
			{ id: "bury_body", label: "花力气掩埋尸体" },
			{ id: "walk_away", label: "默默离开" },
		],
	}],
])

function getStat(state: GameState, key: string, defaultValue = 0): number {
	return state.player.stats[key] ?? defaultValue
}

function setStat(state: GameState, key: string, value: number): Record<string, number> {
	return { ...state.player.stats, [key]: Math.max(0, Math.min(100, value)) }
}

function pickRandomEventId(): string {
	const ids = Array.from(events.keys())
	return ids[Math.floor(Math.random() * ids.length)]
}

function hasFlag(state: GameState, flag: string): boolean {
	return state.worldFlags[flag] === true
}

function nightSettlement(state: GameState): { text: string; stateChange: Partial<GameState> } {
	const stats = { ...state.player.stats }
	stats.hunger = Math.max(0, (stats.hunger ?? 50) - 25)
	stats.stamina = Math.max(0, (stats.stamina ?? 100) - 10)
	stats.mental = Math.max(0, (stats.mental ?? 100) - 10)

	let healthLoss = 0
	if (stats.hunger <= 0) healthLoss += 15
	if (stats.stamina <= 0) healthLoss += 15
	if (stats.mental <= 0) healthLoss += 15

	// 状态类 debuff
	if (hasFlag(state, "wound")) healthLoss += 10
	if (hasFlag(state, "sick")) healthLoss += 15

	const newHealth = state.player.health - healthLoss
	const nextDay = state.player.day + 1

	let text = "夜幕降临。"
	if (healthLoss > 0) {
		const reasons: string[] = []
		if (stats.hunger <= 0) reasons.push("饥饿")
		if (stats.stamina <= 0) reasons.push("虚脱")
		if (stats.mental <= 0) reasons.push("崩溃")
		if (hasFlag(state, "wound")) reasons.push("伤口恶化")
		if (hasFlag(state, "sick")) reasons.push("高烧不退")
		text += ` 你在${reasons.join("、")}中煎熬，损失了 ${healthLoss} 点生命。`
	}
	else {
		text += " 这一夜还算安稳。"
	}

	// 自动通关
	if (nextDay > TARGET_DAY) {
		if (newHealth <= 0) {
			return {
				text: text + " 第 7 天清晨，你隐约听到了直升机的轰鸣，但没能撑到救援到来。",
				stateChange: {
					player: {
						...state.player,
						health: newHealth,
						stats,
						day: nextDay,
					},
					gameOver: true,
					win: false,
				},
			}
		}
		return {
			text: text + " 第 7 天清晨，直升机的轰鸣划破长空——救援队终于来了！",
			stateChange: {
				player: {
					...state.player,
					health: newHealth,
					stats,
					day: nextDay,
				},
				gameOver: true,
				win: true,
			},
		}
	}

	const nextEventId = pickRandomEventId()

	return {
		text: text + ` 第 ${nextDay} 天到来了。`,
		stateChange: {
			player: {
				...state.player,
				health: newHealth,
				stats,
				day: nextDay,
			},
			worldFlags: { ...state.worldFlags, event_id: nextEventId },
		},
	}
}

function getCurrentEvent(state: GameState): EventDef {
	const eventId = state.worldFlags.event_id as string | undefined
	if (eventId && events.has(eventId)) {
		return events.get(eventId)!
	}
	return events.get("find_food")!
}

export function getAvailableActions(state: GameState): Action[] {
	if (state.gameOver) return []
	const ev = getCurrentEvent(state)
	return ev.actions
}

export function getCurrentScene(state: GameState): Scene {
	if (state.gameOver && state.win) {
		return {
			id: "ending",
			name: "获救",
			description: "救援队将你扶上直升机。下方的荒野越来越小，你终于安全了。",
		}
	}
	if (state.gameOver) {
		return {
			id: "ending",
			name: "死亡",
			description: "你的意识逐渐模糊，荒野吞噬了又一个迷失的灵魂。",
		}
	}
	const ev = getCurrentEvent(state)
	return {
		id: "camp",
		name: `${ev.title} · 第 ${state.player.day} 天`,
		description: ev.description,
	}
}

function resolveImmediateResult(state: GameState, actionId: string): ActionResult {
	const p = state.player
	const worldFlags = { ...state.worldFlags }

	switch (state.worldFlags.event_id as string) {
	case "find_food": {
		switch (actionId) {
		case "eat_berries": {
			const poison = Math.random() < 0.5
			if (poison) {
				return {
					text: "浆果味道发苦，你吐了一地，反而更饿了。",
					playerChange: {
						stats: setStat(state, "hunger", getStat(state, "hunger", 50) - 15),
						health: p.health - 15,
					},
				}
			}
			return {
				text: "浆果酸甜可口，你暂时填饱了肚子。",
				playerChange: {
					stats: setStat(state, "hunger", getStat(state, "hunger", 50) + 20),
				},
			}
		}
		case "set_trap": {
			return {
				text: "你花了一下午布置陷阱，幸运地捕获了一只野兔。",
				playerChange: {
					stats: setStat(state, "hunger", getStat(state, "hunger", 50) + 35),
					stats: setStat(state, "stamina", getStat(state, "stamina", 100) - 15),
				},
			}
		}
		case "skip_food":
			return { text: "你饿着肚子躺在床上，胃袋一阵阵抽搐。" }
		}
		break
	}

	case "strange_sound": {
		switch (actionId) {
		case "check_sound": {
			const safe = Math.random() < 0.4
			if (safe) {
				return {
					text: "外面空无一物，只是风吹动了枯枝。",
					playerChange: {
						stats: setStat(state, "mental", getStat(state, "mental", 100) + 5),
					},
				}
			}
			return {
				text: "一头野狼从暗处扑出，你拼命挥舞木棍才把它赶走，手臂被撕开一道狰狞的伤口。",
				playerChange: {
					health: p.health - 25,
					stats: setStat(state, "mental", getStat(state, "mental", 100) - 15),
				},
				worldFlagsChange: { wound: true },
			}
		}
		case "hide_tent":
			return {
				text: "你屏住呼吸，听着脚步声从帐篷外掠过，冷汗浸透了后背。",
				playerChange: {
					stats: setStat(state, "mental", getStat(state, "mental", 100) - 10),
				},
			}
		case "make_fire":
			return {
				text: "篝火噼啪作响，林子里的动静渐渐远去了。",
				playerChange: {
					stats: setStat(state, "stamina", getStat(state, "stamina", 100) - 15),
				},
			}
		}
		break
	}

	case "beast_attack": {
		switch (actionId) {
		case "fight_bear": {
			const survive = Math.random() < 0.5
			if (survive) {
				return {
					text: "你击中了熊的鼻子，它痛吼一声逃进了树林。但你也被拍了一掌，肋骨剧痛。",
					playerChange: {
						health: p.health - 25,
						stats: setStat(state, "stamina", getStat(state, "stamina", 100) - 30),
					},
					worldFlagsChange: { wound: true },
				}
			}
			return {
				text: "木棍打在熊身上像挠痒痒。巨掌拍下，你听到了自己骨骼碎裂的声音。",
				gameOver: true,
				win: false,
			}
		}
		case "climb_tree": {
			const fall = Math.random() < 0.3
			if (fall) {
				return {
					text: "树皮湿滑，你爬到一半摔了下来。熊嗅了嗅你，不感兴趣地走开了。",
					playerChange: {
						health: p.health - 30,
						stats: setStat(state, "stamina", getStat(state, "stamina", 100) - 20),
					},
					worldFlagsChange: { wound: true },
				}
			}
			return {
				text: "你死死抱住树干，熊在树下转了几圈，悻悻离去。",
				playerChange: {
					stats: setStat(state, "stamina", getStat(state, "stamina", 100) - 30),
					stats: setStat(state, "mental", getStat(state, "mental", 100) - 10),
				},
			}
		}
		case "play_dead": {
			const discovered = Math.random() < 0.4
			if (discovered) {
				return {
					text: "熊用鼻子拱了拱你，然后一口咬住了你的大腿。",
					playerChange: {
						health: p.health - 35,
					},
					worldFlagsChange: { wound: true },
				}
			}
			return {
				text: "你屏住呼吸一动不动。熊嗅了一会儿，慢慢走开了。",
				playerChange: {
					stats: setStat(state, "mental", getStat(state, "mental", 100) - 20),
				},
			}
		}
		}
		break
	}

	case "abandoned_hut": {
		switch (actionId) {
		case "search_hut": {
			const trap = Math.random() < 0.5
			if (trap) {
				return {
					text: "地板突然塌陷，你摔进了一个旧猎坑，木刺深深扎进了小腿。",
					playerChange: {
						health: p.health - 25,
						stats: setStat(state, "stamina", getStat(state, "stamina", 100) - 10),
					},
					worldFlagsChange: { wound: true },
				}
			}
			return {
				text: "你在床底下找到了半箱军用罐头和一张旧地图。",
				playerChange: {
					stats: setStat(state, "hunger", getStat(state, "hunger", 50) + 40),
				},
			}
		}
		case "leave_hut":
			return { text: "你绕开小屋，不想招惹不必要的麻烦。" }
		}
		break
	}

	case "heavy_rain": {
		switch (actionId) {
		case "fix_tent":
			return {
				text: "你用石头压住帐角，浑身湿透，但至少雨水不再往里灌了。",
				playerChange: {
					stats: setStat(state, "stamina", getStat(state, "stamina", 100) - 25),
				},
			}
		case "curl_up": {
			const sick = Math.random() < 0.6
			if (sick) {
				return {
					text: "你在寒冷中瑟瑟发抖，第二天发起了低烧。",
					playerChange: {
						health: p.health - 15,
						stats: setStat(state, "mental", getStat(state, "mental", 100) - 15),
					},
					worldFlagsChange: { sick: true },
				}
			}
			return {
				text: "你缩成一团，奇迹般地挺了过来。",
				playerChange: {
					stats: setStat(state, "mental", getStat(state, "mental", 100) - 10),
				},
			}
		}
		case "collect_water": {
			const sick = Math.random() < 0.9
			if (sick) {
				return {
					text: "雨水让你浑身冰凉，夜里开始剧烈咳嗽。",
					playerChange: {
						health: p.health - 25,
						stats: setStat(state, "hunger", getStat(state, "hunger", 50) + 10),
					},
					worldFlagsChange: { sick: true },
				}
			}
			return {
				text: "你接满了一壶雨水，虽然冷，但至少解渴。",
				playerChange: {
					stats: setStat(state, "hunger", getStat(state, "hunger", 50) + 10),
				},
			}
		}
		}
		break
	}

	case "helicopter": {
		switch (actionId) {
		case "signal_fire": {
			return {
				text: "浓烟滚滚升起，直升机调整了航向，径直朝你飞来！",
				nextSceneId: "ending",
				gameOver: true,
				win: true,
			}
		}
		case "shout_help": {
			const newStats = {
				...setStat(state, "stamina", getStat(state, "stamina", 100) - 25),
				...setStat(state, "mental", getStat(state, "mental", 100) - 20),
			}
			return {
				text: "你的声音被山风和螺旋桨的噪音吞没了。直升机渐渐消失在云层中。",
				playerChange: { stats: newStats },
			}
		}
		case "chase_heli":
			return {
				text: "你拼尽全力追到山脚，直升机却已经远去。你跪在地上大口喘气。",
				playerChange: {
					health: p.health - 20,
					stats: setStat(state, "stamina", getStat(state, "stamina", 100) - 50),
				},
			}
		}
		break
	}

	case "dead_body": {
		switch (actionId) {
		case "loot_body": {
			const newStats = {
				...setStat(state, "hunger", getStat(state, "hunger", 50) + 20),
				...setStat(state, "mental", getStat(state, "mental", 100) - 25),
			}
			return {
				text: "你强忍恶心翻找背包，找到了急救包和压缩饼干。",
				playerChange: {
					health: Math.min(p.maxHealth, p.health + 10),
					stats: newStats,
				},
			}
		}
		case "bury_body": {
			const newStats = {
				...setStat(state, "stamina", getStat(state, "stamina", 100) - 25),
				...setStat(state, "mental", getStat(state, "mental", 100) + 20),
			}
			return {
				text: "你花了一小时挖了个浅坑，把死者安葬。心里稍微好受了些。",
				playerChange: {
					stats: newStats,
				},
			}
		}
		case "walk_away":
			return {
				text: "你扭头走开，但那个画面会在你脑海里停留很久。",
				playerChange: {
					stats: setStat(state, "mental", getStat(state, "mental", 100) - 10),
				},
			}
		}
		break
	}
	}

	return { text: "你愣在原地，什么也没做。" }
}

export function handleAction(state: GameState, actionId: string): ActionResult {
	if (state.gameOver) {
		return { text: "游戏已结束。" }
	}

	const immediate = resolveImmediateResult(state, actionId)

	if (immediate.gameOver) {
		return immediate
	}

	// 构建应用即时变更后的临时状态
	let nextState: GameState = { ...state }
	if (immediate.playerChange) {
		nextState = {
			...nextState,
			player: { ...nextState.player, ...immediate.playerChange },
		}
	}
	if (immediate.worldFlagsChange) {
		nextState = {
			...nextState,
			worldFlags: { ...nextState.worldFlags, ...immediate.worldFlagsChange },
		}
	}

	// 检查即时死亡
	if (nextState.player.health <= 0) {
		return {
			text: immediate.text + " 你伤势过重，倒在了荒野中。",
			gameOver: true,
			win: false,
		}
	}

	// 夜晚结算
	const night = nightSettlement(nextState)
	const combinedText = immediate.text + "\n\n" + night.text

	const nightPlayer = (night.stateChange.player ?? nextState.player) as GameState["player"]
	if (night.stateChange.gameOver) {
		return {
			text: combinedText,
			playerChange: night.stateChange.player,
			worldFlagsChange: night.stateChange.worldFlags,
			gameOver: night.stateChange.gameOver,
			win: night.stateChange.win ?? false,
		}
	}

	if (nightPlayer.health <= 0) {
		return {
			text: combinedText,
			playerChange: night.stateChange.player,
			worldFlagsChange: night.stateChange.worldFlags,
			gameOver: true,
			win: false,
		}
	}

	return {
		text: combinedText,
		playerChange: night.stateChange.player,
		worldFlagsChange: night.stateChange.worldFlags,
	}
}

export const demoSurvival = {
	scenes: new Map<string, Scene>([["camp", { id: "camp", name: "", description: "" }]]),
	getAvailableActions,
	getCurrentScene,
	handleAction,
	initialState: {
		player: {
			health: 100,
			maxHealth: 100,
			items: [],
			flags: {},
			notes: [],
			day: 1,
			stats: {
				hunger: 60,
				stamina: 100,
				mental: 100,
			},
		},
		currentSceneId: "camp",
		log: ["你醒来时发现自己孤身一人，身边只有一架坠毁的轻型飞机的残骸。必须活下去。"],
		gameOver: false,
		win: false,
		worldFlags: { event_id: pickRandomEventId() },
	} satisfies GameState,
}
