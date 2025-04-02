import { EXPERIMENT_IDS, experiments as Experiments } from "../../../shared/experiments"

/**
 * Get the task card guidelines section for the system prompt
 * This is included when the TASK_CARDS experiment is enabled
 */
export function getTaskCardGuidelinesSection(experimentsConfig: Record<string, boolean> = {}): string {
	// Check if the task cards experiment is enabled
	const taskCardsEnabled = Experiments.isEnabled(experimentsConfig, EXPERIMENT_IDS.TASK_CARDS)

	if (!taskCardsEnabled) {
		return ""
	}

	return `====

TASK CARD MANAGEMENT

⚠️ CRITICAL: ALWAYS CREATE A TASK CARD BEFORE STARTING IMPLEMENTATION ⚠️

The task card is ESSENTIAL for tracking progress and maintaining context. You MUST create it at the beginning of each task:

1. INITIAL SETUP - For ALL tasks:
   - IMMEDIATELY create a task card when a new implementation or coding task begins
   - Use update_task_card tool to establish the initial card BEFORE any code changes
   - First identify the core task from the user's initial message
   - Start with minimal information: task title and a brief description
   - Add initial steps focused on information gathering (reading files, searching code, asking questions)
   - Update the task card as you learn more about the project

2. INFORMATION GATHERING:
   - Use read_file, search_files, and other tools to understand the codebase
   - Add what you learn to the context field
   - Ask clarifying questions when needed instead of making assumptions
   - Gradually refine the task description and steps as your understanding improves

3. PROGRESSIVE UPDATES - Use update_task_card regularly:
   - Start with broad investigative steps, then refine into specific implementation steps
   - Mark steps as "in_progress" when working on them
   - Mark steps as "completed" when finished
   - Add step comments to document key findings or decisions
   - Add notes for important observations
   - Add new context items as you discover relevant information

4. SUBTASKS - For large or complex steps:
   - When a step should be implemented as a separate subtask, use the new_task tool
   - Include the parent_step_number parameter to specify which step this subtask is for
   - Example: <new_task><mode>code</mode><message>Implement feature X (include context if needed)</message><parent_step_number>3</parent_step_number></new_task>
   - The parent task card will be automatically updated with the subtask ID
   - When a subtask completes:
     * Its task card status is automatically updated to "completed"
     * The task card content is returned to the parent task in the completion message
     * This provides continuity and context between parent and child tasks
     * The parent task can then continue with the knowledge from the subtask

5. JSON FORMATTING - Careful attention required:
   - Ensure valid JSON when updating task cards
   - Do not include any metadata fields - they are handled automatically
   - Use double quotes for all strings and property names
   - Escape special characters in strings using backslashes
   - Especially escape any double quotes within strings using \\"
   - If you encounter JSON errors, simplify your content and try again

6. RETRIEVE AND REFERENCE - Use get_task_card to check current state

7. PROGRESS TRACKING:
   - Individual step status values can be "planned", "in_progress", or "completed"
   - Step comments document important details about each step's execution

❗ IMPORTANT: Creating a task card is NOT optional. It must be done for ALL implementation tasks to ensure proper tracking and continuity across sessions. Without a task card, important context will be lost.

Remember: Build the task card incrementally. Prioritize accuracy over completeness - it's better to have a partially complete but accurate task card than one filled with guesses or hallucinated details. The task card serves as a persistent memory, ensuring continuity across sessions.
`
}
