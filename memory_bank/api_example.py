import requests
import json
import sys
import time

# Configuration
API_BASE_URL = "http://localhost:3002"

def test_connection():
    """Test if the API server is accessible."""
    try:
        response = requests.get(f"{API_BASE_URL}/api/instructions")
        return True
    except requests.exceptions.ConnectionError:
        print(f"Error: Could not connect to {API_BASE_URL}")
        print("Please check that:")
        print("1. RooCode's External API is enabled in settings")
        print("2. The port number matches your configuration (currently set to 3002)")
        print("3. RooCode is running and the API server has started")
        return False
    except Exception as e:
        print(f"Unexpected error testing connection: {e}")
        return False

def start_new_task(message=None):
    """Start a new task with an optional initial message."""
    url = f"{API_BASE_URL}/api/tasks"
    payload = {}
    if message:
        payload["message"] = message
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()  # Raise an error for bad status codes
        print("Successfully started new task")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Error starting task: {e}")
        return False

def send_message(message):
    """Send a message to the current task."""
    url = f"{API_BASE_URL}/api/messages"
    payload = {"message": message}
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()  # Raise an error for bad status codes
        print("Successfully sent message")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Error sending message: {e}")
        return False

def main():
    # First test the connection
    print(f"Testing connection to {API_BASE_URL}...")
    if not test_connection():
        sys.exit(1)
        
    # Start a new task with "Hello!"
    print("\nStarting new task...")
    if start_new_task("Hello!"):
        print("Task started successfully!")

if __name__ == "__main__":
    main() 