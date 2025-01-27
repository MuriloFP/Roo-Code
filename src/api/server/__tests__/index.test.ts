import { ExternalApiServer, ExternalApiServerConfig } from "../index"
import { ClineAPI } from "../../../exports"
import * as http from "http"
import { modes, ModeConfig, getModeBySlug } from "../../../shared/modes"
import delay from "delay"
import * as fs from "fs/promises"

jest.mock("../../../exports")
jest.mock("fs/promises")

// Helper function to get a random port number between 3001-4000
function getRandomPort(): number {
	return Math.floor(Math.random() * 1000) + 3001
}

// Helper function to retry a request with exponential backoff
async function retryRequest(
	options: {
		port: number
		method: string
		path: string
		body?: any
		headers?: { [key: string]: string }
	},
	maxRetries = 3,
): Promise<{ status: number; body: any }> {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await makeRequest(options)
		} catch (error) {
			if (attempt === maxRetries) {
				throw error
			}
			// Exponential backoff: wait longer between each retry
			await delay(Math.pow(2, attempt) * 100)
		}
	}
	throw new Error("Max retries exceeded")
}

function makeRequest(options: {
	port: number
	method: string
	path: string
	body?: any
	headers?: { [key: string]: string }
}): Promise<{ status: number; body: any }> {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{
				hostname: "localhost",
				port: options.port,
				path: options.path,
				method: options.method,
				headers: {
					"Content-Type": "application/json",
					...options.headers,
				},
			},
			(res) => {
				let data = ""
				res.on("data", (chunk) => (data += chunk))
				res.on("end", () => {
					try {
						resolve({
							status: res.statusCode || 500,
							body: data ? JSON.parse(data) : undefined,
						})
					} catch (error) {
						resolve({
							status: res.statusCode || 500,
							body: { error: "Failed to parse response" },
						})
					}
				})
			},
		)

		req.on("error", (error: NodeJS.ErrnoException) => {
			// Don't reject on ECONNRESET as it's expected when server closes connection
			if (error.code === "ECONNRESET") {
				resolve({ status: 500, body: { error: "Connection reset" } })
			} else {
				reject(error)
			}
		})

		if (options.body) {
			req.write(JSON.stringify(options.body))
		}
		req.end()
	})
}

