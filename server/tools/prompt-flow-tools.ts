/**
 * Prompt flow tools for the chat agent
 * Handles operations related to the prompt flow board
 */
import { tool } from "ai";
import { z } from "zod";
import type { PromptFlow, AgentTask } from "../../src/components/prompt-flow/utils/prompt-flow-utils";
import { generateTaskId } from "../../src/components/prompt-flow/utils/prompt-flow-utils";
import { ChatAgent, agentContext } from "../agents/ChatAgent";

/**
 * Get the current prompt flow
 */
export const getPromptFlow = tool({
  description: "Get the current prompt flow from the agent state",
  parameters: z.object({}),
  execute: async () => {
    const agent = agentContext.getStore() as ChatAgent;
    return agent.state.promptFlow || { mainIdea: agent.state.agentName || "My AI Agent", tasks: [] };
  },
});

/**
 * Update the entire prompt flow
 */
export const updatePromptFlow = tool({
  description: "Update the entire prompt flow in the agent state",
  parameters: z.object({
    promptFlow: z.object({
      mainIdea: z.string(),
      tasks: z.array(z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        category: z.enum(['core', 'tools', 'state', 'api', 'testing']),
        status: z.enum(['todo', 'inProgress', 'done']),
        dependencies: z.array(z.string()),
        parentId: z.string().optional(),
        type: z.enum(['task', 'group']).optional(),
        style: z.record(z.any()).optional(),
        extent: z.enum(['parent']).optional()
      }))
    })
  }),
  execute: async ({ promptFlow }) => {
    const agent = agentContext.getStore() as ChatAgent;
    await agent.setState({
      ...agent.state,
      promptFlow
    });
    return { success: true, message: "Prompt flow updated successfully" };
  },
});

/**
 * Add a new task to the prompt flow
 */
export const addTaskToPromptFlow = tool({
  description: "Add a new task to the prompt flow",
  parameters: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['core', 'tools', 'state', 'api', 'testing']),
    dependencies: z.array(z.string()).optional(),
  }),
  execute: async ({ title, description, category, dependencies = [] }) => {
    const agent = agentContext.getStore() as ChatAgent;
    const currentFlow = agent.state.promptFlow || { 
      mainIdea: agent.state.agentName || "My AI Agent", 
      tasks: [] 
    };
    
    const newTask: AgentTask = {
      id: generateTaskId(),
      title,
      description,
      category,
      status: 'todo',
      dependencies,
    };
    
    const updatedFlow = {
      ...currentFlow,
      tasks: [...currentFlow.tasks, newTask]
    };
    
    await agent.setState({
      ...agent.state,
      promptFlow: updatedFlow
    });
    
    return { 
      success: true, 
      message: "Task added successfully", 
      taskId: newTask.id 
    };
  },
});

/**
 * Update an existing task in the prompt flow
 */
export const updateTaskInPromptFlow = tool({
  description: "Update an existing task in the prompt flow",
  parameters: z.object({
    taskId: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    category: z.enum(['core', 'tools', 'state', 'api', 'testing']).optional(),
    dependencies: z.array(z.string()).optional(),
  }),
  execute: async ({ taskId, title, description, category, dependencies }) => {
    const agent = agentContext.getStore() as ChatAgent;
    const currentFlow = agent.state.promptFlow;
    
    if (!currentFlow) {
      return { success: false, message: "No prompt flow exists" };
    }
    
    const taskIndex = currentFlow.tasks.findIndex(task => task.id === taskId);
    
    if (taskIndex === -1) {
      return { success: false, message: `Task with ID ${taskId} not found` };
    }
    
    const updatedTasks = [...currentFlow.tasks];
    updatedTasks[taskIndex] = {
      ...updatedTasks[taskIndex],
      ...(title && { title }),
      ...(description && { description }),
      ...(category && { category }),
      ...(dependencies && { dependencies }),
    };
    
    const updatedFlow = {
      ...currentFlow,
      tasks: updatedTasks
    };
    
    await agent.setState({
      ...agent.state,
      promptFlow: updatedFlow
    });
    
    return { success: true, message: "Task updated successfully" };
  },
});

/**
 * Change the status of a task
 */
