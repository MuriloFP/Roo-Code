"""
Task Creation Test Script

This script tests the task creation endpoint with wait_for_completion=True
to verify that it properly waits for the initial response.
"""

import requests
import json
import time

# Configuration
API_BASE_URL = "http://localhost:3002/api"  # Adjust port as needed

def create_task(message):
    """Create a new task and wait for completion."""
    url = f"{API_BASE_URL}/tasks"
    
    payload = {
        "message": message,
        "wait_for_completion": True  # This should make it wait for the response
    }

    print("Sending request...")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    response = requests.post(url, json=payload)
    result = response.json()
    
    print(f"\nResponse status code: {response.status_code}")
    print(f"Response body: {json.dumps(result, indent=2)}")
    
    return result

def get_task_status(task_id):
    """Get the status of a specific task."""
    url = f"{API_BASE_URL}/tasks/{task_id}/status"
    response = requests.get(url)
    return response.json()

def format_status(status):
    """Format the task status for display."""
    status_colors = {
        "in_progress": "\033[33m",  # Yellow
        "needs_input": "\033[36m",   # Cyan
        "needs_approval": "\033[35m", # Magenta
        "completed": "\033[32m",     # Green
        "error": "\033[31m"          # Red
    }
    reset_color = "\033[0m"
    return f"{status_colors.get(status, '')}{status}{reset_color}"

def main():
    print("Testing task creation with wait_for_completion=True\n")
    
    message = "Hello! Please create a python script that prints 'Hello World!'"
    
    print("Creating task and waiting for completion...")
    result = create_task(message)
    
    if "id" in result:
        task_id = result["id"]
        print(f"\nTask created with ID: {task_id}")
        print(f"Initial status: {format_status(result['status'])}")
        
        # If task is still in progress, poll for completion
        if result["status"] == "in_progress":
            print("\nPolling for completion...")
            attempts = 0
            while attempts < 120:  # Poll for up to 120 seconds
                status = get_task_status(task_id)
                print(f"Status: {format_status(status['status'])}")
                
                # Show last message if available
                if status.get("lastMessage"):
                    print(f"Last message: {status['lastMessage']}")
                
                # Break if we reach a terminal state
                if status["status"] in ["completed", "needs_input", "needs_approval", "error"]:
                    print(f"\nTask reached state: {format_status(status['status'])}")
                    if status.get("lastMessage"):
                        print(f"Final message: {status['lastMessage']}")
                    break
                    
                time.sleep(1)
                attempts += 1
            else:
                print("\nTimeout waiting for task completion")
    else:
        print("\nFailed to create task")
    
    print("\nTest complete!")

if __name__ == "__main__":
    main() 