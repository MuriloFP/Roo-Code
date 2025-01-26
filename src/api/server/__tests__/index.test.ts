import { ExternalApiServer, ExternalApiServerConfig } from "../index"
import { ClineAPI } from "../../../exports"
import * as http from "http"
import { modes, ModeConfig, getModeBySlug } from "../../../shared/modes"
import delay from "delay"

jest.mock("../../../exports")

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
		it("should start task successfully", async () => {
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
})