export const changeTaskStatus = tool({
  description: "Change the status of a task in the prompt flow",
  parameters: z.object({
    taskId: z.string(),
    status: z.enum(['todo', 'inProgress', 'done']),
  }),
  execute: async ({ taskId, status }) => {
    const agent = agentContext.getStore() as ChatAgent;
    const currentFlow = agent.state.promptFlow;
    
    if (!currentFlow) {
      return { success: false, message: "No prompt flow exists" };
    }
    
    const taskIndex = currentFlow.tasks.findIndex(task => task.id === taskId);
    
    if (taskIndex === -1) {
      return { success: false, message: `Task with ID ${taskId} not found` };
    }
    
    const updatedTasks = [...currentFlow.tasks];
    updatedTasks[taskIndex] = {
      ...updatedTasks[taskIndex],
      status,
    };
    
    const updatedFlow = {
      ...currentFlow,
      tasks: updatedTasks
    };
    
    await agent.setState({
      ...agent.state,
      promptFlow: updatedFlow
    });
    
    return { success: true, message: `Task status changed to ${status}` };
  },
});

/**
 * Delete a task from the prompt flow
 */
export const deleteTaskFromPromptFlow = tool({
  description: "Delete a task from the prompt flow",
  parameters: z.object({
    taskId: z.string(),
  }),
  execute: async ({ taskId }) => {
    const agent = agentContext.getStore() as ChatAgent;
    const currentFlow = agent.state.promptFlow;
    
    if (!currentFlow) {
      return { success: false, message: "No prompt flow exists" };
    }
    
    const updatedTasks = currentFlow.tasks.filter(task => task.id !== taskId);
    
    if (updatedTasks.length === currentFlow.tasks.length) {
      return { success: false, message: `Task with ID ${taskId} not found` };
    }
    
    // Also remove this taskId from any task dependencies
    const tasksWithUpdatedDependencies = updatedTasks.map(task => ({
      ...task,
      dependencies: task.dependencies.filter(depId => depId !== taskId)
    }));
    
    const updatedFlow = {
      ...currentFlow,
      tasks: tasksWithUpdatedDependencies
    };
    
    await agent.setState({
      ...agent.state,
      promptFlow: updatedFlow
    });
    
    return { success: true, message: "Task deleted successfully" };
  },
});

/**
 * Get a specific task from the prompt flow
 */
export const getTaskFromPromptFlow = tool({
  description: "Get a specific task from the prompt flow",
  parameters: z.object({
    taskId: z.string(),
  }),
  execute: async ({ taskId }) => {
    const agent = agentContext.getStore() as ChatAgent;
    const currentFlow = agent.state.promptFlow;
    
    if (!currentFlow) {
      return { success: false, message: "No prompt flow exists" };
    }
    
    const task = currentFlow.tasks.find(task => task.id === taskId);
    
    if (!task) {
      return { success: false, message: `Task with ID ${taskId} not found` };
    }
    
    return { success: true, task };
  },
});

/**
 * Add a new group to the prompt flow
 */
export const addGroupToPromptFlow = tool({
  description: "Add a new group node to the prompt flow",
  parameters: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['core', 'tools', 'state', 'api', 'testing']),
    width: z.number().optional(),
    height: z.number().optional(),
    backgroundColor: z.string().optional(),
    dependencies: z.array(z.string()).optional(),
  }),
  execute: async ({ title, description, category, width = 300, height = 200, backgroundColor = 'rgba(240, 240, 255, 0.8)', dependencies = [] }) => {
    const agent = agentContext.getStore() as ChatAgent;
    const currentFlow = agent.state.promptFlow || { 
      mainIdea: agent.state.agentName || "My AI Agent", 
      tasks: [] 
    };
    
    const newGroup: AgentTask = {
      id: generateTaskId(),
      title,
      description,
      category,
      status: 'todo',
      dependencies,
      type: 'group',
      style: {
        width: width || 400,
        height: height || 700,
        backgroundColor: backgroundColor || 'rgba(240, 240, 255, 0.8)',
        border: '2px solid #ddd',
        borderRadius: '8px',
        padding: '20px'
      }
    };
    
    const updatedFlow = {
      ...currentFlow,
      tasks: [...currentFlow.tasks, newGroup]
    };
    
    await agent.setState({
      ...agent.state,
      promptFlow: updatedFlow
    });
    
    return { 
      success: true, 
      message: "Group added successfully", 
      groupId: newGroup.id 
    };
  },
});

/**
 * Add a task to a specific group
 */
