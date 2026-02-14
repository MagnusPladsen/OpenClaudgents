use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// An agent team configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentTeam {
    pub name: String,
    pub config_path: String,
    pub members: Vec<AgentTeamMember>,
}

/// A member of an agent team
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentTeamMember {
    pub name: String,
    pub agent_id: String,
    pub agent_type: String,
    pub role: String, // "lead" or "teammate"
}

/// MCP server configuration entry
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct McpServerInfo {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub enabled: bool,
}

/// Discover agent teams from ~/.claude/teams/
pub fn discover_teams() -> Vec<AgentTeam> {
    let home = dirs::home_dir().unwrap_or_default();
    let teams_dir = home.join(".claude").join("teams");

    if !teams_dir.exists() {
        return vec![];
    }

    let mut teams = vec![];

    let Ok(entries) = std::fs::read_dir(&teams_dir) else {
        return vec![];
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let team_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let config_path = path.join("config.json");
        if !config_path.exists() {
            continue;
        }

        if let Ok(content) = std::fs::read_to_string(&config_path) {
            if let Ok(config) = serde_json::from_str::<serde_json::Value>(&content) {
                let members = parse_team_members(&config);
                teams.push(AgentTeam {
                    name: team_name,
                    config_path: config_path.to_string_lossy().to_string(),
                    members,
                });
            }
        }
    }

    teams
}

fn parse_team_members(config: &serde_json::Value) -> Vec<AgentTeamMember> {
    let mut members = vec![];

    // Parse members array from team config
    if let Some(members_arr) = config.get("members").and_then(|m| m.as_array()) {
        for member in members_arr {
            let name = member
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("unnamed")
                .to_string();
            let agent_id = member
                .get("agentId")
                .or_else(|| member.get("agent_id"))
                .and_then(|id| id.as_str())
                .unwrap_or("")
                .to_string();
            let agent_type = member
                .get("agentType")
                .or_else(|| member.get("type"))
                .and_then(|t| t.as_str())
                .unwrap_or("general")
                .to_string();
            let role = member
                .get("role")
                .and_then(|r| r.as_str())
                .unwrap_or("teammate")
                .to_string();

            members.push(AgentTeamMember {
                name,
                agent_id,
                agent_type,
                role,
            });
        }
    }

    members
}

/// Read MCP server configs from ~/.claude/settings.json
pub fn get_mcp_servers() -> Vec<McpServerInfo> {
    let home = dirs::home_dir().unwrap_or_default();
    let settings_paths = [
        home.join(".claude").join("settings.json"),
        home.join(".claude").join("settings.local.json"),
    ];

    let mut servers = vec![];

    for settings_path in &settings_paths {
        if !settings_path.exists() {
            continue;
        }

        let Ok(content) = std::fs::read_to_string(settings_path) else {
            continue;
        };

        let Ok(config) = serde_json::from_str::<serde_json::Value>(&content) else {
            continue;
        };

        // MCP servers can be under "mcpServers" key
        if let Some(mcp) = config.get("mcpServers").and_then(|m| m.as_object()) {
            for (name, server_config) in mcp {
                let command = server_config
                    .get("command")
                    .and_then(|c| c.as_str())
                    .unwrap_or("")
                    .to_string();
                let args = server_config
                    .get("args")
                    .and_then(|a| a.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_default();
                let enabled = server_config
                    .get("disabled")
                    .and_then(|d| d.as_bool())
                    .map(|d| !d)
                    .unwrap_or(true);

                servers.push(McpServerInfo {
                    name: name.clone(),
                    command,
                    args,
                    enabled,
                });
            }
        }
    }

    servers
}

/// Read team task files from ~/.claude/tasks/{team-name}/
pub fn get_team_tasks(team_name: &str) -> Vec<serde_json::Value> {
    let home = dirs::home_dir().unwrap_or_default();
    let tasks_dir = home.join(".claude").join("tasks").join(team_name);

    if !tasks_dir.exists() {
        return vec![];
    }

    let mut tasks = vec![];

    if let Ok(entries) = std::fs::read_dir(&tasks_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(arr) = value.as_array() {
                            tasks.extend(arr.clone());
                        } else {
                            tasks.push(value);
                        }
                    }
                }
            }
        }
    }

    tasks
}
