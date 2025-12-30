export type ToolConfig = {
  convert: {
    enabled: boolean;
    outputFormat: string;
  };
  downsample: {
    enabled: boolean;
    targetSampleRate: number;
  };
  trim: {
    enabled: boolean;
    startTime: number;
    endTime: number | null;
  };
  normalize: {
    enabled: boolean;
  };
  mono: {
    enabled: boolean;
  };
};

export type AudioFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "queued" | "processing" | "complete" | "error";
  progress: number;
  file: File;
  trimOverride?: {
    start: number;
    end: number | null;
  };
  result?: {
    blob: Blob;
    filename: string;
    mimeType: string;
  };
  error?: string;
};
