import express from "express"
import { Request, Response, NextFunction } from "express"
import { Server } from "http"
import { ClineAPI } from "../../exports"
import * as vscode from "vscode"

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
	private app: express.Express
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
			return next()
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
	 */
	private setupRoutes(): void {
		// Get custom instructions
		this.app.get("/api/instructions", async (req: Request, res: Response) => {
			try {
				const instructions = await this.clineApi.getCustomInstructions()
				return res.json({ instructions })
			} catch (error) {
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
				return res.status(500).json({ error: "Failed to set instructions" })
			}
		})

		// Start new task
		this.app.post("/api/tasks", async (req: Request, res: Response) => {
			try {
				const { message, images } = req.body
				if (message && typeof message !== "string") {
					return res.status(400).json({ error: "Invalid message format" })
				}
				if (images && !Array.isArray(images)) {
					return res.status(400).json({ error: "Invalid images format" })
				}
				await this.clineApi.startNewTask(message, images)
				return res.json({ success: true })
			} catch (error) {
				return res.status(500).json({ error: "Failed to start task" })
			}
		})

		// Send message
		this.app.post("/api/messages", async (req: Request, res: Response) => {
			try {
				const { message, images } = req.body
				if (message && typeof message !== "string") {
					return res.status(400).json({ error: "Invalid message format" })
				}
				if (images && !Array.isArray(images)) {
					return res.status(400).json({ error: "Invalid images format" })
				}
				await this.clineApi.sendMessage(message, images)
				return res.json({ success: true })
			} catch (error) {
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
				this.server = this.app.listen(this.config.port, "0.0.0.0", () => {
					resolve()
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
				return resolve()
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
