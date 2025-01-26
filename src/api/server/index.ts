import express, { Request, Response, NextFunction } from "express"
import { Server } from "http"
import { ClineAPI } from "../../exports"
import * as vscode from "vscode"
import { Mode, modes, getModeBySlug } from "../../shared/modes"
import { ModeConfig } from "../../shared/modes"

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

		// Start new task
		this.app.post("/api/tasks", async (req: Request, res: Response) => {
			try {
				const { message, images } = req.body
				if (message !== undefined && typeof message !== "string") {
					return res.status(400).json({ error: "Invalid message format" })
				}
				if (images !== undefined && !Array.isArray(images)) {
					return res.status(400).json({ error: "Invalid images format" })
				}
				await this.clineApi.startNewTask(message, images)
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
