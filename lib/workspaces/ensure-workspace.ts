/**
 * NOTE: The workspaces table has no user_id / owner column — it is a standalone
 * business-profile entity not yet linked to auth.users. workspace_id on
 * data_sources is therefore nullable and is NOT populated by the app until
 * the workspace membership system is built out.
 *
 * This file is kept as a placeholder so imports don't break if referenced
 * elsewhere. Nothing calls ensureWorkspace() anymore.
 */
export {};
