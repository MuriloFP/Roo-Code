import { ClineAskUseMcpServer } from "../../shared/ExtensionMessage"
import { ToolUse, RemoveClosingTag, AskApproval, HandleError, PushToolResult } from "../../shared/tools"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"

export async function accessMcpResourceTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const server_name: string | undefined = block.params.server_name
	const uri: string | undefined = block.params.uri

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				type: "access_mcp_resource",
				serverName: removeClosingTag("server_name", server_name),
				uri: removeClosingTag("uri", uri),
			} satisfies ClineAskUseMcpServer)

			await cline.ask("use_mcp_server", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!server_name) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("access_mcp_resource")
				pushToolResult(await cline.sayAndCreateMissingParamError("access_mcp_resource", "server_name"))
				return
			}

			if (!uri) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("access_mcp_resource")
				pushToolResult(await cline.sayAndCreateMissingParamError("access_mcp_resource", "uri"))
				return
			}

			cline.consecutiveMistakeCount = 0

			const completeMessage = JSON.stringify({
				type: "access_mcp_resource",
				serverName: server_name,
				uri,
			} satisfies ClineAskUseMcpServer)

			// Check for auto-approval
			const state = await cline.providerRef.deref()?.getState()
			const { autoApprovalEnabled, alwaysAllowMcp } = state ?? {}

			const mcpHub = cline.providerRef.deref()?.getMcpHub()
			const servers = mcpHub?.getAllServers() || []
			const server = servers.find((s) => s.name === server_name)
			const resources = [...(server?.resources || []), ...(server?.resourceTemplates || [])]

			// Find matching resource or resource template
			const resource = resources.find((r) => {
				if ("uri" in r && r.uri === uri) {
					return true
				}
				if ("uriTemplate" in r) {
					// Enhanced template matching that handles different parameter types
					// Supports: {param} for single segment, {param*} for zero or more segments,
					// {param+} for one or more segments, and * for wildcards

					// First, handle template parameters
					let templateRegex = r.uriTemplate.replace(/\{([^}]+)\}/g, (match, param) => {
						// Handle different parameter types based on convention
						if (param.endsWith("*")) {
							// {param*} - matches zero or more path segments
							return "___ZERO_OR_MORE___"
						} else if (param.endsWith("+")) {
							// {param+} - matches one or more path segments
							return "___ONE_OR_MORE___"
						} else {
							// {param} - matches a single path segment (no slashes)
							return "___SINGLE_SEGMENT___"
						}
					})

					// Then escape special regex characters
					templateRegex = templateRegex.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

					// Replace our placeholders with actual regex patterns
					templateRegex = templateRegex
						.replace(/___ZERO_OR_MORE___/g, ".*")
						.replace(/___ONE_OR_MORE___/g, ".+")
						.replace(/___SINGLE_SEGMENT___/g, "[^/]+")

					// Handle standalone wildcards (that weren't part of template parameters)
					templateRegex = templateRegex.replace(/\\\*/g, ".*")

					const regex = new RegExp(`^${templateRegex}$`)
					return regex.test(uri)
				}
				return false
			})

			const shouldAutoApprove = autoApprovalEnabled && alwaysAllowMcp && resource?.alwaysAllow

			let didApprove = false
			if (shouldAutoApprove) {
				await cline.say("mcp_server_request_started")
				didApprove = true
			} else {
				didApprove = await askApproval("use_mcp_server", completeMessage)
			}

			if (!didApprove) {
				return
			}

			// Now execute the tool
			await cline.say("mcp_server_request_started")
			const resourceResult = await cline.providerRef.deref()?.getMcpHub()?.readResource(server_name, uri)

			const resourceResultPretty =
				resourceResult?.contents
					.map((item) => {
						if (item.text) {
							return item.text
						}
						return ""
					})
					.filter(Boolean)
					.join("\n\n") || "(Empty response)"

			// Handle images (image must contain mimetype and blob)
			let images: string[] = []

			resourceResult?.contents.forEach((item) => {
				if (item.mimeType?.startsWith("image") && item.blob) {
					if (item.blob.startsWith("data:")) {
						images.push(item.blob)
					} else {
						images.push(`data:${item.mimeType};base64,` + item.blob)
					}
				}
			})

			await cline.say("mcp_server_response", resourceResultPretty, images)
			pushToolResult(formatResponse.toolResult(resourceResultPretty, images))

			return
		}
	} catch (error) {
		await handleError("accessing MCP resource", error)
		return
	}
}
