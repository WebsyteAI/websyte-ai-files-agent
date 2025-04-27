import { Card } from "@/components/card/Card";
import { Robot } from "@phosphor-icons/react";

export function WelcomeCard() {
  return (
    <div className="h-full flex items-center justify-center">
      <Card className="p-6 max-w-md mx-auto bg-neutral-100 dark:bg-neutral-900">
        <div className="text-center space-y-4">
          <div className="bg-[#F48120]/10 text-[#F48120] rounded-full p-3 inline-flex">
            <Robot size={24} />
          </div>
          <h3 className="font-semibold text-lg">
            Welcome to Prompt Flow
          </h3>
          <p className="text-muted-foreground text-sm">
            Visualize and manage your agent development workflow. You can:
          </p>
          <ul className="text-sm text-left space-y-2">
            <li className="flex items-center gap-2">
              <span className="text-[#F48120]">•</span>
              <span>Create and organize tasks with dependencies</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#F48120]">•</span>
              <span>Group related tasks into logical categories</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#F48120]">•</span>
              <span>Track progress with todo, in-progress, and done states</span>
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
