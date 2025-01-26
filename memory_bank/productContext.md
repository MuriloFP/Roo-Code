# RooCode External API Project

## Why This Project Exists

RooCode is a powerful VSCode extension that provides AI-powered coding assistance through its UI and command system. However, there's currently no way for external tools (like Model Context Protocol servers) to programmatically control RooCode's functions. This project aims to solve that limitation.

## Problems It Solves

1. **External Tool Integration**: Enables external tools to interact with RooCode programmatically
2. **MCP Integration**: Allows Model Context Protocol servers to create tasks and manage conversation context
3. **Multi-Window Support**: Supports multiple VSCode windows with independent API instances
4. **Controlled Access**: Provides secure, user-controlled access to RooCode's functionality

## How It Should Work

1. Users can enable/disable the external API through RooCode's settings
2. Each VSCode window can run its own API server on a configurable port
3. External tools can make HTTP requests to control RooCode functions:
    - Create new tasks
    - Send messages
    - Manage conversation context
    - Access other RooCode features
4. The API maintains RooCode's security model and user control
