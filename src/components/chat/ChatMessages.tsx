import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card } from "@/components/card/Card";
import { Button } from "@/components/button/Button";
import { ScrollArea } from "@/components/scroll-area";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/tooltip";
import { Robot, CaretDown, CaretRight } from "@phosphor-icons/react";
import { Avatar } from "@/components/avatar/Avatar";
import { WelcomeCard } from "./WelcomeCard";
import type { Message } from "@ai-sdk/react";
import { APPROVAL } from "../../../server/shared";
import type { tools } from "../../../server/tools";

// List of tools that require human confirmation
const toolsRequiringConfirmation: (keyof typeof tools)[] = [
  "getWeatherInformation",
];

// Tool message component with collapsible content
function ToolMessage({ toolInvocation, addToolResult }: { 
  toolInvocation: any; 
  addToolResult: (result: { toolCallId: string; result: string }) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const toolCallId = toolInvocation.toolCallId;
  
  return (
    <Card className="p-3 my-2 rounded-md bg-neutral-100 dark:bg-neutral-900 border-l-2 border-l-[#F48120]">
      <div 
        className="flex items-center gap-2 cursor-pointer" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="bg-[#F48120]/10 p-1.5 rounded-full">
          <Robot size={16} className="text-[#F48120]" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-sm">
            {toolInvocation.toolName}
          </h4>
          <p className="text-xs text-muted-foreground">
            {toolInvocation.state === "partial-call" && "Preparing..."}
            {toolInvocation.state === "call" && "Calling tool..."}
            {toolInvocation.state === "result" && "Completed"}
          </p>
        </div>
        {toolInvocation.state === "partial-call" ? (
          <div className="h-4 w-4 rounded-full border-2 border-[#F48120] border-t-transparent animate-spin"></div>
        ) : (
          isExpanded ? 
            <CaretDown size={16} className="text-muted-foreground" /> : 
            <CaretRight size={16} className="text-muted-foreground" />
        )}
      </div>
      
      {isExpanded && (
        <div className="mt-3">
          {(toolInvocation.args && Object.keys(toolInvocation.args).length > 0) && (
            <div className="mb-2">
              <h5 className="text-xs font-medium mb-1 text-muted-foreground">
                Arguments:
              </h5>
              <pre className="bg-background/80 p-2 rounded-md text-xs overflow-auto max-h-[100px]">
                {JSON.stringify(
                  toolInvocation.args,
                  null,
                  2
                )}
              </pre>
            </div>
          )}
          
          {toolInvocation.state === "result" && (
            <div>
              <h5 className="text-xs font-medium mb-1 text-muted-foreground">
                Result:
              </h5>
              <pre className="bg-background/80 p-2 rounded-md text-xs overflow-auto max-h-[150px]">
                {JSON.stringify(
                  // Access the result data safely using type assertion
                  (toolInvocation as any).data || 
                  (toolInvocation as any).result || 
                  "No result data available",
                  null, 
                  2
                )}
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

interface ChatMessagesProps {
  messages: Message[];
  showDebug: boolean;
  addToolResult: (result: { toolCallId: string; result: string }) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatMessages({ 
  messages, 
  showDebug, 
  addToolResult,
  messagesEndRef
}: ChatMessagesProps) {
  // Format time to a readable format
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {messages.length === 0 ? (
          <WelcomeCard />
        ) : (
        messages.map((m: Message, index) => {
          const isUser = m.role === "user";
          const showAvatar =
            index === 0 || messages[index - 1]?.role !== m.role;
          const showRole = showAvatar && !isUser;

          return (
            <div key={m.id}>
              {showDebug && (
                <pre className="text-xs text-muted-foreground overflow-scroll">
                  {JSON.stringify(m, null, 2)}
                </pre>
              )}
              <div>
                {/* Show avatar for AI messages */}
                {showAvatar && !isUser && (
                  <div className="flex justify-start mb-2">
                    <Avatar username={"AI"} />
                  </div>
                )}
                
                {/* Message content */}
                <div
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div className={`${isUser ? "max-w-[85%]" : "w-full"}`}>
                    <div>
                      {m.parts?.map((part, i) => {
                        if (part.type === "text") {
                          if (!part.text) {
                            return null; // Skip scheduled messages
                          }

                          return (
                            <div key={i}>
                              <Card
                                className={`p-3 rounded-md bg-neutral-100 dark:bg-neutral-900 ${
                                  isUser
                                    ? "rounded-br-none"
                                    : "rounded-bl-none border-assistant-border"
                                } ${
                                  part.text.startsWith("scheduled message")
                                    ? "border-accent/50"
                                    : ""
                                } relative`}
                              >
                                {part.text.startsWith(
                                  "scheduled message"
                                ) && (
                                  <span className="absolute -top-3 -left-2 text-base">
                                    🕒
                                  </span>
                                )}
                                <ReactMarkdown
                                  components={{
                                    p: ({ children }) => <p className="text-sm">{children}</p>,
                                    a: ({ href, children }) => <a href={href} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                                    code: ({ children }) => <code className="bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded text-xs">{children}</code>,
                                    pre: ({ children }) => <pre className="bg-neutral-200 dark:bg-neutral-800 p-2 rounded my-2 overflow-auto text-xs">{children}</pre>,
                                    ul: ({ children }) => <ul className="list-disc pl-5 my-2">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal pl-5 my-2">{children}</ol>,
                                    li: ({ children }) => <li className="my-1">{children}</li>,
                                    h1: ({ children }) => <h1 className="text-lg font-bold my-2">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-base font-bold my-2">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-sm font-bold my-1">{children}</h3>,
                                    blockquote: ({ children }) => <blockquote className="border-l-2 border-neutral-400 pl-2 my-2 italic">{children}</blockquote>,
                                  }}
                                >
                                  {part.text.replace(
                                    /^scheduled message: /,
                                    ""
                                  )}
                                </ReactMarkdown>
                              </Card>
                              <p
                                className={`text-xs text-muted-foreground mt-1 ${
                                  isUser ? "text-right" : "text-left"
                                }`}
                              >
                                {formatTime(
                                  new Date(m.createdAt as unknown as string)
                                )}
                              </p>
                            </div>
                          );
                        }

                        if (part.type === "tool-invocation") {
                          const toolInvocation = part.toolInvocation;
                          const toolCallId = toolInvocation.toolCallId;

                          // For tools requiring confirmation in "call" state
                          if (
                            toolsRequiringConfirmation.includes(
                              toolInvocation.toolName as keyof typeof tools
                            ) &&
                            toolInvocation.state === "call"
                          ) {
                            return (
                              <Card
                                key={i}
                                className="p-4 my-3 rounded-md bg-neutral-100 dark:bg-neutral-900"
                              >
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="bg-[#F48120]/10 p-1.5 rounded-full">
                                    <Robot
                                      size={16}
                                      className="text-[#F48120]"
                                    />
                                  </div>
                                  <h4 className="font-medium">
                                    {toolInvocation.toolName}
                                  </h4>
                                </div>

                                <div className="mb-3">
                                  <h5 className="text-xs font-medium mb-1 text-muted-foreground">
                                    Arguments:
                                  </h5>
                                  <pre className="bg-background/80 p-2 rounded-md text-xs overflow-auto">
                                    {JSON.stringify(
                                      toolInvocation.args,
                                      null,
                                      2
                                    )}
                                  </pre>
                                </div>

                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() =>
                                      addToolResult({
                                        toolCallId,
                                        result: APPROVAL.NO,
                                      })
                                    }
                                  >
                                    Reject
                                  </Button>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="primary"
                                          size="sm"
                                          onClick={() =>
                                            addToolResult({
                                              toolCallId,
                                              result: APPROVAL.YES,
                                            })
                                          }
                                        >
                                          Approve
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Accept action</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </Card>
                            );
                          }
                          
                          // For all other tool invocations (including those in progress or completed)
                          return <ToolMessage key={i} toolInvocation={toolInvocation} addToolResult={addToolResult} />;
                        }

                        return null;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
