import type { Edge, Node } from 'reactflow';

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  category: 'core' | 'tools' | 'state' | 'api' | 'testing';
  status: 'todo' | 'inProgress' | 'done';
  dependencies: string[]; // IDs of tasks that must be completed first
  parentId?: string; // ID of the parent task (for sub-flows)
  type?: 'task' | 'group'; // Type of node (default is 'task')
  style?: Record<string, any>; // Custom styles for the node
  extent?: 'parent'; // Control how child nodes behave within their parent
  position?: { x: number; y: number }; // Position of the node in the flow
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
    position: { x: 400, y: 50 },
    data: { label: mainIdea },
  });
  
  // Calculate positions in a grid layout
  const GRID_COLUMNS = 4; // Increase columns from 3 to 4
  const COLUMN_WIDTH = 200; // Reduce column width from 300 to 200
  const ROW_HEIGHT = 150; // Reduce row height from 200 to 150
  const HORIZONTAL_SPACING = 100; // Reduce horizontal spacing from 150 to 100
  const VERTICAL_SPACING = 80;   // Reduce vertical spacing from 100 to 80
  
  // First, organize tasks by parent
  const tasksByParent: Record<string, AgentTask[]> = {};
  
  // Initialize with an empty array for tasks without a parent
  tasksByParent['root'] = [];
  
  // Group tasks by their parent ID
  tasks.forEach(task => {
    if (task.parentId) {
      if (!tasksByParent[task.parentId]) {
        tasksByParent[task.parentId] = [];
      }
      tasksByParent[task.parentId].push(task);
    } else if (task.type === 'group') {
      // Ensure each group has an entry in the map
      if (!tasksByParent[task.id]) {
        tasksByParent[task.id] = [];
      }
      // Also add to root for positioning
      tasksByParent['root'].push(task);
    } else {
      // Regular tasks without a parent go to root
      tasksByParent['root'].push(task);
    }
  });
  
  // First, add group nodes (parents)
  const groupTasks = tasks.filter(task => task.type === 'group');
  
  // Position group nodes in a kanban-like layout (horizontal row)
  groupTasks.forEach((groupTask, index) => {
    // For kanban layout, we want columns side by side horizontally
    const xPosition = index * 500 + 100; // 500px width + spacing between columns
    const yPosition = 150; // All columns start at the same y position
    
    // Calculate the size of the group based on the number of children
    const childTasks = tasksByParent[groupTask.id] || [];
    const childColumns = Math.min(childTasks.length, 3); // Max 3 columns of children
    const childRows = Math.ceil(childTasks.length / 3);
    
    // Calculate width and height to fit all children with padding
    const width = Math.max(400, childColumns * 180 + 40);
    const height = Math.max(700, childRows * 120 + 150);
    
    nodes.push({
      id: groupTask.id,
      type: 'groupNode',
      position: groupTask.position || { x: xPosition, y: yPosition },
      style: {
        ...groupTask.style,
        width,
        height,
        // backgroundColor: groupTask.style?.backgroundColor || 'rgba(240, 240, 255, 0.8)',
        // border: '1px solid #ccc',
        // borderRadius: '8px',
        // padding: '10px',
      },
      data: { 
        task: groupTask,
        onStatusChange: (newStatus: 'todo' | 'inProgress' | 'done') => {
          console.log(`Status changed for ${groupTask.id} to ${newStatus}`);
        }
      },
    });
    
    // Add child nodes within this group - stack them vertically for kanban-like layout
    childTasks.forEach((childTask, childIndex) => {
      // For kanban columns, we want to stack tasks vertically
      // No need for columns within a column, just stack them
      
      // Position relative to parent with vertical stacking
      const childX = 40; // Centered horizontally in the column
      const childY = 80 + childIndex * 120; // Stack vertically with spacing
      
      nodes.push({
        id: childTask.id,
        type: 'taskNode',
        position: childTask.position || { x: childX, y: childY },
        parentId: groupTask.id,
        extent: childTask.extent || 'parent',
        data: { 
          task: childTask,
          onStatusChange: (newStatus: 'todo' | 'inProgress' | 'done') => {
            console.log(`Status changed for ${childTask.id} to ${newStatus}`);
          }
        },
      });
    });
  });
  
  // Add regular tasks (not in any group)
  const regularTasks = tasksByParent['root'].filter(task => task.type !== 'group');
  
  regularTasks.forEach((task, index) => {
    const column = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    
    const xPosition = column * (COLUMN_WIDTH + HORIZONTAL_SPACING) + 100;
    const yPosition = 150 + (groupTasks.length > 0 ? groupTasks.length * (ROW_HEIGHT + VERTICAL_SPACING) * 2 : 0) + row * (ROW_HEIGHT + VERTICAL_SPACING);
    
    nodes.push({
      id: task.id,
      type: 'taskNode',
      position: task.position || { x: xPosition, y: yPosition },
      data: { 
        task,
        onStatusChange: (newStatus: 'todo' | 'inProgress' | 'done') => {
          console.log(`Status changed for ${task.id} to ${newStatus}`);
        }
      },
    });
  });
  
  return nodes;
};

// Generate edges based on task dependencies and parent-child relationships
export const generateEdges = (tasks: AgentTask[]): Edge[] => {
  const edges: Edge[] = [];
  
  // First, organize tasks by parent
  const tasksByParent: Record<string, AgentTask[]> = {};
  
  // Initialize with an empty array for tasks without a parent
  tasksByParent['root'] = [];
  
  // Group tasks by their parent ID
  tasks.forEach(task => {
    if (task.parentId) {
      if (!tasksByParent[task.parentId]) {
        tasksByParent[task.parentId] = [];
      }
      tasksByParent[task.parentId].push(task);
    } else {
      // Tasks without a parent go to root
      tasksByParent['root'].push(task);
    }
  });
  
  // Connect main idea to all root tasks (tasks without a parent that aren't groups)
  const rootTasks = tasksByParent['root'].filter(task => task.type !== 'group');
  rootTasks.forEach(task => {
    edges.push({
      id: `main-idea-${task.id}`,
      source: 'main-idea',
      target: task.id,
      type: 'smoothstep',
      animated: true,
    });
  });
  
  // Connect main idea to all group nodes
  const groupTasks = tasks.filter(task => task.type === 'group');
  groupTasks.forEach(group => {
    edges.push({
      id: `main-idea-${group.id}`,
      source: 'main-idea',
      target: group.id,
      type: 'smoothstep',
      animated: true,
    });
    
    // Connect each child to its parent group
    const children = tasksByParent[group.id] || [];
    children.forEach(child => {
      edges.push({
        id: `${group.id}-${child.id}`,
        source: group.id,
        target: child.id,
        type: 'smoothstep',
        animated: true,
      });
    });
  });
  
  // Connect tasks based on dependencies, but only for tasks at the same level
  // (i.e., both in root or both children of the same parent)
  tasks.forEach(task => {
    // Skip dependency connections for child nodes
    if (!task.parentId) {
      task.dependencies.forEach(depId => {
        const depTask = tasks.find(t => t.id === depId);
        // Only connect if the dependency is also at the root level
        if (depTask && !depTask.parentId) {
          edges.push({
            id: `${depId}-${task.id}`,
            source: depId,
            target: task.id,
            type: 'smoothstep',
            animated: true,
          });
        }
      });
    }
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
