import { useState } from "react";
import { ChatCircle, X } from "@phosphor-icons/react";
import { Button } from "@/components/button/Button";
import { WorkspacePanel } from "@/components/workspace-panel/WorkspacePanel";
import { CommitTimeline } from "@/components/commit-timeline/CommitTimeline";
import { ScrollArea } from "@/components/scroll-area";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/drawer";

interface AppLayoutProps {
  chatPanel: React.ReactNode;
  isTimelineOpen: boolean;
  setIsTimelineOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isWorkspacePanelOpen: boolean;
  setIsWorkspacePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isPromptFlowOpen: boolean;
  setIsPromptFlowOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  agentState: any | null;
  agentStateLoading: boolean;
  commitHistoryLoading: boolean;
  fetchCommitHistory: () => void;
  revertToCommit: (sha: string) => void;
  onUpdateAgentState?: (newState: any) => void;
}

export function AppLayout({
  chatPanel,
  isTimelineOpen,
  setIsTimelineOpen,
  isWorkspacePanelOpen,
  setIsWorkspacePanelOpen,
  isPromptFlowOpen,
  setIsPromptFlowOpen,
  isMobile,
  agentState,
  agentStateLoading,
  commitHistoryLoading,
  fetchCommitHistory,
  revertToCommit,
  onUpdateAgentState
}: AppLayoutProps) {
  const [isChatVisible, setIsChatVisible] = useState(true);
  
  // Handle agent state updates
  const handleUpdateAgentState = (newState: any) => {
    if (onUpdateAgentState) {
      onUpdateAgentState(newState);
    }
  };
  return (
    <div className="h-[100dvh] w-full flex justify-center items-center bg-fixed overflow-hidden">
      <div className="w-full h-[100dvh] mx-auto flex">
        {/* Sliding Chat Panel */}
        <div 
          className={`h-full transition-all duration-300 ease-in-out ${
            isChatVisible 
              ? isMobile 
                ? 'w-full absolute inset-0 z-50' 
                : 'w-[550px]' 
              : 'w-[0px]'
          }`}
        >
          <div className="w-full h-full flex flex-col relative">
            {isChatVisible && (
              <div className="w-full h-full">
                {chatPanel}
              </div>
            )}
            
          </div>
        </div>

        {/* Workspace Panel - Resizable */}
        <div className="h-full flex-1 flex flex-col relative">
          <WorkspacePanel
            agentState={agentState}
            loading={agentStateLoading}
            onUpdateAgentState={handleUpdateAgentState}
          />
          {/* Chat Toggle Button */}
          <button
            onClick={() => setIsChatVisible(!isChatVisible)}
            className={`absolute bottom-4 ${isMobile ? 'right-4' : 'left-4'} bg-[#F48120] hover:bg-[#F48120]/90 text-white p-3 rounded-full shadow-lg z-50 transition-all`}
            title={isChatVisible ? "Hide chat" : "Show chat"}
          >
            {isChatVisible ? <X size={24} /> : <ChatCircle size={24} />}
          </button>
        </div>
        
        {/* Workspace Panel - Mobile Only */}
        {isWorkspacePanelOpen && isMobile && (
          <div className="fixed inset-0 z-50 bg-background">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h2 className="font-semibold text-base">Workspace Panel</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  shape="square"
                  className="rounded-full h-9 w-9"
                  onClick={() => setIsWorkspacePanelOpen(false)}
                >
                  <X size={20} />
                </Button>
              </div>
              <div className="flex-1 overflow-auto">
                <WorkspacePanel
                  agentState={agentState}
                  loading={agentStateLoading}
                  onToggle={() => setIsWorkspacePanelOpen(false)}
                  onUpdateAgentState={handleUpdateAgentState}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Timeline Panel - Drawer (for both mobile and desktop) */}
        <Drawer open={isTimelineOpen} onOpenChange={setIsTimelineOpen}>
          <DrawerContent className="h-[100dvh] flex flex-col">
            <DrawerHeader>
              <DrawerTitle>Commit History</DrawerTitle>
            </DrawerHeader>
            <ScrollArea className="h-full">
              <div className="px-4">
              <CommitTimeline
                commitHistory={agentState?.commitHistory}
                loading={commitHistoryLoading}
                onRefresh={fetchCommitHistory}
                onRevertToCommit={revertToCommit}
              />
              </div>
            </ScrollArea>
            <DrawerFooter className="flex-shrink-0 mt-auto">
              <DrawerClose asChild>
                <Button variant="secondary">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
        
        {/* Prompt Flow is now integrated directly in the workspace panel */}
      </div>
    </div>
  );
}
