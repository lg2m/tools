import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { ToolConfig } from '@/types/audio';

type ToolSettingsProps = {
  config: ToolConfig;
  onConfigChange: (config: ToolConfig) => void;
};

const outputFormats = [
  { value: 'wav', label: 'WAV' },
  { value: 'mp3', label: 'MP3' },
  { value: 'ogg', label: 'OGG' },
];

const sampleRates = [
  { value: 8000, label: '8 kHz' },
  { value: 16000, label: '16 kHz' },
  { value: 22050, label: '22.05 kHz' },
  { value: 44100, label: '44.1 kHz' },
  { value: 48000, label: '48 kHz' },
];

export function ToolSettings({ config, onConfigChange }: ToolSettingsProps) {
  const updateConfig = (
    key: keyof ToolConfig,
    value: Partial<ToolConfig[keyof ToolConfig]>,
  ) => {
    onConfigChange({
      ...config,
      [key]: { ...config[key], ...value },
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-medium">Settings</h3>
        <p className="text-xs text-muted-foreground">
          Configure processing pipeline
        </p>
      </div>
      <div className="p-4">
        {/* Convert Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="convert-toggle" className="text-sm font-medium">
                Convert Format
              </Label>
              <p className="text-xs text-muted-foreground">
                Change audio format
              </p>
            </div>
            <Switch
              id="convert-toggle"
              checked={config.convert.enabled}
              onCheckedChange={(checked) =>
                updateConfig('convert', { enabled: checked })
              }
            />
          </div>
          {config.convert.enabled && (
            <div className="ml-0 rounded-md bg-secondary/50 p-3">
              <Label className="mb-2 block text-xs text-muted-foreground">
                Output Format
              </Label>
              <Select
                value={config.convert.outputFormat}
                onValueChange={(value) =>
                  updateConfig('convert', { outputFormat: value })
                }
              >
                <SelectTrigger className="h-8 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {outputFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Separator className="my-4" />

        {/* Downsample Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label
                htmlFor="downsample-toggle"
                className="text-sm font-medium"
              >
                Resample
              </Label>
              <p className="text-xs text-muted-foreground">
                Change sample rate
              </p>
            </div>
            <Switch
              id="downsample-toggle"
              checked={config.downsample.enabled}
              onCheckedChange={(checked) =>
                updateConfig('downsample', { enabled: checked })
              }
            />
          </div>
          {config.downsample.enabled && (
            <div className="ml-0 rounded-md bg-secondary/50 p-3">
              <Label className="mb-2 block text-xs text-muted-foreground">
                Target Sample Rate
              </Label>
              <Select
                value={config.downsample.targetSampleRate.toString()}
                onValueChange={(value) =>
                  updateConfig('downsample', {
                    targetSampleRate: Number.parseInt(value),
                  })
                }
              >
                <SelectTrigger className="h-8 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sampleRates.map((rate) => (
                    <SelectItem key={rate.value} value={rate.value.toString()}>
                      {rate.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Separator className="my-4" />

        {/* Trim Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="trim-toggle" className="text-sm font-medium">
                Trim Audio
              </Label>
              <p className="text-xs text-muted-foreground">
                Cut start/end of audio
              </p>
            </div>
            <Switch
              id="trim-toggle"
              checked={config.trim.enabled}
              onCheckedChange={(checked) =>
                updateConfig('trim', { enabled: checked })
              }
            />
          </div>
          {config.trim.enabled && (
            <div className="ml-0 rounded-md bg-secondary/50 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-2 block text-xs text-muted-foreground">
                    Start (seconds)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={config.trim.startTime}
                    onChange={(e) =>
                      updateConfig('trim', {
                        startTime: Number.parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-8 bg-background font-mono"
                  />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-muted-foreground">
                    End (seconds)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="End of file"
                    value={config.trim.endTime ?? ''}
                    onChange={(e) =>
                      updateConfig('trim', {
                        endTime: e.target.value
                          ? Number.parseFloat(e.target.value)
                          : null,
                      })
                    }
                    className="h-8 bg-background font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator className="my-4" />

        {/* Other Utils */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="normalize-toggle" className="text-sm font-medium">
                Normalize
              </Label>
              <p className="text-xs text-muted-foreground">
                Adjust volume levels
              </p>
            </div>
            <Switch
              id="normalize-toggle"
              checked={config.normalize.enabled}
              onCheckedChange={(checked) =>
                updateConfig('normalize', { enabled: checked })
              }
            />
          </div>

          <Separator className="my-4" />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="mono-toggle" className="text-sm font-medium">
                Convert to Mono
              </Label>
              <p className="text-xs text-muted-foreground">
                Merge stereo channels
              </p>
            </div>
            <Switch
              id="mono-toggle"
              checked={config.mono.enabled}
              onCheckedChange={(checked) =>
                updateConfig('mono', { enabled: checked })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
