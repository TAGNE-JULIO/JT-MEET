'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Video, Users, Zap, Shield, ArrowRight, Play } from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950">
      {/* Navbar */}
      <nav className="border-b border-white/10 backdrop-blur-sm bg-black/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <Video size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white">JT-Meet</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Link href="/dashboard"
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
                Dashboard <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link href="/auth/login" className="text-gray-300 hover:text-white transition-colors">
                  Connexion
                </Link>
                <Link href="/auth/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition-colors">
                  Commencer gratuitement
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-full px-4 py-1.5 text-sm text-blue-400 mb-8">
          <Zap size={14} /> Visioconférence nouvelle génération
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight tracking-tight">
          Réunissez votre équipe.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            Capturez l'essentiel.
          </span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          JT-Meet — Visioconférence HD, chat en temps réel, enregistrement des sessions,
          découpage de clips vidéo et partage instantané par lien sécurisé.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href={user ? "/dashboard" : "/auth/register"}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 flex items-center gap-2 shadow-lg shadow-blue-600/30">
            <Play size={20} /> Démarrer une réunion
          </Link>
          <Link href="/join"
            className="border border-white/20 hover:border-white/40 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors">
            Rejoindre avec un code
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { icon: Video, title: "Vidéo HD", desc: "Qualité adaptative WebRTC avec gestion automatique de la bande passante." },
          { icon: Users, title: "Collaboration", desc: "Chat, réactions emoji, tableau blanc partagé et éditeur de code collaboratif." },
          { icon: Play, title: "Clips & Export", desc: "Enregistrez, découpez des extraits et partagez par lien sécurisé avec expiration." },
          { icon: Shield, title: "Sécurisé", desc: "Authentification JWT, liens protégés par mot de passe et verrouillage de salle." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 hover:border-blue-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
              <Icon size={22} className="text-blue-400" />
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
