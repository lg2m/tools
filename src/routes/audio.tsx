import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';

import type { AudioFile, ToolConfig } from '@/types/audio';
import { FileDropzone } from '@/components/audio/file-dropzone';
import { FileQueue } from '@/components/audio/file-queue';
import { ProcessingControls } from '@/components/audio/processing-controls';
import { ToolSettings } from '@/components/audio/tool-settings';
import { WaveformEditor } from '@/components/audio/waveform-editor';

export const Route = createFileRoute('/audio')({
  component: RouteComponent,
});

function RouteComponent() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [config, setConfig] = useState<ToolConfig>({
    convert: { enabled: true, outputFormat: 'wav' },
    downsample: { enabled: false, targetSampleRate: 16000 },
    trim: { enabled: false, startTime: 0, endTime: null },
    normalize: { enabled: false },
    mono: { enabled: false },
  });

  const handleFilesAdded = (newFiles: File[]) => {
    const audioFiles: AudioFile[] = newFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'queued',
      progress: 0,
      file: file,
    }));
    setFiles((prev) => [...prev, ...audioFiles]);
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAll = () => {
    setFiles([]);
  };

  const handleClearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== 'complete'));
  };

  const handleEditFile = (id: string) => {
    setEditingFileId(id);
  };

  const handleSaveTrim = (start: number, end: number | null) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === editingFileId ? { ...f, trimOverride: { start, end } } : f,
      ),
    );
    setEditingFileId(null);
  };

  const editingFile = files.find((f) => f.id === editingFileId);

  if (editingFile) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <WaveformEditor
          file={editingFile.file}
          initialTrimStart={
            editingFile.trimOverride?.start ?? config.trim.startTime
          }
          initialTrimEnd={editingFile.trimOverride?.end ?? config.trim.endTime}
          onSave={handleSaveTrim}
          onCancel={() => setEditingFileId(null)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold">Audio Tools</h1>
        <p className="text-sm text-muted-foreground">
          Convert, downsample, trim, and process audio files in bulk. All
          processing happens locally in your browser.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <FileDropzone onFilesAdded={handleFilesAdded} />
          <FileQueue
            files={files}
            onRemoveFile={handleRemoveFile}
            onClearAll={handleClearAll}
            onClearCompleted={handleClearCompleted}
            onEditFile={handleEditFile}
          />
        </div>
        <div className="flex flex-col gap-6">
          <ToolSettings config={config} onConfigChange={setConfig} />
          <ProcessingControls files={files} config={config} />
        </div>
      </div>
    </div>
  );
}
