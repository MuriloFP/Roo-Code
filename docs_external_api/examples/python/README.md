# RooCode External API Examples

This directory contains Python examples demonstrating how to use the RooCode External API.

## Prerequisites

- Python 3.6 or higher
- `requests` library (`pip install requests`)
- Running RooCode instance with External API enabled

## Configuration

All examples use `http://localhost:3002` as the default API base URL. If your RooCode instance is running on a different port, update the `API_BASE_URL` variable in each script.

## Examples

### 1. Basic Task Management (`basic_task.py`)

Demonstrates basic task creation and message sending:

- Creating a new task
- Sending messages to the current task
- Getting task status
- Getting task logs

### 2. Advanced Task Management (`task_management.py`)

Shows more advanced task management features:

- Listing tasks with pagination
- Getting status of specific tasks
- Getting logs of specific tasks
- Sending messages to specific tasks

### 3. Mode and Profile Management (`mode_and_profile.py`)

Demonstrates mode and profile configuration:

- Listing available modes
- Getting and switching current mode
- Listing available profiles
- Getting and switching current profile

### 4. Auto-Approve Settings (`auto_approve.py`)

Shows how to manage auto-approve settings:

- Getting current auto-approve settings
- Updating specific auto-approve settings
- Toggling the master auto-approve switch

### 5. MCP Management (`mcp_management.py`)

Demonstrates MCP (Model Context Protocol) management:

- Listing available MCPs
- Getting detailed MCP information
- Enabling/disabling MCPs

## Usage

1. Make sure RooCode is running and the External API is enabled
2. Install the required Python package:
    ```bash
    pip install requests
    ```
3. Run any example script:
    ```bash
    python basic_task.py
    ```

## Error Handling

All examples include basic error handling. The API will return appropriate error messages and status codes:

- 400: Bad Request (invalid input)
- 404: Not Found (resource doesn't exist)
- 500: Internal Server Error

## Notes

- Some examples require existing tasks, modes, or profiles to work properly
- Auto-approve settings are global and affect all RooCode operations
- MCP management requires MCPs to be configured in RooCode
