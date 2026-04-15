import type { GameState, Scene, Action, ActionResult } from "./types.ts"

// ========== 示例解谜冒险：实验室逃脱 ==========

const scenes = new Map<string, Scene>([
	["entrance", {
		id: "entrance",
		name: "实验室走廊",
		description: "你站在一条昏暗的走廊里。尽头是一扇厚重的电子门禁，通往外界。旁边墙上有一个消防柜，天花板上有一个通风口盖板。",
	}],
	["ventshaft", {
		id: "ventshaft",
		name: "通风管道",
		description: "狭窄而闷热的金属管道，勉强能容一人爬行。前方有一丝微弱的光亮，后方是返回走廊的入口。",
	}],
	["office", {
		id: "office",
		name: "办公室",
		description: "一间凌乱的办公室。书桌上有一台旧电脑，抽屉紧锁着。角落里有一台废弃的碎纸机。",
	}],
	["ending", {
		id: "ending",
		name: "自由",
		description: "门禁缓缓打开，刺眼的光线照了进来。你成功逃出了实验室。",
	}],
])

function hasItem(state: GameState, itemId: string): boolean {
	return state.player.items.includes(itemId)
}

function addNote(notes: string[], note: string): string[] {
	return notes.includes(note) ? notes : [...notes, note]
}

function getAvailableActions(state: GameState): Action[] {
	const here = state.currentSceneId
	const actions: Action[] = []

	// ── entrance ──
	if (here === "entrance") {
		actions.push(
			{ id: "examine_door", label: "调查电子门禁" },
			{ id: "examine_vent", label: "调查通风口" },
			{ id: "examine_fire_cabinet", label: "调查消防柜" }
		)

		if (!state.worldFlags.fire_cabinet_opened) {
			actions.push({ id: "open_fire_cabinet", label: "打破玻璃打开消防柜" })
		}
		else if (!hasItem(state, "crowbar")) {
			actions.push({ id: "take_crowbar", label: "取出消防柜里的撬棍" })
		}

		if (!state.worldFlags.vent_opened && hasItem(state, "crowbar")) {
			actions.push({ id: "use_crowbar_on_vent", label: "用撬棍撬开通风口" })
		}
		if (state.worldFlags.vent_opened) {
			actions.push({ id: "enter_vent", label: "爬进通风管道" })
		}

		if (hasItem(state, "keycard")) {
			actions.push({
				id: "use_keycard_on_door",
				label: "用门禁卡刷大门",
				hint: state.worldFlags.computer_unlocked ? "已知密码" : "还不知道密码"
			})
		}
	}

	// ── ventshaft ──
	if (here === "ventshaft") {
		actions.push(
			{ id: "crawl_to_office", label: "朝有光亮的方向爬去" },
			{ id: "crawl_to_entrance", label: "爬回走廊" }
		)
	}

	// ── office ──
	if (here === "office") {
		actions.push(
			{ id: "examine_desk", label: "调查书桌抽屉" },
			{ id: "examine_shredder", label: "调查碎纸机" },
			{ id: "examine_computer", label: "调查电脑" }
		)

		if (!state.worldFlags.desk_opened && hasItem(state, "crowbar")) {
			actions.push({ id: "use_crowbar_on_desk", label: "用撬棍撬开抽屉" })
		}
		if (state.worldFlags.desk_opened && !hasItem(state, "keycard")) {
			actions.push({ id: "take_keycard", label: "拿走抽屉里的门禁卡" })
		}

		if (!state.worldFlags.computer_unlocked) {
			actions.push({ id: "unlock_computer", label: "尝试输入电脑密码" })
		}

		actions.push({ id: "back_to_entrance", label: "通过通风管返回走廊" })
	}

	return actions
}

