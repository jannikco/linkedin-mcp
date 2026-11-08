export interface McpTool { name: string; description?: string; inputSchema: Record<string, unknown>; [key: string]: unknown }
export interface CheckOptions { endpoint: string; token: string; fetchImpl?: typeof fetch; timeoutMs?: number; maxPages?: number; protocolVersion?: '2026-07-28' | '2025-11-25' | '2025-06-18' | '2025-03-26'; lifecycle?: 'auto' | 'legacy' | 'stateless' }
export function validateEndpoint(value: string): string;
export function clientConfigs(endpoint: string, options?: { name?: string; tokenEnv?: string }): { cursor: Record<string, unknown>; claudeCode: { command: string; args: string[] }; chatgpt: { serverUrl: string; authentication: string; tokenEnvironmentVariable: string } };
export function listTools(options: CheckOptions): Promise<McpTool[]>;
export function checkConnection(options: CheckOptions): Promise<{ state: 'setup-validated'; providerLiveValidation: 'not-run'; toolCount: number; toolNames: string[] }>;
