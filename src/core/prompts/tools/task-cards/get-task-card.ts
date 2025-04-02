import * as z from "zod"
import { getTaskCard } from "./storage"
import { ToolArgs } from "../types"

// Define the schema for the get task card arguments
export const getTaskCardArgsSchema = z.object({
	task_id: z.string(),
})

// Function to get the description for the get task card tool
export function getGetTaskCardDescription(_args: ToolArgs): string {
	return `get_task_card

Retrieve a task card by ID

PARAMETERS:
{
  "type": "object",
  "properties": {
    "task_id": {
      "type": "string",
      "description": "The ID of the task card to retrieve"
    }
  },
  "required": ["task_id"]
}`
}

// Function to get a task card
export async function getTaskCardTool(
	cwd: string,
	globalStoragePath: string,
	args: z.infer<typeof getTaskCardArgsSchema>,
) {
	try {
		// Get the task card
		const taskCard = await getTaskCard(cwd, args.task_id, globalStoragePath)

		if (!taskCard) {
			return {
				error: `Task card ${args.task_id} not found.`,
			}
		}

		return {
			result: `Task card ${args.task_id} retrieved successfully.`,
			task_card: taskCard,
		}
	} catch (error) {
		return {
			error: `Failed to retrieve task card: ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}
