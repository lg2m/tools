export type ToolMode = "bulk" | "queue" | "editor";

export type FileStatus = "queued" | "processing" | "complete" | "error";

// === Workflow Types ===
export type AudioWorkflow = "process" | "label";

// === Segment/Label Types (for annotation workflow) ===
export interface AudioSegment {
  id: string;
  start: number;
  end: number;
  label: string;
  color?: string;
  metadata?: Record<string, string>;
}

export interface BaseFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: FileStatus;
  progress: number;
  file: File;
  url: string;
  hasOverrides?: boolean; // track if file has per-file customizations
}

export interface AudioFileData extends BaseFile {
  mediaType: "audio";
  duration?: number;
  sampleRate?: number;
  channels?: number;
  trimOverride?: TrimRegion;
  segments?: AudioSegment[]; // for labeling workflow
  fileLabel?: string; // whole-file classification label
}

export interface ImageFileData extends BaseFile {
  mediaType: "image";
  width?: number;
  height?: number;
  cropOverride?: CropRegion;
  annotations?: Annotation[];
  labels?: string[];
}

export interface VideoFileData extends BaseFile {
  mediaType: "video";
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  trimOverride?: TrimRegion;
  cropOverride?: CropRegion;
  annotations?: TemporalAnnotation[];
}

export type MediaFile = AudioFileData | ImageFileData | VideoFileData;

export interface Annotation {
  id: string;
  type: "bbox" | "polygon" | "point" | "line";
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

export interface TemporalAnnotation extends Annotation {
  frameStart: number;
  frameEnd: number;
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TrimRegion {
  start: number;
  end: number | null;
}

export interface ToolSectionConfig {
  enabled: boolean;
}

export interface ConvertConfig extends ToolSectionConfig {
  outputFormat: string;
  quality?: number;
}

export interface ResizeConfig extends ToolSectionConfig {
  mode: "dimensions" | "percentage" | "maxSize";
  width: number;
  height: number;
  percentage: number;
  maxSize: number;
  maintainAspect: boolean;
}

export interface CropConfig extends ToolSectionConfig {
  mode: "fixed" | "ratio";
  x: number;
  y: number;
  width: number;
  height: number;
  ratioWidth: number;
  ratioHeight: number;
}

export interface NormalizeConfig extends ToolSectionConfig {
  meanR: number;
  meanG: number;
  meanB: number;
  stdR: number;
  stdG: number;
  stdB: number;
}

export interface AugmentConfig extends ToolSectionConfig {
  flipHorizontal: boolean;
  flipVertical: boolean;
  rotate90: boolean;
  grayscale: boolean;
}

export interface PaddingConfig extends ToolSectionConfig {
  size: number;
  color: string;
  mode: "constant" | "reflect" | "replicate";
}

export interface RenameConfig extends ToolSectionConfig {
  pattern: string;
  startIndex: number;
  zeroPadding: number;
}

export interface DownsampleConfig extends ToolSectionConfig {
  targetSampleRate: number;
}

export interface TrimConfig extends ToolSectionConfig {
  startTime: number;
  endTime: number | null;
}

export interface MonoConfig extends ToolSectionConfig {}

export interface AudioNormalizeConfig extends ToolSectionConfig {}
