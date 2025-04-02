import { z } from "zod"
import { ApiConfiguration, ApiProvider } from "./api"
import { Mode, PromptComponent, ModeConfig } from "./modes"
import { TaskCard } from "./task-cards"

export type ClineAskResponse = "yesButtonClicked" | "noButtonClicked" | "messageResponse"

export type PromptMode = Mode | "enhance"

export type AudioType = "notification" | "celebration" | "progress_loop"

export interface WebviewMessage {
	type:
		| "apiConfiguration"
		| "deleteMultipleTasksWithIds"
		| "currentApiConfigName"
		| "saveApiConfiguration"
		| "upsertApiConfiguration"
		| "deleteApiConfiguration"
		| "loadApiConfiguration"
		| "loadApiConfigurationById"
		| "renameApiConfiguration"
		| "getListApiConfiguration"
		| "customInstructions"
		| "allowedCommands"
		| "alwaysAllowReadOnly"
		| "alwaysAllowReadOnlyOutsideWorkspace"
		| "alwaysAllowWrite"
		| "alwaysAllowWriteOutsideWorkspace"
		| "alwaysAllowExecute"
		| "alwaysAllowTaskCards"
		| "webviewDidLaunch"
		| "newTask"
		| "askResponse"
		| "clearTask"
		| "didShowAnnouncement"
		| "selectImages"
		| "exportCurrentTask"
		| "showTaskWithId"
		| "deleteTaskWithId"
		| "exportTaskWithId"
		| "importSettings"
		| "exportSettings"
		| "resetState"
		| "requestOllamaModels"
		| "requestLmStudioModels"
		| "requestVsCodeLmModels"
		| "openImage"
		| "openFile"
		| "openMention"
		| "cancelTask"
		| "refreshOpenRouterModels"
		| "refreshGlamaModels"
		| "refreshUnboundModels"
		| "refreshRequestyModels"
		| "refreshOpenAiModels"
		| "alwaysAllowBrowser"
		| "alwaysAllowMcp"
		| "alwaysAllowModeSwitch"
		| "alwaysAllowSubtasks"
		| "playSound"
		| "playTts"
		| "stopTts"
		| "soundEnabled"
		| "ttsEnabled"
		| "ttsSpeed"
		| "soundVolume"
		| "diffEnabled"
		| "enableCheckpoints"
		| "checkpointStorage"
		| "browserViewportSize"
		| "screenshotQuality"
		| "remoteBrowserHost"
		| "openMcpSettings"
		| "openProjectMcpSettings"
		| "restartMcpServer"
		| "toggleToolAlwaysAllow"
		| "toggleMcpServer"
		| "updateMcpTimeout"
		| "fuzzyMatchThreshold"
		| "writeDelayMs"
		| "enhancePrompt"
		| "enhancedPrompt"
		| "draggedImages"
		| "deleteMessage"
		| "terminalOutputLineLimit"
		| "terminalShellIntegrationTimeout"
		| "mcpEnabled"
		| "enableMcpServerCreation"
		| "searchCommits"
		| "alwaysApproveResubmit"
		| "requestDelaySeconds"
		| "rateLimitSeconds"
		| "setApiConfigPassword"
		| "mode"
		| "updatePrompt"
		| "updateSupportPrompt"
		| "resetSupportPrompt"
		| "getSystemPrompt"
		| "copySystemPrompt"
		| "systemPrompt"
		| "enhancementApiConfigId"
		| "updateExperimental"
		| "autoApprovalEnabled"
		| "updateCustomMode"
		| "deleteCustomMode"
		| "setopenAiCustomModelInfo"
		| "openCustomModesSettings"
		| "checkpointDiff"
		| "checkpointRestore"
		| "deleteMcpServer"
		| "maxOpenTabsContext"
		| "maxWorkspaceFiles"
		| "humanRelayResponse"
		| "humanRelayCancel"
		| "browserToolEnabled"
		| "telemetrySetting"
		| "showRooIgnoredFiles"
		| "testBrowserConnection"
		| "browserConnectionResult"
		| "remoteBrowserEnabled"
		| "language"
		| "maxReadFileLine"
		| "searchFiles"
		| "toggleApiConfigPin"
		| "getTaskCardData"
		| "taskCardData"
		| "updateTaskCard"
		| "openTaskCard"
		| "closeTaskCard"
		| "error"
		| "getSystemPrompt"
		| "systemPrompt"
		| "clearConversation"
		| "newChat"
		| "requestModels"
		| "sendMessage"
		| "exportMessage"
		| "exportTaskAsPrompt"
		| "exportTaskAsFile"
		| "exportTask"
		| "finishTask"
		| "switchMode"
		| "regenerateMessage"
		| "renderContext"
		| "checkpoints"
		| "restoreCheckpoint"
		| "saveCurrentCheckpoint"
		| "deleteCheckpoint"
		| "switchToPrompt"
		| "submitMessage"
		| "getSettings"
		| "updateApiConfig"
		| "renderApiConfig"
		| "sendOpenRouterCallback"
		| "sendGlamaCallback"
		| "sendRequestyCallback"
		| "requestCommitDiff"
		| "checkoutCommit"
		| "getHistoryItems"
		| "getHistoryItem"
		| "deleteTask"
		| "deletePrompt"
		| "updateCustomInstructions"
		| "getCustomPrompt"
		| "setCustomPrompt"
		| "enableBrowserTool"
		| "openUri"
		| "enableRemoteBrowser"
		| "enableTts"
		| "ttsStop"
		| "requestHistoryItemsWithFiles"
		| "searchWorkspace"
	text?: string
	disabled?: boolean
	askResponse?: ClineAskResponse
	apiConfiguration?: ApiConfiguration
	images?: string[]
	bool?: boolean
	value?: number
	commands?: string[]
	audioType?: AudioType
	serverName?: string
	toolName?: string
	alwaysAllow?: boolean
	mode?: Mode
	promptMode?: PromptMode
	customPrompt?: PromptComponent
	dataUrls?: string[]
	values?: Record<string, any>
	query?: string
	slug?: string
	modeConfig?: ModeConfig
	timeout?: number
	payload?: WebViewMessagePayload
	source?: "global" | "project"
	requestId?: string
	ids?: string[]
	taskId?: string
	taskCard?: TaskCard
	data?: any
}

