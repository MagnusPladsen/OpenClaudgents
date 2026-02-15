import { SLASH_COMMANDS, CATEGORY_LABELS } from "./commands";
import { estimateCost, formatCost, getModelDisplayName } from "./cost";
import { BUILT_IN_THEMES } from "./theme";
import { detectClaudeCli, getGitStatus, getClaudeTodos, updateClaudeMd, killSession, listWorktrees } from "./tauri";
import type { ParsedSlashCommand, CommandCategory } from "./commands";
import type { Session, ChatMessage } from "./types";

type Tab = "diff" | "context" | "instructions" | "tasks" | "agents" | "mcp" | "worktrees";

export interface CommandContext {
  addSystemMessage: (content: string) => void;
  clearMessages: () => void;
  openPreviewTab: (tab: Tab) => void;
  openSettings: () => void;
  newSession: () => void;
  exitSession: () => void;
  getActiveSession: () => Session | undefined;
  getAllSessions: () => Session[];
  setActiveSession: (id: string | null) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  getMessages: () => ChatMessage[];
  removeLastMessages: (count: number) => void;
  showSessionPicker: () => void;
  setTheme: (themeId: string) => void;
  setPlanMode: (enabled: boolean) => void;
  getPlanMode: () => boolean;
  showRewindDialog: () => void;
  switchModel: (model: string) => Promise<void>;
  showRestoreDialog: () => void;
  showPluginManager: () => void;
}

/**
 * Execute a slash command. Returns true if handled locally, false if it should
 * be passed through to the CLI (e.g., /compact).
 */
