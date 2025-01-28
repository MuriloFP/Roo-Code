# RooCode External API Server - Developer Documentation

## Architecture Overview

The External API Server is implemented as an Express.js application that provides HTTP endpoints for programmatic control of RooCode features. The server is designed to be extensible and maintainable, with clear separation of concerns.

### Core Components

1. **ExternalApiServer Class** (`src/api/server/index.ts`)

    - Main server implementation using Express.js
    - Handles route setup and middleware configuration
    - Manages CORS and request validation
    - Receives ClineAPI instance in constructor for direct access to RooCode functionality

2. **ClineAPI Integration**

    - Acts as the bridge between HTTP endpoints and RooCode's core functionality
    - Provided through constructor injection to ExternalApiServer
    - Key methods exposed:
        - `setCustomInstructions`: Updates AI assistant behavior
        - `getCustomInstructions`: Retrieves current instructions
        - `startNewTask`: Initiates a new conversation
        - `sendMessage`: Sends messages to current task
        - `pressPrimaryButton`/`pressSecondaryButton`: Handles task approvals/rejections
    - Accesses global state through `sidebarProvider`:
        - Task history management
        - Configuration settings
        - Mode and profile management
        - MCP server integration

3. **Configuration Management**

    - CORS settings with configurable allowed hosts
    - Port configuration (default: 3000)
    - Auto-approve settings
    - MCP integration settings

4. **State Management**

    - Utilizes ClineProvider's global state for persistence
    - Manages:
        - Task history and messages
        - Custom instructions
        - Mode and profile configurations
        - Auto-approve settings
        - MCP server states
    - File-based storage for task messages and logs

5. **Integration Points**
    - VSCode Extension API: Connects to VSCode's extension ecosystem
    - ClineProvider: Manages webview and state persistence
    - API Handler: Processes AI model interactions
    - MCP Hub: Manages external tool integrations

## Implementation Details

### Server Initialization

The ExternalApiServer is initialized with a ClineAPI instance and configuration options:

```typescript
export class ExternalApiServer {
	private app: express.Express
	private server: http.Server | null = null
	private config: ExternalApiServerConfig
	private clineApi: ClineAPI

	constructor(config: ExternalApiServerConfig, clineApi: ClineAPI) {
		this.config = config
		this.clineApi = clineApi
		this.app = express()
		this.setupMiddleware()
		this.setupRoutes()
	}
}
```

The ClineAPI instance provides direct access to RooCode's core functionality:

1. **Task Management**

    ```typescript
    // Start a new task
    await this.clineApi.startNewTask(message, images)

    // Send a message to current task
    await this.clineApi.sendMessage(message, images)

    // Get task data
    const taskHistory = await this.clineApi.sidebarProvider.getGlobalState("taskHistory")
    const taskData = await this.clineApi.sidebarProvider.getTaskWithId(taskId)
    ```

2. **Configuration Management**

    ```typescript
    // Access and update settings
    await this.clineApi.sidebarProvider.updateGlobalState("autoApprovalEnabled", true)
    await this.clineApi.sidebarProvider.postStateToWebview()

    // Handle mode switching
    await this.clineApi.sidebarProvider.handleModeSwitch(mode)
    ```

3. **MCP Integration**
    ```typescript
    // Access MCP Hub
    const mcpHub = this.clineApi.sidebarProvider.mcpHub
    const servers = mcpHub?.getServers()
    ```

### Middleware Setup

1. **CORS Configuration**

    - Validates origin against allowedHosts
    - Defaults to localhost-only if no hosts specified
    - Supports same-origin requests
    - Allows any port on allowed hosts

2. **Request Parsing**
    - JSON body parsing
    - URL-encoded data handling
    - File upload handling for images

### State Management

The server interacts with several state management systems:

1. **Task State**

    - Stored in task history
    - Includes messages, status, and metadata
    - Persisted to disk for reliability

2. **Configuration State**

    - Mode settings
    - Profile configurations
    - Auto-approve settings
    - Custom instructions

