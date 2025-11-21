import React, { useState, useRef, useEffect } from 'react';
import { Upload, Music, Languages, Mic2, Play, Pause, Wand2, ChevronRight, ArrowRight, RotateCcw, Download } from 'lucide-react';
import { AppState, SongData, TARGET_LANGUAGES, AnalysisResult, TranslatedLine } from './types';
import { analyzeAudio, translateLyrics, generateDubbedAudio, fileToGenerativePart } from './services/gemini';
import Button from './components/Button';
import AudioVisualizer from './components/AudioVisualizer';

const App = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [songData, setSongData] = useState<SongData>({
    file: null,
    audioUrl: null,
    analysis: null,
    translations: [],
    targetLanguage: 'Spanish',
    dubbedAudioUrl: null
  });
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [isPlayingDubbed, setIsPlayingDubbed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDubbingLoading, setIsDubbingLoading] = useState(false);
  
  const originalAudioRef = useRef<HTMLAudioElement>(null);
  const dubbedAudioRef = useRef<HTMLAudioElement>(null);

  // Reset logic
  const resetApp = () => {
    setState(AppState.IDLE);
    setSongData({
      file: null,
      audioUrl: null,
      analysis: null,
      translations: [],
      targetLanguage: 'Spanish',
      dubbedAudioUrl: null
    });
    setError(null);
    setIsDubbingLoading(false);
  };

  // 1. Handle File Upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB for this demo.");
      return;
    }

    const url = URL.createObjectURL(file);
    setSongData(prev => ({ ...prev, file, audioUrl: url }));
    setError(null);
  };

  // 2. Start Analysis
  const startAnalysis = async () => {
    if (!songData.file) return;
    setState(AppState.ANALYZING);
    try {
      const base64 = await fileToGenerativePart(songData.file);
      const analysis = await analyzeAudio(base64, songData.file.type);
      setSongData(prev => ({ ...prev, analysis }));
      setState(AppState.LYRICS_REVIEW);
    } catch (err: any) {
      setError(err.message || "Analysis failed. Please try again.");
      setState(AppState.IDLE);
    }
  };

  // 3. Start Translation
  const handleTranslate = async () => {
    if (!songData.analysis) return;
    setState(AppState.ANALYZING); // Reuse analyzing state visual or create a new TRANSLATING state
    try {
      const translations = await translateLyrics(
        songData.analysis.lyrics, 
        songData.targetLanguage, 
        songData.analysis.language, 
        songData.analysis.bpm
      );
      setSongData(prev => ({ ...prev, translations }));
      setState(AppState.DUBBING);
    } catch (err: any) {
      setError(err.message || "Translation failed.");
      setState(AppState.LYRICS_REVIEW);
    }
  };

  // 4. Generate Dubbing (TTS)
  const handleDubbing = async () => {
    if (!songData.analysis || songData.translations.length === 0) return;
    
    setIsDubbingLoading(true);
    setError(null);

    try {
        const audioUrl = await generateDubbedAudio(
            songData.translations,
            songData.analysis.gender as 'MALE' | 'FEMALE' | 'UNKNOWN',
            songData.targetLanguage
        );
        
        setSongData(prev => ({ ...prev, dubbedAudioUrl: audioUrl }));
        setState(AppState.COMPLETE);
    } catch (err: any) {
        setError(err.message || "Dubbing generation failed.");
    } finally {
        setIsDubbingLoading(false);
    }
  };

  // Audio Control Handlers
  const toggleOriginal = () => {
    if (originalAudioRef.current) {
      if (isPlayingOriginal) originalAudioRef.current.pause();
      else originalAudioRef.current.play();
      setIsPlayingOriginal(!isPlayingOriginal);
    }
  };

  const toggleDubbed = () => {
    if (dubbedAudioRef.current) {
      if (isPlayingDubbed) dubbedAudioRef.current.pause();
      else dubbedAudioRef.current.play();
      setIsPlayingDubbed(!isPlayingDubbed);
    }
  };

  // Sync play/pause state with actual audio events
  useEffect(() => {
    const aud = originalAudioRef.current;
    const dub = dubbedAudioRef.current;
    
    const onOriginalEnd = () => setIsPlayingOriginal(false);
    const onDubbedEnd = () => setIsPlayingDubbed(false);

    aud?.addEventListener('ended', onOriginalEnd);
    dub?.addEventListener('ended', onDubbedEnd);

    return () => {
      aud?.removeEventListener('ended', onOriginalEnd);
      dub?.removeEventListener('ended', onDubbedEnd);
    };
  }, [songData.audioUrl, songData.dubbedAudioUrl]);


  return (
    <div className="min-h-screen bg-[#0f172a] text-white pb-20">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md fixed top-0 w-full z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">SonicDub AI</span>
          </div>
          <div className="flex gap-4">
            {state !== AppState.IDLE && (
               <Button variant="ghost" onClick={resetApp} className="text-sm py-2 h-9">
                 <RotateCcw className="w-4 h-4 mr-2" />
                 New Project
               </Button>
            )}
            <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm font-medium flex items-center">
               Docs
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-28 max-w-5xl">
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-lg mb-8 flex items-center gap-3 animate-pulse">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            {error}
          </div>
        )}

        {/* STATE: IDLE (Upload) */}
        {state === AppState.IDLE && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in">
             <div className="space-y-4 max-w-2xl">
                <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 pb-2">
                  Break Language Barriers in Music
                </h1>
                <p className="text-slate-400 text-lg">
                  Upload any song. Our AI analyzes the vocal style, translates the lyrics to fit the rhythm, and dubs it into a new language automatically.
                </p>
             </div>

             <div className="w-full max-w-xl">
                <label className="relative group cursor-pointer block">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                  <div className="relative bg-slate-900 border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-xl p-12 flex flex-col items-center justify-center transition-all duration-300">
                     <input 
                       type="file" 
                       accept="audio/*" 
                       onChange={handleFileUpload}
                       className="hidden" 
                     />
                     <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                       <Upload className="w-8 h-8 text-blue-400" />
                     </div>
                     <h3 className="text-xl font-semibold text-white mb-2">Drop your song here</h3>
                     <p className="text-slate-500 text-sm">MP3, WAV, M4A (Max 10MB)</p>
                  </div>
                </label>
             </div>
          </div>
        )}

        {/* Preview Uploaded File Transition */}
        {state === AppState.IDLE && songData.file && (
           <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 p-6 z-40 animate-slide-up">
              <div className="container mx-auto max-w-5xl flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                      <Music className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{songData.file.name}</p>
                      <p className="text-sm text-slate-500">{(songData.file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                 </div>
                 <Button onClick={startAnalysis} icon={<Wand2 className="w-4 h-4"/>}>
                    Analyze Song
                 </Button>
              </div>
           </div>
        )}

        {/* STATE: ANALYZING */}
        {state === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8">
            <div className="relative w-32 h-32">
               <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-t-blue-500 border-r-purple-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
               <div className="absolute inset-0 flex items-center justify-center">
                 <Wand2 className="w-10 h-10 text-slate-400 animate-pulse" />
               </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-white">Analyzing Composition</h2>
              <p className="text-slate-400">Deconstructing rhythm, extracting lyrics, and identifying vocal patterns...</p>
            </div>
          </div>
        )}

        {/* STATE: LYRICS REVIEW */}
        {state === AppState.LYRICS_REVIEW && songData.analysis && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Analysis Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="glass-panel p-6 rounded-2xl col-span-1 md:col-span-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
                 <div>
                   <h2 className="text-sm text-slate-400 uppercase tracking-wider font-semibold mb-1">Detected Style</h2>
                   <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm border border-blue-500/30">{songData.analysis.genre}</span>
                      <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm border border-purple-500/30">{songData.analysis.emotion}</span>
                      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm border border-emerald-500/30">{songData.analysis.bpm} BPM</span>
                      <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm">{songData.analysis.gender} VOCAL</span>
                   </div>
                 </div>
                 <div className="md:w-1/2">
                   <h2 className="text-sm text-slate-400 uppercase tracking-wider font-semibold mb-1">AI Summary</h2>
                   <p className="text-slate-200 text-sm leading-relaxed italic">"{songData.analysis.summary}"</p>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Original Lyrics */}
              <div className="glass-panel rounded-2xl overflow-hidden flex flex-col h-[600px]">
                <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <Mic2 className="w-4 h-4 text-slate-400" />
                     <span className="font-medium text-slate-200">Original Lyrics ({songData.analysis.language})</span>
                   </div>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-4 font-mono text-sm">
                   {songData.analysis.lyrics.map((line, i) => (
                     <p key={i} className="text-slate-300 leading-relaxed hover:text-white transition-colors">{line}</p>
                   ))}
                </div>
              </div>

              {/* Configuration for Translation */}
              <div className="space-y-6">
                 <div className="glass-panel p-6 rounded-2xl space-y-6">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                       <Languages className="w-5 h-5 text-purple-400" />
                       Target Configuration
                    </h3>
                    
                    <div className="space-y-3">
                       <label className="text-sm text-slate-400">Target Language</label>
                       <div className="grid grid-cols-2 gap-2">
                          {TARGET_LANGUAGES.map((lang) => (
                             <button
                               key={lang.code}
                               onClick={() => setSongData(prev => ({...prev, targetLanguage: lang.code}))}
                               className={`p-3 rounded-lg text-sm text-left transition-all ${
                                 songData.targetLanguage === lang.code 
                                 ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 ring-1 ring-blue-400' 
                                 : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                               }`}
                             >
                               {lang.label}
                             </button>
                          ))}
                       </div>
                    </div>

                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-200">
                       <p className="mb-2 font-semibold">AI Dubbing Strategy:</p>
                       <ul className="list-disc list-inside space-y-1 opacity-80">
                          <li>Match {songData.analysis.bpm} BPM rhythm pattern</li>
                          <li>Adapt syllable counts for flow</li>
                          <li>Preserve {songData.analysis.emotion.toLowerCase()} emotional delivery</li>
                       </ul>
                    </div>

                    <Button onClick={handleTranslate} className="w-full" icon={<ArrowRight className="w-4 h-4" />}>
                       Generate Translation
                    </Button>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* STATE: DUBBING (Translation Done, Ready to Synthesize) */}
        {state === AppState.DUBBING && (
           <div className="space-y-8 animate-fade-in">
              <div className="flex items-center justify-between">
                 <h2 className="text-2xl font-bold text-white">Review Translation</h2>
                 <Button onClick={handleDubbing} isLoading={isDubbingLoading} icon={<Mic2 className="w-4 h-4" />}>
                    {isDubbingLoading ? 'Synthesizing Voice...' : 'Start Voice Synthesis'}
                 </Button>
              </div>

              <div className="glass-panel rounded-2xl overflow-hidden">
                 <div className="grid grid-cols-2 border-b border-slate-700/50 bg-slate-800/50 text-xs uppercase tracking-wider font-semibold text-slate-400">
                    <div className="p-4">Original</div>
                    <div className="p-4 text-blue-400">Target ({songData.targetLanguage})</div>
                 </div>
                 <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-800/50">
                    {songData.translations.map((item, idx) => (
                       <div key={idx} className="grid grid-cols-2 hover:bg-slate-800/30 transition-colors group">
                          <div className="p-4 text-slate-400 text-sm group-hover:text-slate-200 transition-colors">
                             {item.original}
                          </div>
                          <div className="p-4 text-white text-sm font-medium">
                             {item.translated}
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        )}

        {/* STATE: COMPLETE */}
        {state === AppState.COMPLETE && songData.dubbedAudioUrl && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
             <div className="text-center space-y-2">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Music className="w-10 h-10 text-green-400" />
                </div>
                <h2 className="text-3xl font-bold text-white">Dubbing Complete</h2>
                <p className="text-slate-400">Your song has been successfully translated and dubbed.</p>
             </div>

             <div className="glass-panel p-8 rounded-3xl space-y-8 shadow-2xl shadow-black/50">
                
                {/* Original Track Player */}
                <div className="space-y-3">
                   <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Original Vocal</span>
                      <span className="text-xs text-slate-600">{songData.analysis?.language}</span>
                   </div>
                   <div className="flex items-center gap-4">
                      <button 
                        onClick={toggleOriginal}
                        className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
                      >
                        {isPlayingOriginal ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-1" />}
                      </button>
                      <div className="flex-1 h-16 bg-slate-900/50 rounded-lg overflow-hidden flex items-center px-2">
                          <AudioVisualizer isPlaying={isPlayingOriginal} color="#64748b" />
                      </div>
                   </div>
                </div>

                {/* Dubbed Track Player */}
                <div className="space-y-3">
                   <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">AI Dubbed Vocal</span>
                      <span className="text-xs text-blue-400">{songData.targetLanguage}</span>
                   </div>
                   <div className="flex items-center gap-4">
                      <button 
                        onClick={toggleDubbed}
                        className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-900/30 transition-all"
                      >
                        {isPlayingDubbed ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-1" />}
                      </button>
                      <div className="flex-1 h-20 bg-slate-900/50 rounded-xl overflow-hidden flex items-center px-2 ring-1 ring-blue-500/20">
                          <AudioVisualizer isPlaying={isPlayingDubbed} color="#3b82f6" />
                      </div>
                   </div>
                </div>

                {/* Download Actions */}
                <div className="pt-6 border-t border-slate-700/50 flex gap-4">
                   <a 
                     href={songData.dubbedAudioUrl} 
                     download={`dubbed_${songData.targetLanguage}.wav`}
                     className="flex-1"
                   >
                      <Button variant="secondary" className="w-full" icon={<Download className="w-4 h-4" />}>
                         Download Dub
                      </Button>
                   </a>
                   <Button variant="ghost" onClick={resetApp}>
                      Create New
                   </Button>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* Hidden Audio Elements */}
      {songData.audioUrl && (
        <audio ref={originalAudioRef} src={songData.audioUrl} />
      )}
      {songData.dubbedAudioUrl && (
        <audio ref={dubbedAudioRef} src={songData.dubbedAudioUrl} />
      )}
    </div>
  );
};

export default App;