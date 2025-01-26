# System Architecture and Patterns

## Architecture Overview

The external API integration follows these key architectural patterns:

1. **Extension Integration**

    - Uses VSCode's extension API
    - Integrates with RooCode's existing architecture
    - Maintains separation of concerns

2. **API Server Pattern**

    ```
    [External Tools/MCPs] → [HTTP API Server] → [RooCode API] → [VSCode Extension]
    ```

    - Independent HTTP server per VSCode window
    - RESTful API design
    - Stateless request handling

3. **Configuration Management**
    - Uses VSCode's configuration system
    - Settings persisted per workspace
    - Real-time settings updates

## Key Technical Decisions

1. **Server Implementation**

    - Lightweight HTTP server (Express.js)
    - Port configuration per window
    - Graceful startup/shutdown

2. **API Design**

    - RESTful endpoints
    - JSON request/response format
    - Error handling with HTTP status codes

3. **Security Model**

    - User-controlled activation
    - Local-only by default
    - Optional authentication

4. **State Management**
    - Server state tied to VSCode window
    - Configuration changes trigger server updates
    - Clean shutdown on extension deactivation

## Integration Points

1. **RooCode Components**

    - ClineProvider: Task and UI management
    - Extension activation
    - Settings management
    - API implementation

2. **VSCode Integration**
    - Configuration API
    - Commands and events
    - Window management
    - Extension lifecycle

## External API Architecture

### Server Implementation

- Uses Express.js for HTTP server
- RESTful API design with JSON request/response format
- Stateless request handling
- CORS middleware for security
- Configuration through VSCode settings

### Key Components

1. `ExternalApiServer` class

    - Manages server lifecycle (start/stop)
    - Handles route setup and middleware
    - Integrates with ClineAPI for RooCode operations

2. Configuration

    - Port number (default: 3000)
    - Allowed origins for CORS
    - Enable/disable through VSCode settings

3. API Endpoints

    - GET /api/instructions
    - POST /api/instructions
    - POST /api/tasks
    - POST /api/messages

4. Error Handling
    - Consistent error response format
    - HTTP status codes for different scenarios
    - Input validation for all endpoints

### Testing

- Comprehensive test suite using Jest
- Tests for CORS, validation, and error handling
- Server lifecycle management tests
- Mock ClineAPI for isolated testing
