mod claude;
mod commands;
mod db;
mod events;
mod git;

use std::sync::Arc;

use claude::process::ProcessManager;
use commands::session::{self, AppState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let process_manager = Arc::new(ProcessManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:openclaudgents.db", db::get_migrations())
                .build(),
        )
        .manage(AppState { process_manager })
        .invoke_handler(tauri::generate_handler![
            session::create_session,
            session::send_message,
            session::kill_session,
            session::detect_claude_cli,
            session::discover_sessions,
            session::get_session_messages,
            session::resume_session,
            commands::git::get_git_status,
            commands::git::get_git_diff,
            commands::git::create_worktree,
            commands::git::remove_worktree,
            commands::git::list_worktrees,
            commands::git::cleanup_worktrees,
            commands::git::get_file_diff_content,
            commands::git::git_stage_all,
            commands::git::git_commit,
            commands::git::git_push,
            commands::git::git_log_commits,
            commands::git::git_restore_to_commit,
            commands::settings::get_claude_md,
            commands::settings::update_claude_md,
            commands::settings::get_claude_todos,
            commands::settings::discover_custom_skills,
            commands::settings::list_plugins,
            commands::settings::install_plugin,
            commands::settings::remove_plugin,
            commands::settings::add_mcp_server,
            commands::settings::remove_mcp_server,
            commands::settings::toggle_mcp_server,
            commands::agent_team::get_agent_teams,
            commands::agent_team::get_mcp_servers,
            commands::agent_team::get_team_tasks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
