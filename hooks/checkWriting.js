#!/usr/bin/env node
/**
 * A Claude Code `Stop` hook that asks the agent to run the writing checklist on the prose its turn wrote, before it stops.
 * Prose is a Markdown file, a doc comment, a commit message, or a pull request or merge request description. The hook
 * asks once per turn, so the agent can stop after the check.
 */
import fs from "node:fs"

const editTools = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"])
const markdownFile = /\.mdx?$/i
const commitCommand = /\bgit\s+commit\b/
const requestCommand = /\b(gh\s+pr|glab\s+mr)\s+(create|edit|update)\b/
const requestTool = /(create|update)_(pull|merge)_request/i

// oxlint-disable-next-line eslint/no-restricted-properties -- Claude Code's own hook input.
const input = JSON.parse(fs.readFileSync(0, "utf8"))

/** Each JSON line of the transcript. A line that doesn't parse is skipped. */
function readTranscript(file) {
	if (typeof file !== "string" || !fs.existsSync(file)) return []
	return fs
		.readFileSync(file, "utf8")
		.split("\n")
		.flatMap(function (line) {
			try {
				// oxlint-disable-next-line eslint/no-restricted-properties -- Claude Code's own transcript.
				return [JSON.parse(line)]
			} catch {
				return []
			}
		})
}

/** A message the person typed, as opposed to a tool result that Claude Code sends back as a user message. */
function isPersonMessage(entry) {
	if (entry.type !== "user" || entry.isMeta === true) return false
	const content = entry.message?.content
	return typeof content === "string" || (Array.isArray(content) && content.some((block) => block.type === "text"))
}

/** Every tool call the agent made since the person's last message. */
function toolCallsThisTurn(entries) {
	const start = entries.findLastIndex(isPersonMessage)
	return entries
		.slice(start + 1)
		.filter((entry) => entry.type === "assistant" && Array.isArray(entry.message?.content))
		.flatMap((entry) => entry.message.content.filter((block) => block.type === "tool_use"))
}

/** The text a call to an edit tool writes into its file. */
function writtenText(call) {
	const edits = Array.isArray(call.input?.edits) ? call.input.edits : []
	return [
		call.input?.content,
		call.input?.new_string,
		call.input?.new_source,
		...edits.map((edit) => edit.new_string),
	]
		.filter((text) => typeof text === "string")
		.join("\n")
}

/** What kind of prose a tool call wrote, if any. */
function proseKind(call) {
	if (editTools.has(call.name)) {
		const file = call.input?.file_path ?? call.input?.notebook_path ?? ""
		if (markdownFile.test(file)) return `the Markdown file ${file}`
		if (writtenText(call).includes("/**")) return `the doc comments in ${file}`
		return undefined
	}
	if (call.name === "Bash") {
		const command = call.input?.command ?? ""
		if (commitCommand.test(command)) return "the commit message"
		if (requestCommand.test(command)) return "the pull request or merge request description"
		return undefined
	}
	return requestTool.test(call.name ?? "") ? "the pull request or merge request description" : undefined
}

const kinds =
	input.stop_hook_active === true
		? []
		: [
				...new Set(
					toolCallsThisTurn(readTranscript(input.transcript_path)).flatMap((call) => proseKind(call) ?? [])
				),
			]

if (kinds.length > 0)
	process.stdout.write(
		JSON.stringify({
			decision: "block",
			reason: `This turn wrote prose: ${kinds.join(", ")}. Before you finish, run the checklist in .agents/skills/writing/SKILL.md on that text, check it against docs/WRITING.md, and fix what fails.`,
		})
	)
