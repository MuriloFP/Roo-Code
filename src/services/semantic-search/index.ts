import {
	CodeDefinition,
	convertSegmentToDefinition,
	SearchResult,
	SearchResultType,
	FileSearchResult,
	CodeSearchResult,
} from "./types"
import { Vector, VectorSearchResult, VectorWithMetadata } from "./vector-store/types"
import { WorkspaceCache } from "./cache/workspace-cache"
import * as path from "path"
import { EmbeddingModel } from "./embeddings/types"
import { MiniLMModel } from "./embeddings/minilm"
import * as vscode from "vscode"
import { TreeSitterParser } from "./parser/tree-sitter"
import { LanceDBVectorStore } from "./vector-store/lancedb"
import * as crypto from "crypto"

export type ModelType = "minilm"

export interface SemanticSearchConfig {
	/**
	 * Directory to store model files and cache
	 */
	storageDir: string

	/**
	 * Maximum number of results to return
	 */
	maxResults?: number

	/**
	 * Whether to normalize embeddings
	 */
	normalizeEmbeddings?: boolean

	/**
	 * Context for storage and paths
	 */
	context: vscode.ExtensionContext

	/**
	 * Model type to use (default: minilm)
	 */
	modelType?: ModelType
}

export enum WorkspaceIndexStatus {
	NotIndexed = "Not indexed",
	Indexing = "Indexing",
	Indexed = "Indexed",
}

export class SemanticSearchService {
	// Supported file extensions for semantic search
	private static readonly SUPPORTED_CODE_EXTENSIONS = new Set([
		"js",
		"jsx",
		"ts",
		"tsx", // JavaScript/TypeScript
		"py", // Python
		"rs", // Rust
		"go", // Go
		"cpp",
		"hpp", // C++
		"c",
		"h", // C
		"cs", // C#
		"rb", // Ruby
		"java", // Java
		"php", // PHP
		"swift", // Swift
	])

	// Maximum size for text files (5MB)
	private static readonly MAX_TEXT_FILE_SIZE = 5 * 1024 * 1024
	private static readonly SNIPPET_CONTEXT_LINES = 3 // Lines of context around matches
	private static readonly MAX_SNIPPET_LENGTH = 1000 // Maximum characters per snippet
	private static readonly MAX_SNIPPETS_PER_FILE = 3 // Maximum number of snippets to extract

