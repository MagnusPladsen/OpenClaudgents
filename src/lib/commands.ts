export type CommandCategory = "navigation" | "session" | "context" | "tools" | "custom";

export interface SlashCommand {
  name: string;
  description: string;
  args?: string;
  category: CommandCategory;
  hidden?: boolean;
  passthrough?: boolean;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Navigation — open panels/tabs
  { name: "context", description: "Open context budget panel", category: "navigation" },
  { name: "tasks", description: "Open task list panel", category: "navigation" },
  { name: "memory", description: "Open CLAUDE.md instructions", category: "navigation" },
  { name: "mcp", description: "Open MCP servers panel", category: "navigation" },
  { name: "settings", description: "Open settings dialog", category: "navigation" },
  { name: "config", description: "Open settings (alias)", category: "navigation" },

  // Session — manage sessions and messages
  { name: "new", description: "Start a new session", category: "session" },
  { name: "clear", description: "Clear chat messages", category: "session" },
  { name: "exit", description: "End current session", category: "session" },
  { name: "resume", description: "Resume a previous session", args: "[session-id]", category: "session" },
  { name: "rename", description: "Rename current session", args: "<name>", category: "session" },
  { name: "model", description: "Set model for session", args: "[model-name]", category: "session" },
  { name: "compact", description: "Compact conversation context", category: "session", passthrough: true },
  { name: "rewind", description: "Rewind conversation and/or code to a checkpoint", category: "session" },
  { name: "plan", description: "Toggle plan mode", category: "session" },

  // Context — info about current state
  { name: "help", description: "Show available commands", category: "context" },
  { name: "cost", description: "Show token usage and cost", category: "context" },
  { name: "stats", description: "Show session statistics", category: "context" },
  { name: "status", description: "Show session and git status", category: "context" },
  { name: "doctor", description: "Check CLI health", category: "context" },
  { name: "todos", description: "Show TODO list", category: "context" },
  { name: "usage", description: "Show usage and billing info", category: "context" },
  { name: "debug", description: "Show debug info", category: "context" },
  { name: "permissions", description: "Show permissions info", category: "context" },

  // Tools — actions
  { name: "copy", description: "Copy last response to clipboard", category: "tools" },
  { name: "theme", description: "Switch theme", args: "[theme-name]", category: "tools" },
  { name: "init", description: "Create template CLAUDE.md", category: "tools" },
  { name: "export", description: "Export chat to clipboard", category: "tools" },
  { name: "plugins", description: "Show skills and MCP servers", category: "tools" },

  // Hidden — not available in GUI
  { name: "vim", description: "Not available in GUI", category: "tools", hidden: true },
  { name: "terminal-setup", description: "Not available in GUI", category: "tools", hidden: true },
  { name: "install-github-app", description: "Not available in GUI", category: "tools", hidden: true },
  { name: "statusline", description: "Not available in GUI", category: "tools", hidden: true },
  { name: "teleport", description: "Not available in GUI", category: "tools", hidden: true },
  { name: "desktop", description: "Not available in GUI", category: "tools", hidden: true },
];

export interface ParsedSlashCommand {
  command: string;
  args: string;
}

export function parseSlashCommand(input: string): ParsedSlashCommand | null {
  if (!input.startsWith("/")) return null;
  const trimmed = input.slice(1).trim();
  if (!trimmed) return null;
  const [command, ...rest] = trimmed.split(/\s+/);
  return { command: command.toLowerCase(), args: rest.join(" ") };
}

const CATEGORY_ORDER: CommandCategory[] = ["navigation", "session", "context", "tools", "custom"];

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: "Navigation",
  session: "Session",
  context: "Info",
  tools: "Tools",
  custom: "Custom Skills",
};

export { CATEGORY_LABELS };

export interface GroupedCommands {
  category: CommandCategory;
  label: string;
  commands: SlashCommand[];
}

export function matchCommandsGrouped(
  partial: string,
  customSkills?: SlashCommand[],
): GroupedCommands[] {
  if (!partial.startsWith("/")) return [];
  const query = partial.slice(1).toLowerCase();

  const allCommands = customSkills
    ? [...SLASH_COMMANDS, ...customSkills]
    : SLASH_COMMANDS;

  const filtered = query
    ? allCommands.filter((c) => !c.hidden && c.name.startsWith(query))
    : allCommands.filter((c) => !c.hidden);

  // Group by category in defined order
  const groups: GroupedCommands[] = [];
  for (const cat of CATEGORY_ORDER) {
    const cmds = filtered.filter((c) => c.category === cat);
    if (cmds.length > 0) {
      groups.push({
        category: cat,
        label: CATEGORY_LABELS[cat],
        commands: cmds,
      });
    }
  }

  return groups;
}

/** Flat match for backward compat — returns all matching non-hidden commands */
export function matchCommands(partial: string): SlashCommand[] {
  if (!partial.startsWith("/")) return [];
  const query = partial.slice(1).toLowerCase();
  if (!query) return SLASH_COMMANDS.filter((c) => !c.hidden);
  return SLASH_COMMANDS.filter((c) => !c.hidden && c.name.startsWith(query));
}