export async function executeCommand(
  ctx: CommandContext,
  parsed: ParsedSlashCommand,
): Promise<boolean> {
  const cmd = parsed.command;
  const args = parsed.args;

  // Check if this is a known passthrough command
  const def = SLASH_COMMANDS.find((c) => c.name === cmd);
  if (def?.passthrough) return false;

  // Check if this is a hidden/N/A command
  if (def?.hidden) {
    ctx.addSystemMessage(`**/${cmd}** is not available in the GUI. This command only works in the terminal CLI.`);
    return true;
  }

  switch (cmd) {
    // --- Navigation ---
    case "context":
      ctx.openPreviewTab("context");
      return true;

    case "tasks":
      ctx.openPreviewTab("tasks");
      return true;

    case "memory":
      ctx.openPreviewTab("instructions");
      return true;

    case "mcp":
      ctx.openPreviewTab("mcp");
      return true;

    case "settings":
    case "config":
      ctx.openSettings();
      return true;

    // --- Session ---
    case "new":
      ctx.newSession();
      return true;

    case "clear":
      ctx.clearMessages();
      return true;

    case "exit": {
      const session = ctx.getActiveSession();
      if (session) {
        try {
          await killSession(session.id);
        } catch {
          // Session may already be dead
        }
      }
      ctx.exitSession();
      return true;
    }

    case "resume":
      if (args) {
        // Direct resume by ID
        const target = ctx.getAllSessions().find(
          (s) => s.id === args || s.claudeSessionId === args,
        );
        if (target) {
          ctx.setActiveSession(target.id);
          ctx.addSystemMessage(`Resumed session: **${target.name || target.id}**`);
        } else {
          ctx.addSystemMessage(`Session "${args}" not found. Use /resume without arguments to browse sessions.`);
        }
      } else {
        ctx.showSessionPicker();
      }
      return true;

    case "rename":
      if (!args) {
        ctx.addSystemMessage("Usage: **/rename <name>** — Rename the current session.");
        return true;
      }
      {
        const session = ctx.getActiveSession();
        if (!session) {
          ctx.addSystemMessage("No active session to rename.");
          return true;
        }
        ctx.updateSession(session.id, { name: args });
        ctx.addSystemMessage(`Session renamed to **${args}**`);
      }
      return true;

    case "model": {
      const MODELS: Record<string, string> = {
        sonnet: "claude-sonnet-4-5-20250929",
        opus: "claude-opus-4-6",
        haiku: "claude-haiku-4-5-20251001",
      };
      if (!args) {
        const session = ctx.getActiveSession();
        const current = session?.model ? getModelDisplayName(session.model) : "none";
        ctx.addSystemMessage(
          `**Current model:** ${current}\n\n` +
          "**Available models:**\n" +
          "- `sonnet` — Claude Sonnet 4.5 (fast, balanced)\n" +
          "- `opus` — Claude Opus 4.6 (most capable)\n" +
          "- `haiku` — Claude Haiku 4.5 (fastest, cheapest)\n\n" +
          "Usage: **/model <name>**",
        );
        return true;
      }
      const modelId = MODELS[args.toLowerCase()];
      if (!modelId) {
        ctx.addSystemMessage(
          `Unknown model "${args}". Available: sonnet, opus, haiku`,
        );
        return true;
      }
      {
        const session = ctx.getActiveSession();
        if (!session) {
          ctx.addSystemMessage("No active session. The model will be used for the next session.");
          return true;
        }
        try {
          await ctx.switchModel(modelId);
          ctx.addSystemMessage(`Model switched to **${getModelDisplayName(modelId)}**.`);
        } catch (err) {
          ctx.addSystemMessage(`Failed to switch model: ${err}`);
        }
      }
      return true;
    }

    case "rewind": {
      const messages = ctx.getMessages();
      if (messages.length === 0) {
        ctx.addSystemMessage("No messages to rewind.");
        return true;
      }
      ctx.showRewindDialog();
      return true;
    }

    case "plan": {
      const current = ctx.getPlanMode();
      ctx.setPlanMode(!current);
      ctx.addSystemMessage(
        !current
          ? "Plan mode **enabled**. Messages will include a plan-mode flag."
          : "Plan mode **disabled**.",
      );
      return true;
    }

    case "restore": {
      const session = ctx.getActiveSession();
      if (!session) {
        ctx.addSystemMessage("No active session.");
        return true;
      }
      ctx.showRestoreDialog();
      return true;
    }

    // --- Info ---
    case "help": {
      const groups: Record<CommandCategory, string[]> = {
        navigation: [],
        session: [],
        context: [],
        tools: [],
        custom: [],
      };
      for (const c of SLASH_COMMANDS) {
        if (c.hidden) continue;
        const line = `**/${c.name}**${c.args ? ` ${c.args}` : ""} — ${c.description}`;
        groups[c.category].push(line);
      }
      const sections = (Object.entries(groups) as [CommandCategory, string[]][])
        .filter(([, lines]) => lines.length > 0)
        .map(([cat, lines]) => `**${CATEGORY_LABELS[cat]}**\n${lines.join("\n")}`)
        .join("\n\n");
      ctx.addSystemMessage(`Available commands:\n\n${sections}`);
      return true;
    }

    case "cost": {
      const session = ctx.getActiveSession();
      if (!session) {
        ctx.addSystemMessage("No active session.");
        return true;
      }
      const cost = estimateCost(
        session.model,
        session.totalInputTokens,
        session.totalOutputTokens,
      );
      ctx.addSystemMessage(
        `**Session Cost**\n` +
        `Model: ${getModelDisplayName(session.model)}\n` +
        `Input tokens: ${session.totalInputTokens.toLocaleString()}\n` +
        `Output tokens: ${session.totalOutputTokens.toLocaleString()}\n` +
        `Estimated cost: **${formatCost(cost)}**`,
      );
      return true;
    }

    case "usage": {
      const session = ctx.getActiveSession();
      if (!session) {
        ctx.addSystemMessage("No active session.");
        return true;
      }
      const cost = estimateCost(
        session.model,
        session.totalInputTokens,
        session.totalOutputTokens,
      );
      ctx.addSystemMessage(
        `**Usage**\n` +
        `Model: ${getModelDisplayName(session.model)}\n` +
        `Input: ${session.totalInputTokens.toLocaleString()} tokens\n` +
        `Output: ${session.totalOutputTokens.toLocaleString()} tokens\n` +
        `Total: ${(session.totalInputTokens + session.totalOutputTokens).toLocaleString()} tokens\n` +
        `Estimated cost: **${formatCost(cost)}**\n\n` +
        `_Cost estimates based on published API pricing. Actual billing may differ for Max/Pro subscribers._`,
      );
      return true;
    }

    case "stats": {
      const session = ctx.getActiveSession();
      const messages = ctx.getMessages();
      if (!session) {
        ctx.addSystemMessage("No active session.");
        return true;
      }
      const userMsgs = messages.filter((m) => m.role === "user").length;
      const assistantMsgs = messages.filter((m) => m.role === "assistant").length;
      ctx.addSystemMessage(
        `**Session Stats**\n` +
        `Name: ${session.name || "(unnamed)"}\n` +
        `Status: ${session.status}\n` +
        `Model: ${getModelDisplayName(session.model)}\n` +
        `Messages: ${messages.length} total (${userMsgs} user, ${assistantMsgs} assistant)\n` +
        `Created: ${new Date(session.createdAt).toLocaleString()}\n` +
        `Last updated: ${new Date(session.updatedAt).toLocaleString()}`,
      );
      return true;
    }

    case "status": {
      const session = ctx.getActiveSession();
      if (!session) {
        ctx.addSystemMessage("No active session.");
        return true;
      }
      let statusText =
        `**Session Status**\n` +
        `ID: \`${session.id}\`\n` +
        `Claude Session: \`${session.claudeSessionId}\`\n` +
        `Status: ${session.status}\n` +
        `Project: ${session.projectPath}`;

      if (session.worktreePath) {
        statusText += `\nWorktree: ${session.worktreePath}`;
      }

      try {
        const path = session.worktreePath || session.projectPath;
        const git = await getGitStatus(path);
        statusText +=
          `\n\n**Git Status**\n` +
          `Branch: ${git.branch}\n` +
          `Dirty: ${git.isDirty ? `Yes (${git.dirtyFileCount} files)` : "No"}\n` +
          `Last commit: ${git.lastCommitMessage}`;
      } catch {
        statusText += "\n\n_Git status unavailable._";
      }

      ctx.addSystemMessage(statusText);
      return true;
    }

    case "doctor": {
      let report = "**CLI Health Check**\n";
      try {
        const cliPath = await detectClaudeCli();
        if (cliPath) {
          report += `CLI found: \`${cliPath}\`\n`;
          report += "Status: healthy";
        } else {
          report += "CLI not found.\n";
          report += "Install Claude Code: `npm install -g @anthropic-ai/claude-code`";
        }
      } catch (err) {
        report += `Error detecting CLI: ${err}`;
      }
      ctx.addSystemMessage(report);
      return true;
    }

    case "todos": {
      try {
        const todos = await getClaudeTodos();
        if (todos.length === 0) {
          ctx.addSystemMessage("No TODOs found.");
          return true;
        }
        const lines = todos.map((t) => {
          const icon = t.status === "done" ? "[x]" : t.status === "in_progress" ? "[-]" : "[ ]";
          return `- ${icon} ${t.content}`;
        });
        ctx.addSystemMessage(`**TODOs** (${todos.length})\n${lines.join("\n")}`);
      } catch (err) {
        ctx.addSystemMessage(`Failed to load TODOs: ${err}`);
      }
      return true;
    }

    case "debug": {
      const session = ctx.getActiveSession();
      const messages = ctx.getMessages();
      const allSessions = ctx.getAllSessions();
      ctx.addSystemMessage(
        "**Debug Info**\n" +
        `Active session ID: \`${session?.id ?? "none"}\`\n` +
        `Claude session ID: \`${session?.claudeSessionId ?? "none"}\`\n` +
        `Total sessions in store: ${allSessions.length}\n` +
        `Messages in view: ${messages.length}\n` +
        `Plan mode: ${ctx.getPlanMode() ? "on" : "off"}\n` +
        `Session status: ${session?.status ?? "n/a"}\n` +
        `Project path: ${session?.projectPath ?? "n/a"}\n` +
        `Worktree path: ${session?.worktreePath ?? "n/a"}\n` +
        `Model: ${session?.model ?? "n/a"}\n` +
        `Is agent team: ${session?.isAgentTeam ?? false}\n` +
        `Team role: ${session?.teamRole ?? "n/a"}`,
      );
      return true;
    }

    case "permissions":
      ctx.addSystemMessage(
        "**Permissions**\n\n" +
        "Permissions are managed by the Claude CLI configuration.\n" +
        "Edit `~/.claude/settings.json` or use `claude config` in your terminal to change permission settings.\n\n" +
        "OpenClaudgents inherits the CLI's permission model — tool approvals happen through the native CLI prompts.",
      );
      return true;

    // --- Tools ---
    case "copy": {
      const messages = ctx.getMessages();
      const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
      if (!lastAssistant) {
        ctx.addSystemMessage("No assistant message to copy.");
        return true;
      }
      const text = typeof lastAssistant.content === "string"
        ? lastAssistant.content
        : lastAssistant.content
            .filter((b) => b.type === "text")
            .map((b) => b.text ?? "")
            .join("\n");
      try {
        await navigator.clipboard.writeText(text);
        ctx.addSystemMessage("Last response copied to clipboard.");
      } catch {
        ctx.addSystemMessage("Failed to copy to clipboard.");
      }
      return true;
    }

    case "theme": {
      if (!args) {
        const themeList = BUILT_IN_THEMES.map((t) => `- \`${t.id}\` — ${t.name}`).join("\n");
        ctx.addSystemMessage(`**Available Themes:**\n${themeList}\n\nUsage: **/theme <theme-id>**`);
        return true;
      }
      const theme = BUILT_IN_THEMES.find(
        (t) => t.id === args || t.name.toLowerCase() === args.toLowerCase(),
      );
      if (!theme) {
        ctx.addSystemMessage(`Unknown theme "${args}". Type **/theme** to see available themes.`);
        return true;
      }
      ctx.setTheme(theme.id);
      ctx.addSystemMessage(`Theme switched to **${theme.name}**.`);
      return true;
    }

    case "init": {
      const session = ctx.getActiveSession();
      if (!session) {
        ctx.addSystemMessage("No active session. Start a session first.");
        return true;
      }
      const template = `# Project Instructions\n\n## Overview\nDescribe your project here.\n\n## Conventions\n- List your coding conventions\n- Style guidelines\n- Important patterns\n\n## Commands\n\`\`\`bash\n# Add useful commands here\n\`\`\`\n`;
      try {
        await updateClaudeMd(session.projectPath, template);
        ctx.addSystemMessage("Created **CLAUDE.md** with a starter template. Open the CLAUDE.md tab to edit.");
        ctx.openPreviewTab("instructions");
      } catch (err) {
        ctx.addSystemMessage(`Failed to create CLAUDE.md: ${err}`);
      }
      return true;
    }

    case "export": {
      const messages = ctx.getMessages();
      if (messages.length === 0) {
        ctx.addSystemMessage("No messages to export.");
        return true;
      }
      const exported = messages
        .map((m) => {
          const role = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System";
          const text = typeof m.content === "string"
            ? m.content
            : m.content
                .filter((b) => b.type === "text")
                .map((b) => b.text ?? "")
                .join("\n");
          return `## ${role}\n\n${text}`;
        })
        .join("\n\n---\n\n");

      try {
        await navigator.clipboard.writeText(exported);
        ctx.addSystemMessage(`Exported ${messages.length} messages to clipboard as markdown.`);
      } catch {
        ctx.addSystemMessage("Failed to copy to clipboard.");
      }
      return true;
    }

    case "plugins": {
      ctx.showPluginManager();
      return true;
    }

    case "worktree": {
      const session = ctx.getActiveSession();
      if (!session) {
        ctx.addSystemMessage("No active session.");
        return true;
      }

      if (args === "list") {
        try {
          const worktrees = await listWorktrees(session.projectPath);
          if (worktrees.length === 0) {
            ctx.addSystemMessage("No worktrees found for this project.");
          } else {
            const lines = worktrees.map((w) => `- \`${w}\``);
            ctx.addSystemMessage(
              `**Worktrees for ${session.projectPath}** (${worktrees.length})\n${lines.join("\n")}`,
            );
          }
        } catch (err) {
          ctx.addSystemMessage(`Failed to list worktrees: ${err}`);
        }
      } else {
        if (session.worktreePath) {
          ctx.addSystemMessage(
            `This session is running in a worktree at \`${session.worktreePath}\`\n\n` +
            `Original project: \`${session.projectPath}\`\n\n` +
            `Use **/worktree list** to see all worktrees for this project.`,
          );
        } else {
          ctx.addSystemMessage(
            "This session is using the project folder directly.\n\n" +
            "Use **/worktree list** to see all worktrees for this project.",
          );
        }
      }
      return true;
    }

    default:
      ctx.addSystemMessage(
        `Unknown command **/${cmd}**. Type **/help** to see available commands.`,
      );
      return true;
  }
}
