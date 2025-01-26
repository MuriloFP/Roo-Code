# RooCode External API Documentation

## Overview

The RooCode External API provides HTTP endpoints for interacting with RooCode from external applications. The API follows RESTful principles and uses JSON for request and response bodies.

## Base URL

The API server runs locally on a configurable port. The default base URL is:

```
http://localhost:<port>/api
```

## Authentication

Currently, the API uses CORS for security. Only requests from allowed origins will be accepted.

## Common Response Formats

### Success Response

```json
{
    "success": true,
    "data": <response_data>
}
```

### Error Response

```json
{
	"error": "Error message describing what went wrong"
}
```

## Endpoints

### Instructions

#### GET /api/instructions

Retrieve current custom instructions.

**Response**

```json
{
	"instructions": "string"
}
```

#### POST /api/instructions

Set custom instructions.

**Request Body**

```json
{
	"instructions": "string"
}
```

**Response**

```json
{
	"success": true
}
```

### Tasks

#### POST /api/tasks

Start a new task.

**Request Body**

```json
{
    "message": "string",
    "images": ["string"],
    "mode": "string" (optional),
    "profile": "string" (optional),
    "timeout": number (optional, default: 300000),
    "auto_approve": boolean (optional, default: false),
    "wait_for_completion": boolean (optional, default: false)
}
```

**Response**

```json
{
	"success": true,
	"task_id": "string"
}
```

### Messages

#### POST /api/messages

Send a message in the current task.

**Request Body**

```json
{
	"message": "string",
	"images": ["string"]
}
```

**Response**

```json
{
	"success": true
}
```

### Modes

#### GET /api/modes

List all available modes (built-in and custom).

**Response**

```json
{
	"builtIn": [
		{
			"slug": "string",
			"name": "string",
			"roleDefinition": "string",
			"groups": ["string"]
		}
	],
	"custom": [
		{
			"slug": "string",
			"name": "string",
			"roleDefinition": "string",
			"customInstructions": "string",
			"groups": ["string"]
		}
	]
}
```

#### GET /api/modes/current

Get the currently active mode.

**Response**

```json
{
	"slug": "string",
	"name": "string",
	"roleDefinition": "string",
	"customInstructions": "string",
	"groups": ["string"]
}
```

#### POST /api/modes/switch

Switch to a different mode.

**Request Body**

```json
{
	"mode": "string"
}
```

**Response**

```json
{
	"message": "Mode switched successfully"
}
```

### Profiles

#### GET /api/profiles

List all available configuration profiles.

**Response**

```json
[
	{
		"name": "string",
		"id": "string",
		"apiProvider": "string"
	}
]
```

**Example Response**

```json
[
	{
		"name": "default",
		"id": "default-id",
		"apiProvider": "anthropic"
	},
	{
		"name": "openai",
		"id": "openai-id",
		"apiProvider": "openai"
	}
]
```

#### GET /api/profiles/current

Get the currently active profile configuration.

**Response**

```json
{
	"name": "string",
	"id": "string",
	"apiProvider": "string"
}
```

**Example Response**

```json
{
	"name": "default",
	"id": "default-id",
	"apiProvider": "anthropic"
}
```

#### POST /api/profiles/switch

Switch to a different profile.

**Request Body**

```json
{
	"name": "string"
}
```

**Response**

```json
{
	"message": "Switched to profile '{name}'"
}
```

**Example**

```bash
curl -X POST http://localhost:3000/api/profiles/switch \
    -H "Content-Type: application/json" \
    -d '{"name": "openai"}'
```

## Error Codes

- `400` Bad Request - Invalid input
- `403` Forbidden - CORS validation failed
- `404` Not Found - Resource not found
- `500` Internal Server Error - Server error

## Rate Limiting

Currently, no rate limiting is implemented. This may change in future versions.

## Websocket Support

Real-time updates via WebSocket are planned for future implementation.
