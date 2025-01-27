"""
Basic Task Creation and Message Sending Example

This example demonstrates:
1. Creating a new task
2. Sending a message to the current task
3. Getting task status
4. Getting task logs
"""

import requests
import json

# Configuration
API_BASE_URL = "http://localhost:3002/api"  # Adjust port as needed

def create_task(message=None, mode=None, profile=None, wait_for_completion=False):
    """Create a new task with optional parameters."""
    url = f"{API_BASE_URL}/tasks"
    
    payload = {}
    if message:
        payload["message"] = message
    if mode:
        payload["mode"] = mode
    if profile:
        payload["profile"] = profile
    if wait_for_completion:
        payload["wait_for_completion"] = wait_for_completion

    response = requests.post(url, json=payload)
    return response.json()

def send_message(message, images=None):
    """Send a message to the current task."""
    url = f"{API_BASE_URL}/messages"
    
    payload = {"message": message}
    if images:
        payload["images"] = images

    response = requests.post(url, json=payload)
    return response.json()

def get_task_status():
    """Get the status of the current task."""
    url = f"{API_BASE_URL}/tasks/status"
    response = requests.get(url)
    return response.json()

def get_task_logs():
    """Get the conversation logs for the current task."""
    url = f"{API_BASE_URL}/tasks/logs"
    response = requests.get(url)
    return response.json()

def main():
    # Create a new task
    print("Creating new task...")
    result = create_task(
        message="Hello! Let's start a new task.",
        mode="architect",  # Optional: specify a mode
        wait_for_completion=True  # Wait for initial response
    )
    print(f"Task created: {json.dumps(result, indent=2)}")

    input("\nPress Enter to send follow-up message...")  # Wait for user input

    # Send a follow-up message
    print("\nSending follow-up message...")
    result = send_message("Can you help me with a Python script to print out a poem about a cat?")
    print(f"Message sent: {json.dumps(result, indent=2)}")

    input("\nPress Enter to check task status...")  # Wait for user input

    # Get task status
    print("\nChecking task status...")
    status = get_task_status()
    print(f"Current status: {json.dumps(status, indent=2)}")

    input("\nPress Enter to get conversation logs...")  # Wait for user input

    # Get conversation logs
    print("\nGetting conversation logs...")
    logs = get_task_logs()
    print(f"Conversation logs: {json.dumps(logs, indent=2)}")

if __name__ == "__main__":
    main() 