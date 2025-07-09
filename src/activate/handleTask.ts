import * as vscode from "vscode"

import { Package } from "../shared/package"
import { ClineProvider } from "../core/webview/ClineProvider"
import { t } from "../i18n"

export const handleNewTask = async (params: { prompt?: string } | null | undefined) => {
	console.log("[Roo Debug] handleNewTask called with params:", params)

	let prompt = params?.prompt

	if (!prompt) {
		console.log("[Roo Debug] No prompt provided, showing input box")
		prompt = await vscode.window.showInputBox({
			prompt: t("common:input.task_prompt"),
			placeHolder: t("common:input.task_placeholder"),
		})
	}

	if (!prompt) {
		console.log("[Roo Debug] No prompt entered, focusing sidebar")
		await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)
		return
	}

	console.log("[Roo Debug] Creating new task with prompt:", prompt)
	await ClineProvider.handleCodeAction("newTask", "NEW_TASK", { userInput: prompt })
}
