"""
Task Creation Test Script

This script tests the task creation endpoint with wait_for_completion=True
to verify that it properly waits for the initial response.
"""

import requests
import json

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

def main():
    print("Testing task creation with wait_for_completion=True\n")
    
    message = "Hello! Please create a python script that prints 'Hello World!'"
    
    print("Creating task and waiting for completion...")
    result = create_task(message)
    
    print("\nTest complete!")

if __name__ == "__main__":
    main() 