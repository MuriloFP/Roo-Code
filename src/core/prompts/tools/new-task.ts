import { ToolArgs } from "./types"

export function getNewTaskDescription(args: ToolArgs): string {
	return `## new_task
Description: Create a new task with a specified starting mode and initial message. This tool instructs the system to create a new Cline instance in the given mode with the provided message.

Parameters:
- mode: (required) The slug of the mode to start the new task in (e.g., "code", "ask", "architect").
- message: (required) The initial user message or instructions for this new task.
- parent_step_number: (optional) If this is a subtask, the step number in the parent task that this subtask is for. This creates a parent-child relationship between tasks.

Usage:
<new_task>
<mode>your-mode-slug-here</mode>
<message>Your initial instructions here</message>
<parent_step_number>step-number</parent_step_number> <!-- Optional -->
</new_task>

Example:
<new_task>
<mode>code</mode>
<message>Implement a new feature for the application.</message>
</new_task>

Example with parent_step_number:
<new_task>
<mode>code</mode>
<message>Implement the database schema for this feature.</message>
<parent_step_number>3</parent_step_number>
</new_task>
`
}
