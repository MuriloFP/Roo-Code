# MCP Configuration Reload

## Reloading MCP Configuration

You can reload MCP configuration files without restarting the extension:

1. Make changes to `mcp_settings.json` or `.roo/mcp.json`
2. Toggle MCP off using the checkbox in the MCP view
3. Toggle MCP back on

The configuration files will be reloaded and servers will be re-initialized with the new settings.

### How It Works

When you toggle MCP off and then back on:

- The extension reads both configuration files fresh from disk
- All existing MCP server connections are closed
- New connections are established based on the updated configuration
- Any new servers, tools, or settings take effect immediately

### Benefits

- No need to restart VS Code or the extension
- Quickly test MCP server configurations
- Troubleshoot connection issues more efficiently
- Iterate on MCP settings during development

### Configuration Files

MCP settings can be configured in two locations:

- **Global**: `~/.roo/mcp_settings.json` - Applies to all projects
- **Project**: `.roo/mcp.json` - Project-specific settings

Both files are reloaded when toggling MCP off and on.
