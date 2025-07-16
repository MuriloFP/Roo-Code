import React from "react"
import { render, fireEvent, screen } from "@/utils/test-utils"

import { vscode } from "@src/utils/vscode"

import McpResourceRow from "../McpResourceRow"

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"mcp:resource.alwaysAllow": "Always allow",
			}
			return translations[key] || key
		},
	}),
}))

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeCheckbox: function MockVSCodeCheckbox({
		children,
		checked,
		onChange,
	}: {
		children?: React.ReactNode
		checked?: boolean
		onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
	}) {
		return (
			<label>
				<input type="checkbox" checked={checked} onChange={onChange} />
				{children}
			</label>
		)
	},
}))

describe("McpResourceRow", () => {
	const mockResource = {
		uri: "resource://test",
		name: "Test Resource",
		description: "A test resource",
		mimeType: "text/plain",
		alwaysAllow: false,
	}

	const mockResourceTemplate = {
		uriTemplate: "resource://test/{id}",
		name: "Test Resource Template",
		description: "A test resource template",
		mimeType: "application/json",
		alwaysAllow: false,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders resource URI and description", () => {
		render(<McpResourceRow item={mockResource} />)

		expect(screen.getByText("resource://test")).toBeInTheDocument()
		expect(screen.getByText("Test Resource: A test resource")).toBeInTheDocument()
		expect(screen.getByText("text/plain")).toBeInTheDocument()
	})

	it("renders resource template URI and description", () => {
		render(<McpResourceRow item={mockResourceTemplate} />)

		expect(screen.getByText("resource://test/{id}")).toBeInTheDocument()
		expect(screen.getByText("Test Resource Template: A test resource template")).toBeInTheDocument()
		expect(screen.getByText("application/json")).toBeInTheDocument()
	})

	it("does not show always allow checkbox when serverName is not provided", () => {
		render(<McpResourceRow item={mockResource} />)

		expect(screen.queryByText("Always allow")).not.toBeInTheDocument()
	})

	it("shows always allow checkbox when serverName and alwaysAllowMcp are provided", () => {
		render(<McpResourceRow item={mockResource} serverName="test-server" alwaysAllowMcp={true} />)

		expect(screen.getByText("Always allow")).toBeInTheDocument()
	})

	it("sends message to toggle always allow when checkbox is clicked for resource", () => {
		render(<McpResourceRow item={mockResource} serverName="test-server" alwaysAllowMcp={true} />)

		const checkbox = screen.getByRole("checkbox")
		fireEvent.click(checkbox)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "toggleResourceAlwaysAllow",
			serverName: "test-server",
			resourceUri: "resource://test",
			alwaysAllow: true,
			source: "global",
		})
	})

	it("sends message to toggle always allow when checkbox is clicked for resource template", () => {
		render(<McpResourceRow item={mockResourceTemplate} serverName="test-server" alwaysAllowMcp={true} />)

		const checkbox = screen.getByRole("checkbox")
		fireEvent.click(checkbox)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "toggleResourceAlwaysAllow",
			serverName: "test-server",
			resourceUri: "resource://test/{id}",
			alwaysAllow: true,
			source: "global",
		})
	})

	it("reflects always allow state in checkbox", () => {
		const alwaysAllowedResource = {
			...mockResource,
			alwaysAllow: true,
		}

		render(<McpResourceRow item={alwaysAllowedResource} serverName="test-server" alwaysAllowMcp={true} />)

		const checkbox = screen.getByRole("checkbox") as HTMLInputElement
		expect(checkbox.checked).toBe(true)
	})

	it("uses project source when provided", () => {
		render(
			<McpResourceRow
				item={mockResource}
				serverName="test-server"
				serverSource="project"
				alwaysAllowMcp={true}
			/>,
		)

		const checkbox = screen.getByRole("checkbox")
		fireEvent.click(checkbox)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "toggleResourceAlwaysAllow",
			serverName: "test-server",
			resourceUri: "resource://test",
			alwaysAllow: true,
			source: "project",
		})
	})

	it("handles resources with only name", () => {
		const resourceWithOnlyName = {
			...mockResource,
			description: undefined,
		}

		render(<McpResourceRow item={resourceWithOnlyName} />)

		expect(screen.getByText("Test Resource")).toBeInTheDocument()
	})

	it("handles resources with only description", () => {
		const resourceWithOnlyDescription = {
			...mockResource,
			name: undefined,
		} as any

		render(<McpResourceRow item={resourceWithOnlyDescription} />)

		expect(screen.getByText("A test resource")).toBeInTheDocument()
	})

	it("shows 'No description' when neither name nor description is provided", () => {
		const resourceWithNoInfo = {
			...mockResource,
			name: undefined,
			description: undefined,
		} as any

		render(<McpResourceRow item={resourceWithNoInfo} />)

		expect(screen.getByText("No description")).toBeInTheDocument()
	})

	it("shows 'Unknown' for mime type when not provided", () => {
		const resourceWithNoMimeType = {
			...mockResource,
			mimeType: undefined,
		}

		render(<McpResourceRow item={resourceWithNoMimeType} />)

		expect(screen.getByText("Unknown")).toBeInTheDocument()
	})
})
