import type { Edge, Node } from 'reactflow';

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  category: 'core' | 'tools' | 'state' | 'api' | 'testing';
  status: 'todo' | 'inProgress' | 'done';
  dependencies: string[]; // IDs of tasks that must be completed first
}

export interface PromptFlow {
  mainIdea: string;
  tasks: AgentTask[];
}

// Generate nodes from tasks
export const generateNodes = (tasks: AgentTask[], mainIdea: string): Node[] => {
  const nodes: Node[] = [];
  
  // Add main idea node
  nodes.push({
    id: 'main-idea',
    type: 'ideaNode',
    position: { x: 300, y: 50 },
    data: { label: mainIdea },
  });
  
  // Calculate positions in a grid layout
  const GRID_COLUMNS = 3;
  const COLUMN_WIDTH = 300;
  const ROW_HEIGHT = 150;
  const HORIZONTAL_SPACING = 50;
  const VERTICAL_SPACING = 30;
  
  // Add task nodes
  tasks.forEach((task, index) => {
    const column = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    
    const xPosition = column * (COLUMN_WIDTH + HORIZONTAL_SPACING);
    const yPosition = 150 + row * (ROW_HEIGHT + VERTICAL_SPACING);
    
    nodes.push({
      id: task.id,
      type: 'taskNode',
      position: { x: xPosition, y: yPosition },
      data: { 
        task,
        onStatusChange: (newStatus: 'todo' | 'inProgress' | 'done') => {
          // This will be implemented in the parent component
          console.log(`Status changed for ${task.id} to ${newStatus}`);
        }
      },
    });
  });
  
  return nodes;
};

// Generate edges based on task dependencies
export const generateEdges = (tasks: AgentTask[]): Edge[] => {
  const edges: Edge[] = [];
  
  // Connect main idea to all tasks without dependencies
  const rootTasks = tasks.filter(task => task.dependencies.length === 0);
  rootTasks.forEach(task => {
    edges.push({
      id: `main-idea-${task.id}`,
      source: 'main-idea',
      target: task.id,
      type: 'smoothstep',
      animated: true,
    });
  });
  
  // Connect tasks based on dependencies
  tasks.forEach(task => {
    task.dependencies.forEach(depId => {
      edges.push({
        id: `${depId}-${task.id}`,
        source: depId,
        target: task.id,
        type: 'smoothstep',
        animated: true,
      });
    });
  });
  
  return edges;
};

// Get tasks for a specific column/status
export const getTasksByStatus = (tasks: AgentTask[], status: 'todo' | 'inProgress' | 'done'): AgentTask[] => {
  return tasks.filter(task => task.status === status);
};

// Update task status
export const updateTaskStatus = (
  tasks: AgentTask[], 
  taskId: string, 
  newStatus: 'todo' | 'inProgress' | 'done'
): AgentTask[] => {
  return tasks.map(task => 
    task.id === taskId 
      ? { ...task, status: newStatus } 
      : task
  );
};

// Generate a unique ID for new tasks
export const generateTaskId = (): string => {
  return `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

// Default categories with descriptions
export const TASK_CATEGORIES = {
  core: 'Core agent functionality',
  tools: 'Tool integrations',
  state: 'State management',
  api: 'API connections',
  testing: 'Testing prompts',
};

// Sample colors for categories
export const CATEGORY_COLORS = {
  core: '#3b82f6', // blue
  tools: '#10b981', // green
  state: '#f59e0b', // amber
  api: '#8b5cf6', // purple
  testing: '#ef4444', // red
};
