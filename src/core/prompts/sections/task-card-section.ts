import * as path from "path"
import * as fs from "fs/promises"
import { EXPERIMENT_IDS, experiments as Experiments } from "../../../shared/experiments"
import { GlobalFileNames } from "../../../shared/globalFileNames"
import { TaskCard } from "../../../shared/task-cards"

/**
 * Get the task card section for the system prompt
 * This is included when the TASK_CARDS experiment is enabled
 */
export async function getTaskCardSection(
	cwd: string,
	taskId: string,
	experimentsConfig: Record<string, boolean> = {},
): Promise<string> {
	// Check if the task cards experiment is enabled
	const taskCardsEnabled = Experiments.isEnabled(experimentsConfig, EXPERIMENT_IDS.TASK_CARDS)

	if (!taskCardsEnabled || !taskId) {
		return ""
	}

	try {
		// Try to find the task card in the global storage path first, then fall back to local
		let taskCardPath: string
		let taskCardContent: string

		try {
			// Try in the local directory first
			taskCardPath = path.join(cwd, ".roo", "tasks", taskId, GlobalFileNames.taskCard)
			taskCardContent = await fs.readFile(taskCardPath, "utf-8")
		} catch (error) {
			// If it doesn't exist locally, there's no task card yet
			return ""
		}

		// Parse the task card
		const taskCard = JSON.parse(taskCardContent) as TaskCard

		// Format the task card for the system prompt
		return formatTaskCardForSystemPrompt(taskCard)
	} catch (error) {
		// If there's an error, return an empty string
		console.error(
			`Error getting task card for system prompt: ${error instanceof Error ? error.message : String(error)}`,
		)
		return ""
	}
}

/**
 * Format a task card for the system prompt
 */
function formatTaskCardForSystemPrompt(taskCard: TaskCard): string {
	const formattedSteps = taskCard.steps
		.map(
			(step) =>
				`- [${step.status}] Step ${step.step_number}: ${step.description}${
					step.subtask_id ? ` (Subtask: ${step.subtask_id})` : ""
				}${step.comments.length > 0 ? `\n  - Comments: ${step.comments.join("\n  - ")}` : ""}`,
		)
		.join("\n")

	const formattedContext =
		taskCard.context.length > 0
			? `\nContext:\n${taskCard.context.map((ctx) => `- ${ctx}`).join("\n")}`
			: "\nContext: None"

	const formattedNotes =
		taskCard.notes.length > 0
			? `\nNotes:\n${taskCard.notes.map((note) => `- ${note}`).join("\n")}`
			: "\nNotes: None"

	return `====

TASK CARD

Task Title: ${taskCard.task_title}
Description: ${taskCard.description}

Current Status: ${taskCard.metadata.status}
Created: ${taskCard.metadata.created_at}
Last Updated: ${taskCard.metadata.updated_at}
${taskCard.metadata.parent_task_id ? `Parent Task: ${taskCard.metadata.parent_task_id}` : ""}

Steps:
${formattedSteps}
${formattedContext}
${formattedNotes}
`
}
