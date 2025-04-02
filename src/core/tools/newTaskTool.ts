import { ToolUse } from "../assistant-message"
import { HandleError, PushToolResult, RemoveClosingTag } from "./types"
import { Cline } from "../Cline"
import { AskApproval } from "./types"
import { defaultModeSlug, getModeBySlug } from "../../shared/modes"
import { formatResponse } from "../prompts/responses"
import delay from "delay"
import { EXPERIMENT_IDS, experiments as Experiments } from "../../shared/experiments"
import * as vscode from "vscode"

// Extend the Cline type to include parentStepNumber
declare module "../Cline" {
	interface Cline {
		parentStepNumber?: number
	}
}

export async function newTaskTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const mode: string | undefined = block.params.mode
	const message: string | undefined = block.params.message
	const parentStepNumber: string | undefined = block.params.parent_step_number

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				tool: "newTask",
				mode: removeClosingTag("mode", mode),
				message: removeClosingTag("message", message),
				parentStepNumber: removeClosingTag("parent_step_number", parentStepNumber),
			})
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!mode) {
				cline.consecutiveMistakeCount++
				pushToolResult(await cline.sayAndCreateMissingParamError("new_task", "mode"))
				return
			}
			if (!message) {
				cline.consecutiveMistakeCount++
				pushToolResult(await cline.sayAndCreateMissingParamError("new_task", "message"))
				return
			}
			cline.consecutiveMistakeCount = 0

			// Verify the mode exists
			const targetMode = getModeBySlug(mode, (await cline.providerRef.deref()?.getState())?.customModes)
			if (!targetMode) {
				pushToolResult(formatResponse.toolError(`Invalid mode: ${mode}`))
				return
			}

			// Include parentStepNumber in the tool message if provided
			const toolMessage = JSON.stringify({
				tool: "newTask",
				mode: targetMode.name,
				content: message,
				...(parentStepNumber ? { parentStepNumber } : {}),
			})
			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			const provider = cline.providerRef.deref()

			if (!provider) {
				return
			}

			// Preserve the current mode so we can resume with it later.
			cline.pausedModeSlug = (await provider.getState()).mode ?? defaultModeSlug

			// Switch mode first, then create new task instance.
			await provider.handleModeSwitch(mode)

			// Delay to allow mode change to take effect before next tool is executed.
			await delay(500)

			const newCline = await provider.initClineWithTask(message, undefined, cline)

			// If this is a subtask with a parent step number, update the parent task card
			if (parentStepNumber && cline.taskId) {
				const { experiments } = await provider.getState()
				const taskCardsEnabled = Experiments.isEnabled(experiments, EXPERIMENT_IDS.TASK_CARDS)

				if (taskCardsEnabled) {
					try {
						// Convert parentStepNumber to a number
						const stepNumber = parseInt(parentStepNumber, 10)
						if (!isNaN(stepNumber)) {
							// Get the global storage path
							const globalStoragePath = provider.context.globalStorageUri.fsPath

							// Import the necessary functions dynamically to avoid circular dependencies
							const { updateParentTaskCardWithSubtask, getTaskCard, createTaskCard, updateTaskCard } =
								await import("../prompts/tools/task-cards/storage")

							console.log(
								`Setting up parent-child relationship between ${cline.taskId} and ${newCline.taskId}...`,
							)

							// 1. First, ALWAYS create a basic task card for the new subtask with the parent information
							console.log(`Creating initial task card for subtask ${newCline.taskId}`)
							await createTaskCard(
								provider.cwd,
								globalStoragePath,
								{
									task_title: message, // Use the message as the task title for now
									description: `Subtask for step ${stepNumber} of parent task ${cline.taskId}`,
									steps: [], // Empty steps initially
									context: [], // Empty context initially
									notes: [], // Empty notes initially
									metadata: {
										parent_task_id: cline.taskId,
										parent_step_number: stepNumber,
									},
								},
								newCline.taskId,
							)

							// 2. Check if parent task card exists, if not create it
							const parentTaskCard = await getTaskCard(provider.cwd, cline.taskId, globalStoragePath)

							if (!parentTaskCard) {
								console.log(`Creating initial task card for parent task ${cline.taskId}`)
								// Create a basic task card for the parent task
								await createTaskCard(
									provider.cwd,
									globalStoragePath,
									{
										task_title: cline.parentTask
											? `Subtask: ${cline.taskId}`
											: `Task: ${cline.taskId}`,
										description: "Task created automatically",
										steps: [
											{
												step_number: stepNumber,
												description: `Step ${stepNumber}`,
												status: "in_progress",
												subtask_id: null, // Will be updated next
												comments: [],
											},
										],
										context: [],
										notes: [],
									},
									cline.taskId,
								)
							}

							// 3. Now update the parent task step with the subtask ID
							console.log(
								`Updating parent task ${cline.taskId} step ${stepNumber} with subtask ID ${newCline.taskId}`,
							)
							await updateParentTaskCardWithSubtask(
								provider.cwd,
								globalStoragePath,
								cline.taskId,
								stepNumber,
								newCline.taskId,
							)

							// Set the newCline's parentStepNumber for reference
							newCline.parentStepNumber = stepNumber

							console.log(
								`Successfully set up parent-child relationship between ${cline.taskId} and ${newCline.taskId}`,
							)
						}
					} catch (error) {
						console.error(`Error updating parent-child task relationship: ${error.message}`)
					}
				}
			}

			cline.emit("taskSpawned", newCline.taskId)

			// Include parent step number in the success message if provided
			const parentStepInfo = parentStepNumber
				? ` (subtask for step ${parentStepNumber} of parent task ${cline.taskId})`
				: ""

			pushToolResult(
				`Successfully created new task${parentStepInfo} in ${targetMode.name} mode with message: ${message}`,
			)

			// Set the isPaused flag to true so the parent
			// task can wait for the sub-task to finish.
			cline.isPaused = true
			cline.emit("taskPaused")

			return
		}
	} catch (error) {
		await handleError("creating new task", error)
		return
	}
}
