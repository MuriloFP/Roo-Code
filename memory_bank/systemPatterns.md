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

- Express.js HTTP server with TypeScript
- RESTful API design principles
- Custom CORS middleware for security
- Consistent error handling patterns
- Stateless request handling

### Key Components

1. ExternalApiServer class

    - Manages server lifecycle
    - Configures middleware
    - Sets up API routes
    - Handles cleanup on shutdown

2. Configuration

    - VSCode settings integration
    - Port configuration
    - CORS allowed hosts
    - Feature toggles

3. API Endpoints

    - GET endpoints for retrieving state
    - POST endpoints for actions
    - Consistent response formats
    - Proper HTTP status codes

4. Error Handling

    - Consistent error response format
    - Detailed error messages
    - Proper HTTP status codes
    - Error logging

5. Testing
    - Jest test framework
    - HTTP request mocking
    - Comprehensive test coverage
    - Error case testing

### Security Model

- CORS protection
- Input validation
- Error message sanitization
- Configurable allowed origins

### Integration Points

- ClineAPI for core functionality
- VSCode extension APIs
- Custom modes manager
- Sidebar provider
