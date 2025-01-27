"""
MCP (Model Context Protocol) Management Example

This example demonstrates:
1. Listing available MCPs
2. Getting detailed MCP information
3. Enabling/disabling MCPs
"""

import requests
import json

# Configuration
API_BASE_URL = "http://localhost:3002/api"  # Adjust port as needed

def list_mcps():
    """List all available MCPs with their status."""
    url = f"{API_BASE_URL}/mcps"
    response = requests.get(url)
    return response.json()

def get_mcp_details(mcp_id):
    """Get detailed information about a specific MCP."""
    url = f"{API_BASE_URL}/mcps/{mcp_id}"
    response = requests.get(url)
    return response.json()

def set_mcp_status(mcp_id, enabled):
    """Enable or disable a specific MCP."""
    url = f"{API_BASE_URL}/mcps/{mcp_id}/status"
    payload = {"enabled": enabled}
    response = requests.post(url, json=payload)
    return response.json()

def main():
    # List all MCPs
    print("Listing available MCPs...")
    mcps = list_mcps()
    print(f"Available MCPs: {json.dumps(mcps, indent=2)}")

    if mcps:
        input("\nPress Enter to get MCP details...")  # Wait for user input
        
        # Get details of first MCP
        mcp_id = mcps[0]["id"]
        print(f"\nGetting details for MCP '{mcp_id}'...")
        details = get_mcp_details(mcp_id)
        print(f"MCP details: {json.dumps(details, indent=2)}")
        
        input("\nPress Enter to disable MCP...")  # Wait for user input
        
        # Disable the MCP
        print(f"\nDisabling MCP '{mcp_id}'...")
        result = set_mcp_status(mcp_id, False)
        print(f"Disable result: {json.dumps(result, indent=2)}")

        input("\nPress Enter to re-enable MCP...")  # Wait for user input

        # Re-enable the MCP
        print(f"\nRe-enabling MCP '{mcp_id}'...")
        result = set_mcp_status(mcp_id, True)
        print(f"Enable result: {json.dumps(result, indent=2)}")

        input("\nPress Enter for final status check...")  # Wait for user input

        # Verify final status
        print(f"\nVerifying final status of MCP '{mcp_id}'...")
        details = get_mcp_details(mcp_id)
        print(f"Final status: {json.dumps(details, indent=2)}")

if __name__ == "__main__":
    main() 