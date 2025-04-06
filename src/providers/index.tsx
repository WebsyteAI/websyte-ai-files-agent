import { ModalProvider } from "@/providers/ModalProvider";
import { TooltipProvider } from "@/components/tooltip";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <TooltipProvider>
      <ModalProvider>{children}</ModalProvider>
    </TooltipProvider>
  );
};
