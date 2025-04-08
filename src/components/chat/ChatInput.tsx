import type { FormEvent } from "react";
import { Button } from "@/components/button/Button";
import { Textarea } from "@/components/textarea";
import { PaperPlaneRight, CloudArrowUp, Hammer, Globe, GitPullRequest } from "@phosphor-icons/react";

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent, options?: any) => void;
  pendingToolCallConfirmation: boolean;
}

export function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  pendingToolCallConfirmation
}: ChatInputProps) {
  return (
    <form
      onSubmit={(e) =>
        handleSubmit(e, {
          data: {
            annotations: {
              hello: "world",
            },
          },
        })
      }
      className="p-4 bg-input-background bottom-0 left-0 right-0 z-10"
    >
      <div className="mx-auto max-w-3xl">
        <div className="relative rounded-2xl shadow-md bg-neutral-100 dark:bg-neutral-900">
          <Textarea
            disabled={pendingToolCallConfirmation}
            placeholder={
              pendingToolCallConfirmation
                ? "Please respond to the tool confirmation above..."
                : "Ask anything..."
            }
            className="pl-4 pr-12 py-3 w-full rounded-2xl max-h-[200px] overflow-y-auto min-h-[70px] bg-transparent border-none focus:ring-0 focus:outline-none"
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
          />
          
          <div className="absolute right-2 bottom-2">
            <Button
              type="submit"
              shape="square"
              className="rounded-full h-8 w-8 flex-shrink-0 bg-[#F48120] hover:bg-[#F48120]/90 text-white"
              disabled={pendingToolCallConfirmation || !input.trim()}
            >
              <PaperPlaneRight size={16} />
            </Button>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-3 justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full bg-neutral-100 dark:bg-neutral-900 px-3"
            onClick={() => {
              handleInputChange({ target: { value: "Publish app" } } as React.ChangeEvent<HTMLTextAreaElement>);
            }}
          >
            <CloudArrowUp size={16} className="mr-2" />
            Publish
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full bg-neutral-100 dark:bg-neutral-900 px-3"
            onClick={() => {
              handleInputChange({ target: { value: "Check the build status" } } as React.ChangeEvent<HTMLTextAreaElement>);
            }}
          >
            <Hammer size={16} className="mr-2" />
            Check build
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full bg-neutral-100 dark:bg-neutral-900 px-3"
            onClick={() => {
              handleInputChange({ target: { value: "Test the endpoint" } } as React.ChangeEvent<HTMLTextAreaElement>);
            }}
          >
            <Globe size={16} className="mr-2" />
            Test endpoint
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full bg-neutral-100 dark:bg-neutral-900 px-3"
            onClick={() => {
              handleInputChange({ target: { value: "Sync from Github" } } as React.ChangeEvent<HTMLTextAreaElement>);
            }}
          >
            <GitPullRequest size={16} className="mr-2" />
            Sync from Github
          </Button>
        </div>
      </div>
    </form>
  );
}