describe("ExternalApiServer", () => {
	let server: ExternalApiServer
	let port: number
	let config: ExternalApiServerConfig
	let mockClineApi: jest.Mocked<ClineAPI>
	let mockGetCustomModes: jest.Mock<Promise<ModeConfig[]>>

	// Increase timeout for all tests in this suite
	jest.setTimeout(15000)

	beforeEach(async () => {
		port = await getRandomPort()

		// Create mock for getCustomModes
		mockGetCustomModes = jest.fn<Promise<ModeConfig[]>, []>()

		// Mock the ClineAPI
		mockClineApi = {
			setCustomInstructions: jest.fn(),
			getCustomInstructions: jest.fn(),
			startNewTask: jest.fn(),
			sendMessage: jest.fn(),
			pressPrimaryButton: jest.fn(),
			pressSecondaryButton: jest.fn(),
			sidebarProvider: {
				customModesManager: {
					getCustomModes: mockGetCustomModes,
				},
			} as any,
		}

		config = {
			port,
			allowedHosts: ["http://localhost:3000"],
		}

		server = new ExternalApiServer(config, mockClineApi)
		await server.start()
	})

	afterEach(async () => {
		if (server) {
			await server.stop()
		}
	})

	describe("CORS middleware", () => {
		it("should allow requests from allowed origins", async () => {
			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/instructions",
				headers: { Origin: "http://localhost:3000" },
			})

			expect(response.status).not.toBe(403)
		})

		it("should block requests from disallowed origins", async () => {
			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/instructions",
				headers: { Origin: "http://evil.com" },
			})

			expect(response.status).toBe(403)
			expect(response.body.error).toBe("Origin not allowed")
		})
	})

	describe("GET /api/instructions", () => {
		it("should return instructions successfully", async () => {
			const mockInstructions = "test instructions"
			mockClineApi.getCustomInstructions.mockResolvedValue(mockInstructions)

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/instructions",
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({ instructions: mockInstructions })
			expect(mockClineApi.getCustomInstructions).toHaveBeenCalled()
		})

		it("should handle errors", async () => {
			mockClineApi.getCustomInstructions.mockRejectedValue(new Error("test error"))

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/instructions",
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to get instructions")
		})
	})

	describe("POST /api/instructions", () => {
		it("should set instructions successfully", async () => {
			const instructions = "new instructions"

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/instructions",
				body: { instructions },
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({ success: true })
			expect(mockClineApi.setCustomInstructions).toHaveBeenCalledWith(instructions)
		})

		it("should validate instructions format", async () => {
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/instructions",
				body: { instructions: 123 },
			})

			expect(response.status).toBe(400)
			expect(response.body.error).toBe("Invalid instructions format")
		})

		it("should handle errors", async () => {
			mockClineApi.setCustomInstructions.mockRejectedValue(new Error("test error"))

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/instructions",
				body: { instructions: "test" },
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to set instructions")
		})
	})

	describe("POST /api/tasks", () => {
		beforeEach(() => {
			// Mock additional methods needed for enhanced task creation
			mockClineApi.sidebarProvider.handleModeSwitch = jest.fn().mockResolvedValue(undefined)
			mockClineApi.sidebarProvider.configManager = {
				hasConfig: jest.fn().mockResolvedValue(true),
				loadConfig: jest.fn().mockResolvedValue({ id: "test-id", apiProvider: "anthropic" }),
				setCurrentConfig: jest.fn().mockResolvedValue(undefined),
			} as any
			mockClineApi.sidebarProvider.updateGlobalState = jest.fn().mockResolvedValue(undefined)
			mockClineApi.sidebarProvider.postStateToWebview = jest.fn().mockResolvedValue(undefined)
			mockClineApi.sidebarProvider.getGlobalState = jest
				.fn()
				.mockResolvedValue([{ id: "task-1", ts: Date.now(), task: "test task" }])
			mockClineApi.sidebarProvider.getTaskWithId = jest.fn().mockResolvedValue({
				uiMessagesFilePath: "test-path",
			})
			;(fs.readFile as jest.Mock).mockResolvedValue(
				JSON.stringify([{ type: "assistant", content: "test response" }]),
			)
		})

		it("should start task successfully with basic parameters", async () => {
			const message = "test task"
			const images = ["image1.png"]

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/tasks",
				body: { message, images },
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({ success: true })
			expect(mockClineApi.startNewTask).toHaveBeenCalledWith(message, images)
		})

		it("should start task with mode switch", async () => {
			mockGetCustomModes.mockResolvedValue([])
			const message = "test task"
			const mode = "architect"

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/tasks",
				body: { message, mode },
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({ success: true })
			expect(mockClineApi.sidebarProvider.handleModeSwitch).toHaveBeenCalledWith(mode)
			expect(mockClineApi.startNewTask).toHaveBeenCalledWith(message, undefined)
		})

		it("should start task with profile switch", async () => {
			const message = "test task"
			const profile = "test-profile"

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/tasks",
				body: { message, profile },
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({ success: true })
			expect(mockClineApi.sidebarProvider.configManager.setCurrentConfig).toHaveBeenCalledWith(profile)
			expect(mockClineApi.sidebarProvider.updateGlobalState).toHaveBeenCalledWith("currentApiConfigName", profile)
			expect(mockClineApi.startNewTask).toHaveBeenCalledWith(message, undefined)
		})

		it("should wait for task completion when specified", async () => {
			const message = "test task"

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/tasks",
				body: { message, wait_for_completion: true },
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({
				id: "task-1",
				status: "waiting_for_approval",
				lastMessage: "test response",
			})
			expect(mockClineApi.startNewTask).toHaveBeenCalledWith(message, undefined)
		})

		it("should validate mode format", async () => {
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/tasks",
				body: { message: "test", mode: 123 },
			})

			expect(response.status).toBe(400)
			expect(response.body.error).toBe("Mode must be a string")
		})

		it("should validate profile format", async () => {
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/tasks",
				body: { message: "test", profile: 123 },
			})

			expect(response.status).toBe(400)
			expect(response.body.error).toBe("Profile must be a string")
		})

		it("should validate wait_for_completion format", async () => {
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/tasks",
				body: { message: "test", wait_for_completion: "not-a-boolean" },
			})

			expect(response.status).toBe(400)
			expect(response.body.error).toBe("wait_for_completion must be a boolean")
		})

		it("should handle non-existent mode", async () => {
			mockGetCustomModes.mockResolvedValue([])
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/tasks",
				body: { message: "test", mode: "non-existent-mode" },
			})

			expect(response.status).toBe(404)
			expect(response.body.error).toBe("Mode not found")
		})

		it("should handle non-existent profile", async () => {
			mockClineApi.sidebarProvider.configManager.hasConfig = jest.fn().mockResolvedValue(false)
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/tasks",
				body: { message: "test", profile: "non-existent-profile" },
			})

			expect(response.status).toBe(404)
			expect(response.body.error).toBe("Profile 'non-existent-profile' not found")
		})

		it("should validate message format", async () => {
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/tasks",
				body: { message: 123 },
			})

			expect(response.status).toBe(400)
			expect(response.body.error).toBe("Invalid message format")
		})

		it("should validate images format", async () => {
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/tasks",
				body: { message: "test", images: "not-an-array" },
			})

			expect(response.status).toBe(400)
			expect(response.body.error).toBe("Invalid images format")
		})

		it("should handle errors", async () => {
			mockClineApi.startNewTask.mockRejectedValue(new Error("test error"))

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/tasks",
				body: { message: "test" },
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to start task")
		})
	})

	describe("POST /api/messages", () => {
		it("should send message successfully", async () => {
			const message = "test message"
			const images = ["image1.png"]

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/messages",
				body: { message, images },
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({ success: true })
			expect(mockClineApi.sendMessage).toHaveBeenCalledWith(message, images)
		})

		it("should validate message format", async () => {
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/messages",
				body: { message: 123 },
			})

			expect(response.status).toBe(400)
			expect(response.body.error).toBe("Invalid message format")
		})

		it("should validate images format", async () => {
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/messages",
				body: { message: "test", images: "not-an-array" },
			})

			expect(response.status).toBe(400)
			expect(response.body.error).toBe("Invalid images format")
		})

		it("should handle errors", async () => {
			mockClineApi.sendMessage.mockRejectedValue(new Error("test error"))

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/messages",
				body: { message: "test" },
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to send message")
		})
	})

	describe("GET /api/modes", () => {
		it("should return all available modes", async () => {
			// Mock custom modes
			const mockCustomModes = [
				{
					slug: "custom-mode",
					name: "Custom Mode",
					roleDefinition: "A custom mode for testing",
					customInstructions: "Custom instructions",
					groups: ["read"],
				},
			]

			// Set up mock to resolve with custom modes
			mockGetCustomModes.mockResolvedValue(mockCustomModes)

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/modes",
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({
				builtIn: Object.values(modes),
				custom: mockCustomModes,
			})
		})

		it("should handle errors when getting modes", async () => {
			// Set up mock to reject with error
			mockGetCustomModes.mockRejectedValue(new Error("Failed to get custom modes"))

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/modes",
			})

			expect(response.status).toBe(500)
			expect(response.body).toEqual({
				error: "Failed to get modes",
			})
		})
	})

	describe("GET /api/modes/current", () => {
		beforeEach(() => {
			// Mock getState to return a default mode
			mockClineApi.sidebarProvider.getState = jest.fn().mockResolvedValue({
				mode: "code", // default mode
			})
		})

		it("should return current mode when it is a built-in mode", async () => {
			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/modes/current",
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual(getModeBySlug("code"))
		})

		it("should return current mode when it is a custom mode", async () => {
			const customMode = {
				slug: "custom-mode",
				name: "Custom Mode",
				roleDefinition: "A custom mode for testing",
				customInstructions: "Custom instructions",
				groups: ["read"],
			}

			mockClineApi.sidebarProvider.getState = jest.fn().mockResolvedValue({
				mode: "custom-mode",
			})
			mockGetCustomModes.mockResolvedValue([customMode])

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/modes/current",
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual(customMode)
		})

		it("should return 404 when current mode is not found", async () => {
			mockClineApi.sidebarProvider.getState = jest.fn().mockResolvedValue({
				mode: "non-existent-mode",
			})
			mockGetCustomModes.mockResolvedValue([])

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/modes/current",
			})

			expect(response.status).toBe(404)
			expect(response.body.error).toBe("Current mode not found")
		})

		it("should handle errors when getting current mode", async () => {
			mockClineApi.sidebarProvider.getState = jest.fn().mockRejectedValue(new Error("Failed to get state"))

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/modes/current",
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to get current mode")
		})
	})

	describe("POST /api/modes/switch", () => {
		beforeEach(() => {
			// Mock handleModeSwitch
			mockClineApi.sidebarProvider.handleModeSwitch = jest.fn().mockResolvedValue(undefined)
		})

		it("should switch mode successfully", async () => {
			const targetMode = "architect"
			mockGetCustomModes.mockResolvedValue([])

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/modes/switch",
				body: { mode: targetMode },
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({ message: "Mode switched successfully" })
			expect(mockClineApi.sidebarProvider.handleModeSwitch).toHaveBeenCalledWith(targetMode)
		})

		it("should validate mode format", async () => {
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/modes/switch",
				body: { mode: 123 },
			})

			expect(response.status).toBe(400)
			expect(response.body.error).toBe("Mode must be a string")
		})

		it("should return 404 when mode is not found", async () => {
			const nonExistentMode = "non-existent-mode"
			mockGetCustomModes.mockResolvedValue([])

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/modes/switch",
				body: { mode: nonExistentMode },
			})

			expect(response.status).toBe(404)
			expect(response.body.error).toBe("Mode not found")
		})

		it("should handle errors when switching mode", async () => {
			mockClineApi.sidebarProvider.handleModeSwitch = jest
				.fn()
				.mockRejectedValue(new Error("Failed to switch mode"))

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/modes/switch",
				body: { mode: "code" },
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to switch mode")
		})
	})

	describe("server lifecycle", () => {
		it("should start and stop server", async () => {
			const testServer = new ExternalApiServer({ port: getRandomPort() }, mockClineApi)
			await expect(testServer.start()).resolves.toBeUndefined()
			await expect(testServer.stop()).resolves.toBeUndefined()
		})

		it("should handle stopping when server is not running", async () => {
			const testServer = new ExternalApiServer({ port: getRandomPort() }, mockClineApi)
			await expect(testServer.stop()).resolves.toBeUndefined()
		})

		it("should handle start errors", async () => {
			const testServer = new ExternalApiServer(
				{ port: -1 }, // Invalid port to force error
				mockClineApi,
			)
			await expect(testServer.start()).rejects.toThrow()
		})
	})

	describe("GET /api/profiles", () => {
		it("should return all profiles successfully", async () => {
			const mockProfiles = [
				{ name: "default", id: "default-id", apiProvider: "anthropic" },
				{ name: "test", id: "test-id", apiProvider: "openai" },
			]
			mockClineApi.sidebarProvider.configManager = {
				listConfig: jest.fn().mockResolvedValue(mockProfiles),
			} as any

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/profiles",
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual(mockProfiles)
			expect(mockClineApi.sidebarProvider.configManager.listConfig).toHaveBeenCalled()
		})

		it("should handle errors", async () => {
			mockClineApi.sidebarProvider.configManager = {
				listConfig: jest.fn().mockRejectedValue(new Error("Failed to list configs")),
			} as any

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/profiles",
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to list configs")
		})
	})

	describe("GET /api/profiles/current", () => {
		it("should return current profile successfully", async () => {
			const currentProfile = {
				name: "default",
				id: "default-id",
				apiProvider: "anthropic",
			}
			mockClineApi.sidebarProvider.getGlobalState = jest.fn().mockResolvedValue("default")
			mockClineApi.sidebarProvider.configManager = {
				loadConfig: jest.fn().mockResolvedValue({
					id: "default-id",
					apiProvider: "anthropic",
				}),
			} as any

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/profiles/current",
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual(currentProfile)
			expect(mockClineApi.sidebarProvider.getGlobalState).toHaveBeenCalledWith("currentApiConfigName")
			expect(mockClineApi.sidebarProvider.configManager.loadConfig).toHaveBeenCalledWith("default")
		})

		it("should return 404 when no current profile is set", async () => {
			mockClineApi.sidebarProvider.getGlobalState = jest.fn().mockResolvedValue(undefined)

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/profiles/current",
			})

			expect(response.status).toBe(404)
			expect(response.body.error).toBe("Current profile not found")
		})

		it("should handle errors", async () => {
			mockClineApi.sidebarProvider.getGlobalState = jest.fn().mockRejectedValue(new Error("Failed to get state"))

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/profiles/current",
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to get state")
		})
	})

	describe("POST /api/profiles/switch", () => {
		beforeEach(() => {
			mockClineApi.sidebarProvider.configManager = {
				hasConfig: jest.fn<Promise<boolean>, [string]>().mockResolvedValue(true),
				loadConfig: jest.fn().mockResolvedValue({
					id: "test-id",
					apiProvider: "anthropic",
				}),
				setCurrentConfig: jest.fn().mockResolvedValue(undefined),
				listConfig: jest.fn().mockResolvedValue([{ name: "test", id: "test-id", apiProvider: "anthropic" }]),
			} as any
			mockClineApi.sidebarProvider.updateGlobalState = jest.fn().mockResolvedValue(undefined)
			mockClineApi.sidebarProvider.postStateToWebview = jest.fn().mockResolvedValue(undefined)
		})

		it("should switch profile successfully", async () => {
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/profiles/switch",
				body: { name: "test" },
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({ message: "Switched to profile 'test'" })
			expect(mockClineApi.sidebarProvider.configManager.hasConfig).toHaveBeenCalledWith("test")
			expect(mockClineApi.sidebarProvider.configManager.loadConfig).toHaveBeenCalledWith("test")
			expect(mockClineApi.sidebarProvider.configManager.setCurrentConfig).toHaveBeenCalledWith("test")
			expect(mockClineApi.sidebarProvider.updateGlobalState).toHaveBeenCalledWith("currentApiConfigName", "test")
			expect(mockClineApi.sidebarProvider.postStateToWebview).toHaveBeenCalled()
		})

		it("should validate profile name", async () => {
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/profiles/switch",
				body: {},
			})

			expect(response.status).toBe(400)
			expect(response.body.error).toBe("Profile name is required")
		})

		it("should return 404 when profile does not exist", async () => {
			const hasConfig = mockClineApi.sidebarProvider.configManager.hasConfig as jest.Mock
			hasConfig.mockResolvedValue(false)

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/profiles/switch",
				body: { name: "non-existent" },
			})

			expect(response.status).toBe(404)
			expect(response.body.error).toBe("Profile 'non-existent' not found")
		})

		it("should handle errors", async () => {
			const hasConfig = mockClineApi.sidebarProvider.configManager.hasConfig as jest.Mock
			hasConfig.mockRejectedValue(new Error("Failed to check config"))

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/profiles/switch",
				body: { name: "test" },
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to check config")
		})
	})

	describe("GET /api/tasks/status", () => {
		beforeEach(() => {
			// Mock the task history and data
			mockClineApi.sidebarProvider.getGlobalState = jest.fn().mockResolvedValue([
				{ id: "task-1", ts: 1000 },
				{ id: "task-2", ts: 2000 },
			])
			mockClineApi.sidebarProvider.getTaskWithId = jest.fn().mockResolvedValue({
				historyItem: { id: "task-2" },
				uiMessagesFilePath: "/test/path/messages.json",
			})
			;(fs.readFile as jest.Mock).mockResolvedValue(
				JSON.stringify([
					{ type: "assistant", content: "Hello" },
					{ type: "user", content: "Hi" },
				]),
			)
		})

		it("should return current task status successfully", async () => {
			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks/status",
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({
				id: "task-2",
				status: "waiting_for_response",
				lastMessage: "Hi",
			})
			expect(mockClineApi.sidebarProvider.getGlobalState).toHaveBeenCalledWith("taskHistory")
			expect(mockClineApi.sidebarProvider.getTaskWithId).toHaveBeenCalledWith("task-2")
		})

		it("should return 404 when no tasks exist", async () => {
			mockClineApi.sidebarProvider.getGlobalState = jest.fn().mockResolvedValue([])

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks/status",
			})

			expect(response.status).toBe(404)
			expect(response.body.error).toBe("No active task found")
		})

		it("should handle errors", async () => {
			mockClineApi.sidebarProvider.getGlobalState = jest
				.fn()
				.mockRejectedValue(new Error("Failed to get task history"))

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks/status",
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to get task status")
		})
	})

	describe("GET /api/tasks/:id/status", () => {
		beforeEach(() => {
			// Mock the task data
			mockClineApi.sidebarProvider.getTaskWithId = jest.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
				uiMessagesFilePath: "/test/path/messages.json",
			})
			;(fs.readFile as jest.Mock).mockResolvedValue(
				JSON.stringify([
					{ type: "assistant", content: "Hello" },
					{ type: "user", content: "Hi" },
				]),
			)
		})

		it("should return task status successfully", async () => {
			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks/test-task-id/status",
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({
				id: "test-task-id",
				status: "waiting_for_response",
				lastMessage: "Hi",
			})
			expect(mockClineApi.sidebarProvider.getTaskWithId).toHaveBeenCalledWith("test-task-id")
		})

		it("should return 404 when task is not found", async () => {
			mockClineApi.sidebarProvider.getTaskWithId = jest.fn().mockRejectedValue(new Error("Task not found"))

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks/non-existent-id/status",
			})

			expect(response.status).toBe(404)
			expect(response.body.error).toBe("Task not found")
		})

		it("should handle errors", async () => {
			mockClineApi.sidebarProvider.getTaskWithId = jest.fn().mockRejectedValue(new Error("Failed to get task"))

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks/test-task-id/status",
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to get task status")
		})
	})

	describe("GET /api/tasks/logs", () => {
		beforeEach(() => {
			// Mock the task history and data
			mockClineApi.sidebarProvider.getGlobalState = jest.fn().mockResolvedValue([
				{ id: "task-1", ts: 1000 },
				{ id: "task-2", ts: 2000 },
			])
			mockClineApi.sidebarProvider.getTaskWithId = jest.fn().mockResolvedValue({
				historyItem: { id: "task-2" },
				uiMessagesFilePath: "/test/path/messages.json",
				apiConversationHistoryFilePath: "/test/path/api_conversation.json",
			})
			;(fs.readFile as jest.Mock).mockImplementation((path: string) => {
				if (path.endsWith("messages.json")) {
					return Promise.resolve(
						JSON.stringify([
							{ type: "assistant", content: "Hello" },
							{ type: "user", content: "Hi" },
						]),
					)
				}
				if (path.endsWith("api_conversation.json")) {
					return Promise.resolve(
						JSON.stringify([
							{ role: "assistant", content: "API Hello" },
							{ role: "user", content: "API Hi" },
						]),
					)
				}
				return Promise.reject(new Error("File not found"))
			})
		})

		it("should return current task logs successfully", async () => {
			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks/logs",
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({
				id: "task-2",
				messages: [
					{ type: "assistant", content: "Hello" },
					{ type: "user", content: "Hi" },
				],
				apiConversation: [
					{ role: "assistant", content: "API Hello" },
					{ role: "user", content: "API Hi" },
				],
			})
			expect(mockClineApi.sidebarProvider.getGlobalState).toHaveBeenCalledWith("taskHistory")
			expect(mockClineApi.sidebarProvider.getTaskWithId).toHaveBeenCalledWith("task-2")
		})

		it("should return 404 when no tasks exist", async () => {
			mockClineApi.sidebarProvider.getGlobalState = jest.fn().mockResolvedValue([])

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks/logs",
			})

			expect(response.status).toBe(404)
			expect(response.body.error).toBe("No active task found")
		})

		it("should handle errors", async () => {
			mockClineApi.sidebarProvider.getGlobalState = jest
				.fn()
				.mockRejectedValue(new Error("Failed to get task history"))

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks/logs",
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to get task logs")
		})
	})

	describe("GET /api/tasks/:id/logs", () => {
		beforeEach(() => {
			// Mock the task data
			mockClineApi.sidebarProvider.getTaskWithId = jest.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
				uiMessagesFilePath: "/test/path/messages.json",
				apiConversationHistoryFilePath: "/test/path/api_conversation.json",
			})
			;(fs.readFile as jest.Mock).mockImplementation((path: string) => {
				if (path.endsWith("messages.json")) {
					return Promise.resolve(
						JSON.stringify([
							{ type: "assistant", content: "Hello" },
							{ type: "user", content: "Hi" },
						]),
					)
				}
				if (path.endsWith("api_conversation.json")) {
					return Promise.resolve(
						JSON.stringify([
							{ role: "assistant", content: "API Hello" },
							{ role: "user", content: "API Hi" },
						]),
					)
				}
				return Promise.reject(new Error("File not found"))
			})
		})

		it("should return task logs successfully", async () => {
			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks/test-task-id/logs",
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({
				id: "test-task-id",
				messages: [
					{ type: "assistant", content: "Hello" },
					{ type: "user", content: "Hi" },
				],
				apiConversation: [
					{ role: "assistant", content: "API Hello" },
					{ role: "user", content: "API Hi" },
				],
			})
			expect(mockClineApi.sidebarProvider.getTaskWithId).toHaveBeenCalledWith("test-task-id")
		})

		it("should return 404 when task is not found", async () => {
			mockClineApi.sidebarProvider.getTaskWithId = jest.fn().mockRejectedValue(new Error("Task not found"))

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks/non-existent-id/logs",
			})

			expect(response.status).toBe(404)
			expect(response.body.error).toBe("Task not found")
		})

		it("should handle errors", async () => {
			mockClineApi.sidebarProvider.getTaskWithId = jest.fn().mockRejectedValue(new Error("Failed to get task"))

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks/test-task-id/logs",
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to get task logs")
		})
	})

	describe("GET /api/tasks", () => {
		beforeEach(() => {
			// Mock task history data
			mockClineApi.sidebarProvider.getGlobalState = jest.fn().mockResolvedValue([
				{
					id: "task-1",
					task: "First task",
					ts: 1000,
					tokensIn: 10,
					tokensOut: 20,
					totalCost: 0.001,
				},
				{
					id: "task-2",
					task: "Second task",
					ts: 2000,
					tokensIn: 15,
					tokensOut: 25,
					totalCost: 0.002,
				},
				{
					id: "task-3",
					task: "Third task",
					ts: 3000,
					tokensIn: 20,
					tokensOut: 30,
					totalCost: 0.003,
				},
			])
		})

		it("should return tasks successfully with default limit", async () => {
			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks",
			})

			expect(response.status).toBe(200)
			expect(response.body).toHaveLength(3)
			expect(response.body[0]).toEqual({
				id: "task-3",
				message: "Third task",
				timestamp: 3000,
				tokensIn: 20,
				tokensOut: 30,
				cost: 0.003,
			})
			expect(mockClineApi.sidebarProvider.getGlobalState).toHaveBeenCalledWith("taskHistory")
		})

		it("should respect the limit parameter", async () => {
			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks?limit=2",
			})

			expect(response.status).toBe(200)
			expect(response.body).toHaveLength(2)
			expect(response.body[0].id).toBe("task-3")
			expect(response.body[1].id).toBe("task-2")
		})

		it("should return empty array when no tasks exist", async () => {
			mockClineApi.sidebarProvider.getGlobalState = jest.fn().mockResolvedValue([])

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks",
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual([])
		})

		it("should handle errors", async () => {
			mockClineApi.sidebarProvider.getGlobalState = jest
				.fn()
				.mockRejectedValue(new Error("Failed to get task history"))

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/tasks",
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to list tasks")
		})
	})

	describe("GET /api/auto-approve", () => {
		it("should return auto-approve settings successfully", async () => {
			// Mock the state
			const mockState = {
				autoApprovalEnabled: true,
				alwaysAllowReadOnly: true,
				alwaysAllowWrite: false,
				alwaysAllowExecute: true,
				alwaysAllowBrowser: false,
				alwaysAllowMcp: true,
				alwaysApproveResubmit: false,
			}
			mockClineApi.sidebarProvider.getState = jest.fn().mockResolvedValue(mockState)

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/auto-approve",
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual(mockState)
			expect(mockClineApi.sidebarProvider.getState).toHaveBeenCalled()
		})

		it("should handle errors", async () => {
			mockClineApi.sidebarProvider.getState = jest.fn().mockRejectedValue(new Error("test error"))

			const response = await retryRequest({
				port,
				method: "GET",
				path: "/api/auto-approve",
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to get auto-approve settings")
		})
	})

	describe("POST /api/auto-approve", () => {
		beforeEach(() => {
			mockClineApi.sidebarProvider.updateGlobalState = jest.fn().mockResolvedValue(undefined)
			mockClineApi.sidebarProvider.postStateToWebview = jest.fn().mockResolvedValue(undefined)
		})

		it("should update settings successfully", async () => {
			const settings = {
				autoApprovalEnabled: true,
				alwaysAllowReadOnly: true,
				alwaysAllowWrite: false,
				alwaysAllowExecute: true,
				alwaysAllowBrowser: false,
				alwaysAllowMcp: true,
				alwaysApproveResubmit: false,
			}

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/auto-approve",
				body: settings,
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({ success: true })
			expect(mockClineApi.sidebarProvider.updateGlobalState).toHaveBeenCalledTimes(7)
			expect(mockClineApi.sidebarProvider.postStateToWebview).toHaveBeenCalled()
		})

		it("should validate boolean fields", async () => {
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/auto-approve",
				body: { autoApprovalEnabled: "not a boolean" },
			})

			expect(response.status).toBe(400)
			expect(response.body.error).toBe("autoApprovalEnabled must be a boolean")
		})

		it("should handle errors", async () => {
			mockClineApi.sidebarProvider.updateGlobalState = jest.fn().mockRejectedValue(new Error("test error"))

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/auto-approve",
				body: { autoApprovalEnabled: true },
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to update auto-approve settings")
		})
	})

	describe("POST /api/auto-approve/enabled", () => {
		beforeEach(() => {
			mockClineApi.sidebarProvider.updateGlobalState = jest.fn().mockResolvedValue(undefined)
			mockClineApi.sidebarProvider.postStateToWebview = jest.fn().mockResolvedValue(undefined)
		})

		it("should update master switch successfully", async () => {
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/auto-approve/enabled",
				body: { enabled: true },
			})

			expect(response.status).toBe(200)
			expect(response.body).toEqual({ success: true })
			expect(mockClineApi.sidebarProvider.updateGlobalState).toHaveBeenCalledWith("autoApprovalEnabled", true)
			expect(mockClineApi.sidebarProvider.postStateToWebview).toHaveBeenCalled()
		})

		it("should validate enabled field is boolean", async () => {
			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/auto-approve/enabled",
				body: { enabled: "not a boolean" },
			})

			expect(response.status).toBe(400)
			expect(response.body.error).toBe("enabled must be a boolean")
		})

		it("should handle errors", async () => {
			mockClineApi.sidebarProvider.updateGlobalState = jest.fn().mockRejectedValue(new Error("test error"))

			const response = await retryRequest({
				port,
				method: "POST",
				path: "/api/auto-approve/enabled",
				body: { enabled: true },
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to update auto-approve enabled setting")
		})
	})
})
