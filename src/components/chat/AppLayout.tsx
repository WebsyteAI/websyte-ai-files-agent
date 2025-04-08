import { useState, useEffect } from "react";
import { X } from "@phosphor-icons/react";
import { Button } from "@/components/button/Button";
import { StoragePanel } from "@/components/storage-panel/StoragePanel";
import { CommitTimeline } from "@/components/commit-timeline/CommitTimeline";
import { ScrollArea } from "@/components/scroll-area/ScrollArea";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/drawer";

interface AppLayoutProps {
  children: React.ReactNode;
  isTimelineOpen: boolean;
  setIsTimelineOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isStoragePanelOpen: boolean;
  setIsStoragePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  agentState: any | null;
  agentStateLoading: boolean;
  commitHistoryLoading: boolean;
  fetchCommitHistory: () => void;
  revertToCommit: (sha: string) => void;
}

export function AppLayout({
  children,
  isTimelineOpen,
  setIsTimelineOpen,
  isStoragePanelOpen,
  setIsStoragePanelOpen,
  isMobile,
  agentState,
  agentStateLoading,
  commitHistoryLoading,
  fetchCommitHistory,
  revertToCommit
}: AppLayoutProps) {
  return (
    <div className="h-[100dvh] w-full flex justify-center items-center bg-fixed overflow-hidden">
      <div className="flex flex-col md:flex-row w-full h-[100dvh] md:h-[100dvh] mx-auto relative">
        {/* Chat Panel */}
        <div className="h-full md:w-1/3 w-full flex-shrink-0 flex flex-col shadow-xl rounded-md overflow-hidden relative">
          {children}
        </div>

        {/* Timeline Panel */}
        <div
          className={`
            h-full flex-shrink-0 flex flex-col
            md:relative md:w-[80px]
            fixed top-0 right-0 z-30 w-3/4 sm:w-1/2 md:w-[80px] bg-background shadow-2xl md:shadow-none
            transform transition-transform duration-300 ease-in-out
            ${isTimelineOpen ? "translate-x-0" : "translate-x-full"}
            md:translate-x-0
            ${isTimelineOpen ? "flex" : "hidden md:flex"}
          `}
        >
          {/* Close button for mobile */}
          <Button
            variant="ghost"
            size="md"
            shape="square"
            className="absolute top-2 right-2 rounded-full h-9 w-9 md:hidden z-40"
            onClick={() => setIsTimelineOpen(false)}
          >
            <X size={20} />
          </Button>
          <CommitTimeline
            commitHistory={agentState?.commitHistory}
            loading={commitHistoryLoading}
            onRefresh={fetchCommitHistory}
            onRevertToCommit={revertToCommit}
          />
        </div>

        {/* Storage Panel - Desktop */}
        <div className="h-full flex-1 hidden md:flex flex-col">
          <StoragePanel
            agentState={agentState}
            loading={agentStateLoading}
          />
        </div>
        
        {/* Storage Panel - Mobile (Drawer) */}
        <Drawer open={isStoragePanelOpen && isMobile} onOpenChange={setIsStoragePanelOpen}>
          <DrawerContent className="h-[100dvh] flex flex-col">
            <ScrollArea className="flex-1 px-4 overflow-y-auto pt-4">
              <StoragePanel
                agentState={agentState}
                loading={agentStateLoading}
              />
            </ScrollArea>
            <DrawerFooter className="flex-shrink-0 mt-auto">
              <DrawerClose asChild>
                <Button variant="secondary">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}
