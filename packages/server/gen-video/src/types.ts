export type FixtureCategory = 'standard' | 'hostile';

export interface FixtureDefinition {
  id: string;
  filename: string;
  description: string;
  category: FixtureCategory;
  slow: boolean;
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  rotate?: number;
  videoCodec?: string;
  audioCodec?: string;
  sha256?: string;
}

export interface FixtureManifest {
  version: string;
  description: string;
  fixtures: FixtureDefinition[];
}

export interface GeneratorOptions {
  outputDir: string;
  includeSlow?: boolean;
  only?: string;
  quiet?: boolean;
}

export interface ProbeStream {
  codec_type: 'video' | 'audio';
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  duration?: string;
  tags?: Record<string, string>;
  side_data_list?: Array<{ rotation?: number }>;
}

export interface ProbeFormat {
  filename?: string;
  format_name?: string;
  duration?: string;
  size?: string;
  tags?: Record<string, string>;
}

export interface ProbeResult {
  streams: ProbeStream[];
  format: ProbeFormat;
}

export interface CheckResult {
  id: string;
  filename: string;
  passed: boolean;
  message: string;
}
