import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { BaseFile } from "@/lib/tools/types";
import { cn } from "@/lib/utils";

interface EditorFilmstripProps<T extends BaseFile> {
  files: T[];
  currentIndex: number;
  onSelect: (index: number) => void;
  renderThumbnail: (file: T, isActive: boolean) => React.ReactNode;
}

export function EditorFilmstrip<T extends BaseFile>({
  files,
  currentIndex,
  onSelect,
  renderThumbnail,
}: EditorFilmstripProps<T>) {
  return (
    <div className="border-t border-border bg-card">
      <ScrollArea className="w-full">
        <div className="flex gap-1 p-2">
          {files.map((file, index) => (
            <button
              key={file.id}
              onClick={() => onSelect(index)}
              className={cn(
                "relative h-14 w-14 shrink-0 overflow-hidden rounded border-2 transition-all",
                index === currentIndex
                  ? "border-foreground ring-2 ring-foreground/20"
                  : "border-transparent hover:border-muted-foreground/50",
                file.hasOverrides && index !== currentIndex && "ring-1 ring-blue-500/50",
              )}
            >
              {renderThumbnail(file, index === currentIndex)}
              <span className="absolute bottom-0.5 right-0.5 rounded bg-background/80 px-1 font-mono text-[9px]">
                {index + 1}
              </span>
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
