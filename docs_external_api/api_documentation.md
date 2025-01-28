# RooCode External API Documentation

## Overview

The RooCode External API Server provides HTTP endpoints for programmatically interacting with RooCode features. It enables external applications to control RooCode functionality through a REST API.

### Base URL

By default, the server runs on `http://localhost:3000`. The host and port can be configured through the RooCode settings.
![image](https://github.com/user-attachments/assets/bf53901a-3c1a-45f5-8c09-4b023066aa40)

### Authentication

The API uses CORS (Cross-Origin Resource Sharing) for access control. By default, only localhost origins are allowed. Additional origins can be configured through the RooCode settings.
![image](https://github.com/user-attachments/assets/49b9112d-b452-4abd-81ce-349853bee261)


### Response Format

All responses are in JSON format. Successful responses typically include either a `success: true` field or the requested data. Error responses include an `error` field with a description of what went wrong.

### Common HTTP Status Codes

- 200: Success
- 400: Bad Request (invalid parameters)
- 404: Not Found (resource doesn't exist)
- 500: Internal Server Error

## Task Management

### Create New Task

Creates a new task and optionally waits for its completion.

**Endpoint:** `POST /api/tasks`

**Request Body:**

```json
{
    "message": string,           // Required: The task message/prompt
    "images": string[],         // Optional: Array of image paths
    "mode": string,            // Optional: Mode to switch to before starting task
    "profile": string,         // Optional: Profile to switch to before starting task
    "wait_for_response": boolean // Optional: Whether to wait for task completion (default: false)
}
```

**Response:**

- If `wait_for_response` is `false`:

```json
{
    "success": true,
    "id": string       // The ID of the created task
}
```

- If `wait_for_response` is `true`:

```json
{
    "id": string,      // The ID of the task
    "messages": [      // Array of messages from the task
        {
            "type": string,    // Message type (e.g., "say", "ask")
            "text": string,    // Message content
            "ts": number      // Timestamp
        }
    ],
    "lastMessage": string,  // The most recent message
    "status": string       // Task status (e.g., "completed", "error", "needs_input")
}
```

**Example:**

```python
import requests

# Create a task and wait for response
response = requests.post("http://localhost:3002/api/tasks", json={
    "message": "Create a new Python file that prints 'Hello World'",
    "wait_for_response": True
})

if response.status_code == 200:
    result = response.json()
    print(f"Task {result['id']} status: {result['status']}")
    print(f"Last message: {result['lastMessage']}")
```

### Get Task Status

Retrieves the status of a task.

**Endpoint:** `GET /api/tasks/status` (current task)  
**Endpoint:** `GET /api/tasks/:id/status` (specific task)

**Response:**

```json
{
    "id": string,           // Task ID
    "lastMessage": string,  // Most recent message
    "status": string       // Task status
}
```

**Possible Status Values:**

- `waiting_for_response`: Task is waiting for AI response
- `in_progress`: Task is being processed
- `completed`: Task has finished successfully
- `error`: Task encountered an error
- `needs_input`: Task requires user input
- `needs_approval`: Task requires user approval

**Example:**

```python
import requests

# Get status of a specific task
task_id = "task-123"
response = requests.get(f"http://localhost:3002/api/tasks/{task_id}/status")

if response.status_code == 200:
    status = response.json()
    print(f"Task status: {status['status']}")
    print(f"Last message: {status['lastMessage']}")
```

### Get Task Logs

Retrieves the complete message history and API conversation for a task.

**Endpoint:** `GET /api/tasks/logs` (current task)  
**Endpoint:** `GET /api/tasks/:id/logs` (specific task)

**Response:**

```json
{
    "id": string,           // Task ID
    "messages": [           // Array of UI messages
        {
            "type": string,    // Message type
            "text": string,    // Message content
            "ts": number      // Timestamp
        }
    ],
    "apiConversation": [    // Array of API messages
        // API-specific message format
    ]
}
```

**Example:**

```python
import requests

# Get logs for the current task
response = requests.get("http://localhost:3002/api/tasks/logs")

if response.status_code == 200:
    logs = response.json()
    print(f"Number of messages: {len(logs['messages'])}")
    for msg in logs['messages']:
        print(f"{msg['type']}: {msg['text']}")
```

### List Tasks

Retrieves a list of recent tasks with metadata.

**Endpoint:** `GET /api/tasks`

**Query Parameters:**

- `limit`: Maximum number of tasks to return (default: 10)

**Response:**

```json
[
    {
        "id": string,           // Task ID
        "message": string,      // Initial task message
        "timestamp": number,    // Creation timestamp
        "tokensIn": number,    // Input tokens used
        "tokensOut": number,   // Output tokens generated
        "cost": number         // Total cost of the task
    }
]
```

**Example:**

```python
import requests

# Get last 5 tasks
response = requests.get("http://localhost:3002/api/tasks?limit=5")

if response.status_code == 200:
    tasks = response.json()
    for task in tasks:
        print(f"Task {task['id']}: {task['message']}")
        print(f"Cost: ${task['cost']}")
```

### Respond to Task Action

Approves or rejects a task action that requires user input.

**Endpoint:** `POST /api/tasks/respond` (current task)  
**Endpoint:** `POST /api/tasks/:id/respond` (specific task)

**Request Body:**

```json
{
    "response": string,     // Required: "approve" or "reject"
    "wait_for_response": boolean  // Optional: Whether to wait for next response (default: false)
}
```

**Response:**

- If `wait_for_response` is `false`:

```json
{
	"success": true
}
```

- If `wait_for_response` is `true`:

```json
{
    "id": string,      // Task ID
    "messages": [      // New messages since response
        {
            "type": string,
            "text": string,
            "ts": number
        }
    ],
    "lastMessage": string,  // Most recent message
    "status": string       // Current task status
}
```

**Example:**

```python
import requests

# Approve current task action and wait for response
response = requests.post("http://localhost:3002/api/tasks/respond", json={
    "response": "approve",
    "wait_for_response": True
})

if response.status_code == 200:
    result = response.json()
    print(f"New status: {result['status']}")
    print(f"Response: {result['lastMessage']}")
```

## Message Handling

### Send Message to Current Task

Sends a message to the currently active task.

**Endpoint:** `POST /api/messages`

**Request Body:**

```json
{
    "message": string,           // Required: The message to send
    "images": string[],         // Optional: Array of image paths
    "wait_for_response": boolean // Optional: Whether to wait for response (default: false)
}
```

**Response:**

- If `wait_for_response` is `false`:

```json
{
	"success": true
}
```

- If `wait_for_response` is `true`:

```json
{
    "id": string,      // Task ID
    "messages": [      // New messages since sending
        {
            "type": string,    // Message type (e.g., "say", "ask")
            "text": string,    // Message content
            "ts": number      // Timestamp
        }
    ],
    "lastMessage": string,  // Most recent message
    "status": string       // Current task status
}
```

**Example:**

```python
import requests

# Send a message and wait for response
response = requests.post("http://localhost:3002/api/messages", json={
    "message": "What changes did you make?",
    "wait_for_response": True
})

if response.status_code == 200:
    result = response.json()
    print(f"Status: {result['status']}")
    print(f"Response: {result['lastMessage']}")
```

### Send Message to Specific Task

Sends a message to a specific task identified by its ID.

**Endpoint:** `POST /api/messages/:id`

**URL Parameters:**

- `id`: The ID of the task to send the message to

**Request Body:**

```json
{
    "message": string,           // Required: The message to send
    "images": string[],         // Optional: Array of image paths
    "wait_for_response": boolean // Optional: Whether to wait for response (default: false)
}
```

**Response:**

- If `wait_for_response` is `false`:

```json
{
	"success": true
}
```

- If `wait_for_response` is `true`:

```json
{
    "id": string,      // Task ID
    "messages": [      // New messages since sending
        {
            "type": string,    // Message type
            "text": string,    // Message content
            "ts": number      // Timestamp
        }
    ],
    "lastMessage": string,  // Most recent message
    "status": string       // Current task status
}
```

**Example:**

```python
import requests

# Send a message to a specific task
task_id = "task-123"
response = requests.post(f"http://localhost:3002/api/messages/{task_id}", json={
    "message": "Please continue with the changes",
    "wait_for_response": True
})

if response.status_code == 200:
    result = response.json()
    print(f"Status: {result['status']}")
    for msg in result['messages']:
        print(f"{msg['type']}: {msg['text']}")
```

**Error Responses:**

- 400: Invalid message format or invalid images format
- 404: Task not found or no active task
- 500: Failed to send message

**Notes:**

- When sending a message to the current task (`POST /api/messages`), there must be an active task. If no task exists, a 404 error will be returned.
- When sending a message to a specific task (`POST /api/messages/:id`), the task must exist and be accessible.
- If `wait_for_response` is `true`, the API will wait for the AI to process the message and return the response. This can take several seconds.
- The response includes all messages that occurred after sending the message, allowing you to see the complete conversation flow.

## Mode Management

RooCode supports both built-in and custom modes that define the capabilities and behavior of the AI assistant. The following endpoints allow you to manage these modes.

### List All Modes

Retrieves all available modes, including both built-in and custom modes.

**Endpoint**: `GET /api/modes`

**Response Format**:

```json
{
	"builtIn": [
		{
			"slug": "code",
			"name": "Code",
			"roleDefinition": "You are Roo, a highly skilled software engineer...",
			"groups": ["read", "edit", "browser", "command", "mcp"]
		}
		// ... other built-in modes
	],
	"custom": [
		{
			"slug": "custom-mode",
			"name": "Custom Mode",
			"roleDefinition": "A custom mode for testing",
			"customInstructions": "Custom instructions",
			"groups": ["read"]
		}
		// ... other custom modes
	]
}
```

**Error Responses**:

- `500`: Failed to get modes

### Get Current Mode

Retrieves the currently active mode.

**Endpoint**: `GET /api/modes/current`

**Response Format**:

```json
{
	"slug": "code",
	"name": "Code",
	"roleDefinition": "You are Roo, a highly skilled software engineer...",
	"groups": ["read", "edit", "browser", "command", "mcp"]
}
```

**Error Responses**:

- `404`: Current mode not found
- `500`: Failed to get current mode

### Switch Mode

Switches to a specified mode.

**Endpoint**: `POST /api/modes/switch`

**Request Body**:

```json
{
	"mode": "code" // The slug of the target mode
}
```

**Response Format**:

```json
{
	"message": "Mode switched successfully"
}
```

**Error Responses**:

- `400`: Mode must be a string
- `404`: Mode not found
- `500`: Failed to switch mode

### Example Usage (Python)

```python
import requests

API_BASE_URL = "http://localhost:3002/api"

def list_modes():
    """List all available modes (built-in and custom)."""
    url = f"{API_BASE_URL}/modes"
    response = requests.get(url)
    return response.json()

def get_current_mode():
    """Get the currently active mode."""
    url = f"{API_BASE_URL}/modes/current"
    response = requests.get(url)
    return response.json()

def switch_mode(mode_slug):
    """Switch to a different mode."""
    url = f"{API_BASE_URL}/modes/switch"
    payload = {"mode": mode_slug}
    response = requests.post(url, json=payload)
    return response.json()

# Example usage
modes = list_modes()
print("Available modes:", modes)

current_mode = get_current_mode()
print("Current mode:", current_mode)

# Switch to architect mode
result = switch_mode("architect")
print("Switch result:", result)
```

### Notes

- Built-in modes include "code", "architect", and "ask", each with predefined capabilities
- Custom modes can be configured through the VSCode extension settings
- Mode switching may affect available tools and AI behavior
- When switching modes, any associated configuration profiles will be automatically applied

## Profile Management

RooCode supports configuration profiles that define API settings and preferences. The following endpoints allow you to manage these profiles.

### List All Profiles

Retrieves all available configuration profiles.

**Endpoint**: `GET /api/profiles`

**Response Format**:

```json
[
	{
		"name": "default",
		"id": "default-id",
		"apiProvider": "anthropic"
	},
	{
		"name": "test",
		"id": "test-id",
		"apiProvider": "openai"
	}
]
```

**Error Responses**:

- `500`: Failed to list configs

### Get Current Profile

Retrieves the currently active configuration profile.

**Endpoint**: `GET /api/profiles/current`

**Response Format**:

```json
{
	"name": "default",
	"id": "default-id",
	"apiProvider": "anthropic"
}
```

**Error Responses**:

- `404`: Current profile not found
- `500`: Failed to get state

### Switch Profile

Switches to a specified configuration profile.

**Endpoint**: `POST /api/profiles/switch`

**Request Body**:

```json
{
	"name": "test" // The name of the target profile
}
```

**Response Format**:

```json
{
	"message": "Switched to profile 'test'"
}
```

**Error Responses**:

- `400`: Profile name is required
- `404`: Profile not found
- `500`: Failed to switch profile

### Example Usage (Python)

```python
import requests

API_BASE_URL = "http://localhost:3002/api"

def list_profiles():
    """List all available configuration profiles."""
    url = f"{API_BASE_URL}/profiles"
    response = requests.get(url)
    return response.json()

def get_current_profile():
    """Get the currently active profile."""
    url = f"{API_BASE_URL}/profiles/current"
    response = requests.get(url)
    return response.json()

def switch_profile(profile_name):
    """Switch to a different profile."""
    url = f"{API_BASE_URL}/profiles/switch"
    payload = {"name": profile_name}
    response = requests.post(url, json=payload)
    return response.json()

# Example usage
profiles = list_profiles()
print("Available profiles:", profiles)

current_profile = get_current_profile()
print("Current profile:", current_profile)

# Switch to a different profile
result = switch_profile("test")
print("Switch result:", result)
```

### Notes

- Profiles contain API provider settings and other configuration options
- Profile switching may affect API behavior and capabilities
- When switching modes, associated profiles may be automatically applied
- Profile names must be unique within the configuration
- The default profile is used if no specific profile is selected

## Auto-Approve Settings

RooCode supports automatic approval of various operations through configurable settings. These endpoints allow you to manage auto-approve settings globally.

### Get Auto-Approve Settings

Retrieves the current auto-approve settings.

**Endpoint**: `GET /api/auto-approve`

**Response Format**:

```json
{
    "autoApprovalEnabled": boolean,     // Master switch for auto-approval
    "alwaysAllowReadOnly": boolean,     // Auto-approve file read operations
    "alwaysAllowWrite": boolean,        // Auto-approve file write operations
    "alwaysAllowExecute": boolean,      // Auto-approve command execution
    "alwaysAllowBrowser": boolean,      // Auto-approve browser actions
    "alwaysAllowMcp": boolean,         // Auto-approve MCP operations
    "alwaysApproveResubmit": boolean   // Auto-approve request retries
}
```

**Error Responses**:

- `500`: Failed to get auto-approve settings

### Update Auto-Approve Settings

Updates the auto-approve settings. You can update any combination of settings.

**Endpoint**: `POST /api/auto-approve`

**Request Body**:

```json
{
    "autoApprovalEnabled": boolean,     // Optional: Master switch
    "alwaysAllowReadOnly": boolean,     // Optional: File read operations
    "alwaysAllowWrite": boolean,        // Optional: File write operations
    "alwaysAllowExecute": boolean,      // Optional: Command execution
    "alwaysAllowBrowser": boolean,      // Optional: Browser actions
    "alwaysAllowMcp": boolean,         // Optional: MCP operations
    "alwaysApproveResubmit": boolean   // Optional: Request retries
}
```

**Response Format**:

```json
{
	"success": true
}
```

**Error Responses**:

- `400`: Invalid setting value (must be boolean)
- `500`: Failed to update settings

### Toggle Master Auto-Approve Switch

Enables or disables the master auto-approve switch.

**Endpoint**: `POST /api/auto-approve/enabled`

**Request Body**:

```json
{
    "enabled": boolean  // Required: Whether to enable auto-approve
}
```

**Response Format**:

```json
{
	"success": true
}
```

**Error Responses**:

- `400`: enabled must be a boolean
- `500`: Failed to update setting

### Example Usage (Python)

```python
import requests

API_BASE_URL = "http://localhost:3002/api"

def get_auto_approve_settings():
    """Get current auto-approve settings."""
    url = f"{API_BASE_URL}/auto-approve"
    response = requests.get(url)
    return response.json()

def update_auto_approve_settings(settings):
    """Update auto-approve settings."""
    url = f"{API_BASE_URL}/auto-approve"
    response = requests.post(url, json=settings)
    return response.json()

def set_auto_approve_enabled(enabled):
    """Toggle the master auto-approve switch."""
    url = f"{API_BASE_URL}/auto-approve/enabled"
    payload = {"enabled": enabled}
    response = requests.post(url, json=payload)
    return response.json()

# Example usage
settings = get_auto_approve_settings()
print("Current settings:", settings)

# Update specific settings
new_settings = {
    "autoApprovalEnabled": True,
    "alwaysAllowReadOnly": True,
    "alwaysAllowWrite": False,
    "alwaysAllowExecute": False,
    "alwaysAllowBrowser": True,
    "alwaysAllowMcp": False,
    "alwaysApproveResubmit": True
}
result = update_auto_approve_settings(new_settings)
print("Update result:", result)

# Toggle master switch
result = set_auto_approve_enabled(False)
print("Toggle result:", result)
```

### Notes

- Auto-approve settings are global and affect all RooCode operations
- The master switch (`autoApprovalEnabled`) must be on for individual settings to take effect
- For security reasons, consider carefully which operations to auto-approve
- Changes to auto-approve settings take effect immediately
- Command execution auto-approval can be further configured with allowed command prefixes in VSCode settings

## MCP Management

MCP (Model Context Protocol) servers provide additional capabilities to RooCode through standardized interfaces. These endpoints allow you to manage MCP servers and their settings.

### List MCPs

Retrieves all configured MCP servers and their status.

**Endpoint**: `GET /api/mcps`

**Response Format**:

```json
[
    {
        "name": string,           // Server name
        "status": "active" | "inactive",
        "tools": [               // Available tools
            {
                "name": string,      // Tool name
                "description": string,
                "alwaysAllow": boolean
            }
        ]
    }
]
```

**Error Responses**:

- `500`: Failed to list MCPs

### Get MCP Details

Retrieves detailed information about a specific MCP server.

**Endpoint**: `GET /api/mcps/:id`

**URL Parameters**:

- `id`: The name of the MCP server

**Response Format**:

```json
{
    "name": string,           // Server name
    "status": "active" | "inactive",
    "tools": [               // Available tools
        {
            "name": string,      // Tool name
            "description": string,
            "alwaysAllow": boolean
        }
    ],
    "config": {             // Server configuration
        "port": number,
        "host": string,
        // ... other config options
    }
}
```

**Error Responses**:

- `404`: MCP not found
- `500`: Failed to get MCP details

### Enable/Disable MCP

Enables or disables a specific MCP server.

**Endpoint**: `POST /api/mcps/:id/status`

**URL Parameters**:

- `id`: The name of the MCP server

**Request Body**:

```json
{
    "enabled": boolean  // Required: Whether to enable the MCP
}
```

**Response Format**:

```json
{
	"success": true
}
```

**Error Responses**:

- `400`: enabled must be a boolean
- `404`: MCP not found
- `500`: Failed to update MCP status

### Example Usage (Python)

```python
import requests

API_BASE_URL = "http://localhost:3002/api"

def list_mcps():
    """List all MCP servers."""
    url = f"{API_BASE_URL}/mcps"
    response = requests.get(url)
    return response.json()

def get_mcp_details(mcp_name):
    """Get detailed information about an MCP server."""
    url = f"{API_BASE_URL}/mcps/{mcp_name}"
    response = requests.get(url)
    return response.json()

def set_mcp_enabled(mcp_name, enabled):
    """Enable or disable an MCP server."""
    url = f"{API_BASE_URL}/mcps/{mcp_name}/status"
    payload = {"enabled": enabled}
    response = requests.post(url, json=payload)
    return response.json()

# Example usage
mcps = list_mcps()
print("Available MCPs:", mcps)

# Get details for a specific MCP
mcp_details = get_mcp_details("spotify-mcp")
print("MCP details:", mcp_details)

# Enable an MCP
result = set_mcp_enabled("spotify-mcp", True)
print("Enable result:", result)
```

### Notes

- MCPs must be configured in RooCode settings before they can be managed through the API
- MCP servers run independently and may require additional setup or authentication
- The `alwaysAllow` setting for tools requires both the tool-specific setting and global MCP auto-approve to be enabled
- MCPs may have their own configuration requirements and limitations
- Some MCPs may require environment variables or authentication tokens to be set up

## Custom Instructions

RooCode allows you to set custom instructions that modify the behavior of the AI assistant. These instructions can be global (applied to all modes) or mode-specific.

### Get Custom Instructions

Retrieves the current custom instructions.

**Endpoint**: `GET /api/instructions`

**Response Format**:

```json
{
    "instructions": string  // The current custom instructions text
}
```

**Error Responses**:

- `500`: Failed to get instructions

### Set Custom Instructions

Updates the GLOBAL custom instructions.

**Endpoint**: `POST /api/instructions`

**Request Body**:

```json
{
    "instructions": string  // Required: The new instructions text
}
```

**Response Format**:

```json
{
	"success": true
}
```

**Error Responses**:

- `400`: Invalid instructions format (must be a string)
- `500`: Failed to set instructions

### Example Usage (Python)

```python
import requests

API_BASE_URL = "http://localhost:3002/api"

def get_custom_instructions():
    """Get current custom instructions."""
    url = f"{API_BASE_URL}/instructions"
    response = requests.get(url)
    return response.json()

def set_custom_instructions(instructions):
    """Set new custom instructions."""
    url = f"{API_BASE_URL}/instructions"
    payload = {"instructions": instructions}
    response = requests.post(url, json=payload)
    return response.json()

# Example usage
instructions = get_custom_instructions()
print("Current instructions:", instructions)

# Update instructions
new_instructions = """
Language Preference:
You should always speak and think in English.

Global Instructions:
1. Always provide detailed error messages
2. Use consistent code formatting
3. Follow the project's naming conventions
"""
result = set_custom_instructions(new_instructions)
print("Update result:", result)
```

### Notes

- Custom instructions are applied in addition to RooCode's built-in system prompt
- Instructions can include language preferences, coding standards, project-specific rules, etc.
- Changes to custom instructions take effect immediately for new tasks
- Instructions are stored per workspace and persist between sessions
- You can clear instructions by setting them to an empty string
- Mode-specific instructions (if set) are applied after global instructions
- Instructions can reference external rule files (`.clinerules` and `.clinerules-{mode}`)
