import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface BatchProcessorTab<TTab extends string = string> {
  id: TTab;
  label: string;
  content: ReactNode;
  footer?: ReactNode;
}

interface BatchProcessorDialogProps<TTab extends string> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  itemCount: number;
  itemCountLabel?: string;
  tabs: BatchProcessorTab<TTab>[];
  activeTab: TTab;
  onActiveTabChange: (tab: TTab) => void;
}

export function BatchProcessorDialog<TTab extends string>({
  open,
  onOpenChange,
  title,
  itemCount,
  itemCountLabel = "files",
  tabs,
  activeTab,
  onActiveTabChange,
}: BatchProcessorDialogProps<TTab>) {
  const activeTabConfig = tabs.find((tab) => tab.id === activeTab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[90vh] max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-3 text-base">
            {title}
            <span className="text-muted-foreground font-mono text-xs">
              {itemCount} {itemCountLabel}
            </span>
          </DialogTitle>
          <div className="mt-4 flex gap-1 rounded-md border bg-muted/40 p-1">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                variant="ghost"
                size="sm"
                className={cn("flex-1", activeTab === tab.id && "bg-background shadow-xs")}
                onClick={() => onActiveTabChange(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full overflow-hidden">
            <div className="px-6 py-4">{activeTabConfig?.content}</div>
          </ScrollArea>
        </div>

        {activeTabConfig?.footer ? <div className="border-t px-6 py-4">{activeTabConfig.footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}
