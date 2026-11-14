'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import {
  ArrowLeft, Scissors, Share2, Download, Play, Pause,
  Copy, Check, Lock, Clock, Film, Loader2
} from 'lucide-react';

interface Recording {
  id: string; title: string; duration: number; filename: string;
  file_path: string; created_at: string; meeting_title?: string;
}
interface Clip {
  id: string; title: string; start_time: number; end_time: number;
  duration: number; share_token: string; filename: string; created_at: string;
}

export default function RecordingPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

  const [recording, setRecording] = useState<Recording | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);
  const [clipTitle, setClipTitle] = useState('');
  const [clipPassword, setClipPassword] = useState('');
  const [clipExpiry, setClipExpiry] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copiedToken, setCopiedToken] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !id) return;
    api.get(`/recordings/${id}`).then(r => {
      setRecording(r.data.recording);
    }).catch(() => router.push('/dashboard'));
    api.get('/clips/my-clips').then(r => {
      setClips((r.data.clips || []).filter((c: Clip & { recording_id: string }) => c.recording_id === id));
    }).catch(() => {});
  }, [user, id]);

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const d = videoRef.current.duration;
      setDuration(isFinite(d) ? d : recording?.duration || 0);
      setClipEnd(isFinite(d) ? Math.round(d) : recording?.duration || 0);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const seekTo = (secs: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = secs;
      setCurrentTime(secs);
    }
  };

  const setInPoint = () => {
    setClipStart(Math.round(currentTime));
    if (Math.round(currentTime) >= clipEnd) setClipEnd(Math.min(Math.round(currentTime) + 30, Math.round(duration)));
  };
  const setOutPoint = () => setClipEnd(Math.round(currentTime));

  const createClip = async () => {
    if (clipEnd <= clipStart) { setError('Le point de sortie doit être après le point d\'entrée.'); return; }
    setError(''); setCreating(true);
    try {
      const { data } = await api.post('/clips', {
        recording_id: id,
        title: clipTitle || `Extrait ${formatTime(clipStart)} – ${formatTime(clipEnd)}`,
        start_time: clipStart,
        end_time: clipEnd,
        is_public: true,
        password: clipPassword || undefined,
        expires_in_days: clipExpiry ? parseInt(clipExpiry) : undefined,
      });
      setClips(prev => [data.clip, ...prev]);
      setClipTitle(''); setClipPassword(''); setClipExpiry('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la création du clip.');
    } finally { setCreating(false); }
  };

  const copyShareLink = (token: string) => {
    const link = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(''), 2000);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading || !user || !recording) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{recording.title}</h1>
            <p className="text-gray-400 text-sm">{recording.meeting_title} · {new Date(recording.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
              <video ref={videoRef}
                src={`${API_URL}/uploads/${recording.filename}`}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="w-full h-full object-contain"
                controls={false}
              />
            </div>

            {/* Timeline */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors">
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <span className="text-sm text-gray-400 font-mono">
                  {formatTime(currentTime)} / {formatTime(duration || recording.duration)}
                </span>
              </div>

              {/* Seek bar */}
              <div className="relative h-2 bg-white/10 rounded-full cursor-pointer"
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  seekTo(ratio * (duration || recording.duration));
                }}>
                {/* Clip range highlight */}
                <div className="absolute h-full bg-blue-500/30 rounded-full"
                  style={{
                    left: `${((clipStart / (duration || recording.duration || 1)) * 100)}%`,
                    width: `${(((clipEnd - clipStart) / (duration || recording.duration || 1)) * 100)}%`
                  }} />
                {/* Playhead */}
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md"
                  style={{ left: `calc(${(currentTime / (duration || recording.duration || 1)) * 100}% - 6px)` }} />
              </div>

              {/* Clip range controls */}
              <div className="flex items-center gap-3 pt-1">
                <button onClick={setInPoint}
                  className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg hover:bg-blue-600/40 transition-colors flex items-center gap-1.5">
                  <Scissors size={12} /> IN: {formatTime(clipStart)}
                </button>
                <div className="flex-1 h-px bg-white/10" />
                <button onClick={setOutPoint}
                  className="text-xs bg-purple-600/20 text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded-lg hover:bg-purple-600/40 transition-colors flex items-center gap-1.5">
                  <Scissors size={12} /> OUT: {formatTime(clipEnd)}
                </button>
                <span className="text-xs text-gray-500 ml-1">
                  Durée: <span className="text-white font-medium">{formatTime(clipEnd - clipStart)}</span>
                </span>
              </div>
            </div>

            {/* Clip creator */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Scissors size={18} className="text-blue-400" /> Créer un extrait (Clip)
              </h3>
              {error && <p className="text-red-400 text-sm mb-3 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
              <div className="space-y-3">
                <input value={clipTitle} onChange={e => setClipTitle(e.target.value)}
                  placeholder={`Titre (optionnel) — Extrait ${formatTime(clipStart)}–${formatTime(clipEnd)}`}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input value={clipPassword} onChange={e => setClipPassword(e.target.value)}
                      placeholder="Mot de passe (optionnel)"
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  <div className="relative">
                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <select value={clipExpiry} onChange={e => setClipExpiry(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none">
                      <option value="">Pas d'expiration</option>
                      <option value="1">Expire dans 1 jour</option>
                      <option value="7">Expire dans 7 jours</option>
                      <option value="30">Expire dans 30 jours</option>
                    </select>
                  </div>
                </div>
                <button onClick={createClip} disabled={creating || clipEnd <= clipStart}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                  {creating ? <><Loader2 size={16} className="animate-spin" /> Génération du clip...</> : <><Scissors size={16} /> Générer le clip & lien de partage</>}
                </button>
              </div>
            </div>
          </div>

          {/* Clips list */}
          <div>
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Film size={18} className="text-blue-400" /> Clips créés ({clips.length})
            </h3>
            <div className="space-y-3">
              {clips.length === 0 ? (
                <div className="text-center py-10 text-gray-500 bg-white/5 border border-white/10 rounded-2xl">
                  <Scissors size={30} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucun clip. Utilisez la timeline<br />pour créer votre premier extrait.</p>
                </div>
              ) : clips.map(clip => (
                <div key={clip.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-blue-500/30 transition-colors">
                  <p className="text-white font-medium text-sm mb-1 truncate">{clip.title}</p>
                  <p className="text-xs text-gray-500 mb-3">
                    {formatTime(clip.start_time)} → {formatTime(clip.end_time)} · {formatTime(clip.duration)}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => copyShareLink(clip.share_token)}
                      className="flex-1 text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg hover:bg-blue-600/40 transition-colors flex items-center justify-center gap-1.5">
                      {copiedToken === clip.share_token ? <><Check size={12} /> Copié !</> : <><Copy size={12} /> Copier le lien</>}
                    </button>
                    <a href={`${API_URL}/uploads/${clip.filename}`} download
                      className="text-xs bg-white/5 border border-white/10 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                      <Download size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
