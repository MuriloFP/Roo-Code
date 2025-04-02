import * as z from "zod"
import { TaskStepStatus, TaskCardStatus } from "../../../../shared/task-cards"
import { updateTaskCard } from "./storage"
import { ToolArgs } from "../types"

// Define the schema for the update task card tool
const updateTaskCardSchema = z.object({
	task_title: z.string().optional(),
	description: z.string().optional(),
	steps: z
		.array(
			z.object({
				step_number: z.number().int().positive(),
				description: z.string(),
				status: z.enum(["planned", "in_progress", "completed"]).default("planned"),
				subtask_id: z.string().nullable().default(null),
				comments: z.array(z.string()).default([]),
			}),
		)
		.optional(),
	context: z.array(z.string()).optional(),
	notes: z.array(z.string()).optional(),
	metadata: z
		.object({
			status: z.enum(["active", "completed"]).optional(),
		})
		.optional(),
})

// Define the schema for the update task card arguments
export const updateTaskCardArgsSchema = z.object({
	task_id: z.string().optional(),
	task_card_data: z.string(), // JSON string of the task card data
})

// Function to normalize status values
function normalizeStatusValues(data: any): any {
	if (!data) return data

	// Normalize step statuses
	if (data.steps && Array.isArray(data.steps)) {
		data.steps = data.steps.map((step: any) => ({
			...step,
			status: step.status?.toLowerCase().replace(/\s+/g, "_") || "planned",
		}))
	}

	// Normalize task card status
	if (data.metadata?.status) {
		data.metadata.status = data.metadata.status.toLowerCase()
	}

	return data
}

// Function to get the description for the update task card tool
export function getUpdateTaskCardDescription(_args: ToolArgs): string {
	return `update_task_card

Update a task card with new information

PARAMETERS:
{
  "type": "object",
  "properties": {
    "task_id": {
      "type": "string",
      "description": "The ID of the task card to update. If not provided, the current task's ID will be used."
    },
    "task_card_data": {
      "type": "string",
      "description": "JSON string containing the task card data to update"
    }
  },
  "required": ["task_card_data"]
}

Usage:
<update_task_card>
<task_card_data>
{
  "task_title": "Your task title",
  "description": "Detailed description of the task",
  "steps": [
    {
      "step_number": 1,
      "description": "First step description",
      "status": "planned",
      "subtask_id": null,
      "comments": []
    }
  ],
  "context": ["Context item 1", "Context item 2"],
  "notes": ["Note 1", "Note 2"],
  "metadata": {
    "status": "active"
  }
}
</task_card_data>
</update_task_card>`
}

// Function to update a task card
export async function updateTaskCardTool(
	cwd: string,
	globalStoragePath: string,
	args: z.infer<typeof updateTaskCardArgsSchema>,
) {
	try {
		if (!args.task_id) {
			return {
				error: "No task ID provided and no current task ID available",
			}
		}

		// Parse the task card data
		const taskCardDataRaw = JSON.parse(args.task_card_data)

		// Normalize the status values
		const normalizedData = normalizeStatusValues(taskCardDataRaw)

		// Validate the task card data against the schema
		const taskCardData = updateTaskCardSchema.parse(normalizedData)

		// Update the task card
		const updatedTaskCard = await updateTaskCard(cwd, globalStoragePath, args.task_id, taskCardData)

		return {
			result: `Task card ${args.task_id} updated successfully.`,
			task_card: updatedTaskCard,
		}
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				error: `Invalid task card data: ${error.message}`,
			}
		}

		if (error instanceof SyntaxError) {
			return {
				error: `Invalid JSON: ${error.message}`,
			}
		}

		return {
			error: `Failed to update task card: ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}
