import { useRef } from "react";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import type { Message } from "@ai-sdk/react";

interface ChatPanelProps {
  showDebug: boolean;
  setShowDebug: React.Dispatch<React.SetStateAction<boolean>>;
  setIsTimelineOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsStoragePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  clearHistory: () => void;
  messages: Message[];
  addToolResult: (result: { toolCallId: string; result: string }) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  isLoading: boolean;
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent, options?: any) => void;
  pendingToolCallConfirmation: boolean;
}

export function ChatPanel({
  showDebug,
  setShowDebug,
  setIsTimelineOpen,
  setIsStoragePanelOpen,
  clearHistory,
  messages,
  addToolResult,
  messagesEndRef,
  isLoading,
  input,
  handleInputChange,
  handleSubmit,
  pendingToolCallConfirmation
}: ChatPanelProps) {
  return (
    <div className="flex flex-col h-full bg-background/95 backdrop-blur-sm shadow-xl md:rounded-r-lg overflow-hidden border-r border-y border-neutral-200 dark:border-neutral-800 transition-all">
      <div className="flex items-center justify-between px-4">
        <ChatHeader
          showDebug={showDebug}
          setShowDebug={setShowDebug}
          setIsTimelineOpen={setIsTimelineOpen}
          setIsStoragePanelOpen={setIsStoragePanelOpen}
          clearHistory={clearHistory}
        />
      </div>
      
      <div className="flex-1 overflow-hidden" style={{ height: 'calc(100% - 120px)', maxWidth: '100%' }}>
        <ChatMessages
          messages={messages}
          showDebug={showDebug}
          addToolResult={addToolResult}
          messagesEndRef={messagesEndRef}
          isLoading={isLoading}
        />
      </div>
      
      <div className="flex-shrink-0 mt-auto">
        <ChatInput
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          pendingToolCallConfirmation={pendingToolCallConfirmation}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
