"""
Auto-Approve Settings Management Example

This example demonstrates:
1. Getting current auto-approve settings
2. Updating specific auto-approve settings
3. Toggling the master auto-approve switch
"""

import requests
import json

# Configuration
API_BASE_URL = "http://localhost:3002/api"  # Adjust port as needed

def get_auto_approve_settings():
    """Get current auto-approve settings."""
    url = f"{API_BASE_URL}/auto-approve"
    response = requests.get(url)
    return response.json()

def update_auto_approve_settings(settings):
    """Update auto-approve settings."""
    url = f"{API_BASE_URL}/auto-approve"
    response = requests.post(url, json=settings)
    return response.json()

def set_auto_approve_enabled(enabled):
    """Toggle the master auto-approve switch."""
    url = f"{API_BASE_URL}/auto-approve/enabled"
    payload = {"enabled": enabled}
    response = requests.post(url, json=payload)
    return response.json()

def main():
    # Get current settings
    print("Getting current auto-approve settings...")
    settings = get_auto_approve_settings()
    print(f"Current settings: {json.dumps(settings, indent=2)}")

    input("\nPress Enter to update settings...")  # Wait for user input

    # Update specific settings
    print("\nUpdating auto-approve settings...")
    new_settings = {
        "autoApprovalEnabled": True,
        "alwaysAllowReadOnly": True,
        "alwaysAllowWrite": False,
        "alwaysAllowExecute": False,
        "alwaysAllowBrowser": True,
        "alwaysAllowMcp": False,
        "alwaysApproveResubmit": True
    }
    result = update_auto_approve_settings(new_settings)
    print(f"Update result: {json.dumps(result, indent=2)}")

    input("\nPress Enter to verify settings...")  # Wait for user input

    # Verify updated settings
    print("\nVerifying updated settings...")
    settings = get_auto_approve_settings()
    print(f"Updated settings: {json.dumps(settings, indent=2)}")

    input("\nPress Enter to disable auto-approve...")  # Wait for user input

    # Toggle master switch off
    print("\nDisabling auto-approve...")
    result = set_auto_approve_enabled(False)
    print(f"Toggle result: {json.dumps(result, indent=2)}")

    input("\nPress Enter for final verification...")  # Wait for user input

    # Final verification
    print("\nFinal settings check...")
    settings = get_auto_approve_settings()
    print(f"Final settings: {json.dumps(settings, indent=2)}")

if __name__ == "__main__":
    main() 