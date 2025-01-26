# RooCode External API Documentation

## Overview

The RooCode External API enables programmatic control of RooCode through a REST API. This allows automation of RooCode interactions and integration with other tools.

## Configuration

Enable and configure the external API through VSCode settings:

- `roo-cline.externalApi.enabled`: Enable/disable the API server (default: false)
- `roo-cline.externalApi.port`: Set the server port (default: 3000)
- `roo-cline.externalApi.allowedHosts`: List of allowed CORS origins (empty = all allowed)

## Security

The API server implements CORS protection. Only requests from allowed origins (configured in settings) are accepted.

## API Endpoints

### Custom Instructions

#### GET /api/instructions

Retrieves the current custom instructions.

**Response Format:**

```json
{
    "instructions": string | undefined
}
```

The response includes instructions from multiple sources, combined in the following order:

1. Language Preference (if specified)
2. Global Instructions (set via API)
3. Mode-specific Instructions (from mode configuration)
4. Rules (from `.clinerules` files)

**Example Response:**

```json
{
	"instructions": "Language Preference:\nYou should always speak and think in English.\n\nGlobal Instructions:\nAlways use TypeScript instead of JavaScript\nFollow the Google Style Guide\n\nMode-specific Instructions:\nIn code mode, focus on clean architecture..."
}
```

**Error Response (500):**

```json
{
	"error": "Failed to get instructions"
}
```

#### POST /api/instructions

Sets or updates the global instructions. These are distinct from mode-specific instructions and rules, which are managed separately through RooCode's UI and configuration files.

**Request Format:**

```json
{
    "instructions": string
}
```

**Important Notes:**

- This endpoint ONLY sets the GLOBAL instructions
- Mode-specific instructions are managed through RooCode's UI
- Rules are managed through `.clinerules` files
- Global instructions are combined with other instruction sources when RooCode processes them
- Empty string or undefined clears the global instructions only
- Instructions can include natural language, multiple paragraphs, and formatting preferences

**Example Request:**

```json
{
	"instructions": "Always use TypeScript instead of JavaScript\nFollow the Google Style Guide\nInclude detailed comments for complex functions"
}
```

**Example Response (200):**

```json
{
	"message": "Global instructions updated successfully"
}
```

**Error Response (400):**

```json
{
	"error": "Invalid instructions format"
}
```

### Mode Management

#### GET /api/modes

Lists all available modes in RooCode.

**Response Format:**

```json
{
    "modes": [
        {
            "slug": string,
            "name": string,
            "roleDefinition": string,
            "customInstructions": string | undefined,
            "groups": string[]
        }
    ]
}
```

#### GET /api/modes/current

Gets the currently active mode.

**Response Format:**

```json
{
    "mode": {
        "slug": string,
        "name": string,
        "roleDefinition": string,
        "customInstructions": string | undefined,
        "groups": string[]
    }
}
```

#### POST /api/modes/switch

Switches to a different mode.

**Request Format:**

```json
{
    "mode": string  // mode slug
}
```

### Profile Management

#### GET /api/profiles

Lists all available configuration profiles.

**Response Format:**

```json
{
    "profiles": [
        {
            "id": string,
            "name": string,
            "configuration": object
        }
    ]
}
```

#### GET /api/profiles/current

Gets the currently active profile configuration.

**Response Format:**

```json
{
    "profile": {
        "id": string,
        "name": string,
        "configuration": object
    }
}
```

#### POST /api/profiles/switch

Switches to a different profile.

**Request Format:**

```json
{
    "profile": string  // profile id
}
```

### Tasks

#### POST /api/tasks

Start a new task with extended configuration options.

**Request Format:**

```json
{
    "message": string,              // Optional: Initial message
    "images": string[],            // Optional: Array of image data URIs
    "mode": string,                // Optional: Mode to use for this task
    "model": string,               // Optional: AI model to use
    "prompt": string,              // Optional: Custom prompt for this task
    "wait_for_completion": boolean, // Optional: Wait for task completion
    "auto_approve": boolean        // Optional: Auto-approve actions
}
```

**Response Format (wait_for_completion=false):**

```json
{
    "task_id": string,
    "message": "Task started successfully"
}
```

**Response Format (wait_for_completion=true):**

```json
{
    "task_id": string,
    "status": "completed" | "waiting_for_approval" | "error",
    "response": string,
    "requires_approval": {
        "type": string,
        "action": object
    } | null
}
```

#### GET /api/tasks/current/status

Get the status and response of the current task.

**Response Format:**

```json
{
    "task_id": string,
    "status": "in_progress" | "completed" | "waiting_for_approval" | "error",
    "response": string | null,
    "requires_approval": {
        "type": string,
        "action": object
    } | null
}
```

#### GET /api/tasks/current/log

Get the conversation log for the current task.

**Response Format:**

```json
{
    "task_id": string,
    "messages": [
        {
            "type": "user" | "assistant",
            "content": string,
            "timestamp": string,
            "images": string[] | null
        }
    ]
}
```

#### GET /api/tasks/:taskId/log

Get the conversation log for a specific task.

**Response Format:** Same as current task log

#### GET /api/tasks

List task history with timestamps and conversation previews.

**Response Format:**

```json
{
    "tasks": [
        {
            "id": string,
            "index": number,        // 1 is most recent
            "timestamp": string,
            "preview": string,      // Start of conversation
            "status": "completed" | "in_progress" | "error"
        }
    ]
}
```

### MCP Management

#### GET /api/mcps

List all available MCPs and their status.

**Response Format:**

```json
{
    "mcps": [
        {
            "id": string,
            "name": string,
            "status": "enabled" | "disabled",
            "isRunning": boolean
        }
    ]
}
```

#### POST /api/mcps/:mcpId/toggle

Enable or disable a specific MCP.

**Request Format:**

```json
{
    "enabled": boolean
}
```

## Best Practices

1. Always check if the API server is running before making requests
2. Handle error responses appropriately
3. Consider rate limiting for automated interactions
4. Use appropriate error handling in your client code

## Example Usage

Here's a simple Python script demonstrating API usage:

```python
import requests

# API Configuration
API_URL = "http://localhost:3002"

def test_connection():
    try:
        response = requests.get(f"{API_URL}/api/instructions")
        response.raise_for_status()
        print("API server is accessible")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Error: Could not connect to {API_URL}")
        print("Please check that:")
        print("1. RooCode's External API is enabled in settings")
        print("2. The port number matches your configuration")
        print("3. RooCode is running and the API server has started")
        return False

def start_new_task(message=None):
    if message:
        response = requests.post(f"{API_URL}/api/tasks", json={"message": message})
        response.raise_for_status()
        print("Task started successfully!")

def send_message(message):
    response = requests.post(f"{API_URL}/api/messages", json={"message": message})
    response.raise_for_status()
    print("Message sent successfully!")

def main():
    print(f"Testing connection to {API_URL}...")
    if test_connection():
        start_new_task("Hello!")

if __name__ == "__main__":
    main()
```
