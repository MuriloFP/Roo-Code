/**
 * Task Card Types
 *
 * This file contains the type definitions for the Task Cards feature.
 * Task Cards help users organize and track their tasks with a structured system.
 */

/**
 * Task Card Metadata
 * System-managed information about the task card.
 */
export interface TaskCardMetadata {
	task_id: string
	created_at: string
	updated_at: string
	status: string
	parent_task_id: string | null
	parent_step_number?: number
}

/**
 * Task Step
 * A single step in a task card with its own status and comments.
 */
export interface TaskStep {
	step_number: number
	description: string
	status: string // "planned", "in_progress", or "completed"
	subtask_id: string | null
	comments: string[]
}

/**
 * Task Card
 * The main structure for a task card, containing all its components.
 */
export interface TaskCard {
	metadata: TaskCardMetadata
	task_title: string
	description: string
	steps: TaskStep[]
	context: string[]
	notes: string[]
}

/**
 * Step Status
 * The possible status values for a task step.
 */
export enum TaskStepStatus {
	PLANNED = "planned",
	IN_PROGRESS = "in_progress",
	COMPLETED = "completed",
}

/**
 * Task Card Status
 * The possible status values for a task card.
 */
export enum TaskCardStatus {
	ACTIVE = "active",
	COMPLETED = "completed",
}
