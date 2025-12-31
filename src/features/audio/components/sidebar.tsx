import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  side: "left" | "right";
  onToggle: () => void;
  children: ReactNode;
}

export function Sidebar({ isOpen, side, onToggle, children }: SidebarProps) {
  const isLeft = side === "left";

  return (
    <div
      className={cn(
        "relative flex-shrink-0 bg-card transition-all duration-300",
        isLeft ? "border-r border-border" : "border-l border-border",
        isOpen ? (isLeft ? "w-64" : "w-72") : "w-0",
      )}
    >
      <div
        className={cn(isOpen ? (isLeft ? "h-full overflow-hidden" : "flex h-full flex-col overflow-hidden") : "hidden")}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "absolute top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg hover:bg-muted hover:text-foreground",
          isLeft ? "-right-3" : "-left-3",
        )}
      >
        {isOpen ? (
          isLeft ? (
            <ChevronLeft className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )
        ) : isLeft ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
