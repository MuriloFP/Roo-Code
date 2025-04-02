import React, { useState, useEffect } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./dialog"
import { TaskCardView } from "./task-cards/TaskCardView"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"
import { TaskCard } from "../../../../src/shared/task-cards"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

interface TaskCardDialogProps {
	isOpen: boolean
	taskId: string | undefined
	onOpenChange: (open: boolean) => void
}

export const TaskCardDialog: React.FC<TaskCardDialogProps> = ({ isOpen, taskId, onOpenChange }) => {
	const { t } = useAppTranslation()
	const [error, setError] = useState<string | null>(null)
	const [editMode, setEditMode] = useState(false)

	// Immediately create default data instead of showing loading
	const createDefaultTaskCard = (id: string): TaskCard => ({
		task_title: "Task Card",
		description: "Task details will appear here",
		steps: [],
		context: [],
		notes: [],
		metadata: {
			task_id: id,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			status: "active",
			parent_task_id: null,
		},
	})

	// Initialize with default data immediately
	const [taskCard, setTaskCard] = useState<TaskCard | null>(taskId ? createDefaultTaskCard(taskId) : null)

	// State to hold temporary edits before saving
	const [editableTaskCard, setEditableTaskCard] = useState<TaskCard | null>(taskCard ? { ...taskCard } : null)

	// Effect to handle dialog open/close
	useEffect(() => {
		if (isOpen && taskId) {
			const formattedTaskId = taskId.trim()
			// Initialize with default task card rather than showing loading
			const defaultCard = createDefaultTaskCard(formattedTaskId)
			setTaskCard(defaultCard)
			setEditableTaskCard(defaultCard)
			setError(null)
			setEditMode(false)

			// Request actual data in the background
			console.log(`[DEBUG] Requesting task card data for taskId: ${formattedTaskId}`)
			vscode.postMessage({
				type: "getTaskCardData",
				taskId: formattedTaskId,
			})
		} else if (!isOpen) {
			console.log("[DEBUG] Dialog closed, resetting state")
			setTaskCard(null)
			setEditableTaskCard(null)
			setError(null)
			setEditMode(false)
		}
	}, [isOpen, taskId])

	// Message listener for data from extension
	useEffect(() => {
		console.log("[DEBUG] Setting up message listener for taskId:", taskId)

		const messageListener = (event: MessageEvent) => {
			const message = event.data

			// Log ALL messages received, not just ones we handle
			console.log("[DEBUG] ALL MESSAGES:", {
				messageType: message.type,
				messageTaskId: message.taskId,
				currentTaskId: taskId,
				messageHasText: Boolean(message.text),
				message: message,
			})

			// Check type and taskId matching
			if (message.type === "taskCardData") {
				console.log("[DEBUG] TaskCardData message received", {
					messageTaskId: message.taskId,
					currentTaskId: taskId,
					matches: message.taskId === taskId,
					text: message.text ? message.text.substring(0, 50) + "..." : "none",
				})

				// We should process the message if it has a task ID that matches our current task ID
				// OR if the message has no task ID but we're only looking at one task
				if (message.taskId === taskId || (!message.taskId && taskId)) {
					try {
						if (!message.text) {
							console.log("[DEBUG] Empty task card data received, keeping default")
							return
						}

						console.log("[DEBUG] Parsing task card data:", message.text)
						let data
						try {
							data = JSON.parse(message.text)
						} catch (parseError) {
							console.error("[DEBUG] Failed to parse JSON, keeping default card", parseError)
							return
						}

						// Only update if we have actual data
						if (data === null) {
							console.log("[DEBUG] Task card not found, keeping default")
							return
						}

						console.log("[DEBUG] Parsed task card data:", data)

						// Validate we have actual task card data
						let taskCardData
						if (data.task_card) {
							console.log("[DEBUG] Found nested task_card property:", data.task_card)
							taskCardData = data.task_card
						} else {
							console.log("[DEBUG] Using direct data object")
							taskCardData = data
						}

						// Add debug log to see exactly what's in the card data
						console.log("[DEBUG] TaskCardData details:", {
							hasTitle: Boolean(taskCardData?.task_title),
							title: taskCardData?.task_title,
							hasDescription: Boolean(taskCardData?.description),
							hasMetadata: Boolean(taskCardData?.metadata),
							stepsCount: Array.isArray(taskCardData?.steps) ? taskCardData.steps.length : 0,
							fullData: taskCardData,
						})

						// Validate task card structure and use it if valid
						if (taskCardData && typeof taskCardData === "object") {
							// Initialize missing properties with defaults
							const normalizedTaskCard = {
								task_title: taskCardData.task_title || "Task Card",
								description: taskCardData.description || "",
								steps: Array.isArray(taskCardData.steps) ? taskCardData.steps : [],
								context: Array.isArray(taskCardData.context) ? taskCardData.context : [],
								notes: Array.isArray(taskCardData.notes) ? taskCardData.notes : [],
								metadata: taskCardData.metadata || {
									task_id: taskId,
									created_at: Date.now(),
									updated_at: Date.now(),
								},
							}

							console.log("[DEBUG] Updating with real task card data:", normalizedTaskCard)
							setTaskCard(normalizedTaskCard)
							// Only update editable card if not in edit mode
							if (!editMode) {
								setEditableTaskCard(normalizedTaskCard)
							}
						}
					} catch (error) {
						console.error("[DEBUG] Error processing task card data, keeping default", error)
					}
				}
			} else if (message.type === "error") {
				console.error("[DEBUG] Error from extension:", message.text)
			} else if (message.type === "success" && message.text?.includes("updated successfully")) {
				console.log("[DEBUG] Task card updated successfully")
				// After successful update, refresh the data
				if (taskId) {
					vscode.postMessage({
						type: "getTaskCardData",
						taskId,
					})
				}
				setEditMode(false)
			}
		}

		window.addEventListener("message", messageListener)
		return () => {
			console.log("[DEBUG] Removing message listener for taskId:", taskId)
			window.removeEventListener("message", messageListener)
		}
	}, [taskId, editMode])

	const handleSaveChanges = () => {
		if (!taskId || !editableTaskCard) return

		console.log("Saving changes for task:", taskId, editableTaskCard)
		vscode.postMessage({
			type: "updateTaskCard",
			taskId,
			data: editableTaskCard,
		})
		// Optimistically update the main taskCard state
		setTaskCard(editableTaskCard)
		setEditMode(false)
	}

	const handleCancelEdit = () => {
		setEditableTaskCard(taskCard) // Reset changes
		setEditMode(false)
	}

	const handleClose = () => {
		onOpenChange(false)
	}

	const handleEdit = () => {
		setEditableTaskCard(taskCard ? { ...taskCard } : null)
		setEditMode(true)
	}

	const handleTaskCardChange = (updatedData: Partial<TaskCard>) => {
		setEditableTaskCard((prev) => (prev ? { ...prev, ...updatedData } : null))
	}

	// Check if we have a task card to display
	const hasTaskCard = Boolean(taskCard)

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-[800px] w-[95vw] p-0 bg-[var(--vscode-editor-background)] max-h-[90vh] flex flex-col"
				style={{
					border: "1px solid var(--vscode-focusBorder)",
					borderColor: "color-mix(in srgb, var(--vscode-focusBorder) 50%, transparent)",
					borderRadius: "8px",
					overflow: "hidden", // Ensures content doesn't overflow rounded corners
					gap: 0, // Remove any gap between flex children
				}}>
				{/* Custom action buttons in top-right corner */}
				<div className="absolute top-4 right-4 flex items-center gap-2 z-10">
					{/* Edit button */}
					{!editMode ? (
						<button
							className="rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none"
							onClick={(e) => {
								e.stopPropagation()
								if (hasTaskCard) handleEdit()
							}}
							disabled={!hasTaskCard}
							title={t("common:edit")}>
							<span className="codicon codicon-edit text-[var(--vscode-foreground)] text-lg"></span>
						</button>
					) : (
						<button
							className="rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
							onClick={(e) => {
								e.stopPropagation()
								handleCancelEdit()
							}}
							title={t("common:cancel")}>
							<span className="codicon codicon-discard text-[var(--vscode-foreground)] text-lg"></span>
						</button>
					)}

					{/* Close button */}
					<DialogPrimitive.Close className="rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-none">
						<span className="codicon codicon-chrome-close text-[var(--vscode-foreground)] text-lg"></span>
						<span className="sr-only">Close</span>
					</DialogPrimitive.Close>
				</div>

				{/* Header - Fixed at top */}
				<div
					className="py-7 px-6 flex-shrink-0"
					style={{
						background: `linear-gradient(135deg, var(--vscode-editor-background) 0%, color-mix(in srgb, var(--vscode-editor-background), white 4%) 100%)`,
						borderBottom: "1px solid color-mix(in srgb, var(--vscode-focusBorder) 50%, transparent)",
					}}>
					<DialogHeader className="text-left">
						<DialogTitle className="text-2xl font-bold text-[var(--vscode-foreground)] text-left">
							{taskCard?.task_title || "Task Card"}
						</DialogTitle>
						{taskCard && (
							<p className="text-[var(--vscode-foreground)] mt-2 text-left">{taskCard.description}</p>
						)}
						{taskCard?.metadata?.parent_task_id && (
							<div className="text-xs text-[var(--vscode-descriptionForeground)] mt-2 text-left">
								<strong>{t("task_card:parent_task")}:</strong> {taskCard.metadata.parent_task_id}
							</div>
						)}
						{taskCard?.metadata && (
							<div className="text-xs text-[var(--vscode-descriptionForeground)] mt-2 text-left">
								Last updated: {new Date(taskCard.metadata.updated_at || Date.now()).toLocaleString()}
							</div>
						)}
					</DialogHeader>
				</div>

				{/* Content Area - Scrollable */}
				<div className="overflow-y-auto p-6 flex-grow" style={{ overflowY: "auto" }}>
					{error && (
						<div className="text-[var(--vscode-errorForeground)] bg-[var(--vscode-inputValidation-errorBackground)] p-4 rounded border border-[var(--vscode-inputValidation-errorBorder)] mb-4">
							<p>{error}</p>
						</div>
					)}

					{hasTaskCard && (
						<TaskCardView
							taskCard={editMode ? editableTaskCard : taskCard}
							editMode={editMode}
							onTaskCardChange={handleTaskCardChange}
						/>
					)}
				</div>

				{/* Footer - Fixed at bottom */}
				<div
					className="bg-[var(--vscode-editor-background)] p-4 flex-shrink-0"
					style={{
						borderTop: "1px solid color-mix(in srgb, var(--vscode-focusBorder) 50%, transparent)",
					}}>
					<DialogFooter className="flex justify-end gap-2">
						{!editMode ? (
							<div className="flex gap-2 justify-end">
								<VSCodeButton appearance="secondary" onClick={handleEdit} disabled={!hasTaskCard}>
									{t("common:edit")}
								</VSCodeButton>
								<VSCodeButton appearance="secondary" onClick={handleClose}>
									{t("common:close")}
								</VSCodeButton>
							</div>
						) : (
							<div className="flex gap-2 justify-end">
								<VSCodeButton appearance="secondary" onClick={handleCancelEdit}>
									{t("common:cancel")}
								</VSCodeButton>
								<VSCodeButton appearance="primary" onClick={handleSaveChanges}>
									{t("common:save")}
								</VSCodeButton>
							</div>
						)}
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	)
}
