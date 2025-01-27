import express, { Request, Response, NextFunction } from "express"
import { Server } from "http"
import { ClineAPI } from "../../exports"
import * as vscode from "vscode"
import { Mode, modes, getModeBySlug } from "../../shared/modes"
import { ModeConfig } from "../../shared/modes"
import * as fs from "fs/promises"
import { HistoryItem } from "../../shared/HistoryItem"
import { ClineMessage } from "../../shared/ExtensionMessage"

/**
 * Configuration options for the external API server
 */
export interface ExternalApiServerConfig {
	/** Port number the server will listen on */
	port: number
	/** List of allowed origins for CORS. If empty, all origins are allowed */
	allowedHosts?: string[]
}

/**
 * External API server that provides HTTP endpoints for interacting with RooCode
 * Enables programmatic control of RooCode features through a REST API
 */
export class ExternalApiServer {
	private app: express.Application
	private server: Server | null = null
	private config: ExternalApiServerConfig
	private clineApi: ClineAPI

	/**
	 * Creates a new instance of the external API server
	 * @param config - Server configuration options
	 * @param clineApi - Instance of ClineAPI to handle RooCode operations
	 */
	constructor(config: ExternalApiServerConfig, clineApi: ClineAPI) {
		this.config = config
		this.clineApi = clineApi
		this.app = express()
		this.setupMiddleware()
		this.setupRoutes()
	}

	/**
	 * Sets up middleware for parsing JSON and handling CORS
	 */
	private setupMiddleware(): void {
		this.app.use(express.json())

		// Security middleware
		this.app.use((req: Request, res: Response, next: NextFunction) => {
			const origin = req.get("origin")
			if (this.config.allowedHosts && origin) {
				if (!this.config.allowedHosts.includes(origin)) {
					return res.status(403).json({ error: "Origin not allowed" })
				}
			}
			// Set CORS headers
			res.setHeader("Access-Control-Allow-Origin", origin || "*")
			res.setHeader("Access-Control-Allow-Methods", "GET, POST")
			res.setHeader("Access-Control-Allow-Headers", "Content-Type")
			next()
			return
		})
	}

