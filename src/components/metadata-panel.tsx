import { Info, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface MetadataField {
  label: string;
  value: React.ReactNode;
}

interface MetadataPanelProps {
  title?: string;
  icon?: LucideIcon;
  fields: MetadataField[];
  className?: string;
}

export function MetadataPanel({ title = "METADATA", icon: Icon = Info, fields, className }: MetadataPanelProps) {
  return (
    <div className={cn("flex-1 overflow-y-auto p-3", className)}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <div className="text-[10px] font-medium tracking-wider text-muted-foreground">{title}</div>
      </div>
      <div className="space-y-2.5">
        {fields.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="text-[10px] font-medium text-muted-foreground">{item.label}</div>
            <div className="rounded border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
