export interface AudioFile {
  id: string;
  name: string;
  url: string;
  duration: number;
  format: string;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  trimStart?: number;
  trimEnd?: number;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  hotkey: string;
}

export interface Annotation {
  id: string;
  fileId: string;
  labelId: string;
  startTime: number;
  endTime: number;
}
