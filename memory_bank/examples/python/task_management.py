"""
Advanced Task Management Example

This example demonstrates:
1. Listing tasks
2. Getting status of specific tasks
3. Getting logs of specific tasks
4. Sending messages to specific tasks
"""

import requests
import json

# Configuration
API_BASE_URL = "http://localhost:3002/api"  # Adjust port as needed

def list_tasks(limit=10):
    """List recent tasks with optional limit."""
    url = f"{API_BASE_URL}/tasks"
    params = {"limit": limit}
    response = requests.get(url, params=params)
    return response.json()

def get_task_status_by_id(task_id):
    """Get the status of a specific task."""
    url = f"{API_BASE_URL}/tasks/{task_id}/status"
    response = requests.get(url)
    return response.json()

def get_task_logs_by_id(task_id):
    """Get the conversation logs for a specific task."""
    url = f"{API_BASE_URL}/tasks/{task_id}/logs"
    response = requests.get(url)
    return response.json()

def send_message_to_task(task_id, message, images=None):
    """Send a message to a specific task."""
    url = f"{API_BASE_URL}/messages/{task_id}"
    
    payload = {"message": message}
    if images:
        payload["images"] = images

    response = requests.post(url, json=payload)
    return response.json()

def main():
    # List recent tasks
    print("Listing recent tasks...")
    tasks = list_tasks(limit=5)
    print(f"Recent tasks: {json.dumps(tasks, indent=2)}")

    if tasks:
        # Get the most recent task ID
        task_id = tasks[0]["id"]
        
        input(f"\nPress Enter to get status for task {task_id}...")  # Wait for user input
        
        # Get status of specific task
        print(f"\nGetting status for task {task_id}...")
        status = get_task_status_by_id(task_id)
        print(f"Task status: {json.dumps(status, indent=2)}")

        input(f"\nPress Enter to get logs for task {task_id}...")  # Wait for user input

        # Get logs of specific task
        print(f"\nGetting logs for task {task_id}...")
        logs = get_task_logs_by_id(task_id)
        print(f"Task logs: {json.dumps(logs, indent=2)}")

        input(f"\nPress Enter to send message to task {task_id}...")  # Wait for user input

        # Send message to specific task
        print(f"\nSending message to task {task_id}...")
        result = send_message_to_task(
            task_id,
            "This is a message to a specific task!"
        )
        print(f"Message sent: {json.dumps(result, indent=2)}")

if __name__ == "__main__":
    main() 