import { useState, useEffect } from "react";
import { X } from "@phosphor-icons/react";
import { Button } from "@/components/button/Button";
import { StoragePanel } from "@/components/storage-panel/StoragePanel";
import { CommitTimeline } from "@/components/commit-timeline/CommitTimeline";
import { ScrollArea } from "@/components/scroll-area";
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

        {/* Removed desktop timeline panel as it's now in a drawer */}

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
            <DrawerHeader>
              <DrawerTitle>Storage Panel</DrawerTitle>
            </DrawerHeader>
            <ScrollArea className="h-full">
              <div className="px-4">
              <StoragePanel
                agentState={agentState}
                loading={agentStateLoading}
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
      </div>
    </div>
  );
}
