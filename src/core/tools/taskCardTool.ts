import { Cline } from "../Cline"
import { ToolUse } from "../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "./types"
import { formatResponse } from "../prompts/responses"
import { updateTaskCardTool } from "../prompts/tools/task-cards/update-task-card"
import { getTaskCardTool } from "../prompts/tools/task-cards/get-task-card"
import { EXPERIMENT_IDS } from "../../shared/experiments"
import { experiments } from "../../shared/experiments"

export async function updateTaskCardToolHandler(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const taskId = block.params.task_id || cline.taskId
	const taskCardData = block.params.task_card_data

	try {
		const provider = cline.providerRef.deref()
		if (!provider) {
			return
		}

		// First, check if task cards experiment is enabled
		const state = await provider.getState()
		const taskCardsEnabled = experiments.isEnabled(state.experiments, EXPERIMENT_IDS.TASK_CARDS)

		if (!taskCardsEnabled) {
			// Task cards feature is disabled
			pushToolResult(
				formatResponse.toolError(
					"Task cards feature is disabled. Enable the feature in settings to use this tool.",
				),
			)
			return
		}

		if (block.partial) {
			await cline
				.ask(
					"tool",
					JSON.stringify({
						tool: "updateTaskCard",
						taskId,
						taskCardData: removeClosingTag("task_card_data", taskCardData),
					}),
					block.partial,
				)
				.catch(() => {})
			return
		} else {
			if (!taskCardData) {
				cline.consecutiveMistakeCount++
				pushToolResult(await cline.sayAndCreateMissingParamError("update_task_card", "task_card_data"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Check if auto-approval is enabled for task cards BEFORE making any changes
			const isAutoApproved = state.autoApprovalEnabled && state.alwaysAllowTaskCards

			// First, construct the request
			const completeMessage = JSON.stringify({
				tool: "updateTaskCard",
				taskId,
				taskCardData,
			})

			// Always ask for approval unless auto-approved
			if (!isAutoApproved) {
				const didApprove = await askApproval("tool", completeMessage)
				if (!didApprove) {
					return
				}
			}

			// Now that we have approval (or auto-approval), proceed with the actual operation
			const globalStoragePath = provider.context.globalStorageUri.fsPath
			const result = await updateTaskCardTool(cline.cwd, globalStoragePath, {
				task_id: taskId,
				task_card_data: taskCardData,
			})

			if (result.error) {
				pushToolResult(formatResponse.toolError(result.error))
				return
			}

			// Push the tool result
			pushToolResult(
				formatResponse.toolResult(
					JSON.stringify({
						tool: "updateTaskCard",
						taskId,
						taskCardData: result.task_card,
					}),
				),
			)

			// Then send success message to webview
			await cline.say("text", "Task card updated successfully")
		}
	} catch (error) {
		await handleError("updating task card", error)
	}
}

export async function getTaskCardToolHandler(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const taskId = block.params.task_id

	try {
		const provider = cline.providerRef.deref()
		if (!provider) {
			return
		}

		// First, check if task cards experiment is enabled
		const state = await provider.getState()
		const taskCardsEnabled = experiments.isEnabled(state.experiments, EXPERIMENT_IDS.TASK_CARDS)

		if (!taskCardsEnabled) {
			// Task cards feature is disabled
			pushToolResult(
				formatResponse.toolError(
					"Task cards feature is disabled. Enable the feature in settings to use this tool.",
				),
			)
			return
		}

		if (block.partial) {
			await cline
				.ask(
					"tool",
					JSON.stringify({
						tool: "getTaskCard",
						taskId: removeClosingTag("task_id", taskId),
					}),
					block.partial,
				)
				.catch(() => {})
			return
		} else {
			if (!taskId) {
				cline.consecutiveMistakeCount++
				pushToolResult(await cline.sayAndCreateMissingParamError("get_task_card", "task_id"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Check if auto-approval is enabled for task cards BEFORE making any changes
			const isAutoApproved = state.autoApprovalEnabled && state.alwaysAllowTaskCards

			// First, construct the request
			const completeMessage = JSON.stringify({
				tool: "getTaskCard",
				taskId,
			})

			// Always ask for approval unless auto-approved
			if (!isAutoApproved) {
				const didApprove = await askApproval("tool", completeMessage)
				if (!didApprove) {
					return
				}
			}

			// Now that we have approval (or auto-approval), proceed with the actual operation
			const globalStoragePath = provider.context.globalStorageUri.fsPath
			const result = await getTaskCardTool(cline.cwd, globalStoragePath, { task_id: taskId })

			if (result.error) {
				pushToolResult(formatResponse.toolError(result.error))
				return
			}

			// Push the tool result
			pushToolResult(
				formatResponse.toolResult(
					JSON.stringify({
						tool: "getTaskCard",
						taskId,
						taskCardData: result.task_card,
					}),
				),
			)

			// Then send success message to webview
			await cline.say("text", "Task card retrieved successfully")
		}
	} catch (error) {
		await handleError("getting task card", error)
	}
}
