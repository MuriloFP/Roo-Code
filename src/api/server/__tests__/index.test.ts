import { ExternalApiServer, ExternalApiServerConfig } from "../index"
import { ClineAPI } from "../../../exports"
import * as http from "http"

jest.mock("../../../exports")

// Helper function to get a random port number between 3001-4000
function getRandomPort(): number {
	return Math.floor(Math.random() * 1000) + 3001
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
	let mockClineApi: jest.Mocked<ClineAPI>
	let config: ExternalApiServerConfig
	let port: number

	// Increase timeout for all tests in this suite
	jest.setTimeout(15000)

	beforeEach(async () => {
		port = getRandomPort()
		mockClineApi = {
			getCustomInstructions: jest.fn(),
			setCustomInstructions: jest.fn(),
			startNewTask: jest.fn(),
			sendMessage: jest.fn(),
			pressPrimaryButton: jest.fn(),
			pressSecondaryButton: jest.fn(),
			sidebarProvider: {} as any,
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
			const response = await makeRequest({
				port,
				method: "GET",
				path: "/api/instructions",
				headers: { Origin: "http://localhost:3000" },
			})

			expect(response.status).not.toBe(403)
		})

		it("should block requests from disallowed origins", async () => {
			const response = await makeRequest({
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

			const response = await makeRequest({
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

			const response = await makeRequest({
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

			const response = await makeRequest({
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
			const response = await makeRequest({
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

			const response = await makeRequest({
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

			const response = await makeRequest({
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
			const response = await makeRequest({
				port,
				method: "POST",
				path: "/api/tasks",
				body: { message: 123 },
			})

			expect(response.status).toBe(400)
			expect(response.body.error).toBe("Invalid message format")
		})

		it("should validate images format", async () => {
			const response = await makeRequest({
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

			const response = await makeRequest({
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

			const response = await makeRequest({
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
			const response = await makeRequest({
				port,
				method: "POST",
				path: "/api/messages",
				body: { message: 123 },
			})

			expect(response.status).toBe(400)
			expect(response.body.error).toBe("Invalid message format")
		})

		it("should validate images format", async () => {
			const response = await makeRequest({
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

			const response = await makeRequest({
				port,
				method: "POST",
				path: "/api/messages",
				body: { message: "test" },
			})

			expect(response.status).toBe(500)
			expect(response.body.error).toBe("Failed to send message")
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