export const checkoutDiffPayloadSchema = z.object({
	ts: z.number(),
	previousCommitHash: z.string().optional(),
	commitHash: z.string(),
	mode: z.enum(["full", "checkpoint"]),
})

export type CheckpointDiffPayload = z.infer<typeof checkoutDiffPayloadSchema>

export const checkoutRestorePayloadSchema = z.object({
	ts: z.number(),
	commitHash: z.string(),
	mode: z.enum(["preview", "restore"]),
})

export type CheckpointRestorePayload = z.infer<typeof checkoutRestorePayloadSchema>

export type WebViewMessagePayload = CheckpointDiffPayload | CheckpointRestorePayload

/**
 * Task Card Message Schemas
 */

export const taskCardDataRequestSchema = z.object({
	taskId: z.string(),
})

export type TaskCardDataRequest = z.infer<typeof taskCardDataRequestSchema>

export const taskCardDataResponseSchema = z.object({
	taskId: z.string(),
	taskCard: z.any(), // This will be a TaskCard, but using any to avoid circular dependencies
})

export type TaskCardDataResponse = z.infer<typeof taskCardDataResponseSchema>

export const updateTaskCardSchema = z.object({
	taskId: z.string(),
	taskCard: z.any(), // This will be a Partial<TaskCard>, but using any to avoid circular dependencies
})

export type UpdateTaskCardRequest = z.infer<typeof updateTaskCardSchema>
