export interface McpTool { name: string; description?: string; inputSchema: Record<string, unknown>; [key: string]: unknown }
export interface CheckOptions { endpoint: string; token: string; fetchImpl?: typeof fetch; timeoutMs?: number; maxPages?: number }
export function validateEndpoint(value: string): string;
export function clientConfigs(endpoint: string, options?: { name?: string; tokenEnv?: string }): { cursor: Record<string, unknown>; claudeCode: { command: string; args: string[] }; chatgpt: { serverUrl: string; authentication: string; tokenEnvironmentVariable: string } };
export function listTools(options: CheckOptions): Promise<McpTool[]>;
export function checkConnection(options: CheckOptions): Promise<{ state: 'setup-validated'; providerLiveValidation: 'not-run'; toolCount: number; toolNames: string[] }>;
