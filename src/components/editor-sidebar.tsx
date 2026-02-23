import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EditorSidebarProps {
  open: boolean;
  side: "left" | "right";
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}

export function EditorSidebar({ open, side, onToggle, children, className }: EditorSidebarProps) {
  const isLeft = side === "left";
  const Icon = open === isLeft ? ChevronLeft : ChevronRight;

  return (
    <div
      data-state={open ? "open" : "closed"}
      data-side={side}
      className={cn(
        "relative z-20 shrink-0 overflow-visible bg-card transition-[width] duration-300 max-md:absolute max-md:inset-y-0",
        "max-md:data-[side=left]:left-0 max-md:data-[side=right]:right-0",
        "data-[side=left]:border-r data-[side=right]:border-l border-border",
        "data-[state=open]:shadow-xl max-md:data-[state=open]:shadow-2xl",
        "data-[state=open]:data-[side=left]:w-[min(20rem,calc(100vw-3rem))] md:data-[state=open]:data-[side=left]:w-64",
        "data-[state=open]:data-[side=right]:w-[min(22rem,calc(100vw-3rem))] md:data-[state=open]:data-[side=right]:w-72",
        "data-[state=closed]:w-0",
        className,
      )}
    >
      {open && <div className={cn("h-full min-w-0 overflow-x-hidden", !isLeft && "flex flex-col")}>{children}</div>}
      <Button
        variant="outline"
        size="icon-sm"
        onClick={onToggle}
        className={cn(
          "absolute top-4 z-30 size-6 rounded-full shadow-lg",
          isLeft ? "-right-3" : "-left-3",
          "max-md:top-3",
        )}
      >
        <Icon className="size-3" />
      </Button>
    </div>
  );
}
