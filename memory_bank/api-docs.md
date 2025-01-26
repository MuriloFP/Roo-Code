# RooCode External API Documentation

## Overview

The RooCode External API allows programmatic control of RooCode features through a REST API. This enables external applications to interact with RooCode, manage custom instructions, create tasks, and send messages.

## Configuration

The API server can be configured through VSCode settings:

```json
{
	"roo-cline.externalApi.enabled": false, // Enable/disable the API server
	"roo-cline.externalApi.port": 3000, // Port number for the server
	"roo-cline.externalApi.allowedHosts": [] // CORS allowed origins (empty = all allowed)
}
```

## Security

- The API server implements CORS protection
- Only configured origins are allowed to make requests
- Empty `allowedHosts` list allows all origins (use with caution)

## API Endpoints

### Get Custom Instructions

Retrieves the current custom instructions.

```
GET /api/instructions

Response 200:
{
    "instructions": string
}

Response 500:
{
    "error": "Failed to get instructions"
}
```

### Set Custom Instructions

Updates the custom instructions.

```
POST /api/instructions

Request:
{
    "instructions": string
}

Response 200:
{
    "success": true
}

Response 400:
{
    "error": "Invalid instructions format"
}

Response 500:
{
    "error": "Failed to set instructions"
}
```

### Start New Task

Creates a new task with optional message and images.

```
POST /api/tasks

Request:
{
    "message": string (optional),
    "images": string[] (optional)
}

Response 200:
{
    "success": true
}

Response 400:
{
    "error": "Invalid message format" | "Invalid images format"
}

Response 500:
{
    "error": "Failed to start task"
}
```

### Send Message

Sends a message to the current task with optional images.

```
POST /api/messages

Request:
{
    "message": string (optional),
    "images": string[] (optional)
}

Response 200:
{
    "success": true
}

Response 400:
{
    "error": "Invalid message format" | "Invalid images format"
}

Response 500:
{
    "error": "Failed to send message"
}
```

## Error Handling

All endpoints follow a consistent error response format:

```json
{
    "error": string
}
```

Common HTTP status codes:

- 200: Success
- 400: Invalid request format
- 403: CORS origin not allowed
- 500: Internal server error

## Example Usage

### JavaScript/TypeScript

```typescript
// Start a new task
await fetch("http://localhost:3000/api/tasks", {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		message: "Create a new React component",
		images: [],
	}),
})

// Send a follow-up message
await fetch("http://localhost:3000/api/messages", {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		message: "Make it responsive",
	}),
})
```

### cURL

```bash
# Get custom instructions
curl http://localhost:3000/api/instructions

# Set custom instructions
curl -X POST http://localhost:3000/api/instructions \
    -H "Content-Type: application/json" \
    -d '{"instructions":"Always use TypeScript"}'

# Start new task
curl -X POST http://localhost:3000/api/tasks \
    -H "Content-Type: application/json" \
    -d '{"message":"Create a new API endpoint"}'
```

## Best Practices

1. **Error Handling**: Always handle potential errors in responses
2. **CORS Security**: Configure `allowedHosts` in production environments
3. **Message Format**: Provide clear, specific messages for tasks
4. **Image Support**: Ensure image URLs are accessible to RooCode
5. **Rate Limiting**: Consider implementing client-side rate limiting
