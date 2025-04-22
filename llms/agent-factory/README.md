# Cloudflare Agents Factory

This directory contains comprehensive documentation and code examples for building Cloudflare Agents. It's designed to serve as a knowledge base for an agent that builds other agents.

## Overview

Cloudflare Agents are stateful, autonomous systems that can perform tasks, communicate with clients in real-time, call AI models, and maintain persistent state. This documentation is organized to help you understand and build different types of agents.

## Directory Structure

- **concepts/** - Core concepts and API references
- **code-snippets/** - Reusable code examples for common agent features
- **configuration/** - Configuration guides and examples
- **integration/** - Integration with other systems like MCP
- **templates/** - Ready-to-use agent templates for common use cases

## Getting Started

Start by reading the [index.txt](index.txt) file, which provides an overview of the documentation and guides you to the relevant sections based on your needs.

If you're new to Cloudflare Agents, begin with:
1. [What Are Agents?](concepts/what-are-agents.txt)
2. [Agents API Reference](concepts/agents-api-reference.txt)

## Key Features

Cloudflare Agents provide several powerful capabilities:

- **Stateful Computation**: Each agent has its own persistent state
- **Real-time Communication**: WebSocket support for live interactions
- **AI Integration**: Call models from OpenAI, Workers AI, and more
- **Task Scheduling**: Schedule future tasks and manage workflows
- **Database Access**: Built-in SQLite database for each agent
- **Scalability**: Scale to millions of agent instances

## Use Cases

This documentation covers several common use cases:

- Building chat bots with AI integration
- Creating workflow automation systems
- Developing knowledge base agents with RAG capabilities
- Integrating with AI assistants via MCP

## How to Use This Documentation

The documentation is designed to be modular, allowing you to focus on the specific aspects of agent development that are relevant to your project. Each file contains practical code examples that you can adapt for your own agents.

For complete, ready-to-use implementations, check out the [templates](templates/agent-templates.txt) section.

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
