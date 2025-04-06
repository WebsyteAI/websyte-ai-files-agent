import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/tooltip";
import { useMenuNavigation } from "@/hooks/useMenuNavigation";
import { cn } from "@/lib/utils";
import { IconContext } from "@phosphor-icons/react";
import { useRef } from "react";

type MenuOptionProps = {
  icon: React.ReactNode;
  id?: number;
  isActive?: number | boolean | string | undefined;
  onClick: () => void;
  tooltip: string;
};

const MenuOption = ({
  icon,
  id,
  isActive,
  onClick,
  tooltip,
}: MenuOptionProps) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            "relative -ml-px flex h-full w-11 cursor-pointer items-center justify-center border border-neutral-300 dark:border-neutral-700 transition-colors focus:z-10 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-offset-2",
            {
              "bg-neutral-200 dark:bg-neutral-800": isActive === id,
              "rounded-l-lg": "first-of-type",
              "rounded-r-lg": "last-of-type"
            }
          )}
          onClick={onClick}
        >
          <IconContext.Provider value={{ size: 18 }}>{icon}</IconContext.Provider>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

type MenuBarProps = {
  className?: string;
  isActive: number | boolean | string | undefined;
  options: MenuOptionProps[];
  optionIds?: boolean;
};

export const MenuBar = ({
  className,
  isActive,
  options,
  optionIds = false, // if option needs an extra unique ID
}: MenuBarProps) => {
  const menuRef = useRef<HTMLElement | null>(null);

  useMenuNavigation({ menuRef, direction: "horizontal" });

  return (
    <nav
      className={cn(
        "bg-ob-base-100 flex rounded-lg shadow-xs transition-colors",
        className
      )}
      ref={menuRef}
    >
      {options.map((option, index) => (
        <MenuOption
          key={index}
          {...option}
          isActive={isActive}
          id={optionIds ? option.id : index}
        />
      ))}
    </nav>
  );
};