	private static async isTextFile(filePath: string): Promise<boolean> {
		const stats = await vscode.workspace.fs.stat(vscode.Uri.file(filePath))

		// Check if path is a directory
		if (stats.type === vscode.FileType.Directory) {
			return false
		}

		if (stats.size > this.MAX_TEXT_FILE_SIZE) {
			return false
		}

		const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))

		// Check for null bytes and other control characters (except common ones like newline, tab)
		const sampleSize = Math.min(4096, fileContent.length)
		for (let i = 0; i < sampleSize; i++) {
			if (fileContent[i] === 0 || (fileContent[i] < 32 && ![9, 10, 13].includes(fileContent[i]))) {
				return false
			}
		}

		// Check if the buffer is valid UTF-8
		if (!this.isValidUtf8(fileContent)) {
			return false
		}

		// Heuristic check for ASCII printable characters
		let validBytes = 0
		for (let i = 0; i < fileContent.length; i++) {
			const byte = fileContent[i]
			if (
				byte === 0x09 || // Tab
				byte === 0x0a || // Line Feed
				byte === 0x0d || // Carriage Return
				(byte >= 0x20 && byte <= 0x7e) // Printable ASCII
			) {
				validBytes++
			}
		}

		const ratio = validBytes / fileContent.length
		return ratio >= 0.95 // 95% threshold
	}

	private static isValidUtf8(buffer: Uint8Array): boolean {
		// Check if buffer can be converted to UTF-8 without replacement characters
		const str = new TextDecoder().decode(buffer)
		return !str.includes("\ufffd") // No replacement characters found
	}

	// Check if a file is supported for indexing
	public static async isFileSupported(filePath: string): Promise<boolean> {
		const ext = path.extname(filePath).toLowerCase().slice(1)
		return this.SUPPORTED_CODE_EXTENSIONS.has(ext) || (await this.isTextFile(filePath))
	}

	// Check if a file should be treated as a code file (parsed with tree-sitter)
	private static isCodeFile(filePath: string): boolean {
		const ext = path.extname(filePath).toLowerCase().slice(1)
		return this.SUPPORTED_CODE_EXTENSIONS.has(ext)
	}

	private statuses = new Map<string, WorkspaceIndexStatus>()
	private model: EmbeddingModel
	private store!: LanceDBVectorStore
	private cache: WorkspaceCache
	private initialized = false
	private initializationError: Error | null = null
	private parser: TreeSitterParser

	constructor(private config: SemanticSearchConfig) {
		const workspaceId = this.getWorkspaceId(config.context)
		const modelConfig = {
			modelPath: path.join(config.storageDir, "models"),
			normalize: config.normalizeEmbeddings ?? true,
		}

		this.model = new MiniLMModel(modelConfig)
		this.cache = new WorkspaceCache(config.context.globalState, workspaceId)
		this.parser = new TreeSitterParser()

		// Initialize status as NotIndexed
		this.updateStatus(WorkspaceIndexStatus.NotIndexed)
	}

	private getWorkspaceId(context: vscode.ExtensionContext): string {
		// Use the workspace folder path as the ID
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (workspaceFolders && workspaceFolders.length > 0) {
			return workspaceFolders[0].uri.fsPath
		}
		// Fallback to extension context storage path
		return context.storagePath || "global"
	}

	public updateStatus(status: WorkspaceIndexStatus): void {
		const workspaceId = this.getWorkspaceId(this.config.context)
		this.statuses.set(workspaceId, status)
	}

	public getStatus(): WorkspaceIndexStatus {
		const workspaceId = this.getWorkspaceId(this.config.context)
		return this.statuses.get(workspaceId) || WorkspaceIndexStatus.NotIndexed
	}

	/**
	 * Initializes the semantic search service by:
	 * 1. Setting the workspace status to 'Indexing'
	 * 2. Initializing the vector store with the workspace ID
	 * 3. Initializing the embedding model with retry logic
	 * 4. Verifying model initialization with a test embedding
	 * 5. Loading persisted vectors from the store
	 *
	 * The initialization process includes robust error handling and retry mechanisms:
	 * - Model initialization is attempted up to 3 times with increasing delays
	 * - Detailed error logging is performed for debugging
	 * - Status is updated appropriately based on success/failure
	 * - Initialization errors are stored for later reference
	 *
	 * @throws {Error} If initialization fails after all retry attempts
	 * @returns {Promise<void>} Resolves when initialization is complete
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			console.log("Semantic search service already initialized")
			return
		}

		this.updateStatus(WorkspaceIndexStatus.Indexing)
		this.initializationError = null

		try {
			const startTime = Date.now()
			console.log("Initializing semantic search service")

			// Initialize store first
			console.log("Initializing vector store...")
			const workspaceId = this.getWorkspaceId(this.config.context)
			this.store = new LanceDBVectorStore(path.join(this.config.storageDir, "lancedb"), workspaceId)

			try {
				await this.store.initialize()
				console.log("Vector store initialized successfully")
			} catch (error) {
				console.error("Failed to initialize vector store:", error)
				throw new Error(`Vector store initialization failed: ${error}`)
			}

			const storeSize = this.store.size()
			console.log(`Current vector store size: ${storeSize} records`)

			// Initialize model with retries
			console.log("Initializing embedding model...")
			const MAX_INIT_ATTEMPTS = 3
			let initAttempt = 0
			let modelInitError: Error | null = null

			while (initAttempt < MAX_INIT_ATTEMPTS) {
				try {
					await this.model.initialize()
					modelInitError = null
					console.log("Embedding model initialized successfully")
					break
				} catch (error) {
					initAttempt++
					modelInitError = error instanceof Error ? error : new Error(String(error))
					console.error(`Model initialization attempt ${initAttempt} failed:`, error)

					if (initAttempt < MAX_INIT_ATTEMPTS) {
						const delay = Math.min(1000 * Math.pow(2, initAttempt), 5000)
						console.log(`Waiting ${delay}ms before retry...`)
						await new Promise((resolve) => setTimeout(resolve, delay))
					}
				}
			}

			if (modelInitError) {
				throw modelInitError
			}

			// Verify model initialization
			if (!this.model.isInitialized()) {
				throw new Error("Model initialization verification failed: isInitialized() returned false")
			}

			// Perform test embedding
			try {
				console.log("Performing test embedding...")
				const testResult = await this.model.embed("Test embedding")
				if (!testResult || !testResult.values || testResult.values.length !== this.model.dimension) {
					throw new Error(
						`Test embedding failed: invalid output dimension (expected ${this.model.dimension})`,
					)
				}
				console.log("Test embedding successful")
			} catch (error) {
				console.error("Test embedding failed:", error)
				throw new Error(`Model verification failed: ${error}`)
			}

			const initDuration = Date.now() - startTime
			console.log(`Semantic search service initialization completed in ${initDuration}ms`)

			this.initialized = true
			this.updateStatus(storeSize === 0 ? WorkspaceIndexStatus.NotIndexed : WorkspaceIndexStatus.Indexed)
		} catch (error) {
			console.error("Semantic search service initialization failed:", error)
			this.initializationError = error instanceof Error ? error : new Error(String(error))
			this.initialized = false
			this.updateStatus(WorkspaceIndexStatus.NotIndexed)
			throw error
		}
	}

	// Modify methods that require initialization to handle potential errors
	private async ensureInitialized(): Promise<void> {
		// If not initialized, attempt initialization
		if (!this.initialized) {
			try {
				await this.initialize()
			} catch (error) {
				// If initialization fails, throw a clear error
				throw new Error(
					`Semantic search service could not be initialized: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		// If an initialization error occurred previously, throw it
		if (this.initializationError) {
			throw this.initializationError
		}

		// Verify store exists
		if (!this.store) {
			throw new Error("Vector store not initialized")
		}
	}

	private async processFileWithHash(filePath: string): Promise<void> {
		// Check if path is a directory
		try {
			const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
			if (stat.type === vscode.FileType.Directory) {
				console.log(`Skipping directory: ${filePath}`)
				return
			}
		} catch (error) {
			console.error(`Error checking file stats for ${filePath}:`, error)
			return
		}

		const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
		const textContent = new TextDecoder().decode(fileContent)

		// Create hash of file content
		const hash = crypto.createHash("sha256").update(textContent).digest("hex")

		// Check if file exists in DB and get its hash
		const { exists: hasExisting, hash: prevHash } = await this.store.hasFileSegments(filePath)

		// If hash matches and has existing segments, skip entirely
		if (hasExisting && hash === prevHash) {
			console.log(`Skipping unchanged file: ${filePath}`)
			return
		}

		// Delete old segments if needed
		if (hasExisting) {
			console.log(`File ${filePath} changed, deleting old segments`)
			await this.store.deleteByFilePath(filePath)
		}

		// Only process if we passed the checks
		if (SemanticSearchService.isCodeFile(filePath)) {
			const parsedFile = await this.parser.parseFile(filePath, hash) // Pass hash to parser
			for (const segment of parsedFile.segments) {
				const definition = {
					...convertSegmentToDefinition(segment, filePath),
					contentHash: hash,
				}
				await this.indexDefinition(definition)
			}
		} else {
			const definition: CodeDefinition = {
				type: "file",
				name: path.basename(filePath),
				filePath: filePath,
				content: textContent,
				startLine: 1,
				endLine: textContent.split("\n").length,
				language: path.extname(filePath).slice(1) || "text",
				contentHash: hash,
			}
			await this.indexDefinition(definition)
		}
	}

	async addToIndex(filePath: string): Promise<void> {
		await this.ensureInitialized()
		await this.processFileWithHash(filePath)
	}

	async addBatchToIndex(filePaths: string[]): Promise<void> {
		await this.ensureInitialized()
		this.updateStatus(WorkspaceIndexStatus.Indexing)

		try {
			for (const filePath of filePaths) {
				await this.processFileWithHash(filePath)
			}

			// Only update status to Indexed if we have vectors in the store
			const storeSize = this.store.size()
			this.updateStatus(storeSize > 0 ? WorkspaceIndexStatus.Indexed : WorkspaceIndexStatus.NotIndexed)
		} catch (error) {
			this.updateStatus(WorkspaceIndexStatus.NotIndexed)
			throw error
		}
	}

	// Helper method to index a single definition
	private async indexDefinition(definition: CodeDefinition): Promise<void> {
		// Try to get vector from cache first
		let vector = await this.cache.get(definition)

		if (!vector) {
			// Generate new embedding if not in cache
			vector = await (this.model as any).embedWithContext(definition)
			if (!vector) {
				console.error(`Failed to generate embedding for ${definition.filePath}`)
				return
			}
			await this.cache.set(definition, vector)
			console.log(
				`Generated new contextual embedding for ${definition.filePath} (${definition.type}: ${definition.name})`,
			)
		} else {
			console.log(`Using cached embedding for ${definition.filePath} (${definition.type}: ${definition.name})`)
		}

		await this.store.add(vector, definition)
	}

	private extractSnippets(
		content: string,
		query: string,
	): { snippets: string[]; lineRanges: Array<{ start: number; end: number }> } {
		const lines = content.split("\n")
		const snippets: string[] = []
		const lineRanges: Array<{ start: number; end: number }> = []

		// Create a simplified version of content for matching (lowercase, no punctuation)
		const simplifiedContent = content.toLowerCase().replace(/[^\w\s]/g, "")
		const simplifiedQuery = query.toLowerCase().replace(/[^\w\s]/g, "")
		const queryTerms = simplifiedQuery.split(/\s+/).filter((term) => term.length > 2)

		// Find matches for each term
		const matchingLines = new Set<number>()
		lines.forEach((line, index) => {
			const simplifiedLine = line.toLowerCase().replace(/[^\w\s]/g, "")
			if (queryTerms.some((term) => simplifiedLine.includes(term))) {
				matchingLines.add(index)
			}
		})

		// Group nearby matching lines into snippets
		const processedLines = new Set<number>()
		Array.from(matchingLines)
			.sort((a, b) => a - b)
			.forEach((lineNum) => {
				if (processedLines.has(lineNum)) return

				// Find snippet range
				let startLine = Math.max(0, lineNum - SemanticSearchService.SNIPPET_CONTEXT_LINES)
				let endLine = Math.min(lines.length - 1, lineNum + SemanticSearchService.SNIPPET_CONTEXT_LINES)

				// Extend range to include nearby matches
				for (let i = lineNum + 1; i <= endLine + SemanticSearchService.SNIPPET_CONTEXT_LINES; i++) {
					if (matchingLines.has(i)) {
						endLine = Math.min(lines.length - 1, i + SemanticSearchService.SNIPPET_CONTEXT_LINES)
					}
				}

				// Mark these lines as processed
				for (let i = startLine; i <= endLine; i++) {
					processedLines.add(i)
				}

				// Extract snippet
				const snippet = lines.slice(startLine, endLine + 1).join("\n")
				if (snippet.length <= SemanticSearchService.MAX_SNIPPET_LENGTH) {
					snippets.push(snippet)
					lineRanges.push({ start: startLine + 1, end: endLine + 1 })

					// Stop if we have enough snippets
					if (snippets.length >= SemanticSearchService.MAX_SNIPPETS_PER_FILE) {
						return
					}
				}
			})

		return { snippets, lineRanges }
	}

	private formatResult(result: VectorWithMetadata): SearchResult {
		if (!result.metadata || !result.metadata.filePath) {
			throw new Error("Invalid metadata in search result")
		}

		const { snippets, lineRanges } = this.extractSnippets(result.metadata.content, result.metadata.lastQuery || "")

		if (result.metadata.type === SearchResultType.File) {
			return {
				type: SearchResultType.File,
				filePath: result.metadata.filePath,
				name: result.metadata.name,
				snippets,
				lineRanges,
				metadata: {
					type: result.metadata.type,
					name: result.metadata.name,
					filePath: result.metadata.filePath,
					score: result.score,
					language: result.metadata.language,
					startLine: lineRanges[0]?.start,
					endLine: lineRanges[lineRanges.length - 1]?.end,
				},
			} as FileSearchResult
		}

		// For code results, return only the relevant snippets
		return {
			type: SearchResultType.Code,
			filePath: result.metadata.filePath,
			content: snippets.join("\n"), // Only include the relevant snippets
			startLine: result.metadata.startLine,
			endLine: result.metadata.endLine,
			name: result.metadata.name,
			codeType: result.metadata.type,
			snippets,
			lineRanges,
			metadata: {
				type: result.metadata.type,
				name: result.metadata.name,
				filePath: result.metadata.filePath,
				score: result.score,
				language: result.metadata.language,
				startLine: result.metadata.startLine,
				endLine: result.metadata.endLine,
			},
		} as CodeSearchResult
	}

	private deduplicateResults(results: VectorSearchResult[]): VectorSearchResult[] {
		const dedupedResults: VectorSearchResult[] = []
		const seenPaths = new Set<string>()
		const seenContent = new Set<string>()
		for (const result of results) {
			const filePath = result.metadata.filePath
			if (!filePath) continue

			if (result.metadata.type === SearchResultType.File) {
				if (!seenPaths.has(filePath)) {
					dedupedResults.push(result)
					seenPaths.add(filePath)
				}
			} else {
				if (!seenContent.has(result.metadata.content)) {
					dedupedResults.push(result)
					seenContent.add(result.metadata.content)
				}
			}
		}

		return dedupedResults
	}

	size(): number {
		if (!this.store) {
			throw new Error("Vector store not initialized")
		}
		return this.store.size()
	}

	clear(): void {
		this.store.clear()
		this.cache.clear()
		this.updateStatus(WorkspaceIndexStatus.NotIndexed)
	}

	async invalidateCache(definition: CodeDefinition): Promise<void> {
		await this.cache.invalidate(definition)
	}

	async search(query: string): Promise<SearchResult[]> {
		try {
			await this.ensureInitialized()

			const storeSize = this.size()
			if (storeSize === 0) {
				return []
			}

			const queryVector = await this.model.embed(query)
			const results = await this.store.search(
				queryVector,
				this.config.maxResults ? this.config.maxResults * 2 : 20,
			)

			// Add the query to the metadata for snippet extraction
			results.forEach((result) => {
				if (result.metadata) {
					result.metadata.lastQuery = query
				}
			})

			const dedupedResults = this.deduplicateResults(results)
			const maxResults = this.config.maxResults ?? 10
			const finalResults: VectorSearchResult[] = []

			const codeResults = dedupedResults.filter((r) => r.metadata?.type !== "file")
			const fileResults = dedupedResults.filter((r) => r.metadata?.type === "file")

			for (const result of codeResults) {
				if (finalResults.length >= maxResults) break
				finalResults.push(result)
			}

			for (const result of fileResults) {
				if (finalResults.length >= maxResults) break
				finalResults.push(result)
			}

			return finalResults.slice(0, maxResults).map((r) => this.formatResult(r))
		} catch (error) {
			console.error("Error during semantic search:", error)
			throw error
		}
	}
}
