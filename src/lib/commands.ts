export interface SlashCommand {
  name: string;
  description: string;
  args?: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: "clear", description: "Clear chat messages" },
  { name: "compact", description: "Compact conversation context" },
  { name: "settings", description: "Open settings" },
  { name: "mcp", description: "Open MCP servers panel" },
  { name: "help", description: "Show available commands" },
  { name: "new", description: "Start a new session" },
  { name: "model", description: "Set model for next session", args: "<model-name>" },
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

export function matchCommands(partial: string): SlashCommand[] {
  if (!partial.startsWith("/")) return [];
  const query = partial.slice(1).toLowerCase();
  if (!query) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) => c.name.startsWith(query));
}
