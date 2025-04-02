import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { VSCodeButton, VSCodeTextField, VSCodeTextArea, VSCodeDivider } from "@vscode/webview-ui-toolkit/react"

import { TaskCard, TaskStep, TaskStepStatus } from "../../../../../src/shared/task-cards"

interface TaskCardViewProps {
	taskCard: TaskCard | Partial<TaskCard> | null
	editMode: boolean
	onTaskCardChange: (updatedData: Partial<TaskCard>) => void
}

interface SectionProps {
	title: string
	icon: string
	steps: TaskStep[]
	color: string
	editMode: boolean
	expandedSteps: Record<number, boolean>
	toggleStepExpansion: (stepNumber: number) => void
	updateStepStatus: (stepNumber: number, status: string) => void
	removeStep: (stepNumber: number) => void
	addStepComment: (stepNumber: number, comment: string) => void
	removeStepComment: (stepNumber: number, commentIndex: number) => void
	taskCardIdPrefix: string
}

const Section: React.FC<SectionProps> = ({
	title,
	icon,
	steps,
	color,
	editMode,
	expandedSteps,
	toggleStepExpansion,
	updateStepStatus,
	removeStep,
	addStepComment,
	removeStepComment,
	taskCardIdPrefix,
}) => {
	const { t } = useTranslation()
	const [newComments, setNewComments] = useState<Record<number, string>>({})

	const handleCommentChange = (stepNumber: number, value: string) => {
		setNewComments((prev) => ({
			...prev,
			[stepNumber]: value,
		}))
	}

	const handleAddComment = (stepNumber: number) => {
		const comment = newComments[stepNumber]
		if (comment?.trim()) {
			addStepComment(stepNumber, comment.trim())
			setNewComments((prev) => ({
				...prev,
				[stepNumber]: "",
			}))
		}
	}

	const renderStep = (step: TaskStep, color: string) => {
		const isExpanded = expandedSteps[step.step_number] || false
		const hasDetails = (Array.isArray(step.comments) && step.comments.length > 0) || step.subtask_id !== null
		const hasCommentsOrEditMode = editMode || (Array.isArray(step.comments) && step.comments.length > 0)

		return (
			<div
				key={step.step_number}
				className={`mb-3 py-2 border-l-2 pl-4 ${hasDetails || editMode ? "cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)]" : ""} transition-colors duration-150`}
				style={{ borderColor: color }}
				onClick={hasDetails || editMode ? () => toggleStepExpansion(step.step_number) : undefined}>
				<div className="flex items-center">
					<div
						className="text-xs px-2 py-1 rounded mr-3 flex-shrink-0 text-[var(--vscode-foreground)]"
						style={{
							backgroundColor: `color-mix(in srgb, ${color} 20%, var(--vscode-editor-background))`,
							border: `1px solid ${color}`,
						}}>
						{taskCardIdPrefix}-{step.step_number}
					</div>
					<div className="flex-1 mr-2">{step.description}</div>
					{editMode ? (
						<div className="flex items-center ml-auto flex-shrink-0">
							<select
								value={step.status}
								onChange={(e) => updateStepStatus(step.step_number, e.target.value)}
								style={{
									backgroundColor: "var(--vscode-dropdown-background)",
									color: "var(--vscode-dropdown-foreground)",
									border: "1px solid var(--vscode-dropdown-border)",
									padding: "2px 4px",
									marginRight: "8px",
								}}
								onClick={(e) => e.stopPropagation()}>
								<option value={TaskStepStatus.PLANNED}>{t("task_card:status_planned")}</option>
								<option value={TaskStepStatus.IN_PROGRESS}>{t("task_card:status_in_progress")}</option>
								<option value={TaskStepStatus.COMPLETED}>{t("task_card:status_completed")}</option>
							</select>
							<VSCodeButton
								appearance="icon"
								onClick={(e) => {
									e.stopPropagation()
									removeStep(step.step_number)
								}}
								title={t("common:delete")}>
								<span className="codicon codicon-trash"></span>
							</VSCodeButton>
						</div>
					) : (
						hasDetails && (
							<div className="text-xs ml-2 mr-1 flex-shrink-0">
								<span className={`codicon codicon-chevron-${isExpanded ? "down" : "right"}`}></span>
							</div>
						)
					)}
				</div>

				{isExpanded && hasCommentsOrEditMode && (
					<div className="pl-10 mt-2 text-sm text-[var(--vscode-descriptionForeground)]">
						{step.subtask_id && (
							<div className="mb-1">
								<span className="font-medium text-[var(--vscode-foreground)]">Subtask ID:</span>{" "}
								{step.subtask_id}
							</div>
						)}

						<div>
							<span className="font-medium text-[var(--vscode-foreground)]">Comments:</span>
							{Array.isArray(step.comments) && step.comments.length > 0 ? (
								<ul className="list-disc pl-5 mt-1">
									{step.comments.map((comment, idx) => (
										<li key={idx} className="mb-1 flex items-start">
											<span className="flex-grow mr-2">{comment}</span>
											{editMode && (
												<VSCodeButton
													appearance="icon"
													onClick={(e) => {
														e.stopPropagation()
														removeStepComment(step.step_number, idx)
													}}
													title={t("common:delete")}
													className="ml-auto h-5 w-5 flex-shrink-0">
													<span className="codicon codicon-trash text-xs"></span>
												</VSCodeButton>
											)}
										</li>
									))}
								</ul>
							) : (
								<p className="text-[var(--vscode-descriptionForeground)] italic text-sm ml-5 mt-1">
									{t("task_card:no_comments") || "No comments"}
								</p>
							)}

							{editMode && (
								<div className="flex mt-2 pl-5">
									<VSCodeTextField
										placeholder={t("task_card:new_comment") || "New Comment"}
										value={newComments[step.step_number] || ""}
										onInput={(e: any) => handleCommentChange(step.step_number, e.target.value)}
										className="flex-grow"
										onClick={(e) => e.stopPropagation()}
									/>
									<VSCodeButton
										className="ml-2"
										onClick={(e) => {
											e.stopPropagation()
											handleAddComment(step.step_number)
										}}
										appearance="secondary">
										{t("common:add")}
									</VSCodeButton>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		)
	}

	// Always render the section header, even if there are no steps
	return (
		<div className="mb-5">
			<div className="flex items-center gap-2 mb-4">
				<div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></div>
				<h3 className="font-semibold text-lg uppercase">
					{title} {steps.length > 0 ? `(${steps.length})` : ""}
				</h3>
			</div>
			<div className="pl-5">
				{steps.length > 0 ? (
					steps.map((step) => renderStep(step, color))
				) : (
					<div className="text-[var(--vscode-descriptionForeground)] italic text-sm pl-1">
						{editMode
							? t("task_card:no_steps_edit") || "No steps yet. Add steps below."
							: t("task_card:no_steps") || "No steps in this section."}
					</div>
				)}
			</div>
		</div>
	)
}

export const TaskCardView: React.FC<TaskCardViewProps> = ({ taskCard, editMode, onTaskCardChange }) => {
	const { t } = useTranslation()

	console.log("[DEBUG] TaskCardView rendered with props:", {
		taskCard: taskCard
			? {
					task_title: taskCard.task_title,
					has_steps: Array.isArray(taskCard.steps) && taskCard.steps.length > 0,
					has_metadata: Boolean(taskCard.metadata),
					steps_count: Array.isArray(taskCard.steps) ? taskCard.steps.length : 0,
				}
			: null,
		editMode,
	})

	// Initialize with empty values or from taskCard if available
	const [title, setTitle] = useState(taskCard?.task_title || "")
	const [description, setDescription] = useState(taskCard?.description || "")
	const [steps, setSteps] = useState<TaskStep[]>(taskCard?.steps || [])
	const [context, setContext] = useState<string[]>(taskCard?.context || [])
	const [notes, setNotes] = useState<string[]>(taskCard?.notes || [])

	const [newStep, setNewStep] = useState("")
	const [newContext, setNewContext] = useState("")
	const [newNote, setNewNote] = useState("")

	const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({})

	const taskCardIdPrefix = useMemo(() => {
		if (!taskCard?.metadata?.task_id) return "TASK"

		// Use the first 4 characters of the task ID or the whole ID if shorter
		const id = taskCard.metadata.task_id
		const shortId = id.length > 4 ? id.substring(0, 4).toUpperCase() : id.toUpperCase()
		return shortId
	}, [taskCard?.metadata?.task_id])

	// Handle expanding/collapsing step details
	const toggleStepExpansion = (stepNumber: number) => {
		setExpandedSteps((prev) => ({
			...prev,
			[stepNumber]: !prev[stepNumber],
		}))
	}

	// Add a new step
	const handleAddStep = () => {
		if (!newStep.trim()) return

		// Find the highest step number and add 1
		const currentSteps =
			steps.length > 0
				? [
						...steps,
						{
							step_number: steps.length + 1,
							description: newStep.trim(),
							status: TaskStepStatus.PLANNED,
							subtask_id: null,
							comments: [],
						},
					]
				: [
						{
							step_number: 1,
							description: newStep.trim(),
							status: TaskStepStatus.PLANNED,
							subtask_id: null,
							comments: [],
						},
					]
		const updatedSteps = currentSteps.sort((a, b) => a.step_number - b.step_number)
		setSteps(updatedSteps)
		onTaskCardChange({ steps: updatedSteps })
		setNewStep("")
	}

	// Remove a step
	const removeStep = (stepNumber: number) => {
		const currentSteps = steps.filter((step) => step.step_number !== stepNumber)
		setSteps(currentSteps)
		onTaskCardChange({ steps: currentSteps })
	}

	// Update step status
	const updateStepStatus = (stepNumber: number, status: string) => {
		const currentSteps = steps.map((step) =>
			step.step_number === stepNumber ? { ...step, status: status as TaskStepStatus } : step,
		)
		setSteps(currentSteps)
		onTaskCardChange({ steps: currentSteps })
	}

	// Add a comment to a step
	const addStepComment = (stepNumber: number, comment: string) => {
		const currentSteps = steps.map((step) => {
			if (step.step_number === stepNumber) {
				const currentComments = Array.isArray(step.comments) ? step.comments : []
				return {
					...step,
					comments: [...currentComments, comment],
				}
			}
			return step
		})

		setSteps(currentSteps)
		onTaskCardChange({ steps: currentSteps })
	}

	// Remove a comment from a step
	const removeStepComment = (stepNumber: number, commentIndex: number) => {
		const currentSteps = steps.map((step) => {
			if (step.step_number === stepNumber && Array.isArray(step.comments)) {
				return {
					...step,
					comments: step.comments.filter((_, idx) => idx !== commentIndex),
				}
			}
			return step
		})

		setSteps(currentSteps)
		onTaskCardChange({ steps: currentSteps })
	}

	// Field change handlers
	const handleTitleChange = (e: any) => {
		setTitle(e.target.value)
		onTaskCardChange({ task_title: e.target.value })
	}

	const handleDescriptionChange = (e: any) => {
		setDescription(e.target.value)
		onTaskCardChange({ description: e.target.value })
	}

	useEffect(() => {
		if (taskCard) {
			setTitle(taskCard.task_title || "")
			setDescription(taskCard.description || "")
			setSteps(Array.isArray(taskCard.steps) ? taskCard.steps : [])
			setContext(Array.isArray(taskCard.context) ? taskCard.context : [])
			setNotes(Array.isArray(taskCard.notes) ? taskCard.notes : [])
			// Reset expansion state when card changes
			setExpandedSteps({})
		}
	}, [taskCard])

	// Automatically expand steps in edit mode
	useEffect(() => {
		if (editMode && steps.length > 0) {
			const expanded: Record<number, boolean> = {}
			steps.forEach((step) => {
				expanded[step.step_number] = true
			})
			setExpandedSteps(expanded)
		}
	}, [editMode, steps])

	const handleInputChange = useCallback(
		(field: keyof TaskCard, value: any) => {
			if (field === "task_title") setTitle(value)
			else if (field === "description") setDescription(value)
			else if (field === "steps") setSteps(value)
			else if (field === "context") setContext(value)
			else if (field === "notes") setNotes(value)

			onTaskCardChange({ [field]: value })
		},
		[onTaskCardChange],
	)

	// No need for null check since we always have a default now

	const addContext = () => {
		if (!newContext.trim()) return
		const updatedContext = [...context, newContext]
		setContext(updatedContext)
		handleInputChange("context", updatedContext)
		setNewContext("")
	}

	const removeContext = (index: number) => {
		const updatedContext = context.filter((_, i) => i !== index)
		setContext(updatedContext)
		handleInputChange("context", updatedContext)
	}

	const addNote = () => {
		if (!newNote.trim()) return
		const updatedNotes = [...notes, newNote]
		setNotes(updatedNotes)
		handleInputChange("notes", updatedNotes)
		setNewNote("")
	}

	const removeNote = (index: number) => {
		const updatedNotes = notes.filter((_, i) => i !== index)
		setNotes(updatedNotes)
		handleInputChange("notes", updatedNotes)
	}

	const groupedSteps = {
		inProgress: steps.filter((s) => [TaskStepStatus.IN_PROGRESS].includes(s.status as TaskStepStatus)),
		todo: steps.filter((s) => [TaskStepStatus.PLANNED].includes(s.status as TaskStepStatus)),
		done: steps.filter((s) => [TaskStepStatus.COMPLETED].includes(s.status as TaskStepStatus)),
	}

	// Check if we have any steps to display in each section
	const hasSteps = steps.length > 0
	const hasInProgressSteps = groupedSteps.inProgress.length > 0
	const hasTodoSteps = groupedSteps.todo.length > 0
	const hasDoneSteps = groupedSteps.done.length > 0

	return (
		<div className="task-card-container flex flex-col gap-6">
			{editMode && (
				<>
					<div className="task-card-section">
						<label className="block mb-1 text-sm font-medium text-gray-300">{t("task_card:title")}</label>
						<VSCodeTextField value={title} onInput={handleTitleChange} className="w-full" />
					</div>
					<div className="task-card-section">
						<label className="block mb-1 text-sm font-medium text-gray-300">
							{t("task_card:description")}
						</label>
						<VSCodeTextArea
							value={description}
							onInput={handleDescriptionChange}
							className="w-full min-h-[100px]"
							rows={4}
						/>
					</div>
					<VSCodeDivider />
				</>
			)}

			<div className="task-card-section">
				{!hasSteps && (
					<div className="bg-[#1F1C33] p-4 rounded border border-gray-700 mb-5">
						<p className="text-center mb-3">
							{editMode
								? "No task steps yet. Add your first step below."
								: "No task steps have been added yet."}
						</p>
					</div>
				)}

				{/* Only show In Progress section if it has steps */}
				{hasInProgressSteps && (
					<Section
						title={t("task_card:in_progress")}
						icon="circle-filled"
						steps={groupedSteps.inProgress}
						color="var(--vscode-charts-yellow)"
						editMode={editMode}
						expandedSteps={expandedSteps}
						toggleStepExpansion={toggleStepExpansion}
						updateStepStatus={updateStepStatus}
						removeStep={removeStep}
						addStepComment={addStepComment}
						removeStepComment={removeStepComment}
						taskCardIdPrefix={taskCardIdPrefix}
					/>
				)}

				{/* Always show To Do section if it has steps */}
				{hasTodoSteps && (
					<Section
						title={t("task_card:todo")}
						icon="circle-outline"
						steps={groupedSteps.todo}
						color="var(--vscode-charts-blue)"
						editMode={editMode}
						expandedSteps={expandedSteps}
						toggleStepExpansion={toggleStepExpansion}
						updateStepStatus={updateStepStatus}
						removeStep={removeStep}
						addStepComment={addStepComment}
						removeStepComment={removeStepComment}
						taskCardIdPrefix={taskCardIdPrefix}
					/>
				)}

				{/* Only show Done section if it has steps */}
				{hasDoneSteps && (
					<Section
						title={t("task_card:completed")}
						icon="check-circle-filled"
						steps={groupedSteps.done}
						color="var(--vscode-charts-green)"
						editMode={editMode}
						expandedSteps={expandedSteps}
						toggleStepExpansion={toggleStepExpansion}
						updateStepStatus={updateStepStatus}
						removeStep={removeStep}
						addStepComment={addStepComment}
						removeStepComment={removeStepComment}
						taskCardIdPrefix={taskCardIdPrefix}
					/>
				)}

				{editMode && (
					<div className="flex mt-4">
						<VSCodeTextField
							placeholder={t("task_card:new_step")}
							value={newStep}
							onInput={(e: any) => setNewStep(e.target.value)}
							className="flex-grow"
						/>
						<VSCodeButton className="ml-2" onClick={handleAddStep} appearance="secondary">
							{t("common:add")}
						</VSCodeButton>
					</div>
				)}
			</div>

			<div className="task-card-section">
				<VSCodeDivider />
				<h3 className="font-semibold text-lg mt-4 mb-3">{t("task_card:context")}</h3>
				{context.length > 0 ? (
					<ul className="pl-5 space-y-2">
						{context.map((ctx, index) => (
							<li key={index} className="flex items-start">
								<span className="flex-grow mr-2 text-[#f5f5f5] flex items-center">
									<span className="text-xl mr-2 leading-none">•</span>
									<span>{ctx}</span>
								</span>
								{editMode && (
									<VSCodeButton
										appearance="icon"
										onClick={() => removeContext(index)}
										title={t("common:delete")}
										className="ml-auto mt-[-4px]">
										<span className="codicon codicon-trash"></span>
									</VSCodeButton>
								)}
							</li>
						))}
					</ul>
				) : (
					!editMode && <p className="text-gray-400 italic text-sm">{t("task_card:no_context")}</p>
				)}
				{editMode && (
					<div className="flex mt-4">
						<VSCodeTextField
							placeholder={t("task_card:new_context")}
							value={newContext}
							onInput={(e: any) => setNewContext(e.target.value)}
							className="flex-grow"
						/>
						<VSCodeButton className="ml-2" onClick={addContext} appearance="secondary">
							{t("common:add")}
						</VSCodeButton>
					</div>
				)}
			</div>
			<div className="task-card-section">
				<VSCodeDivider />
				<h3 className="font-semibold text-lg mt-4 mb-3">{t("task_card:notes")}</h3>
				{notes.length > 0 ? (
					<ul className="pl-5 space-y-2">
						{notes.map((note, index) => (
							<li key={index} className="flex items-start">
								<span className="flex-grow mr-2 text-[#f5f5f5] flex items-center">
									<span className="text-xl mr-2 leading-none">•</span>
									<span>{note}</span>
								</span>
								{editMode && (
									<VSCodeButton
										appearance="icon"
										onClick={() => removeNote(index)}
										title={t("common:delete")}
										className="ml-auto mt-[-4px]">
										<span className="codicon codicon-trash"></span>
									</VSCodeButton>
								)}
							</li>
						))}
					</ul>
				) : (
					!editMode && <p className="text-gray-400 italic text-sm">{t("task_card:no_notes")}</p>
				)}
				{editMode && (
					<div className="flex mt-4">
						<VSCodeTextField
							placeholder={t("task_card:new_note")}
							value={newNote}
							onInput={(e: any) => setNewNote(e.target.value)}
							className="flex-grow"
						/>
						<VSCodeButton className="ml-2" onClick={addNote} appearance="secondary">
							{t("common:add")}
						</VSCodeButton>
					</div>
				)}
			</div>
		</div>
	)
}