export const addTaskToGroup = tool({
  description: "Add a new task to a specific group in the prompt flow",
  parameters: z.object({
    groupId: z.string(),
    title: z.string(),
    description: z.string(),
    category: z.enum(['core', 'tools', 'state', 'api', 'testing']),
    dependencies: z.array(z.string()).optional(),
    stayWithinParent: z.boolean().optional(),
  }),
  execute: async ({ groupId, title, description, category, dependencies = [], stayWithinParent = true }) => {
    const agent = agentContext.getStore() as ChatAgent;
    const currentFlow = agent.state.promptFlow || { 
      mainIdea: agent.state.agentName || "My AI Agent", 
      tasks: [] 
    };
    
    // Check if the group exists
    const groupExists = currentFlow.tasks.some(task => task.id === groupId && task.type === 'group');
    
    if (!groupExists) {
      return { success: false, message: `Group with ID ${groupId} not found` };
    }
    
    const newTask: AgentTask = {
      id: generateTaskId(),
      title,
      description,
      category,
      status: 'todo',
      dependencies,
      parentId: groupId,
      ...(stayWithinParent && { extent: 'parent' })
    };
    
    const updatedFlow = {
      ...currentFlow,
      tasks: [...currentFlow.tasks, newTask]
    };
    
    await agent.setState({
      ...agent.state,
      promptFlow: updatedFlow
    });
    
    return { 
      success: true, 
      message: "Task added to group successfully", 
      taskId: newTask.id 
    };
  },
});

/**
 * Update the position of a task in the prompt flow
 */
export const updateTaskPosition = tool({
  description: "Update the position of a task in the prompt flow",
  parameters: z.object({
    taskId: z.string(),
    x: z.number(),
    y: z.number(),
  }),
  execute: async ({ taskId, x, y }) => {
    const agent = agentContext.getStore() as ChatAgent;
    const currentFlow = agent.state.promptFlow;
    
    if (!currentFlow) {
      return { success: false, message: "No prompt flow exists" };
    }
    
    const taskIndex = currentFlow.tasks.findIndex(task => task.id === taskId);
    
    if (taskIndex === -1) {
      return { success: false, message: `Task with ID ${taskId} not found` };
    }
    
    const updatedTasks = [...currentFlow.tasks];
    updatedTasks[taskIndex] = {
      ...updatedTasks[taskIndex],
      position: { x, y }
    };
    
    const updatedFlow = {
      ...currentFlow,
      tasks: updatedTasks
    };
    
    await agent.setState({
      ...agent.state,
      promptFlow: updatedFlow
    });
    
    return { success: true, message: `Task position updated to x: ${x}, y: ${y}` };
  },
});

/**
 * Update the positions of multiple tasks in the prompt flow
 */
export const updateMultipleTaskPositions = tool({
  description: "Update the positions of multiple tasks in the prompt flow",
  parameters: z.object({
    positions: z.array(z.object({
      taskId: z.string(),
      x: z.number(),
      y: z.number(),
    })),
  }),
  execute: async ({ positions }) => {
    const agent = agentContext.getStore() as ChatAgent;
    const currentFlow = agent.state.promptFlow;
    
    if (!currentFlow) {
      return { success: false, message: "No prompt flow exists" };
    }
    
    const updatedTasks = [...currentFlow.tasks];
    
    // Update each task position
    for (const position of positions) {
      const taskIndex = updatedTasks.findIndex(task => task.id === position.taskId);
      
      if (taskIndex !== -1) {
        updatedTasks[taskIndex] = {
          ...updatedTasks[taskIndex],
          position: { x: position.x, y: position.y }
        };
      }
    }
    
    const updatedFlow = {
      ...currentFlow,
      tasks: updatedTasks
    };
    
    await agent.setState({
      ...agent.state,
      promptFlow: updatedFlow
    });
    
    return { 
      success: true, 
      message: `Updated positions for ${positions.length} tasks`,
      updatedTaskIds: positions.map(p => p.taskId)
    };
  },
});

// Export all prompt flow tools
export const promptFlowTools = {
  getPromptFlow,
  updatePromptFlow,
  addTaskToPromptFlow,
  updateTaskInPromptFlow,
  changeTaskStatus,
  deleteTaskFromPromptFlow,
  getTaskFromPromptFlow,
  addGroupToPromptFlow,
  addTaskToGroup,
  updateTaskPosition,
  updateMultipleTaskPositions,
};
