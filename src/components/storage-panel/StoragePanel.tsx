import React, { useEffect, useState } from "react";
import { Card } from "@/components/card/Card";
import { Button } from "@/components/button/Button";
import { Input } from "@/components/input/Input";
import { 
  Trash, 
  FolderOpen, 
  File, 
  FilePlus, 
  FolderPlus, 
  ArrowsClockwise, 
  Code, 
  FloppyDisk,
  X,
  PencilSimple
} from "@phosphor-icons/react";

interface StoragePanelProps {
  agent: any;
  onRemoveTask?: (id: string) => void;
}

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  extension?: string;
  children?: FileItem[];
  parentId?: string;
}

export function StoragePanel({ agent, onRemoveTask }: StoragePanelProps) {
  const [fileSystem, setFileSystem] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Initialize or fetch the file system
  const fetchFileSystem = async () => {
    try {
      setLoading(true);
      
      // Try to get the file system from the agent
      let storedFileSystem: FileItem[] = [];
      
      try {
        if (typeof agent.call === 'function') {
          // Call the getFileSystem tool
          const result = await agent.call('getFileSystem');
          if (result) {
            try {
              storedFileSystem = JSON.parse(result);
            } catch (parseError) {
              console.error("Error parsing file system:", parseError);
            }
          }
        }
      } catch (e) {
        console.error('Could not retrieve file system from agent:', e);
      }
      
      // If we got a valid file system, use it
      if (Array.isArray(storedFileSystem) && storedFileSystem.length > 0) {
        setFileSystem(storedFileSystem);
        
        // Expand the root folder by default
        const newExpandedFolders = new Set<string>();
        newExpandedFolders.add('root');
        setExpandedFolders(newExpandedFolders);
      }
    } catch (error) {
      console.error("Error fetching file system:", error);
    } finally {
      setLoading(false);
    }
  };

  // Save the file system to the agent
  const saveFileSystem = async (newFileSystem: FileItem[]) => {
    try {
      if (typeof agent.call === 'function') {
        // Call the setFileSystem tool with the new file system
        await agent.call('setFileSystem', { fileSystem: newFileSystem });
      }
    } catch (e) {
      console.error('Could not save file system to agent:', e);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchFileSystem();
    
    // Set up polling for real-time updates
    const intervalId = setInterval(fetchFileSystem, 5000);
    
    return () => clearInterval(intervalId);
  }, [agent]);

  // Get the current folder based on the path
  const getCurrentFolder = (): FileItem[] => {
    if (currentPath.length === 0) {
      return fileSystem;
    }
    
    let current = [...fileSystem];
    for (const pathPart of currentPath) {
      const folder = current.find(item => item.name === pathPart && item.type === 'folder');
      if (folder && folder.children) {
        current = folder.children;
      } else {
        return [];
      }
    }
    
    return current;
  };

  // Navigate to a folder
  const navigateToFolder = (folder: FileItem) => {
    setCurrentPath([...currentPath, folder.name]);
  };

  // Navigate up one level
  const navigateUp = () => {
    if (currentPath.length > 0) {
      setCurrentPath(currentPath.slice(0, -1));
    }
  };

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    const newExpandedFolders = new Set(expandedFolders);
    if (newExpandedFolders.has(folderId)) {
      newExpandedFolders.delete(folderId);
    } else {
      newExpandedFolders.add(folderId);
    }
    setExpandedFolders(newExpandedFolders);
  };

  // Select a file to view/edit
  const selectFile = (file: FileItem) => {
    setSelectedFile(file);
    setEditMode(false);
    setEditContent(file.content || "");
  };

  // Start editing a file
  const startEditing = () => {
    if (selectedFile) {
      setEditMode(true);
      setEditContent(selectedFile.content || "");
    }
  };

  // Save edited file
  const saveFile = async () => {
    if (selectedFile) {
      // Create a deep copy of the file system
      const newFileSystem = JSON.parse(JSON.stringify(fileSystem));
      
      // Find and update the file
      const updateFileContent = (items: FileItem[]) => {
        for (let i = 0; i < items.length; i++) {
          if (items[i].id === selectedFile.id) {
            items[i].content = editContent;
            return true;
          }
          
          if (items[i].children) {
            if (updateFileContent(items[i].children || [])) {
              return true;
            }
          }
        }
        
        return false;
      };
      
      updateFileContent(newFileSystem);
      
      // Update state and save
      setFileSystem(newFileSystem);
      await saveFileSystem(newFileSystem);
      
      // Update the selected file
      setSelectedFile({
        ...selectedFile,
        content: editContent
      });
      
      setEditMode(false);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditMode(false);
    setEditContent(selectedFile?.content || "");
  };

  // Create a new file or folder
  const createNewItem = (type: 'file' | 'folder') => {
    if (type === 'file') {
      setIsCreatingFile(true);
      setIsCreatingFolder(false);
    } else {
      setIsCreatingFile(false);
      setIsCreatingFolder(true);
    }
    setNewItemName("");
  };

  // Save a new file or folder
  const saveNewItem = async () => {
    if (newItemName.trim() === "") return;
    
    const type = isCreatingFile ? 'file' : 'folder';
    const extension = isCreatingFile ? newItemName.split('.').pop() || '' : undefined;
    
    // Create the new item
    const newItem: FileItem = {
      id: `${Date.now()}-${newItemName}`,
      name: newItemName,
      type,
      extension,
      parentId: currentPath.length > 0 ? currentPath[currentPath.length - 1] : 'root',
      content: isCreatingFile ? `// ${newItemName}\n` : undefined,
      children: isCreatingFolder ? [] : undefined
    };
    
    // Create a deep copy of the file system
    const newFileSystem = JSON.parse(JSON.stringify(fileSystem));
    
    // Find the current folder and add the new item
    const addItemToFolder = (items: FileItem[], path: string[]) => {
      if (path.length === 0) {
        items.push(newItem);
        return;
      }
      
      const folderName = path[0];
      const folder = items.find(item => item.name === folderName && item.type === 'folder');
      
      if (folder && folder.children) {
        if (path.length === 1) {
          folder.children.push(newItem);
        } else {
          addItemToFolder(folder.children, path.slice(1));
        }
      }
    };
    
    addItemToFolder(newFileSystem, currentPath);
    
    // Update state and save
    setFileSystem(newFileSystem);
    await saveFileSystem(newFileSystem);
    
    // Reset creation state
    setIsCreatingFile(false);
    setIsCreatingFolder(false);
    setNewItemName("");
    
    // If it's a file, select it
    if (type === 'file') {
      selectFile(newItem);
    }
  };

  // Delete a file or folder
  const deleteItem = async (item: FileItem) => {
    // Create a deep copy of the file system
    const newFileSystem = JSON.parse(JSON.stringify(fileSystem));
    
    // Find and remove the item
    const removeItem = (items: FileItem[], itemId: string): boolean => {
      const index = items.findIndex(i => i.id === itemId);
      
      if (index !== -1) {
        items.splice(index, 1);
        return true;
      }
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].children) {
          if (removeItem(items[i].children || [], itemId)) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    removeItem(newFileSystem, item.id);
    
    // Update state and save
    setFileSystem(newFileSystem);
    await saveFileSystem(newFileSystem);
    
    // If the deleted item was selected, clear selection
    if (selectedFile && selectedFile.id === item.id) {
      setSelectedFile(null);
      setEditMode(false);
    }
  };

  // Generate code for a file
  const generateCode = async (file: FileItem) => {
    try {
      if (typeof agent.call === 'function') {
        // Call the generateCode tool with the file name and extension
        const generatedCode = await agent.call('generateCode', {
          fileName: file.name,
          extension: file.extension || ''
        });
        
        if (!generatedCode) {
          console.error("No code generated");
          return;
        }
        
        // Update the file with the generated code
        const newFileSystem = JSON.parse(JSON.stringify(fileSystem));
        
        const updateFileContent = (items: FileItem[]) => {
          for (let i = 0; i < items.length; i++) {
            if (items[i].id === file.id) {
              items[i].content = generatedCode;
              return true;
            }
            
            if (items[i].children) {
              if (updateFileContent(items[i].children || [])) {
                return true;
              }
            }
          }
          
          return false;
        };
        
        updateFileContent(newFileSystem);
        
        // Update state and save
        setFileSystem(newFileSystem);
        await saveFileSystem(newFileSystem);
        
        // Update the selected file if it's the one being generated
        if (selectedFile && selectedFile.id === file.id) {
          setSelectedFile({
            ...selectedFile,
            content: generatedCode
          });
          setEditContent(generatedCode);
        }
      }
    } catch (error) {
      console.error("Error generating code:", error);
    }
  };

  // Render a file or folder item
  const renderFileItem = (item: FileItem, depth: number = 0) => {
    const isExpanded = expandedFolders.has(item.id);
    
    return (
      <div key={item.id} className="mb-1">
        <div 
          className={`flex items-center p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 ${
            selectedFile?.id === item.id ? 'bg-neutral-200 dark:bg-neutral-800' : ''
          }`}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {item.type === 'folder' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                shape="square"
                className="h-6 w-6 mr-1"
                onClick={() => toggleFolder(item.id)}
              >
                <FolderOpen 
                  size={16} 
                  className={`text-[#F48120] transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} 
                />
              </Button>
              <span 
                className="text-sm flex-1 cursor-pointer truncate" 
                onClick={() => toggleFolder(item.id)}
              >
                {item.name}
              </span>
            </>
          ) : (
            <>
              <File 
                size={16} 
                className="text-neutral-600 dark:text-neutral-400 mr-2 ml-1" 
              />
              <span 
                className="text-sm flex-1 cursor-pointer truncate" 
                onClick={() => selectFile(item)}
              >
                {item.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                shape="square"
                className="h-6 w-6 opacity-0 hover:opacity-100 group-hover:opacity-100"
                onClick={() => generateCode(item)}
                title="Generate code"
              >
                <Code size={14} />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            className="h-6 w-6 opacity-0 hover:opacity-100 group-hover:opacity-100"
            onClick={() => deleteItem(item)}
            title="Delete"
          >
            <Trash size={14} />
          </Button>
        </div>
        
        {item.type === 'folder' && item.children && isExpanded && (
          <div className="ml-2">
            {item.children.map(child => renderFileItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Render the file explorer
  const renderFileExplorer = () => {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between p-2 border-b border-neutral-300 dark:border-neutral-800">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="h-7 w-7 mr-1"
              onClick={navigateUp}
              disabled={currentPath.length === 0}
            >
              <ArrowsClockwise size={14} className="rotate-180" />
            </Button>
            <span className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
              /{currentPath.join('/')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="h-7 w-7"
              onClick={() => createNewItem('file')}
              title="New file"
            >
              <FilePlus size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="h-7 w-7"
              onClick={() => createNewItem('folder')}
              title="New folder"
            >
              <FolderPlus size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="h-7 w-7"
              onClick={fetchFileSystem}
              title="Refresh"
            >
              <ArrowsClockwise size={14} />
            </Button>
          </div>
        </div>
        
        {isCreatingFile || isCreatingFolder ? (
          <div className="p-2 flex items-center">
            {isCreatingFile ? (
              <File size={16} className="text-neutral-600 dark:text-neutral-400 mr-2" />
            ) : (
              <FolderOpen size={16} className="text-[#F48120] mr-2" />
            )}
            <Input
              className="flex-1 h-7 text-sm"
              placeholder={isCreatingFile ? "filename.ext" : "folder name"}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  saveNewItem();
                } else if (e.key === 'Escape') {
                  setIsCreatingFile(false);
                  setIsCreatingFolder(false);
                }
              }}
              autoFocus
              onValueChange={undefined}
            />
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="h-7 w-7 ml-1"
              onClick={saveNewItem}
            >
              <FloppyDisk size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="h-7 w-7"
              onClick={() => {
                setIsCreatingFile(false);
                setIsCreatingFolder(false);
              }}
            >
              <X size={14} />
            </Button>
          </div>
        ) : null}
        
        <div className="p-2">
          {getCurrentFolder().map(item => renderFileItem(item))}
        </div>
      </div>
    );
  };

  // Render the file editor
  const renderFileEditor = () => {
    if (!selectedFile) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 text-neutral-500 dark:text-neutral-400">
          <p>Select a file to view or edit</p>
        </div>
      );
    }
    
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-2 border-b border-neutral-300 dark:border-neutral-800">
          <div className="flex items-center">
            <File size={16} className="text-neutral-600 dark:text-neutral-400 mr-2" />
            <span className="text-sm font-medium">{selectedFile.name}</span>
          </div>
          <div className="flex items-center gap-1">
            {editMode ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  shape="square"
                  className="h-7 w-7"
                  onClick={saveFile}
                  title="Save"
                >
                  <FloppyDisk size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  shape="square"
                  className="h-7 w-7"
                  onClick={cancelEditing}
                  title="Cancel"
                >
                  <X size={14} />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  shape="square"
                  className="h-7 w-7"
                  onClick={startEditing}
                  title="Edit"
                >
                  <PencilSimple size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  shape="square"
                  className="h-7 w-7"
                  onClick={() => generateCode(selectedFile)}
                  title="Generate code"
                >
                  <Code size={14} />
                </Button>
              </>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-2">
          {editMode ? (
            <textarea
              className="w-full h-full p-2 font-mono text-sm bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              spellCheck={false}
            />
          ) : (
            <pre className="font-mono text-sm whitespace-pre-wrap p-2">
              {selectedFile.content || ""}
            </pre>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center">
        <div className="flex items-center justify-center h-8 w-8 mr-2">
          <FolderOpen size={20} className="text-[#F48120]" />
        </div>
        <h2 className="font-semibold text-base">File Explorer</h2>
      </div>
      
      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin h-5 w-5 border-2 border-[#F48120] border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 border-r border-neutral-300 dark:border-neutral-800">
            {renderFileExplorer()}
          </div>
          <div className="w-1/2">
            {renderFileEditor()}
          </div>
        </div>
      )}
    </Card>
  );
}
