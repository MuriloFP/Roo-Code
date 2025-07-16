import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { McpResource, McpResourceTemplate } from "@roo/mcp"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"

type McpResourceRowProps = {
	item: McpResource | McpResourceTemplate
	serverName?: string
	serverSource?: "global" | "project"
	alwaysAllowMcp?: boolean
}

const McpResourceRow = ({ item, serverName, serverSource, alwaysAllowMcp }: McpResourceRowProps) => {
	const { t } = useAppTranslation()
	const hasUri = "uri" in item
	const uri = hasUri ? item.uri : item.uriTemplate

	const handleAlwaysAllowChange = () => {
		if (!serverName) return
		vscode.postMessage({
			type: "toggleResourceAlwaysAllow",
			serverName,
			source: serverSource || "global",
			resourceUri: uri,
			alwaysAllow: !item.alwaysAllow,
		})
	}

	return (
		<div
			key={uri}
			style={{
				padding: "3px 0",
			}}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: "4px",
				}}>
				<div style={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}>
					<span className={`codicon codicon-symbol-file`} style={{ marginRight: "6px" }} />
					<span style={{ fontWeight: 500, wordBreak: "break-all" }}>{uri}</span>
				</div>
				{serverName && alwaysAllowMcp && (
					<VSCodeCheckbox
						checked={item.alwaysAllow}
						onChange={handleAlwaysAllowChange}
						style={{ marginLeft: "8px", flexShrink: 0 }}>
						<span style={{ fontSize: "12px", opacity: 0.8 }}>{t("mcp:resource.alwaysAllow")}</span>
					</VSCodeCheckbox>
				)}
			</div>
			<div
				style={{
					fontSize: "12px",
					opacity: 0.8,
					margin: "4px 0",
				}}>
				{item.name && item.description
					? `${item.name}: ${item.description}`
					: !item.name && item.description
						? item.description
						: !item.description && item.name
							? item.name
							: t("mcp:resource.noDescription")}
			</div>
			<div
				style={{
					fontSize: "12px",
				}}>
				<span style={{ opacity: 0.8 }}>{t("mcp:resource.returns")} </span>
				<code
					style={{
						color: "var(--vscode-textPreformat-foreground)",
						background: "var(--vscode-textPreformat-background)",
						padding: "1px 4px",
						borderRadius: "3px",
					}}>
					{item.mimeType || "Unknown"}
				</code>
			</div>
		</div>
	)
}

export default McpResourceRow
