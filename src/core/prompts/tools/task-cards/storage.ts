import * as fs from "fs/promises"
import * as path from "path"
import { GlobalFileNames } from "../../../../shared/globalFileNames"
import { TaskCard, TaskCardMetadata, TaskCardStatus, TaskStepStatus } from "../../../../shared/task-cards"
import { getTaskDirectoryPath } from "../../../../shared/storagePathManager"

/**
 * Get the task card file path for a given task ID
 */
export async function getTaskCardPath(cwd: string, taskId: string, globalStoragePath: string): Promise<string> {
	const globalTaskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	return path.join(globalTaskDir, GlobalFileNames.taskCard)
}

/**
 * Get a task card by ID
 * Returns null if the task card doesn't exist
 */
export async function getTaskCard(cwd: string, taskId: string, globalStoragePath: string): Promise<TaskCard | null> {
	try {
		const taskCardPath = await getTaskCardPath(cwd, taskId, globalStoragePath)
		const taskCardContent = await fs.readFile(taskCardPath, "utf-8")
		return JSON.parse(taskCardContent) as TaskCard
	} catch (error) {
		return null
	}
}

/**
 * Create a new task card
 * Generates a new task ID if one is not provided
 */
export async function createTaskCard(
	cwd: string,
	globalStoragePath: string,
	taskCard: Omit<TaskCard, "metadata"> & { metadata?: Partial<TaskCardMetadata> },
	taskId?: string,
): Promise<TaskCard> {
	const actualTaskId = taskId || generateTaskId()
	const timestamp = new Date().toISOString()

	// Create the complete task card with metadata
	const completeTaskCard: TaskCard = {
		...taskCard,
		metadata: {
			task_id: actualTaskId,
			created_at: timestamp,
			updated_at: timestamp,
			status: TaskCardStatus.ACTIVE,
			parent_task_id: taskCard.metadata?.parent_task_id || null,
			...taskCard.metadata,
		},
	}

	// Save the task card
	await saveTaskCard(cwd, globalStoragePath, completeTaskCard)

	return completeTaskCard
}

/**
 * Update an existing task card
 * Creates a new one if it doesn't exist
 */
export async function updateTaskCard(
	cwd: string,
	globalStoragePath: string,
	taskId: string,
	updatedTaskCard: Partial<Omit<TaskCard, "metadata">> & { metadata?: Partial<TaskCardMetadata> },
): Promise<TaskCard> {
	// Get the existing task card
	const existingTaskCard = await getTaskCard(cwd, taskId, globalStoragePath)

	if (!existingTaskCard) {
		// If it doesn't exist, create a new one
		if (!updatedTaskCard.task_title || !updatedTaskCard.description) {
			throw new Error("Task title and description are required when creating a new task card")
		}

		return createTaskCard(
			cwd,
			globalStoragePath,
			{
				task_title: updatedTaskCard.task_title,
				description: updatedTaskCard.description,
				steps: updatedTaskCard.steps || [],
				context: updatedTaskCard.context || [],
				notes: updatedTaskCard.notes || [],
				metadata: updatedTaskCard.metadata,
			},
			taskId,
		)
	}

	// Update the task card
	const newTaskCard: TaskCard = {
		...existingTaskCard,
		...updatedTaskCard,
		metadata: {
			...existingTaskCard.metadata,
			...updatedTaskCard.metadata,
			task_id: taskId, // Ensure task_id doesn't change
			updated_at: new Date().toISOString(), // Update timestamp
		},
	}

	// Save the updated task card
	await saveTaskCard(cwd, globalStoragePath, newTaskCard)

	return newTaskCard
}

/**
 * Save a task card to disk
 */
export async function saveTaskCard(cwd: string, globalStoragePath: string, taskCard: TaskCard): Promise<void> {
	const taskCardPath = await getTaskCardPath(cwd, taskCard.metadata.task_id, globalStoragePath)
	await fs.writeFile(taskCardPath, JSON.stringify(taskCard, null, 2), "utf-8")
}

/**
 * Generate a unique task ID
 */
export function generateTaskId(): string {
	return `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

/**
 * Update a parent task card with subtask information
 */
export async function updateParentTaskCardWithSubtask(
	cwd: string,
	globalStoragePath: string,
	parentTaskId: string,
	stepNumber: number,
	subtaskId: string,
): Promise<TaskCard | null> {
	const parentTaskCard = await getTaskCard(cwd, parentTaskId, globalStoragePath)

	if (!parentTaskCard) {
		return null
	}

	// Find the step to update
	const stepIndex = parentTaskCard.steps.findIndex((step) => step.step_number === stepNumber)

	if (stepIndex === -1) {
		return null
	}

	// Update the step with the subtask ID
	const updatedSteps = [...parentTaskCard.steps]
	updatedSteps[stepIndex] = {
		...updatedSteps[stepIndex],
		subtask_id: subtaskId,
		status: TaskStepStatus.IN_PROGRESS,
	}

	// Update the parent task card
	return updateTaskCard(cwd, globalStoragePath, parentTaskId, { steps: updatedSteps })
}

/**
 * Update task card status when a task is completed
 */
export async function updateTaskCardStatus(
	cwd: string,
	globalStoragePath: string,
	taskId: string,
	status: TaskCardStatus,
): Promise<TaskCard | null> {
	return updateTaskCard(cwd, globalStoragePath, taskId, { metadata: { status } })
}

/**
 * Format a task card for inclusion in completion messages
 * This provides a summary of the task card to be included when a subtask completes
 */
export async function getTaskCardForCompletion(
	cwd: string,
	taskId: string,
	globalStoragePath: string,
): Promise<string | null> {
	// Get the task card
	const taskCard = await getTaskCard(cwd, taskId, globalStoragePath)

	if (!taskCard) {
		return null
	}

	// Format completed steps
	const completedSteps = taskCard.steps
		.filter((step) => step.status === TaskStepStatus.COMPLETED)
		.map((step) => {
			const comments =
				step.comments && step.comments.length > 0 ? `\n    - Comments: ${step.comments.join(", ")}` : ""
			return `- Step ${step.step_number}: ${step.description}${comments}`
		})

	const completedStepsText = completedSteps.length > 0 ? completedSteps.join("\n") : "No steps completed"

	// Format context items
	const contextItemsText =
		taskCard.context && taskCard.context.length > 0
			? taskCard.context.map((item) => `- ${item}`).join("\n")
			: "No context items"

	// Format notes
	const notesText =
		taskCard.notes && taskCard.notes.length > 0 ? taskCard.notes.map((note) => `- ${note}`).join("\n") : "No notes"

	// Create the summary
	return `# Task Card Summary: ${taskCard.task_title}\n**Task ID:** ${taskId}\n\n${taskCard.description ? `**Description:** ${taskCard.description}\n\n` : ""}**Completed Steps:**\n${completedStepsText}\n\n**Context:**\n${contextItemsText}\n\n**Notes:**\n${notesText}`
}