3. **MCP State**
    - Server status tracking
    - Tool configurations
    - Connection management

### Key Implementation Patterns

1. **Task Response Polling**

    ```typescript
    async function pollForTaskResponse(taskId: string, afterTimestamp?: number): Promise<TaskResponse> {
    	let attempts = 0
    	const maxAttempts = 120 // 2 minutes timeout

    	while (attempts < maxAttempts) {
    		// Check task status
    		// Return if terminal state reached
    		// Wait 1 second between attempts
    	}
    }
    ```

2. **Error Handling**

    - Consistent error response format
    - Proper HTTP status codes
    - Detailed error messages
    - Error logging for debugging

3. **Request Validation**
    - Type checking for parameters
    - Required field validation
    - Format validation for specific fields

## Extension Points

### Adding New Endpoints

1. Add route definition in `setupRoutes()`
2. Implement request validation
3. Add error handling
4. Update API documentation
5. Add tests in `__tests__/index.test.ts`

Example:

```typescript
this.app.post("/api/new-endpoint", async (req, res) => {
	try {
		// Validate request
		const { param } = req.body
		if (typeof param !== "string") {
			return res.status(400).json({
				error: "Invalid parameter format",
			})
		}

		// Implement functionality
		const result = await this.clineApi.newFunction(param)

		// Return response
		return res.json({ success: true, data: result })
	} catch (error) {
		console.error("Error in new endpoint:", error)
		return res.status(500).json({
			error: "Failed to process request",
		})
	}
})
```

### Adding New Features

1. **Extend ClineApi**

    - Add new methods for feature functionality
    - Update type definitions
    - Add error handling

2. **Update Configuration**

    - Add new configuration options if needed
    - Update validation
    - Add migration if necessary

3. **Add Tests**
    - Unit tests for new functionality
    - Integration tests for API endpoints
    - Error case coverage

## Testing

### Test Structure

1. **Unit Tests**

    - Individual endpoint testing
    - Request validation
    - Error handling
    - State management

2. **Integration Tests**
    - End-to-end workflow testing
    - Cross-endpoint interactions
    - File system operations
    - MCP interactions

### Test Utilities

1. **Mock ClineApi**

    - Simulates RooCode core functionality
    - Controlled test environment
    - Predictable responses

2. **Request Helper**
    ```typescript
    async function retryRequest({ port, method, path, body }: RequestConfig): Promise<Response> {
    	// Handles test server startup timing
    	// Retries failed connections
    	// Returns parsed response
    }
    ```

## Best Practices

1. **Code Organization**

    - Keep route handlers concise
    - Extract common functionality
    - Use TypeScript types for validation
    - Document complex logic

2. **Error Handling**

    - Use specific error types
    - Include helpful error messages
    - Log errors with context
    - Return appropriate status codes

3. **Security**

    - Validate all inputs
    - Use CORS protection
    - Implement rate limiting
    - Avoid exposing internal details

4. **Performance**
    - Minimize blocking operations
    - Use async/await properly
    - Implement timeouts
    - Cache when appropriate

## Common Issues and Solutions

1. **Task Status Updates**

    - Problem: Task status not updating
    - Solution: Check file system permissions and polling logic

2. **CORS Errors**

    - Problem: Requests blocked by CORS
    - Solution: Verify allowedHosts configuration and origin header

3. **File System Operations**

    - Problem: File access errors
    - Solution: Check paths and permissions, use proper error handling

4. **Memory Management**
    - Problem: Memory leaks in long-running operations
    - Solution: Implement proper cleanup and timeout handling

## Future Considerations

1. **Scalability**

    - Consider implementing clustering
    - Add request queuing
    - Implement caching layer

2. **Security**

    - Add authentication system
    - Implement rate limiting
    - Add request logging

3. **Monitoring**

    - Add performance metrics
    - Implement health checks
    - Add detailed logging

4. **API Evolution**
    - Version management
    - Deprecation strategy
    - Backward compatibility
