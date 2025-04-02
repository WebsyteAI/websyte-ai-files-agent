# Websyte AI Files Agent Server

This directory contains the server-side code for the Websyte AI Files Agent, a Cloudflare Workers-based application that provides AI-powered file management capabilities.

## Directory Structure

The server code is organized into the following modules:

```
server/
├── constants/           # Constants and configuration values
│   └── system-prompt.ts # AI system prompt generator
├── tools/               # Tool implementations organized by domain
│   ├── ai-tools.ts      # AI-related tools (weather, time, etc.)
│   ├── filesystem-tools.ts # File system operations
│   ├── github-tools.ts  # GitHub repository operations
│   ├── schedule-tools.ts # Task scheduling operations
│   └── index.ts         # Central export point for all tools
├── cloudflare-system-context.txt # Cloudflare system context for AI
├── router.ts            # API routing logic
├── server.ts            # Main server entry point and agent implementation
├── types.ts             # Shared type definitions
└── utils.ts             # Utility functions
```

## Key Components

### Agent

The `Chat` class in `server.ts` is the main agent implementation. It extends `AIChatAgent` from the Agents framework and handles:

- Chat message processing
- Response streaming
- Task scheduling and execution
- Dynamic agent name configuration (used in system prompt)

### Tools

Tools are organized by domain to improve maintainability:

- **AI Tools**: Simple demonstration tools like weather and time
- **Filesystem Tools**: File creation, reading, updating, and deletion
- **GitHub Tools**: Repository operations like publishing and syncing
- **Schedule Tools**: Task scheduling and management

All tools are exported from `tools/index.ts` for easy access.

### Router

The `router.ts` module handles API routing and request processing. It currently supports:

- Tool execution endpoint (`/api/agent/tool`)

### Types

Common type definitions are centralized in `types.ts` to avoid circular dependencies and ensure consistency.

## Development

### Adding New Tools

To add a new tool:

1. Identify the appropriate domain module (or create a new one)
2. Implement the tool using the `tool()` function from the AI SDK
3. Export the tool from the domain module
4. Add the tool to the exports in `tools/index.ts`

### Adding New API Endpoints

To add a new API endpoint:

1. Add a new condition in the `handleApiRequest` function in `router.ts`
2. Implement a handler function for the endpoint
3. Return the appropriate response

## Environment Variables

- `OPENAI_API_KEY`: Required for AI functionality
- `GITHUB_PERSONAL_ACCESS_TOKEN`: Required for GitHub operations

## Agent Name

The agent name is hardcoded as 'websyte-ai-files-agent' in the system prompt. This name is used for:
- package.json and wrangler.jsonc file names
- Ensuring consistent naming across generated files
