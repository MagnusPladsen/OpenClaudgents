use crate::claude::agent_teams;

/// Discover all agent teams from ~/.claude/teams/
#[tauri::command]
pub async fn get_agent_teams() -> Result<Vec<agent_teams::AgentTeam>, String> {
    Ok(agent_teams::discover_teams())
}

/// Get MCP server configurations
#[tauri::command]
pub async fn get_mcp_servers() -> Result<Vec<agent_teams::McpServerInfo>, String> {
    Ok(agent_teams::get_mcp_servers())
}

/// Get tasks for a specific team
#[tauri::command]
pub async fn get_team_tasks(team_name: String) -> Result<Vec<serde_json::Value>, String> {
    Ok(agent_teams::get_team_tasks(&team_name))
}
