import { BatchProgressCard } from "@/components/batch/batch-progress-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  type AggregateProgress,
  type FileProcessingState,
  getProcessingStepLabel,
  type ProcessingOptions,
} from "@/lib/audio/batch-processor";

const SAMPLE_RATES = [8000, 16000, 22050, 44100, 48000] as const;
const AUDIO_FORMATS = ["wav", "mp3"] as const;
const BIT_DEPTH_OPTIONS = [16, 24, 32] as const;

interface AudioProcessingTabProps {
  filesCount: number;
  options: ProcessingOptions;
  processing: boolean;
  aggregateProgress: AggregateProgress;
  failedFileNames: string[];
  activeFile: FileProcessingState | null;
  onOptionsChange: (updater: (current: ProcessingOptions) => ProcessingOptions) => void;
}

export function AudioProcessingTab({
  filesCount,
  options,
  processing,
  aggregateProgress,
  failedFileNames,
  activeFile,
  onOptionsChange,
}: AudioProcessingTabProps) {
  return (
    <FieldGroup>
      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="trim-checkbox"
            checked={options.trim?.enabled}
            onCheckedChange={(checked) =>
              onOptionsChange((current) => ({
                ...current,
                trim: { ...current.trim, enabled: Boolean(checked) },
              }))
            }
          />
          <FieldLabel htmlFor="trim-checkbox">Trim clips</FieldLabel>
        </Field>

        {options.trim?.enabled ? (
          <FieldSet>
            <FieldLabel>Trim strategy</FieldLabel>
            <FieldDescription className="text-xs">
              Use each file&apos;s saved trim region, or apply one global window to every file.
            </FieldDescription>

            <RadioGroup
              value={options.trim.usePerFileTrim ? "per-file" : "global"}
              onValueChange={(value) =>
                onOptionsChange((current) => ({
                  ...current,
                  trim: { ...current.trim, usePerFileTrim: value === "per-file" },
                }))
              }
            >
              <Field orientation="horizontal">
                <RadioGroupItem id="trim-per-file" value="per-file" />
                <FieldLabel htmlFor="trim-per-file">Use per-file trim points</FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <RadioGroupItem id="trim-global" value="global" />
                <FieldLabel htmlFor="trim-global">Apply one global trim range</FieldLabel>
              </Field>
            </RadioGroup>

            {!options.trim.usePerFileTrim ? (
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="global-start" className="text-xs text-muted-foreground">
                    Start (s)
                  </FieldLabel>
                  <Input
                    id="global-start"
                    type="number"
                    value={options.trim.globalStart}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        trim: { ...current.trim, globalStart: Number(event.target.value) },
                      }))
                    }
                    min={0}
                    step={0.1}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="global-end" className="text-xs text-muted-foreground">
                    End (s)
                  </FieldLabel>
                  <Input
                    id="global-end"
                    type="number"
                    value={options.trim.globalEnd}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        trim: { ...current.trim, globalEnd: Number(event.target.value) },
                      }))
                    }
                    min={0}
                    step={0.1}
                  />
                </Field>
              </div>
            ) : null}
          </FieldSet>
        ) : null}
      </FieldGroup>

      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="silence-checkbox"
            checked={options.silence?.enabled}
            onCheckedChange={(checked) =>
              onOptionsChange((current) => ({
                ...current,
                silence: { ...current.silence, enabled: Boolean(checked) },
              }))
            }
          />
          <FieldLabel htmlFor="silence-checkbox">Remove leading/trailing silence</FieldLabel>
        </Field>
        {options.silence?.enabled ? (
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="silence-threshold" className="text-xs text-muted-foreground">
                Silence threshold (dB)
              </FieldLabel>
              <Input
                id="silence-threshold"
                type="number"
                value={options.silence.thresholdDb}
                onChange={(event) =>
                  onOptionsChange((current) => ({
                    ...current,
                    silence: { ...current.silence, thresholdDb: Number(event.target.value) },
                  }))
                }
                min={-80}
                max={-5}
                step={1}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="silence-min-duration" className="text-xs text-muted-foreground">
                Min silence (ms)
              </FieldLabel>
              <Input
                id="silence-min-duration"
                type="number"
                value={options.silence.minDurationMs}
                onChange={(event) =>
                  onOptionsChange((current) => ({
                    ...current,
                    silence: { ...current.silence, minDurationMs: Number(event.target.value) },
                  }))
                }
                min={20}
                max={2000}
                step={10}
              />
            </Field>
          </div>
        ) : null}
      </FieldGroup>

      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="resample-checkbox"
            checked={options.resample?.enabled}
            onCheckedChange={(checked) =>
              onOptionsChange((current) => ({
                ...current,
                resample: { ...current.resample, enabled: Boolean(checked) },
              }))
            }
          />
          <FieldLabel htmlFor="resample-checkbox">Resample</FieldLabel>
        </Field>
        {options.resample?.enabled ? (
          <Field>
            <FieldLabel className="text-xs text-muted-foreground">Target sample rate (Hz)</FieldLabel>
            <Select
              value={String(options.resample.targetRate)}
              onValueChange={(value) =>
                onOptionsChange((current) => ({
                  ...current,
                  resample: { ...current.resample, targetRate: Number(value) },
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a sample rate" />
              </SelectTrigger>
              <SelectContent>
                {SAMPLE_RATES.map((rate) => (
                  <SelectItem key={rate} value={String(rate)}>
                    {rate} Hz{rate === 16000 ? " (speech ML standard)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </FieldGroup>

      <Field orientation="horizontal">
        <Checkbox
          id="mono-checkbox"
          checked={options.mono?.enabled}
          onCheckedChange={(checked) =>
            onOptionsChange((current) => ({
              ...current,
              mono: { enabled: Boolean(checked) },
            }))
          }
        />
        <FieldLabel htmlFor="mono-checkbox">Convert to mono</FieldLabel>
      </Field>

      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="highpass-checkbox"
            checked={options.highpass?.enabled}
            onCheckedChange={(checked) =>
              onOptionsChange((current) => ({
                ...current,
                highpass: { ...current.highpass, enabled: Boolean(checked) },
              }))
            }
          />
          <FieldLabel htmlFor="highpass-checkbox">Apply high-pass filter</FieldLabel>
        </Field>
        {options.highpass?.enabled ? (
          <Field>
            <FieldLabel htmlFor="highpass-cutoff" className="text-xs text-muted-foreground">
              Cutoff frequency (Hz)
            </FieldLabel>
            <Input
              id="highpass-cutoff"
              type="number"
              value={options.highpass.cutoffHz}
              onChange={(event) =>
                onOptionsChange((current) => ({
                  ...current,
                  highpass: { ...current.highpass, cutoffHz: Number(event.target.value) },
                }))
              }
              min={20}
              max={300}
              step={5}
            />
          </Field>
        ) : null}
      </FieldGroup>

      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="normalize-checkbox"
            checked={options.normalize?.enabled}
            onCheckedChange={(checked) =>
              onOptionsChange((current) => ({
                ...current,
                normalize: { ...current.normalize, enabled: Boolean(checked) },
              }))
            }
          />
          <FieldLabel htmlFor="normalize-checkbox">Normalize audio</FieldLabel>
        </Field>
        {options.normalize?.enabled ? (
          <Field>
            <FieldLabel htmlFor="normalize-audio" className="text-xs text-muted-foreground">
              Target level (dB)
            </FieldLabel>
            <Input
              id="normalize-audio"
              type="number"
              value={options.normalize.targetDb}
              onChange={(event) =>
                onOptionsChange((current) => ({
                  ...current,
                  normalize: { ...current.normalize, targetDb: Number(event.target.value) },
                }))
              }
              min={-60}
              max={0}
              step={0.1}
            />
          </Field>
        ) : null}
      </FieldGroup>

      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="bit-depth-checkbox"
            checked={options.bitDepth?.enabled}
            onCheckedChange={(checked) =>
              onOptionsChange((current) => ({
                ...current,
                bitDepth: { ...current.bitDepth, enabled: Boolean(checked) },
              }))
            }
          />
          <FieldLabel htmlFor="bit-depth-checkbox">Convert bit depth</FieldLabel>
        </Field>
        {options.bitDepth?.enabled ? (
          <Field>
            <FieldLabel className="text-xs text-muted-foreground">Target bit depth</FieldLabel>
            <Select
              value={String(options.bitDepth.targetBitDepth)}
              onValueChange={(value) =>
                onOptionsChange((current) => ({
                  ...current,
                  bitDepth: { ...current.bitDepth, targetBitDepth: Number(value) as 16 | 24 | 32 },
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a bit depth" />
              </SelectTrigger>
              <SelectContent>
                {BIT_DEPTH_OPTIONS.map((bitDepth) => (
                  <SelectItem key={bitDepth} value={String(bitDepth)}>
                    {bitDepth}-bit {bitDepth === 16 ? "(common training format)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </FieldGroup>

      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="convert-checkbox"
            checked={options.convert?.enabled}
            onCheckedChange={(checked) =>
              onOptionsChange((current) => ({
                ...current,
                convert: { ...current.convert, enabled: Boolean(checked) },
              }))
            }
          />
          <FieldLabel htmlFor="convert-checkbox">Convert file format</FieldLabel>
        </Field>

        {options.convert?.enabled ? (
          <Field>
            <FieldLabel className="text-xs text-muted-foreground">Target format</FieldLabel>
            <Select
              value={options.convert.format}
              onValueChange={(value) =>
                onOptionsChange((current) => ({
                  ...current,
                  convert: { ...current.convert, format: value as (typeof AUDIO_FORMATS)[number] },
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a file format" />
              </SelectTrigger>
              <SelectContent>
                {AUDIO_FORMATS.map((format) => (
                  <SelectItem key={format} value={format}>
                    {format.toUpperCase()} {format === "wav" ? "(lossless)" : "(compressed)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </FieldGroup>

      <BatchProgressCard
        isProcessing={processing}
        totalItems={filesCount}
        percent={aggregateProgress.percent}
        queuedItems={aggregateProgress.queuedFiles}
        runningItems={aggregateProgress.runningFiles}
        successfulItems={aggregateProgress.successfulFiles}
        failedItems={aggregateProgress.failedFiles}
        activeItemLabel={activeFile?.fileName}
        runningStepLabel={activeFile?.step ? getProcessingStepLabel(activeFile.step) : undefined}
        failedItemLabels={failedFileNames}
      />
    </FieldGroup>
  );
}
