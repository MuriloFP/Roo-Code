"""
Task Approval Example

This example demonstrates:
1. Creating a task that requires approval
2. Getting task status using both task ID and current task endpoints
3. Approving tasks using both task ID and current task endpoints
"""

import requests
import json

# Configuration
API_BASE_URL = "http://localhost:3002/api"  # Adjust port as needed

def create_task(message=None, mode=None, profile=None):
    """Create a new task with optional parameters."""
    url = f"{API_BASE_URL}/tasks"
    
    payload = {}
    if message:
        payload["message"] = message
    if mode:
        payload["mode"] = mode
    if profile:
        payload["profile"] = profile

    response = requests.post(url, json=payload)
    return response.json()

def get_task_status(task_id=None):
    """Get task status using either task ID or current task endpoint."""
    if task_id:
        url = f"{API_BASE_URL}/tasks/{task_id}/status"
    else:
        url = f"{API_BASE_URL}/tasks/status"
    response = requests.get(url)
    return response.json()

def approve_task(task_id=None):
    """Approve a task using either task ID or current task endpoint."""
    if task_id:
        url = f"{API_BASE_URL}/tasks/{task_id}/respond"
    else:
        url = f"{API_BASE_URL}/tasks/respond"
    
    response = requests.post(url, json={"response": "approve"})
    return response.json()

def main():
    # Test approval using task ID
    print("\nTesting task approval with task ID...")
    input("Press Enter to create a new task...")
    
    result = create_task(
        message="Create a python script that prints hello world and run it",
        mode="architect"  # Optional: specify a mode
    )
    task_id = result.get("id")
    print(f"Task created: {json.dumps(result, indent=2)}")
    
    # Check status until approval needed
    while True:
        input("\nPress Enter to check task status...")
        status = get_task_status(task_id)
        print(f"Current status: {json.dumps(status, indent=2)}")
        
        if status.get("status") == "needs_approval":
            input("\nPress Enter to approve the task...")
            result = approve_task(task_id)
            print(f"Approval result: {json.dumps(result, indent=2)}")
        elif status.get("status") in ["completed", "error"]:
            break
    
    # Test approval using current task endpoint
    print("\nNow testing task approval without task ID...")
    input("\nPress Enter to create another task...")
    
    result = create_task(
        message="Create a python script that prints hello world and run it",
        mode="architect"  # Optional: specify a mode
    )
    print(f"Task created: {json.dumps(result, indent=2)}")
    
    # Check status until approval needed
    while True:
        input("\nPress Enter to check current task status...")
        status = get_task_status()
        print(f"Current status: {json.dumps(status, indent=2)}")
        
        if status.get("status") == "needs_approval":
            input("\nPress Enter to approve the current task...")
            result = approve_task()
            print(f"Approval result: {json.dumps(result, indent=2)}")
        elif status.get("status") in ["completed", "error"]:
            break

if __name__ == "__main__":
    main() 