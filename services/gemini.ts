import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, TranslatedLine, VOICES } from "../types";

// Helper to get AI client
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please set REACT_APP_GEMINI_API_KEY or ensure process.env.API_KEY is available.");
  }
  return new GoogleGenAI({ apiKey });
};

// Convert File to Base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeAudio = async (audioBase64: string, mimeType: string): Promise<AnalysisResult> => {
  const ai = getAiClient();
  
  const prompt = `
    Analyze the provided audio song file meticulously.
    Extract the following information in JSON format:
    1. "language": The detected language of the lyrics.
    2. "genre": The musical genre.
    3. "bpm": Estimated beats per minute (number).
    4. "emotion": The primary emotional tone (e.g., Romantic, Aggressive, Melancholic).
    5. "gender": The perceived gender of the lead singer (MALE, FEMALE, or UNKNOWN).
    6. "lyrics": An array of strings, where each string is a line of the lyrics extracted from the audio.
    7. "summary": A brief 1-sentence summary of the vocal performance style.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            language: { type: Type.STRING },
            genre: { type: Type.STRING },
            bpm: { type: Type.NUMBER },
            emotion: { type: Type.STRING },
            gender: { type: Type.STRING, enum: ['MALE', 'FEMALE', 'UNKNOWN'] },
            lyrics: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING }
          },
          required: ['language', 'genre', 'bpm', 'emotion', 'gender', 'lyrics', 'summary']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from analysis model");
    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

export const translateLyrics = async (
  lyrics: string[],
  targetLanguage: string,
  originalLanguage: string,
  bpm: number
): Promise<TranslatedLine[]> => {
  const ai = getAiClient();
  
  const prompt = `
    Act as a professional song lyricist and translator.
    Translate the following song lyrics from ${originalLanguage} to ${targetLanguage}.
    
    CRITICAL CONSTRAINTS:
    1. Maintain the original rhythm and syllable count as closely as possible to fit the beat (${bpm} BPM).
    2. Match the rhyme scheme if possible without losing meaning.
    3. The translated lines must be singable.
    
    Input Lyrics:
    ${JSON.stringify(lyrics)}

    Output a JSON array of objects with "original" and "translated" keys.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              original: { type: Type.STRING },
              translated: { type: Type.STRING }
            },
            required: ['original', 'translated']
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from translation model");
    return JSON.parse(text) as TranslatedLine[];

  } catch (error) {
    console.error("Translation failed:", error);
    throw error;
  }
};

const createWavUrl = (pcmBase64: string): string => {
  const byteCharacters = atob(pcmBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const pcmData = new Uint8Array(byteNumbers);

  // WAV Header params for Gemini 2.5 Flash TTS (24kHz, Mono, 16-bit)
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.length, true);

  const blob = new Blob([header, pcmData], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

export const generateDubbedAudio = async (
  lines: TranslatedLine[],
  gender: 'MALE' | 'FEMALE' | 'UNKNOWN',
  targetLanguage: string
): Promise<string> => {
  const ai = getAiClient();
  
  // Combine lyrics into a single text block for TTS
  const textToSpeak = lines.map(l => l.translated).join('\n');

  // Select voice based on gender
  let voiceName = VOICES.NEUTRAL;
  if (gender === 'MALE') voiceName = VOICES.MALE;
  if (gender === 'FEMALE') voiceName = VOICES.FEMALE;

  try {
    // Use the array structure for contents as per SDK requirements for some models
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [
        { parts: [{ text: textToSpeak }] }
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName
            }
          }
        },
        // Disable safety settings to prevent refusal of song lyrics
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
      }
    });

    const candidate = response.candidates?.[0];

    // Check for text refusal first
    if (candidate?.content?.parts?.[0]?.text) {
        console.warn("Model returned text instead of audio:", candidate.content.parts[0].text);
    }

    const base64Audio = candidate?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      if (candidate?.content?.parts?.[0]?.text) {
         throw new Error(`Model refused or failed to generate audio: ${candidate.content.parts[0].text}`);
      }
      const finishReason = candidate?.finishReason || 'UNKNOWN';
      throw new Error(`No audio data generated. Model finish reason: ${finishReason}.`);
    }

    return createWavUrl(base64Audio);

  } catch (error) {
    console.error("Dubbing failed:", error);
    throw error;
  }
};