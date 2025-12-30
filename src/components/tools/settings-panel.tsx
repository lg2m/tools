import { Settings2 } from "lucide-react";

interface SettingsPanelProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsPanel({
  title = "Settings",
  description = "Configure processing pipeline",
  children,
}: SettingsPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
