import { Agent, routeAgentRequest, type AgentNamespace } from "agents";
import { MCPClientManager } from "agents/mcp/client";
import type {
  Tool,
  Prompt,
  Resource,
} from "@modelcontextprotocol/sdk/types.js";

type Env = {
  TestMcpAgent: AgentNamespace<TestMcpAgent>;
  HOST: string;
};

export type Server = {
  url: string;
  state: "authenticating" | "connecting" | "ready" | "discovering" | "failed";
  authUrl?: string;
};

export type State = {
  servers: Record<string, Server>;
  tools: (Tool & { serverId: string })[];
  prompts: (Prompt & { serverId: string })[];
  resources: (Resource & { serverId: string })[];
};

export class TestMcpAgent extends Agent<Env, State> {
  initialState = {
    servers: {},
    tools: [],
    prompts: [],
    resources: [],
  };

  private mcp_: MCPClientManager | undefined;

  onStart() {
    console.log("state", this.state);
    this.mcp_ = new MCPClientManager(
      "test-mcp-agent",
      "1.0.0",
      // @ts-ignore
      {
        baseCallbackUri: `${this.env.HOST}/agents/test-mcp-agent/${this.name}/callback`,
        storage: this.ctx.storage,
      }
    );
  }

  setServerState(id: string, state: Server) {
    this.setState({
      ...this.state,
      servers: {
        ...this.state.servers,
        [id]: state,
      },
    });
  }

  async refreshServerData() {
    this.setState({
      ...this.state,
      prompts: this.mcp.listPrompts(),
      tools: this.mcp.listTools(),
      resources: this.mcp.listResources(),
    });
  }

  async addMcpServer(
    url: string = "https://docs.mcp.cloudflare.com/sse"
  ): Promise<string> {
    console.log(`Registering server: ${url}`);
    const { id, authUrl } = await this.mcp.connect(url);
    this.setServerState(id, {
      url,
      authUrl,
      state: this.mcp.mcpConnections[id].connectionState,
    });
    return authUrl ?? "";
  }
  
  /**
   * Use a tool from a connected MCP server
   * @param serverId The ID of the MCP server
   * @param toolName The name of the tool to use
   * @param args Arguments to pass to the tool
   * @returns The result from the tool
   */
  async useTool(serverId: string, toolName: string, args: any): Promise<any> {
    try {
      // Find the tool in our state
      const tool = this.state.tools.find(
        (t) => t.serverId === serverId && t.name === toolName
      );
      
      if (!tool) {
        throw new Error(`Tool ${toolName} not found for server ${serverId}`);
      }
      
      // Get the MCP connection for this server
      const connection = this.mcp.mcpConnections[serverId];
      if (!connection) {
        throw new Error(`No connection found for server ${serverId}`);
      }
      
      // Check if the connection is ready
      if (connection.connectionState !== "ready") {
        throw new Error(`Connection to server ${serverId} is not ready (state: ${connection.connectionState})`);
      }
      
      console.log(`Calling tool ${toolName} on server ${serverId} with args:`, args);
      
      // Call the tool on the MCP server using the MCPClientManager's callTool method
      // Based on the source code at https://github.com/cloudflare/agents/blob/main/packages/agents/src/mcp/client.ts
      const result = await this.mcp.callTool({
        name: toolName,
        arguments: args,
        serverId: serverId
      });
      
      console.log(`Tool ${toolName} result:`, result);
      return result;
    } catch (error) {
      console.error(`Error using tool ${toolName} on server ${serverId}:`, error);
      throw error;
    }
  }

  async onRequest(request: Request): Promise<Response> {
    if (this.mcp.isCallbackRequest(request)) {
      try {
        const { serverId } = await this.mcp.handleCallbackRequest(request);
        this.setServerState(serverId, {
          url: this.state.servers[serverId].url,
          state: this.mcp.mcpConnections[serverId].connectionState,
        });
        await this.refreshServerData();
        // Hack: autoclosing window because a redirect fails for some reason
        return new Response("<script>window.close();</script>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      } catch (e: any) {
        return new Response(e, { status: 401 });
      }
    }

    const reqUrl = new URL(request.url);
    if (reqUrl.pathname.endsWith("add-mcp") && request.method === "POST") {
      const mcpServer = (await request.json()) as { url: string };
      const authUrl = await this.addMcpServer(mcpServer.url);
      return new Response(authUrl, { status: 200 });
    }
    
    // Endpoint to get the current state of the agent
    if (reqUrl.pathname.endsWith("get-state") && request.method === "GET") {
      return Response.json(this.state, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    
    // Endpoint to refresh server data
    if (reqUrl.pathname.endsWith("refresh-data") && request.method === "GET") {
      await this.refreshServerData();
      return Response.json({
        success: true,
        message: "Server data refreshed successfully"
      }, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    
    // Endpoint to use a tool
    if (reqUrl.pathname.endsWith("use-tool") && request.method === "POST") {
      try {
        const data = await request.json() as {
          serverId: string;
          toolName: string;
          args?: Record<string, any>;
        };
        
        const { serverId, toolName, args } = data;
        
        if (!serverId || !toolName) {
          return Response.json({
            success: false,
            message: "Missing required parameters: serverId and toolName"
          }, { status: 400 });
        }
        
        const result = await this.useTool(serverId, toolName, args || {});
        
        return Response.json({
          success: true,
          result
        }, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        return Response.json({
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
          error: error
        }, {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  }
}
