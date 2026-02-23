import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ToolbarButton {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ToolbarToggleGroup {
  type: "toggle";
  id: string;
  value: string;
  options: ToolbarButton[];
  onChange: (value: string) => void;
}

interface ToolbarAction {
  type: "action";
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Render as keyboard shortcut indicator */
  kbd?: string;
}

interface ToolbarSeparator {
  type: "separator";
  id: string;
}

type ToolbarItem = ToolbarToggleGroup | ToolbarAction | ToolbarSeparator;

interface EditorToolbarProps {
  title: string;
  status?: string;
  isPending?: boolean;
  items: ToolbarItem[];
}

function ToggleButton({
  option,
  isActive,
  onClick,
}: {
  option: ToolbarButton;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={option.disabled}
      className={cn(
        "h-auto px-2.5 py-1 text-[11px] font-medium",
        isActive
          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:text-primary-foreground"
          : "text-muted-foreground",
      )}
    >
      {option.label}
    </Button>
  );
}

export function EditorToolbar({ title, status, isPending, items }: EditorToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <h1 className="text-sm font-semibold tracking-tight text-foreground">{title}</h1>
        </div>
        {status && (
          <div className="ml-4 font-mono text-[11px] text-muted-foreground">
            {status}
            {isPending && <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {items.map((item) => {
          if (item.type === "separator") {
            return <div key={item.id} className="mx-1 h-4 w-px bg-border" />;
          }

          if (item.type === "toggle") {
            return (
              <div key={item.id} className="flex items-center gap-1">
                {item.options.map((option) => (
                  <ToggleButton
                    key={option.value}
                    option={option}
                    isActive={item.value === option.value}
                    onClick={() => item.onChange(option.value)}
                  />
                ))}
              </div>
            );
          }

          if (item.type === "action") {
            return (
              <Button
                key={item.id}
                variant="ghost"
                size="sm"
                onClick={item.onClick}
                disabled={item.disabled}
                className="h-auto px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {item.kbd ? <kbd className="font-mono text-[10px] text-muted-foreground">{item.kbd}</kbd> : item.label}
              </Button>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
