import { OpenAICompatibleEmbedder } from "./openai-compatible"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces/embedder"
import { t } from "../../../i18n"

/**
 * LM Studio embedder implementation that wraps the OpenAI Compatible embedder
 * with LM Studio-specific configuration.
 */
export class LmStudioEmbedder implements IEmbedder {
	private readonly openAICompatibleEmbedder: OpenAICompatibleEmbedder
	private static readonly DEFAULT_BASE_URL = "http://localhost:1234/v1"

	/**
	 * Creates a new LM Studio embedder
	 * @param baseUrl The LM Studio base URL (optional, defaults to http://localhost:1234)
	 * @param modelId The embedding model ID to use
	 */
	constructor(baseUrl?: string, modelId?: string) {
		const finalBaseUrl = baseUrl ? `${baseUrl}/v1` : LmStudioEmbedder.DEFAULT_BASE_URL
		const finalModelId = modelId || "nomic-embed-text-v1.5"

		// LM Studio uses "noop" as API key like in the chat handler
		this.openAICompatibleEmbedder = new OpenAICompatibleEmbedder(finalBaseUrl, "noop", finalModelId)
	}

	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		return this.openAICompatibleEmbedder.createEmbeddings(texts, model)
	}

	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		try {
			const result = await this.openAICompatibleEmbedder.validateConfiguration()
			if (!result.valid && result.error?.includes("embeddings:validation.connectionFailed")) {
				return {
					valid: false,
					error: t("embeddings:lmstudio.serviceNotRunning"),
				}
			}
			return result
		} catch (error) {
			return {
				valid: false,
				error: t("embeddings:lmstudio.serviceNotRunning"),
			}
		}
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "lmstudio",
		}
	}
}
