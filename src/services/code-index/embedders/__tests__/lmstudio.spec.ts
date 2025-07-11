import { vitest, describe, it, expect, beforeEach } from "vitest"
import type { MockedClass } from "vitest"
import { LmStudioEmbedder } from "../lmstudio"
import { OpenAICompatibleEmbedder } from "../openai-compatible"

// Mock the OpenAICompatibleEmbedder
vitest.mock("../openai-compatible")

const MockedOpenAICompatibleEmbedder = OpenAICompatibleEmbedder as MockedClass<typeof OpenAICompatibleEmbedder>

describe("LmStudioEmbedder", () => {
	let embedder: LmStudioEmbedder

	beforeEach(() => {
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should create an instance with default base URL and model when not provided", () => {
			// Act
			embedder = new LmStudioEmbedder()

			// Assert
			expect(MockedOpenAICompatibleEmbedder).toHaveBeenCalledWith(
				"http://localhost:1234/v1",
				"noop",
				"nomic-embed-text-v1.5",
			)
		})

		it("should create an instance with custom base URL when provided", () => {
			// Arrange
			const baseUrl = "http://custom-host:8080"

			// Act
			embedder = new LmStudioEmbedder(baseUrl)

			// Assert
			expect(MockedOpenAICompatibleEmbedder).toHaveBeenCalledWith(
				"http://custom-host:8080/v1",
				"noop",
				"nomic-embed-text-v1.5",
			)
		})

		it("should create an instance with custom model ID when provided", () => {
			// Arrange
			const modelId = "custom-embed-model"

			// Act
			embedder = new LmStudioEmbedder(undefined, modelId)

			// Assert
			expect(MockedOpenAICompatibleEmbedder).toHaveBeenCalledWith("http://localhost:1234/v1", "noop", modelId)
		})

		it("should create an instance with both custom base URL and model ID", () => {
			// Arrange
			const baseUrl = "http://custom-host:8080"
			const modelId = "custom-embed-model"

			// Act
			embedder = new LmStudioEmbedder(baseUrl, modelId)

			// Assert
			expect(MockedOpenAICompatibleEmbedder).toHaveBeenCalledWith("http://custom-host:8080/v1", "noop", modelId)
		})
	})

	describe("embedderInfo", () => {
		it("should return correct embedder info", () => {
			// Arrange
			embedder = new LmStudioEmbedder()

			// Act
			const info = embedder.embedderInfo

			// Assert
			expect(info).toEqual({
				name: "lmstudio",
			})
		})
	})

	describe("validateConfiguration", () => {
		let mockValidateConfiguration: any

		beforeEach(() => {
			mockValidateConfiguration = vitest.fn()
			MockedOpenAICompatibleEmbedder.prototype.validateConfiguration = mockValidateConfiguration
		})

		it("should delegate validation to OpenAICompatibleEmbedder", async () => {
			// Arrange
			embedder = new LmStudioEmbedder()
			mockValidateConfiguration.mockResolvedValue({ valid: true })

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(mockValidateConfiguration).toHaveBeenCalled()
			expect(result).toEqual({ valid: true })
		})

		it("should transform connection failed errors to LM Studio specific message", async () => {
			// Arrange
			embedder = new LmStudioEmbedder()
			mockValidateConfiguration.mockResolvedValue({
				valid: false,
				error: "embeddings:validation.connectionFailed",
			})

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(mockValidateConfiguration).toHaveBeenCalled()
			expect(result).toEqual({
				valid: false,
				error: "lmstudio.serviceNotRunning",
			})
		})

		it("should pass through other validation errors unchanged", async () => {
			// Arrange
			embedder = new LmStudioEmbedder()
			mockValidateConfiguration.mockResolvedValue({
				valid: false,
				error: "embeddings:validation.someOtherError",
			})

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(mockValidateConfiguration).toHaveBeenCalled()
			expect(result).toEqual({
				valid: false,
				error: "embeddings:validation.someOtherError",
			})
		})

		it("should handle validation exceptions with LM Studio specific message", async () => {
			// Arrange
			embedder = new LmStudioEmbedder()
			mockValidateConfiguration.mockRejectedValue(new Error("Connection failed"))

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(mockValidateConfiguration).toHaveBeenCalled()
			expect(result).toEqual({
				valid: false,
				error: "lmstudio.serviceNotRunning",
			})
		})
	})

	describe("createEmbeddings", () => {
		let mockCreateEmbeddings: any

		beforeEach(() => {
			mockCreateEmbeddings = vitest.fn()
			MockedOpenAICompatibleEmbedder.prototype.createEmbeddings = mockCreateEmbeddings
		})

		it("should delegate createEmbeddings to OpenAICompatibleEmbedder", async () => {
			// Arrange
			embedder = new LmStudioEmbedder()
			const texts = ["test text 1", "test text 2"]
			const model = "custom-model"
			const mockResponse = {
				embeddings: [
					[0.1, 0.2],
					[0.3, 0.4],
				],
			}
			mockCreateEmbeddings.mockResolvedValue(mockResponse)

			// Act
			const result = await embedder.createEmbeddings(texts, model)

			// Assert
			expect(mockCreateEmbeddings).toHaveBeenCalledWith(texts, model)
			expect(result).toEqual(mockResponse)
		})
	})
})
