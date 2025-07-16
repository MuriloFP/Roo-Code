// npx vitest core/tools/__tests__/accessMcpResourceTool.spec.ts

import { accessMcpResourceTool } from "../accessMcpResourceTool"
import { Task } from "../../task/Task"
import { ToolUse } from "../../../shared/tools"

// Mock dependencies
vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolResult: vi.fn((result: string, images?: string[]) =>
			images?.length ? `Tool result: ${result} [with ${images.length} images]` : `Tool result: ${result}`,
		),
	},
}))

describe("accessMcpResourceTool", () => {
	let mockTask: Partial<Task>
	let mockAskApproval: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockRemoveClosingTag: ReturnType<typeof vi.fn>
	let mockProviderRef: any
	let mockMcpHub: any

	beforeEach(() => {
		mockAskApproval = vi.fn()
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn((tag: string, value?: string) => value || "")

		mockMcpHub = {
			readResource: vi.fn(),
			getAllServers: vi.fn().mockReturnValue([]),
		}

		mockProviderRef = {
			deref: vi.fn().mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: false,
					alwaysAllowMcp: false,
				}),
			}),
		}

		mockTask = {
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn(),
			say: vi.fn(),
			ask: vi.fn(),
			providerRef: mockProviderRef,
		}
	})

	describe("parameter validation", () => {
		it("should handle missing server_name", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					uri: "test://resource",
				},
				partial: false,
			}

			mockTask.sayAndCreateMissingParamError = vi.fn().mockResolvedValue("Missing server_name error")

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("access_mcp_resource")
			expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("access_mcp_resource", "server_name")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing server_name error")
		})

		it("should handle missing uri", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
				},
				partial: false,
			}

			mockTask.sayAndCreateMissingParamError = vi.fn().mockResolvedValue("Missing uri error")

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("access_mcp_resource")
			expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("access_mcp_resource", "uri")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing uri error")
		})
	})

	describe("partial requests", () => {
		it("should handle partial requests", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource",
				},
				partial: true,
			}

			mockTask.ask = vi.fn().mockResolvedValue(true)

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.ask).toHaveBeenCalledWith(
				"use_mcp_server",
				expect.stringContaining("access_mcp_resource"),
				true,
			)
			expect(mockTask.ask).toHaveBeenCalledWith("use_mcp_server", expect.stringContaining("test_server"), true)
			expect(mockTask.ask).toHaveBeenCalledWith(
				"use_mcp_server",
				expect.stringContaining("test://resource"),
				true,
			)
		})
	})

	describe("auto-approval flow", () => {
		it("should auto-approve when all conditions are met", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource",
				},
				partial: false,
			}

			// Setup auto-approval conditions
			mockProviderRef.deref.mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
				}),
			})

			mockMcpHub.getAllServers.mockReturnValue([
				{
					name: "test_server",
					resources: [
						{
							uri: "test://resource",
							name: "Test Resource",
							alwaysAllow: true,
						},
					],
					resourceTemplates: [],
				},
			])

			mockMcpHub.readResource.mockResolvedValue({
				contents: [{ text: "Resource content" }],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should not ask for approval
			expect(mockAskApproval).not.toHaveBeenCalled()
			// Should proceed with execution
			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_request_started")
			expect(mockMcpHub.readResource).toHaveBeenCalledWith("test_server", "test://resource")
			expect(mockPushToolResult).toHaveBeenCalledWith("Tool result: Resource content")
		})

		it("should require manual approval when auto-approval is disabled", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource",
				},
				partial: false,
			}

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: false,
					alwaysAllowMcp: true,
				}),
			})

			mockMcpHub.getAllServers.mockReturnValue([
				{
					name: "test_server",
					resources: [
						{
							uri: "test://resource",
							name: "Test Resource",
							alwaysAllow: true,
						},
					],
					resourceTemplates: [],
				},
			])

			mockAskApproval.mockResolvedValue(true)
			mockMcpHub.readResource.mockResolvedValue({
				contents: [{ text: "Resource content" }],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should ask for approval
			expect(mockAskApproval).toHaveBeenCalled()
			expect(mockMcpHub.readResource).toHaveBeenCalledWith("test_server", "test://resource")
		})

		it("should require manual approval when resource is not marked as always allow", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource",
				},
				partial: false,
			}

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
				}),
			})

			mockMcpHub.getAllServers.mockReturnValue([
				{
					name: "test_server",
					resources: [
						{
							uri: "test://resource",
							name: "Test Resource",
							alwaysAllow: false, // Not always allowed
						},
					],
					resourceTemplates: [],
				},
			])

			mockAskApproval.mockResolvedValue(true)
			mockMcpHub.readResource.mockResolvedValue({
				contents: [{ text: "Resource content" }],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should ask for approval
			expect(mockAskApproval).toHaveBeenCalled()
		})
	})

	describe("URI template matching", () => {
		it("should match direct URI", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://exact/resource",
				},
				partial: false,
			}

			mockMcpHub.getAllServers.mockReturnValue([
				{
					name: "test_server",
					resources: [
						{
							uri: "test://exact/resource",
							name: "Exact Resource",
							alwaysAllow: true,
						},
					],
					resourceTemplates: [],
				},
			])

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
				}),
			})

			mockMcpHub.readResource.mockResolvedValue({
				contents: [{ text: "Resource content" }],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should auto-approve based on direct URI match
			expect(mockAskApproval).not.toHaveBeenCalled()
			expect(mockMcpHub.readResource).toHaveBeenCalledWith("test_server", "test://exact/resource")
		})

		it("should match template with single parameter", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource/123",
				},
				partial: false,
			}

			mockMcpHub.getAllServers.mockReturnValue([
				{
					name: "test_server",
					resources: [],
					resourceTemplates: [
						{
							uriTemplate: "test://resource/{id}",
							name: "Resource Template",
							alwaysAllow: true,
						},
					],
				},
			])

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
				}),
			})

			mockMcpHub.readResource.mockResolvedValue({
				contents: [{ text: "Resource content" }],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should auto-approve based on template match
			expect(mockAskApproval).not.toHaveBeenCalled()
			expect(mockMcpHub.readResource).toHaveBeenCalledWith("test_server", "test://resource/123")
		})

		it("should match template with multiple parameters", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource/users/123/posts/456",
				},
				partial: false,
			}

			mockMcpHub.getAllServers.mockReturnValue([
				{
					name: "test_server",
					resources: [],
					resourceTemplates: [
						{
							uriTemplate: "test://resource/users/{userId}/posts/{postId}",
							name: "User Post Template",
							alwaysAllow: true,
						},
					],
				},
			])

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
				}),
			})

			mockMcpHub.readResource.mockResolvedValue({
				contents: [{ text: "Post content" }],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should auto-approve based on template match
			expect(mockAskApproval).not.toHaveBeenCalled()
			expect(mockMcpHub.readResource).toHaveBeenCalledWith("test_server", "test://resource/users/123/posts/456")
		})

		it("should match template with wildcard", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource/any/path/here",
				},
				partial: false,
			}

			mockMcpHub.getAllServers.mockReturnValue([
				{
					name: "test_server",
					resources: [],
					resourceTemplates: [
						{
							uriTemplate: "test://resource/*",
							name: "Wildcard Template",
							alwaysAllow: true,
						},
					],
				},
			])

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
				}),
			})

			mockMcpHub.readResource.mockResolvedValue({
				contents: [{ text: "Resource content" }],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should auto-approve based on wildcard match
			expect(mockAskApproval).not.toHaveBeenCalled()
			expect(mockMcpHub.readResource).toHaveBeenCalledWith("test_server", "test://resource/any/path/here")
		})

		it("should not match template when URI doesn't match pattern", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://different/resource",
				},
				partial: false,
			}

			mockMcpHub.getAllServers.mockReturnValue([
				{
					name: "test_server",
					resources: [],
					resourceTemplates: [
						{
							uriTemplate: "test://resource/{id}",
							name: "Resource Template",
							alwaysAllow: true,
						},
					],
				},
			])

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
				}),
			})

			mockAskApproval.mockResolvedValue(true)
			mockMcpHub.readResource.mockResolvedValue({
				contents: [{ text: "Resource content" }],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should ask for approval since no template matches
			expect(mockAskApproval).toHaveBeenCalled()
		})

		it("should not match parameters with slashes when using single segment pattern", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource/path/with/slashes",
				},
				partial: false,
			}

			mockMcpHub.getAllServers.mockReturnValue([
				{
					name: "test_server",
					resources: [],
					resourceTemplates: [
						{
							uriTemplate: "test://resource/{path}",
							name: "Path Template",
							alwaysAllow: true,
						},
					],
				},
			])

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
				}),
			})

			mockAskApproval.mockResolvedValue(true)
			mockMcpHub.readResource.mockResolvedValue({
				contents: [{ text: "Resource content" }],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should ask for approval since {path} only matches single segments without slashes
			expect(mockAskApproval).toHaveBeenCalled()
		})

		it("should handle parameters with slashes using greedy matching", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource/path/with/slashes",
				},
				partial: false,
			}

			mockMcpHub.getAllServers.mockReturnValue([
				{
					name: "test_server",
					resources: [],
					resourceTemplates: [
						{
							uriTemplate: "test://resource/{path*}",
							name: "Path Template with Greedy Match",
							alwaysAllow: true,
						},
					],
				},
			])

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
				}),
			})

			mockMcpHub.readResource.mockResolvedValue({
				contents: [{ text: "Resource content" }],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should auto-approve since {path*} matches zero or more segments including slashes
			expect(mockAskApproval).not.toHaveBeenCalled()
			expect(mockMcpHub.readResource).toHaveBeenCalledWith("test_server", "test://resource/path/with/slashes")
		})

		it("should handle one-or-more segments pattern", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource/path/segments",
				},
				partial: false,
			}

			mockMcpHub.getAllServers.mockReturnValue([
				{
					name: "test_server",
					resources: [],
					resourceTemplates: [
						{
							uriTemplate: "test://resource/{path+}",
							name: "Path Template with One-or-More",
							alwaysAllow: true,
						},
					],
				},
			])

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
				}),
			})

			mockMcpHub.readResource.mockResolvedValue({
				contents: [{ text: "Resource content" }],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should auto-approve since {path+} matches one or more segments
			expect(mockAskApproval).not.toHaveBeenCalled()
			expect(mockMcpHub.readResource).toHaveBeenCalledWith("test_server", "test://resource/path/segments")
		})

		it("should not match empty path with one-or-more pattern", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource/",
				},
				partial: false,
			}

			mockMcpHub.getAllServers.mockReturnValue([
				{
					name: "test_server",
					resources: [],
					resourceTemplates: [
						{
							uriTemplate: "test://resource/{path+}",
							name: "Path Template with One-or-More",
							alwaysAllow: true,
						},
					],
				},
			])

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
				}),
			})

			mockAskApproval.mockResolvedValue(true)
			mockMcpHub.readResource.mockResolvedValue({
				contents: [{ text: "Resource content" }],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should ask for approval since {path+} requires at least one segment
			expect(mockAskApproval).toHaveBeenCalled()
		})

		it("should match empty path with zero-or-more pattern", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource/",
				},
				partial: false,
			}

			mockMcpHub.getAllServers.mockReturnValue([
				{
					name: "test_server",
					resources: [],
					resourceTemplates: [
						{
							uriTemplate: "test://resource/{path*}",
							name: "Path Template with Zero-or-More",
							alwaysAllow: true,
						},
					],
				},
			])

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue(mockMcpHub),
				getState: vi.fn().mockResolvedValue({
					autoApprovalEnabled: true,
					alwaysAllowMcp: true,
				}),
			})

			mockMcpHub.readResource.mockResolvedValue({
				contents: [{ text: "Resource content" }],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should auto-approve since {path*} matches zero or more segments
			expect(mockAskApproval).not.toHaveBeenCalled()
			expect(mockMcpHub.readResource).toHaveBeenCalledWith("test_server", "test://resource/")
		})
	})

	describe("successful execution", () => {
		it("should handle text content", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource",
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)
			mockMcpHub.readResource.mockResolvedValue({
				contents: [{ text: "First content" }, { text: "Second content" }],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_response", "First content\n\nSecond content", [])
			expect(mockPushToolResult).toHaveBeenCalledWith("Tool result: First content\n\nSecond content")
		})

		it("should handle image content", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource",
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)
			mockMcpHub.readResource.mockResolvedValue({
				contents: [
					{ text: "Image description" },
					{ mimeType: "image/png", blob: "base64data" },
					{ mimeType: "image/jpeg", blob: "data:image/jpeg;base64,jpegdata" },
				],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			const expectedImages = ["data:image/png;base64,base64data", "data:image/jpeg;base64,jpegdata"]

			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_response", "Image description", expectedImages)
			expect(mockPushToolResult).toHaveBeenCalledWith("Tool result: Image description [with 2 images]")
		})

		it("should handle empty response", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource",
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)
			mockMcpHub.readResource.mockResolvedValue({
				contents: [],
			})

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_response", "(Empty response)", [])
			expect(mockPushToolResult).toHaveBeenCalledWith("Tool result: (Empty response)")
		})

		it("should handle user rejection", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource",
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(false)

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.say).not.toHaveBeenCalledWith("mcp_server_request_started")
			expect(mockMcpHub.readResource).not.toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})
	})

	describe("error handling", () => {
		it("should handle resource read errors", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource",
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)
			const error = new Error("Failed to read resource")
			mockMcpHub.readResource.mockRejectedValue(error)

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockHandleError).toHaveBeenCalledWith("accessing MCP resource", error)
		})

		it("should handle unexpected errors", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "test://resource",
				},
				partial: false,
			}

			const error = new Error("Unexpected error")
			mockAskApproval.mockRejectedValue(error)

			await accessMcpResourceTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockHandleError).toHaveBeenCalledWith("accessing MCP resource", error)
		})
	})
})