	/**
	 * Sets up API routes for the server
	 *
	 * Endpoints:
	 * - GET /api/instructions: Get custom instructions
	 * - POST /api/instructions: Set custom instructions
	 * - POST /api/tasks: Start a new task
	 * - POST /api/messages: Send a message
	 * - GET /api/modes: Get all available modes
	 * - GET /api/modes/current: Get current mode
	 * - POST /api/modes/switch: Switch to a specified mode
	 * - GET /api/profiles: Get all available profiles
	 * - GET /api/profiles/current: Get current profile
	 * - POST /api/profiles/switch: Switch to a specified profile
	 * - GET /api/tasks/status: Get task status for current task
	 * - GET /api/tasks/:id/status: Get task status for a specific task
	 * - GET /api/tasks/logs: Get task logs for current task
	 * - GET /api/tasks/:id/logs: Get task logs for a specific task
	 * - GET /api/tasks: List tasks with pagination, sorting by recency, and including task metadata
	 * - GET /api/auto-approve: Get all auto-approve settings
	 * - POST /api/auto-approve: Update all auto-approve settings
	 * - POST /api/auto-approve/enabled: Update master auto-approve switch
	 * - GET /api/mcps: Get all MCPs with their status
	 * - GET /api/mcps/:id: Get detailed MCP information
	 * - POST /api/mcps/:id/status: Enable/disable an MCP
	 */
	private setupRoutes(): void {
		// Get custom instructions
		this.app.get("/api/instructions", async (req: Request, res: Response) => {
			try {
				const instructions = await this.clineApi.getCustomInstructions()
				return res.json({ instructions })
			} catch (error) {
				console.error("Error getting instructions:", error)
				return res.status(500).json({ error: "Failed to get instructions" })
			}
		})

		// Set custom instructions
		this.app.post("/api/instructions", async (req: Request, res: Response) => {
			try {
				const { instructions } = req.body
				if (typeof instructions !== "string") {
					return res.status(400).json({ error: "Invalid instructions format" })
				}
				await this.clineApi.setCustomInstructions(instructions)
				return res.json({ success: true })
			} catch (error) {
				console.error("Error setting instructions:", error)
				return res.status(500).json({ error: "Failed to set instructions" })
			}
		})

		// Get all modes
		this.app.get("/api/modes", async (req: Request, res: Response) => {
			try {
				const customModes = await this.clineApi.sidebarProvider.customModesManager.getCustomModes()
				return res.json({
					builtIn: modes,
					custom: customModes,
				})
			} catch (error) {
				console.error("Error getting modes:", error)
				return res.status(500).json({ error: "Failed to get modes" })
			}
		})

		// Get current mode
		this.app.get("/api/modes/current", async (req: Request, res: Response) => {
			try {
				const state = await this.clineApi.sidebarProvider.getState()
				if (!state?.mode) {
					return res.status(404).json({ error: "Current mode not found" })
				}

				// Check built-in modes first
				const builtInMode = getModeBySlug(state.mode)
				if (builtInMode) {
					return res.json(builtInMode)
				}

				// Check custom modes
				const customModes = await this.clineApi.sidebarProvider.customModesManager.getCustomModes()
				const customMode = customModes.find((mode) => mode.slug === state.mode)
				if (customMode) {
					return res.json(customMode)
				}

				return res.status(404).json({ error: "Current mode not found" })
			} catch (error) {
				console.error("Error getting current mode:", error)
				return res.status(500).json({ error: "Failed to get current mode" })
			}
		})

		// Switch mode
		this.app.post("/api/modes/switch", async (req: Request, res: Response) => {
			try {
				const { mode } = req.body
				if (typeof mode !== "string") {
					return res.status(400).json({ error: "Mode must be a string" })
				}

				const customModes = await this.clineApi.sidebarProvider.customModesManager.getCustomModes()
				const modeConfig = getModeBySlug(mode, customModes)
				if (!modeConfig) {
					return res.status(404).json({ error: "Mode not found" })
				}

				await this.clineApi.sidebarProvider.handleModeSwitch(mode)
				return res.json({ message: "Mode switched successfully" })
			} catch (error) {
				console.error("Error switching mode:", error)
				return res.status(500).json({ error: "Failed to switch mode" })
			}
		})

		// Get all profiles
		this.app.get("/api/profiles", async (req, res) => {
			try {
				const profiles = await this.clineApi.sidebarProvider.configManager.listConfig()
				return res.json(profiles)
			} catch (error) {
				return res.status(500).json({ error: error.message })
			}
		})

		// Get current profile
		this.app.get("/api/profiles/current", async (req, res) => {
			try {
				const currentApiConfigName = (await this.clineApi.sidebarProvider.getGlobalState(
					"currentApiConfigName",
				)) as string
				if (!currentApiConfigName) {
					return res.status(404).json({ error: "Current profile not found" })
				}
				const config = await this.clineApi.sidebarProvider.configManager.loadConfig(currentApiConfigName)
				return res.json({
					name: currentApiConfigName,
					id: config.id,
					apiProvider: config.apiProvider,
				})
			} catch (error) {
				return res.status(500).json({ error: error.message })
			}
		})

		// Switch profile
		this.app.post("/api/profiles/switch", async (req, res) => {
			try {
				const { name } = req.body
				if (!name) {
					return res.status(400).json({ error: "Profile name is required" })
				}

				const hasProfile = await this.clineApi.sidebarProvider.configManager.hasConfig(name)
				if (!hasProfile) {
					return res.status(404).json({ error: `Profile '${name}' not found` })
				}

				// Load the config first to validate it
				const config = await this.clineApi.sidebarProvider.configManager.loadConfig(name)

				// Set it as current
				await this.clineApi.sidebarProvider.configManager.setCurrentConfig(name)

				// Update global state
				await this.clineApi.sidebarProvider.updateGlobalState("currentApiConfigName", name)
				const listApiConfigMeta = await this.clineApi.sidebarProvider.configManager.listConfig()
				await this.clineApi.sidebarProvider.updateGlobalState("listApiConfigMeta", listApiConfigMeta)

				// Update the API configuration
				await this.clineApi.sidebarProvider.postStateToWebview()

				return res.json({ message: `Switched to profile '${name}'` })
			} catch (error) {
				return res.status(500).json({ error: error.message })
			}
		})

		// Helper function to determine task status from messages
		function determineTaskStatus(messages: ClineMessage[]): string {
			if (!messages || messages.length === 0) {
				return "waiting_for_response"
			}

			const lastMessage = messages[messages.length - 1]

			// Check for error state
			if (lastMessage.type === "say" && lastMessage.say === "error") {
				return "error"
			}

			// Check for task completion
			if (
				lastMessage.type === "say" &&
				lastMessage.say === "task" &&
				lastMessage.text?.includes("Task Completed")
			) {
				return "completed"
			}

			// Check for command approval needed
			if (lastMessage.type === "ask" && lastMessage.ask === "command") {
				return "needs_approval"
			}

			// Check for user input needed
			if (lastMessage.type === "ask") {
				return "needs_input"
			}

			// Check for API request in progress
			if (lastMessage.type === "say" && lastMessage.say === "api_req_started") {
				return "in_progress"
			}

			// Default to waiting for response if we have messages but no clear state
			return "waiting_for_response"
		}

		// Start new task
		this.app.post("/api/tasks", async (req: Request, res: Response) => {
			try {
				const { message, images, mode, profile, wait_for_completion = false } = req.body

				// Validate input parameters
				if (message !== undefined && typeof message !== "string") {
					return res.status(400).json({ error: "Invalid message format" })
				}
				if (images !== undefined && !Array.isArray(images)) {
					return res.status(400).json({ error: "Invalid images format" })
				}
				if (mode !== undefined && typeof mode !== "string") {
					return res.status(400).json({ error: "Mode must be a string" })
				}
				if (profile !== undefined && typeof profile !== "string") {
					return res.status(400).json({ error: "Profile must be a string" })
				}
				if (typeof wait_for_completion !== "boolean") {
					return res.status(400).json({ error: "wait_for_completion must be a boolean" })
				}

				// Switch mode if specified
				if (mode) {
					const customModes = await this.clineApi.sidebarProvider.customModesManager.getCustomModes()
					const modeConfig = getModeBySlug(mode, customModes)
					if (!modeConfig) {
						return res.status(404).json({ error: "Mode not found" })
					}
					await this.clineApi.sidebarProvider.handleModeSwitch(mode)
				}

				// Switch profile if specified
				if (profile) {
					const hasProfile = await this.clineApi.sidebarProvider.configManager.hasConfig(profile)
					if (!hasProfile) {
						return res.status(404).json({ error: `Profile '${profile}' not found` })
					}
					await this.clineApi.sidebarProvider.configManager.setCurrentConfig(profile)
					await this.clineApi.sidebarProvider.updateGlobalState("currentApiConfigName", profile)
					await this.clineApi.sidebarProvider.postStateToWebview()
				}

				// Start the task
				await this.clineApi.startNewTask(message, images)

				// If wait_for_completion is true, wait for task to complete or need input
				if (wait_for_completion) {
					const taskHistory =
						((await this.clineApi.sidebarProvider.getGlobalState("taskHistory")) as
							| HistoryItem[]
							| undefined) || []
					if (taskHistory.length === 0) {
						return res.status(500).json({ error: "Failed to start task" })
					}
					const currentTaskId = taskHistory[taskHistory.length - 1].id

					// Poll for task completion (max 120 seconds)
					let attempts = 0
					const maxAttempts = 120
					let lastStatus = "waiting_for_response"
					let lastMessageText = null

					while (attempts < maxAttempts) {
						try {
							const taskData = await this.clineApi.sidebarProvider.getTaskWithId(currentTaskId)
							let uiMessages: ClineMessage[] = []

							try {
								uiMessages = JSON.parse(await fs.readFile(taskData.uiMessagesFilePath, "utf8"))
							} catch (error) {
								// File might not exist yet, continue polling
								if (!(error instanceof Error && error.message.includes("ENOENT"))) {
									throw error
								}
							}

							// Only update status if we have messages
							if (uiMessages && uiMessages.length > 0) {
								lastStatus = determineTaskStatus(uiMessages)
								lastMessageText = uiMessages[uiMessages.length - 1]?.text || null

								// Return if we reach a terminal state or need user interaction
								if (
									lastStatus === "completed" ||
									lastStatus === "error" ||
									lastStatus === "needs_input" ||
									lastStatus === "needs_approval"
								) {
									const lastMessage = uiMessages[uiMessages.length - 1]
									const formattedLastMessage =
										lastMessage?.type === "ask"
											? `ask ${lastMessage.ask}: ${lastMessage.text}`
											: lastMessage?.text || null

									return res.json({
										id: currentTaskId,
										status: lastStatus,
										lastMessage: formattedLastMessage,
									})
								}
							}
						} catch (error) {
							// Only throw if it's not a file not found error
							if (!(error instanceof Error && error.message === "Task not found")) {
								throw error
							}
						}

						// Wait 1 second before next attempt
						await new Promise((resolve) => setTimeout(resolve, 1000))
						attempts++
					}

					// If we reach here, we timed out waiting for completion
					return res.json({
						id: currentTaskId,
						status: lastStatus,
						lastMessage: lastMessageText || "Timeout waiting for response",
					})
				}

				// Return success response if not waiting for completion
				return res.json({ success: true })
			} catch (error) {
				console.error("Error starting task:", error)
				return res.status(500).json({ error: "Failed to start task" })
			}
		})

		// Send message
		this.app.post("/api/messages", async (req: Request, res: Response) => {
			try {
				const { message, images } = req.body
				if (message !== undefined && typeof message !== "string") {
					return res.status(400).json({ error: "Invalid message format" })
				}
				if (images !== undefined && !Array.isArray(images)) {
					return res.status(400).json({ error: "Invalid images format" })
				}
				await this.clineApi.sendMessage(message, images)
				return res.json({ success: true })
			} catch (error) {
				console.error("Error sending message:", error)
				return res.status(500).json({ error: "Failed to send message" })
			}
		})

		// Send message to specific task
		this.app.post("/api/messages/:id", async (req: Request, res: Response) => {
			try {
				const { id } = req.params
				const { message, images } = req.body

				// Validate message format
				if (message !== undefined && typeof message !== "string") {
					return res.status(400).json({ error: "Invalid message format" })
				}
				if (images !== undefined && !Array.isArray(images)) {
					return res.status(400).json({ error: "Invalid images format" })
				}

				// Verify task exists
				try {
					await this.clineApi.sidebarProvider.getTaskWithId(id)
				} catch (error) {
					return res.status(404).json({ error: "Task not found" })
				}

				// Send message
				await this.clineApi.sendMessage(message, images)
				return res.json({ success: true })
			} catch (error) {
				console.error("Error sending message:", error)
				return res.status(500).json({ error: "Failed to send message" })
			}
		})

		// Get task status
		this.app.get("/api/tasks/status", async (req, res) => {
			try {
				const taskHistory =
					((await this.clineApi.sidebarProvider.getGlobalState("taskHistory")) as
						| HistoryItem[]
						| undefined) || []
				if (taskHistory.length === 0) {
					return res.status(404).json({ error: "No active task found" })
				}
				const currentTaskId = taskHistory[taskHistory.length - 1].id
				const taskData = await this.clineApi.sidebarProvider.getTaskWithId(currentTaskId)
				const uiMessages = JSON.parse(await fs.readFile(taskData.uiMessagesFilePath, "utf8"))
				const status = determineTaskStatus(uiMessages)
				const lastMessage = uiMessages[uiMessages.length - 1]
				const formattedLastMessage =
					lastMessage?.type === "ask"
						? `ask ${lastMessage.ask}: ${lastMessage.text}`
						: lastMessage?.text || null

				return res.json({
					id: currentTaskId,
					status,
					lastMessage: formattedLastMessage,
				})
			} catch (error) {
				console.error("Error getting task status:", error)
				return res.status(500).json({ error: "Failed to get task status" })
			}
		})

		this.app.get("/api/tasks/:id/status", async (req, res) => {
			try {
				const taskData = await this.clineApi.sidebarProvider.getTaskWithId(req.params.id)
				const uiMessages = JSON.parse(await fs.readFile(taskData.uiMessagesFilePath, "utf8"))
				const status = determineTaskStatus(uiMessages)
				const lastMessage = uiMessages[uiMessages.length - 1]
				const formattedLastMessage =
					lastMessage?.type === "ask"
						? `ask ${lastMessage.ask}: ${lastMessage.text}`
						: lastMessage?.text || null

				return res.json({
					id: req.params.id,
					status,
					lastMessage: formattedLastMessage,
				})
			} catch (error) {
				if (error instanceof Error && error.message === "Task not found") {
					return res.status(404).json({ error: "Task not found" })
				}
				console.error("Error getting task status:", error)
				return res.status(500).json({ error: "Failed to get task status" })
			}
		})

		// Get task logs
		this.app.get("/api/tasks/logs", async (req, res) => {
			try {
				const taskHistory =
					((await this.clineApi.sidebarProvider.getGlobalState("taskHistory")) as
						| HistoryItem[]
						| undefined) || []
				if (taskHistory.length === 0) {
					return res.status(404).json({ error: "No active task found" })
				}
				const currentTaskId = taskHistory[taskHistory.length - 1].id
				const taskData = await this.clineApi.sidebarProvider.getTaskWithId(currentTaskId)
				const uiMessages = JSON.parse(await fs.readFile(taskData.uiMessagesFilePath, "utf8"))
				const apiConversation = JSON.parse(await fs.readFile(taskData.apiConversationHistoryFilePath, "utf8"))

				return res.json({
					id: currentTaskId,
					messages: uiMessages,
					apiConversation,
				})
			} catch (error) {
				console.error("Error getting task logs:", error)
				return res.status(500).json({ error: "Failed to get task logs" })
			}
		})

		this.app.get("/api/tasks/:id/logs", async (req, res) => {
			try {
				const taskData = await this.clineApi.sidebarProvider.getTaskWithId(req.params.id)
				const uiMessages = JSON.parse(await fs.readFile(taskData.uiMessagesFilePath, "utf8"))
				const apiConversation = JSON.parse(await fs.readFile(taskData.apiConversationHistoryFilePath, "utf8"))

				return res.json({
					id: req.params.id,
					messages: uiMessages,
					apiConversation,
				})
			} catch (error) {
				if (error instanceof Error && error.message === "Task not found") {
					return res.status(404).json({ error: "Task not found" })
				}
				console.error("Error getting task logs:", error)
				return res.status(500).json({ error: "Failed to get task logs" })
			}
		})

		// List tasks
		this.app.get("/api/tasks", async (req: Request, res: Response) => {
			try {
				const limit = parseInt(req.query.limit as string) || 10
				const taskHistory =
					((await this.clineApi.sidebarProvider.getGlobalState("taskHistory")) as
						| HistoryItem[]
						| undefined) || []

				// Sort by timestamp descending and limit results
				const tasks = taskHistory
					.sort((a, b) => b.ts - a.ts)
					.slice(0, limit)
					.map((item) => ({
						id: item.id,
						message: item.task,
						timestamp: item.ts,
						tokensIn: item.tokensIn,
						tokensOut: item.tokensOut,
						cost: item.totalCost,
					}))

				return res.json(tasks)
			} catch (error) {
				console.error("Error listing tasks:", error)
				return res.status(500).json({ error: "Failed to list tasks" })
			}
		})

		// Get all auto-approve settings
		this.app.get("/api/auto-approve", async (req: Request, res: Response) => {
			try {
				const state = await this.clineApi.sidebarProvider.getState()
				return res.json({
					autoApprovalEnabled: state.autoApprovalEnabled ?? false,
					alwaysAllowReadOnly: state.alwaysAllowReadOnly ?? false,
					alwaysAllowWrite: state.alwaysAllowWrite ?? false,
					alwaysAllowExecute: state.alwaysAllowExecute ?? false,
					alwaysAllowBrowser: state.alwaysAllowBrowser ?? false,
					alwaysAllowMcp: state.alwaysAllowMcp ?? false,
					alwaysApproveResubmit: state.alwaysApproveResubmit ?? false,
				})
			} catch (error) {
				console.error("Error getting auto-approve settings:", error)
				return res.status(500).json({ error: "Failed to get auto-approve settings" })
			}
		})

		// Update all auto-approve settings
		this.app.post("/api/auto-approve", async (req: Request, res: Response) => {
			try {
				const {
					autoApprovalEnabled,
					alwaysAllowReadOnly,
					alwaysAllowWrite,
					alwaysAllowExecute,
					alwaysAllowBrowser,
					alwaysAllowMcp,
					alwaysApproveResubmit,
				} = req.body

				// Validate all fields are boolean
				const settings = {
					autoApprovalEnabled,
					alwaysAllowReadOnly,
					alwaysAllowWrite,
					alwaysAllowExecute,
					alwaysAllowBrowser,
					alwaysAllowMcp,
					alwaysApproveResubmit,
				}

				for (const [key, value] of Object.entries(settings)) {
					if (value !== undefined && typeof value !== "boolean") {
						return res.status(400).json({ error: `${key} must be a boolean` })
					}
				}

				// Update each setting if provided
				if (autoApprovalEnabled !== undefined) {
					await this.clineApi.sidebarProvider.updateGlobalState("autoApprovalEnabled", autoApprovalEnabled)
				}
				if (alwaysAllowReadOnly !== undefined) {
					await this.clineApi.sidebarProvider.updateGlobalState("alwaysAllowReadOnly", alwaysAllowReadOnly)
				}
				if (alwaysAllowWrite !== undefined) {
					await this.clineApi.sidebarProvider.updateGlobalState("alwaysAllowWrite", alwaysAllowWrite)
				}
				if (alwaysAllowExecute !== undefined) {
					await this.clineApi.sidebarProvider.updateGlobalState("alwaysAllowExecute", alwaysAllowExecute)
				}
				if (alwaysAllowBrowser !== undefined) {
					await this.clineApi.sidebarProvider.updateGlobalState("alwaysAllowBrowser", alwaysAllowBrowser)
				}
				if (alwaysAllowMcp !== undefined) {
					await this.clineApi.sidebarProvider.updateGlobalState("alwaysAllowMcp", alwaysAllowMcp)
				}
				if (alwaysApproveResubmit !== undefined) {
					await this.clineApi.sidebarProvider.updateGlobalState(
						"alwaysApproveResubmit",
						alwaysApproveResubmit,
					)
				}

				// Update webview state
				await this.clineApi.sidebarProvider.postStateToWebview()

				return res.json({ success: true })
			} catch (error) {
				console.error("Error updating auto-approve settings:", error)
				return res.status(500).json({ error: "Failed to update auto-approve settings" })
			}
		})

		// Update master auto-approve switch
		this.app.post("/api/auto-approve/enabled", async (req: Request, res: Response) => {
			try {
				const { enabled } = req.body
				if (typeof enabled !== "boolean") {
					return res.status(400).json({ error: "enabled must be a boolean" })
				}

				await this.clineApi.sidebarProvider.updateGlobalState("autoApprovalEnabled", enabled)
				await this.clineApi.sidebarProvider.postStateToWebview()

				return res.json({ success: true })
			} catch (error) {
				console.error("Error updating auto-approve enabled setting:", error)
				return res.status(500).json({ error: "Failed to update auto-approve enabled setting" })
			}
		})

		// Get all MCPs
		this.app.get("/api/mcps", async (req: Request, res: Response) => {
			try {
				if (!this.clineApi.sidebarProvider.mcpHub) {
					return res.status(500).json({ error: "MCP Hub not available" })
				}
				const servers = this.clineApi.sidebarProvider.mcpHub.getServers()
				const mcps = servers.map((server) => ({
					id: server.name,
					name: server.name,
					status: server.disabled ? "disabled" : server.status,
					description: server.error || undefined,
				}))
				return res.json(mcps)
			} catch (error) {
				console.error("Error getting MCPs:", error)
				return res.status(500).json({ error: "Failed to get MCPs" })
			}
		})

		// Get MCP details
		this.app.get("/api/mcps/:id", async (req: Request, res: Response) => {
			try {
				if (!this.clineApi.sidebarProvider.mcpHub) {
					return res.status(500).json({ error: "MCP Hub not available" })
				}

				const { id } = req.params
				const servers = this.clineApi.sidebarProvider.mcpHub.getServers()
				const server = servers.find((s) => s.name === id)

				if (!server) {
					return res.status(404).json({ error: "MCP not found" })
				}

				return res.json({
					id: server.name,
					name: server.name,
					status: server.disabled ? "disabled" : server.status,
					description: server.error || undefined,
					tools:
						server.tools?.map((tool) => ({
							name: tool.name,
							description: tool.description,
							parameters: tool.inputSchema,
						})) || [],
					metadata: {
						config: JSON.parse(server.config),
					},
				})
			} catch (error) {
				console.error("Error getting MCP details:", error)
				return res.status(500).json({ error: "Failed to get MCP details" })
			}
		})

		// Update MCP status
		this.app.post("/api/mcps/:id/status", async (req: Request, res: Response) => {
			try {
				if (!this.clineApi.sidebarProvider.mcpHub) {
					return res.status(500).json({ error: "MCP Hub not available" })
				}

				const { id } = req.params
				const { enabled } = req.body

				if (typeof enabled !== "boolean") {
					return res.status(400).json({ error: "enabled must be a boolean" })
				}

				const servers = this.clineApi.sidebarProvider.mcpHub.getServers()
				const server = servers.find((s) => s.name === id)

				if (!server) {
					return res.status(404).json({ error: "MCP not found" })
				}

				await this.clineApi.sidebarProvider.mcpHub.toggleServerDisabled(id, !enabled)

				return res.json({
					success: true,
					status: enabled ? "enabled" : "disabled",
				})
			} catch (error) {
				console.error("Error updating MCP status:", error)
				return res.status(500).json({ error: "Failed to update MCP status" })
			}
		})
	}

	/**
	 * Starts the API server
	 * @returns Promise that resolves when the server is listening
	 * @throws Error if the server fails to start
	 */
	public async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				// Listen on both IPv4 and IPv6
				this.server = this.app.listen(this.config.port, () => {
					console.log(`External API server is running on port ${this.config.port}`)
					resolve()
				})

				// Handle server errors
				this.server.on("error", (error) => {
					reject(error)
				})
			} catch (error) {
				reject(error)
			}
		})
	}

	/**
	 * Stops the API server if it is running
	 * @returns Promise that resolves when the server has stopped
	 * @throws Error if the server fails to stop cleanly
	 */
	public async stop(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.server) {
				resolve()
				return
			}
			this.server.close((error) => {
				if (error) {
					reject(error)
				} else {
					this.server = null
					resolve()
				}
			})
		})
	}
}
