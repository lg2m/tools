import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Annotation, AudioFile } from "@/types/audio";

export type AnnotationExportFormat = "json" | "csv" | "textgrid";

interface AnnotationExportTabProps {
  files: AudioFile[];
  annotations: Annotation[];
  exportFormat: AnnotationExportFormat;
  onExportFormatChange: (format: AnnotationExportFormat) => void;
}

export function AnnotationExportTab({
  files,
  annotations,
  exportFormat,
  onExportFormatChange,
}: AnnotationExportTabProps) {
  return (
    <FieldGroup>
      <FieldSet>
        <FieldLabel>Export format</FieldLabel>
        <RadioGroup
          value={exportFormat}
          onValueChange={(value) => onExportFormatChange(value as AnnotationExportFormat)}
        >
          <Field orientation="horizontal">
            <RadioGroupItem id="format-json" value="json" />
            <FieldLabel htmlFor="format-json">JSON</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <RadioGroupItem id="format-csv" value="csv" />
            <FieldLabel htmlFor="format-csv">CSV</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <RadioGroupItem id="format-textgrid" value="textgrid" />
            <FieldLabel htmlFor="format-textgrid">TextGrid</FieldLabel>
          </Field>
        </RadioGroup>
      </FieldSet>

      <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total files</span>
          <span className="font-mono">{files.length}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total annotations</span>
          <span className="font-mono">{annotations.length}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Annotated files</span>
          <span className="font-mono">{new Set(annotations.map((annotation) => annotation.fileId)).size}</span>
        </div>
      </div>
    </FieldGroup>
  );
}
