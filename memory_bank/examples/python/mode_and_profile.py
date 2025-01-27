"""
Mode and Profile Management Example

This example demonstrates:
1. Listing available modes
2. Getting and switching current mode
3. Listing available profiles
4. Getting and switching current profile
"""

import requests
import json

# Configuration
API_BASE_URL = "http://localhost:3002/api"  # Adjust port as needed

def list_modes():
    """List all available modes (built-in and custom)."""
    url = f"{API_BASE_URL}/modes"
    response = requests.get(url)
    return response.json()

def get_current_mode():
    """Get the currently active mode."""
    url = f"{API_BASE_URL}/modes/current"
    response = requests.get(url)
    return response.json()

def switch_mode(mode_slug):
    """Switch to a different mode."""
    url = f"{API_BASE_URL}/modes/switch"
    payload = {"mode": mode_slug}
    response = requests.post(url, json=payload)
    return response.json()

def list_profiles():
    """List all available configuration profiles."""
    url = f"{API_BASE_URL}/profiles"
    response = requests.get(url)
    return response.json()

def get_current_profile():
    """Get the currently active profile."""
    url = f"{API_BASE_URL}/profiles/current"
    response = requests.get(url)
    return response.json()

def switch_profile(profile_name):
    """Switch to a different profile."""
    url = f"{API_BASE_URL}/profiles/switch"
    payload = {"name": profile_name}
    response = requests.post(url, json=payload)
    return response.json()

def main():
    # List all available modes
    print("Listing available modes...")
    modes = list_modes()
    print(f"Available modes: {json.dumps(modes, indent=2)}")

    input("\nPress Enter to get current mode...")  # Wait for user input

    # Get current mode
    print("\nGetting current mode...")
    current_mode = get_current_mode()
    print(f"Current mode: {json.dumps(current_mode, indent=2)}")

    input("\nPress Enter to switch to architect mode...")  # Wait for user input

    # Switch to architect mode
    print("\nSwitching to architect mode...")
    result = switch_mode("architect")
    print(f"Switch result: {json.dumps(result, indent=2)}")

    input("\nPress Enter to list profiles...")  # Wait for user input

    # List all available profiles
    print("\nListing available profiles...")
    profiles = list_profiles()
    print(f"Available profiles: {json.dumps(profiles, indent=2)}")

    input("\nPress Enter to get current profile...")  # Wait for user input

    # Get current profile
    print("\nGetting current profile...")
    current_profile = get_current_profile()
    print(f"Current profile: {json.dumps(current_profile, indent=2)}")

    # Switch to a different profile (if available)
    if len(profiles) > 1:
        input("\nPress Enter to switch profile...")  # Wait for user input

        # Switch to the first profile that's not current
        new_profile = next(
            p["name"] for p in profiles 
            if p["name"] != current_profile["name"]
        )
        print(f"\nSwitching to profile '{new_profile}'...")
        result = switch_profile(new_profile)
        print(f"Switch result: {json.dumps(result, indent=2)}")

if __name__ == "__main__":
    main() 