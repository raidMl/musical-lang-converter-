export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  LYRICS_REVIEW = 'LYRICS_REVIEW',
  DUBBING = 'DUBBING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface AnalysisResult {
  language: string;
  genre: string;
  bpm: number;
  emotion: string;
  gender: 'MALE' | 'FEMALE' | 'UNKNOWN';
  lyrics: string[];
  summary: string;
}

export interface TranslatedLine {
  original: string;
  translated: string;
}

export interface SongData {
  file: File | null;
  audioUrl: string | null;
  analysis: AnalysisResult | null;
  translations: TranslatedLine[];
  targetLanguage: string;
  dubbedAudioUrl: string | null;
}

export const TARGET_LANGUAGES = [
  { code: 'Spanish', label: 'Spanish (Español)' },
  { code: 'French', label: 'French (Français)' },
  { code: 'German', label: 'German (Deutsch)' },
  { code: 'Japanese', label: 'Japanese (日本語)' },
  { code: 'Korean', label: 'Korean (한국어)' },
  { code: 'Chinese', label: 'Chinese (中文)' },
  { code: 'Italian', label: 'Italian (Italiano)' },
  { code: 'Portuguese', label: 'Portuguese (Português)' },
];

export const VOICES = {
  MALE: 'Fenrir',
  FEMALE: 'Kore',
  NEUTRAL: 'Puck'
};