// Define the file structure (same as in FileContentsViewer)
interface FileData {
  content: string;
  created: string;
  modified: string;
  streaming?: boolean;
}

interface Node {
  id: string;
  type: string;
  data: {
    label: string;
    path: string;
    modified: string;
    domain: string;
    domainGroup?: string;
    isRecent?: boolean;
    streaming?: boolean;
  };
  position: { x: number; y: number };
}

interface Edge {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  style?: Record<string, any>;
}

interface DomainGroups {
  [key: string]: string[];
}

/**
 * Resolves an import path to an actual file path in the project
 */
export function resolveImportPath(
  sourcePath: string,
  importPath: string,
  availablePaths: string[]
): string | null {
  // Handle relative imports
  if (importPath.startsWith("./") || importPath.startsWith("../")) {
    // Get the directory of the source file
    const sourceDir = sourcePath.split("/").slice(0, -1).join("/");
    
    // Normalize the path
    let normalizedPath = importPath;
    
    // Handle "./" imports
    if (importPath.startsWith("./")) {
      normalizedPath = `${sourceDir}/${importPath.substring(2)}`;
    } 
    // Handle "../" imports
    else if (importPath.startsWith("../")) {
      // Count the number of "../" segments
      const segments = importPath.match(/\.\.\//g) || [];
      const upDirs = segments.length;
      
      // Remove the "../" segments from the import path
      const remainingPath = importPath.replace(/\.\.\//g, "");
      
      // Go up the specified number of directories
      const sourceDirParts = sourceDir.split("/");
      const targetDir = sourceDirParts.slice(0, sourceDirParts.length - upDirs).join("/");
      
      normalizedPath = `${targetDir}/${remainingPath}`;
    }
    
    // Check if the file exists with or without extension
    for (const path of availablePaths) {
      // Check exact match
      if (path === normalizedPath) {
        return path;
      }
      
      // Check with extensions (.ts, .tsx, .js, .jsx)
      if (
        path === `${normalizedPath}.ts` ||
        path === `${normalizedPath}.tsx` ||
        path === `${normalizedPath}.js` ||
        path === `${normalizedPath}.jsx`
      ) {
        return path;
      }
      
      // Check for index files in directories
      if (
        path === `${normalizedPath}/index.ts` ||
        path === `${normalizedPath}/index.tsx` ||
        path === `${normalizedPath}/index.js` ||
        path === `${normalizedPath}/index.jsx`
      ) {
        return path;
      }
    }
  }
  
  // Handle absolute imports (from project root)
  if (importPath.startsWith("@/")) {
    const normalizedPath = importPath.substring(2); // Remove the "@/"
    
    for (const path of availablePaths) {
      // Check if the path contains the import path
      if (path.includes(normalizedPath)) {
        return path;
      }
      
      // Check with extensions
      if (
        path.includes(`${normalizedPath}.ts`) ||
        path.includes(`${normalizedPath}.tsx`) ||
        path.includes(`${normalizedPath}.js`) ||
        path.includes(`${normalizedPath}.jsx`)
      ) {
        return path;
      }
      
      // Check for index files
      if (
        path.includes(`${normalizedPath}/index.ts`) ||
        path.includes(`${normalizedPath}/index.tsx`) ||
        path.includes(`${normalizedPath}/index.js`) ||
        path.includes(`${normalizedPath}/index.jsx`)
      ) {
        return path;
      }
    }
  }
  
  // Handle node_modules imports (not shown in the graph)
  if (!importPath.startsWith(".") && !importPath.startsWith("@/")) {
    return null;
  }
  
  return null;
}

/**
 * Extracts domain information from a file path
 */
export function extractDomain(path: string): string {
  // Check for domain directory pattern
  const domainMatch = path.match(/domain\/([^\/]+)/i);
  if (domainMatch) {
    return domainMatch[1];
  }
  
  // Check for other common patterns
  if (path.includes("/models/")) return "models";
  if (path.includes("/services/")) return "services";
  if (path.includes("/repositories/")) return "repositories";
  if (path.includes("/controllers/")) return "controllers";
  if (path.includes("/views/")) return "views";
  if (path.includes("/components/")) return "components";
  if (path.includes("/utils/")) return "utils";
  if (path.includes("/hooks/")) return "hooks";
  if (path.includes("/contexts/")) return "contexts";
  if (path.includes("/providers/")) return "providers";
  
  // Extract from file name if it follows DDD naming convention
  const fileName = path.split("/").pop() || "";
  const nameMatch = fileName.match(/^([A-Z][a-z]+)(Model|Service|Repository|Controller|View|Component)/);
  if (nameMatch) {
    return nameMatch[1].toLowerCase();
  }
  
  // Default domain
  return "other";
}

/**
 * Applies a domain-based layout to position nodes
 */
export function applyDomainBasedLayout(
  nodes: Node[],
  domains: DomainGroups
): void {
  const domainSpacing = 300;
  const nodeSpacing = 100;
  
  let domainX = 100;
  
  Object.entries(domains).forEach(([domain, paths]) => {
    let nodeY = 100;
    
    // Position each node in the domain
    paths.forEach(path => {
      const node = nodes.find(n => n.id === path);
      if (node) {
        node.position = { 
          x: domainX, 
          y: nodeY 
        };
        node.data.domainGroup = domain;
        nodeY += nodeSpacing;
      }
    });
    
    domainX += domainSpacing;
  });
}

/**
 * Parses file dependencies and creates a graph structure
 */
export function parseDependencies(
  files: Record<string, FileData>
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const domains: DomainGroups = {};
  
  // Extract domains from file paths
  Object.entries(files).forEach(([path, file]) => {
    const domain = extractDomain(path);
    
    // Add to domain groups
    if (!domains[domain]) {
      domains[domain] = [];
    }
    domains[domain].push(path);
    
    // Check if file was recently modified (within the last hour)
    const isRecent = new Date().getTime() - new Date(file.modified).getTime() < 3600000;
    
    // Create node
    nodes.push({
      id: path,
      type: "file",
      data: { 
        label: path.split("/").pop() || "", 
        path,
        modified: file.modified,
        domain,
        isRecent,
        streaming: file.streaming || false
      },
      position: { x: 0, y: 0 }, // Will be calculated by layout algorithm
    });
  });
  
  // Parse imports to create edges
  Object.entries(files).forEach(([path, file]) => {
    // Match ES6 imports
    const importLines = file.content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];
    
    importLines.forEach((importLine: string) => {
      const match = importLine.match(/from\s+['"]([^'"]+)['"]/);
      if (match) {
        const importPath = match[1];
        
        // Find the actual file path that matches this import
        const targetPath = resolveImportPath(path, importPath, Object.keys(files));
        
        if (targetPath) {
          edges.push({
            id: `${path}-${targetPath}`,
            source: path,
            target: targetPath,
            animated: false,
            style: { stroke: "#aaa", strokeWidth: 1.5 }
          });
        }
      }
    });
    
    // Match CommonJS requires
    const requireLines = file.content.match(/require\(['"]([^'"]+)['"]\)/g) || [];
    
    requireLines.forEach((requireLine: string) => {
      const match = requireLine.match(/require\(['"]([^'"]+)['"]\)/);
      if (match) {
        const importPath = match[1];
        
        // Find the actual file path that matches this import
        const targetPath = resolveImportPath(path, importPath, Object.keys(files));
        
        if (targetPath) {
          edges.push({
            id: `${path}-${targetPath}`,
            source: path,
            target: targetPath,
            animated: false,
            style: { stroke: "#aaa", strokeWidth: 1.5, strokeDasharray: "5,5" }
          });
        }
      }
    });
  });
  
  // Apply layout algorithm to position nodes
  applyDomainBasedLayout(nodes, domains);
  
  return { nodes, edges };
}