function handleAction(state: GameState, actionId: string, inputValue?: string): ActionResult {
	const here = state.currentSceneId
	const player = state.player

	// ── entrance ──
	if (here === "entrance") {
		switch (actionId) {
		case "examine_door":
			return { text: "厚重的电子门禁。刷卡区下方有一个数字键盘，需要输入4位密码。" }
		case "examine_vent":
			return { text: "天花板上有一块生锈的金属盖板，边缘的螺丝已经松动了。" }
		case "examine_fire_cabinet":
			return {
				text: state.worldFlags.fire_cabinet_opened
					? "玻璃已经碎了，里面空空如也。"
					: "红色的消防柜，玻璃门上贴着'紧急时刻打破玻璃'。"
			}
		case "open_fire_cabinet":
			return { text: "你打破玻璃，柜子里有一根结实的撬棍。", worldFlagsChange: { fire_cabinet_opened: true } }
		case "take_crowbar":
			return {
				text: "你拿起了撬棍，沉甸甸的很有分量。",
				playerChange: { items: [...player.items, "crowbar"] }
			}
		case "use_crowbar_on_vent":
			return {
				text: "你用撬棍撬掉了通风口的盖板，里面黑洞洞的。",
				worldFlagsChange: { vent_opened: true }
			}
		case "enter_vent":
			return { text: "你钻进通风管道，金属壁上残留着机油味。", nextSceneId: "ventshaft" }
		case "use_keycard_on_door": {
			if (!state.worldFlags.computer_unlocked) {
				return { text: "你把门禁卡在刷卡区晃了晃，红灯亮起：'请输入密码'。你不知道密码。" }
			}
			if (!inputValue) {
				return {
					text: "门禁亮起绿灯，提示输入4位密码。",
					requireInput: {
						prompt: "请输入4位密码",
						answer: "1984",
						onSuccess: { text: "密码正确，大门缓缓打开。", nextSceneId: "ending", gameOver: true, win: true },
						onFailText: "密码错误，红灯闪烁。"
					}
				}
			}
			if (inputValue === "1984") {
				return { text: "密码正确，大门缓缓打开。", nextSceneId: "ending", gameOver: true, win: true }
			}
			return { text: "密码错误，红灯闪烁。" }
		}
		}
	}

	// ── ventshaft ──
	if (here === "ventshaft") {
		switch (actionId) {
		case "crawl_to_office":
			return { text: "你爬过几个弯道，从通风口落到了办公室里。", nextSceneId: "office" }
		case "crawl_to_entrance":
			return { text: "你顺着管道爬回了走廊。", nextSceneId: "entrance" }
		}
	}

	// ── office ──
	if (here === "office") {
		switch (actionId) {
		case "examine_desk":
			return {
				text: state.worldFlags.desk_opened
					? "抽屉已经被撬开，里面除了废纸什么也没有。"
					: "老式的木制书桌，抽屉上挂着一把生锈的铜锁。"
			}
		case "use_crowbar_on_desk":
			return { text: "你用力一撬，锁应声而断。抽屉里有一张门禁卡。", worldFlagsChange: { desk_opened: true } }
		case "take_keycard":
			return {
				text: "你拿走了门禁卡，背面印着'实验区 B-07'。",
				playerChange: { items: [...player.items, "keycard"] }
			}
		case "examine_shredder":
			return {
				text: "碎纸机的纸槽里卡着一张未被完全切碎的纸条，上面依稀可见三个数字：0、4、2。",
				playerChange: { notes: addNote(player.notes, "电脑密码：042") }
			}
		case "examine_computer":
			return {
				text: state.worldFlags.computer_unlocked
					? "屏幕上显示着一行大字：'主门禁密码已更新为 1984。'"
					: "电脑处于锁屏状态，壁纸是一个输入框，提示'请输入4位密码'。"
			}
		case "unlock_computer": {
			if (state.worldFlags.computer_unlocked) {
				return { text: "电脑已经解锁了。" }
			}
			if (!inputValue) {
				return {
					text: "你坐到电脑前，等待输入密码。",
					requireInput: {
						prompt: "请输入4位密码",
						answer: "042",
						onSuccess: {
							text: "密码正确！你看到了大门密码：1984。",
							worldFlagsChange: { computer_unlocked: true },
							playerChange: { notes: addNote(player.notes, "大门密码：1984") }
						},
						onFailText: "密码错误，系统提示'剩余尝试次数：2'。"
					}
				}
			}
			if (inputValue === "042") {
				return {
					text: "密码正确！你看到了大门密码：1984。",
					worldFlagsChange: { computer_unlocked: true },
					playerChange: { notes: addNote(player.notes, "大门密码：1984") }
				}
			}
			return { text: "密码错误，系统提示'剩余尝试次数：2'。" }
		}
		case "back_to_entrance":
			return { text: "你爬上通风管，回到了走廊。", nextSceneId: "entrance" }
		}
	}

	return { text: "你愣在原地，不知道要做什么。" }
}

export const demoAdventure = {
	scenes,
	getAvailableActions,
	handleAction,
	initialState: {
		player: {
			health: 10,
			maxHealth: 10,
			items: [],
			flags: {},
			notes: [],
			day: 1,
			stats: {},
		},
		currentSceneId: "entrance",
		log: [],
		gameOver: false,
		win: false,
		worldFlags: {},
	} satisfies GameState,
}
