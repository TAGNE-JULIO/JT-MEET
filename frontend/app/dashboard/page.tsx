'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import {
  Video, Plus, Calendar, Clock, Users, Clipboard,
  LogOut, ChevronRight, CheckCircle2, Film
} from 'lucide-react';

interface Meeting {
  id: string; code: string; title: string; status: string;
  scheduled_start?: string; started_at?: string; ended_at?: string;
  created_at: string;
}

interface Recording {
  id: string; title: string; duration: number; created_at: string;
  meeting_title?: string; filename: string;
}

export default function DashboardPage() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState<'meetings' | 'recordings'>('meetings');

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      api.get('/meetings/my-meetings').then(r => setMeetings(r.data.meetings || [])).catch(() => {});
      api.get('/recordings/my-recordings').then(r => setRecordings(r.data.recordings || [])).catch(() => {});
    }
  }, [user]);

  const createInstantMeeting = async () => {
    setCreating(true);
    try {
      const { data } = await api.post('/meetings', { title: 'Réunion instantanée' });
      router.push(`/meet/${data.meeting.code}`);
    } catch { setCreating(false); }
  };

  const joinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) router.push(`/meet/${joinCode.trim()}`);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m}m ${s}s`;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      scheduled: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      ended: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    const labels: Record<string, string> = { active: 'En cours', scheduled: 'Planifiée', ended: 'Terminée' };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${map[status] || map.ended}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading || !user) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-black/40 border-r border-white/10 flex flex-col p-4 gap-2">
        <div className="flex items-center gap-2 px-2 py-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <Video size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white">JT-Meet</span>
        </div>

        {[
          { label: 'Réunions', icon: Calendar, tab: 'meetings' },
          { label: 'Enregistrements', icon: Film, tab: 'recordings' },
        ].map(({ label, icon: Icon, tab: t }) => (
          <button key={t} onClick={() => setTab(t as typeof tab)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === t
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            <Icon size={18} /> {label}
          </button>
        ))}

        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="px-3 py-2 mb-2">
            <p className="text-white font-medium text-sm truncate">{user.name}</p>
            <p className="text-gray-500 text-xs truncate">{user.email}</p>
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-8">
            Bonjour, <span className="text-blue-400">{user.name.split(' ')[0]}</span> 👋
          </h1>

          {/* Quick actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            <button onClick={createInstantMeeting} disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-2xl p-6 text-left transition-all transform hover:scale-[1.01] shadow-lg shadow-blue-600/20">
              <Plus size={28} className="mb-3" />
              <h3 className="text-lg font-bold mb-1">Nouvelle réunion</h3>
              <p className="text-blue-200 text-sm">{creating ? 'Création en cours...' : 'Démarrer instantanément'}</p>
            </button>

            <form onSubmit={joinMeeting} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors">
              <Clipboard size={28} className="text-gray-400 mb-3" />
              <h3 className="text-lg font-bold text-white mb-3">Rejoindre une réunion</h3>
              <div className="flex gap-2">
                <input value={joinCode} onChange={e => setJoinCode(e.target.value)}
                  placeholder="Code de la réunion"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors" />
                <button type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>
            </form>
          </div>

          {/* Tabs content */}
          {tab === 'meetings' && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar size={20} className="text-blue-400" /> Mes réunions
              </h2>
              {meetings.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Aucune réunion pour l'instant.</p>
                  <p className="text-sm mt-1">Créez votre première réunion !</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {meetings.map(m => (
                    <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-blue-500/30 transition-colors">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-white font-medium">{m.title}</span>
                          {statusBadge(m.status)}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="font-mono bg-white/5 px-2 py-0.5 rounded">{m.code}</span>
                          <span className="flex items-center gap-1"><Clock size={12} />
                            {new Date(m.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      {m.status !== 'ended' && (
                        <Link href={`/meet/${m.code}`}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5">
                          <Video size={14} /> Rejoindre
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'recordings' && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Film size={20} className="text-blue-400" /> Mes enregistrements
              </h2>
              {recordings.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Film size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Aucun enregistrement pour l'instant.</p>
                  <p className="text-sm mt-1">Les enregistrements de vos réunions apparaîtront ici.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recordings.map(r => (
                    <div key={r.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-blue-500/30 transition-colors">
                      <div>
                        <p className="text-white font-medium mb-1">{r.title}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(r.duration)}</span>
                          <span>{r.meeting_title}</span>
                          <span>{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                      <Link href={`/recordings/${r.id}`}
                        className="border border-white/20 hover:border-blue-500/50 text-gray-300 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
                        <Film size={14} /> Voir & Clips
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
