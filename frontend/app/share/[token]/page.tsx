'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { Video, Play, Pause, Lock, Loader2, AlertTriangle, Download } from 'lucide-react';

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

  const [clip, setClip] = useState<any>(null);
  const [error, setError] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const fetchClip = async (pwd?: string) => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get(`/clips/share/${token}${pwd ? `?password=${encodeURIComponent(pwd)}` : ''}`);
      setClip(data.clip);
      setIsProtected(false);
    } catch (err: any) {
      const d = err.response?.data;
      if (d?.is_protected) { setIsProtected(true); setError(d.error || ''); }
      else if (err.response?.status === 410) setError('Ce lien de partage a expiré.');
      else if (err.response?.status === 404) setError('Clip introuvable ou lien invalide.');
      else setError('Impossible de charger ce clip.');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (token) fetchClip(); }, [token]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <Loader2 size={32} className="text-blue-500 animate-spin" />
    </div>
  );

  if (isProtected) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 flex items-center justify-center p-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
          <Lock size={24} className="text-yellow-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Clip protégé</h2>
        {clip?.title && <p className="text-gray-400 text-sm mb-4">{clip.title}</p>}
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <form onSubmit={e => { e.preventDefault(); fetchClip(password); }} className="space-y-3">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors" />
          <button type="submit"
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 rounded-lg transition-colors">
            Accéder au clip
          </button>
        </form>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <AlertTriangle size={40} className="text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Clip indisponible</h2>
        <p className="text-gray-400">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <nav className="border-b border-white/10 bg-black/40 px-6 py-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
          <Video size={14} className="text-white" />
        </div>
        <span className="font-bold text-white">JT-Meet</span>
        <span className="text-gray-600 ml-1">·</span>
        <span className="text-gray-400 text-sm truncate">{clip?.title}</span>
      </nav>

      {/* Video */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <div className="w-full max-w-3xl">
          <div className="bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center relative group">
            <video ref={videoRef}
              src={`${API_URL}/uploads/${clip?.filename}`}
              className="w-full h-full object-contain"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              controls
            />
            {!isPlaying && (
              <button onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center group-hover:opacity-100 opacity-100 bg-black/30 transition-opacity">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-xl shadow-blue-600/40">
                  <Play size={28} className="text-white ml-1" />
                </div>
              </button>
            )}
          </div>

          {/* Info */}
          <div className="mt-4 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-white mb-1">{clip?.title}</h1>
              <p className="text-sm text-gray-400">
                Partagé par <span className="text-white">{clip?.creator_name}</span>
                {clip?.created_at && ` · ${new Date(clip.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`}
              </p>
              {clip?.views_count !== undefined && (
                <p className="text-xs text-gray-600 mt-1">{clip.views_count} vue{clip.views_count !== 1 ? 's' : ''}</p>
              )}
            </div>
            <a href={`${API_URL}/uploads/${clip?.filename}`} download
              className="flex items-center gap-2 text-sm bg-white/5 border border-white/10 hover:border-white/30 text-gray-300 hover:text-white px-4 py-2 rounded-lg transition-colors">
              <Download size={16} /> Télécharger
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
