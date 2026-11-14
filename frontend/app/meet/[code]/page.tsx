'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import api from '@/lib/api';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare,
  Monitor, Hand, Smile, Circle, Square, Users, ChevronRight
} from 'lucide-react';

interface Participant {
  socketId: string; userId: string; userName: string;
  isHost: boolean; isAudioMuted: boolean; isVideoOff: boolean; handRaised: boolean;
}
interface ChatMessage { id: string; senderName: string; message: string; timestamp: string; }
interface Reaction { id: string; emoji: string; senderName: string; }

const EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🎉', '🙏', '🔥'];

export default function MeetRoom() {
  const { code } = useParams<{ code: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [chatMsg, setChatMsg] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const [meetingInfo, setMeetingInfo] = useState<any>(null);
  const [recordingStart, setRecordingStart] = useState<number>(0);

  const socket = connectSocket();

  // --- Media Setup ---
  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/auth/login'); return; }

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = audioOnly;
          setIsVideoOff(true);
        } catch { console.error('No media available'); }
      }
      // Load meeting info
      try {
        const { data } = await api.get(`/meetings/${code}`);
        setMeetingInfo(data.meeting);
      } catch {}
      // Join socket room
      socket.emit('join-room', {
        roomId: code,
        userId: user.id,
        userName: user.name,
        isHost: false,
      });
    };
    start();
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peerConnections.current.forEach(pc => pc.close());
      socket.emit('disconnect-room', { roomId: code });
      disconnectSocket();
    };
  }, [loading, user]);

  // --- Socket events ---
  useEffect(() => {
    socket.on('room-users', ({ users }: { users: Participant[], you: Participant }) => {
      const map = new Map<string, Participant>();
      users.forEach(u => map.set(u.socketId, u));
      setParticipants(map);
    });

    socket.on('user-connected', ({ user: newUser }: { user: Participant }) => {
      setParticipants(prev => new Map(prev).set(newUser.socketId, newUser));
      // Send offer to new peer
      createOffer(newUser.socketId);
    });

    socket.on('user-disconnected', ({ socketId }: { socketId: string }) => {
      setParticipants(prev => { const m = new Map(prev); m.delete(socketId); return m; });
      setRemoteStreams(prev => { const m = new Map(prev); m.delete(socketId); return m; });
      peerConnections.current.get(socketId)?.close();
      peerConnections.current.delete(socketId);
    });

    socket.on('signal-offer', async ({ callerSocketId, offer }: any) => {
      const pc = createPeerConnection(callerSocketId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('signal-answer', { targetSocketId: callerSocketId, answer });
    });

    socket.on('signal-answer', async ({ responderSocketId, answer }: any) => {
      const pc = peerConnections.current.get(responderSocketId);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async ({ senderSocketId, candidate }: any) => {
      const pc = peerConnections.current.get(senderSocketId);
      if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('new-message', (msg: ChatMessage) => setChat(prev => [...prev, msg]));

    socket.on('new-reaction', (rx: Reaction) => {
      setReactions(prev => [...prev, rx]);
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== rx.id)), 3000);
    });

    socket.on('user-hand-toggled', ({ socketId, userName, handRaised }: any) => {
      setParticipants(prev => {
        const m = new Map(prev);
        const p = m.get(socketId);
        if (p) m.set(socketId, { ...p, handRaised });
        return m;
      });
    });

    return () => {
      socket.off('room-users'); socket.off('user-connected'); socket.off('user-disconnected');
      socket.off('signal-offer'); socket.off('signal-answer'); socket.off('ice-candidate');
      socket.off('new-message'); socket.off('new-reaction'); socket.off('user-hand-toggled');
    };
  }, []);

  const createPeerConnection = (remoteSocketId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('ice-candidate', { targetSocketId: remoteSocketId, candidate });
    };
    pc.ontrack = ({ streams: [stream] }) => {
      setRemoteStreams(prev => new Map(prev).set(remoteSocketId, stream));
    };
    peerConnections.current.set(remoteSocketId, pc);
    return pc;
  };

  const createOffer = async (remoteSocketId: string) => {
    const pc = createPeerConnection(remoteSocketId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('signal-offer', {
      targetSocketId: remoteSocketId,
      offer,
      callerData: { userId: user?.id, userName: user?.name }
    });
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = isMuted; });
    setIsMuted(!isMuted);
    socket.emit('toggle-media', { isAudioMuted: !isMuted, isVideoOff });
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach(t => { t.enabled = isVideoOff; });
    setIsVideoOff(!isVideoOff);
    socket.emit('toggle-media', { isAudioMuted: isMuted, isVideoOff: !isVideoOff });
  };

  const toggleHand = () => {
    const raised = !handRaised;
    setHandRaised(raised);
    socket.emit('toggle-hand', { raised });
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    socket.emit('send-message', { roomId: code, message: chatMsg.trim() });
    setChatMsg('');
  };

  const sendReaction = (emoji: string) => {
    socket.emit('send-reaction', { roomId: code, emoji });
    setShowEmojis(false);
  };

  const startRecording = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
    recordedChunksRef.current = [];
    mr.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
    mr.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const duration = Math.round((Date.now() - recordingStart) / 1000);
      const formData = new FormData();
      formData.append('video', blob, `rec-${code}-${Date.now()}.webm`);
      formData.append('meeting_id', meetingInfo?.id || code);
      formData.append('title', `${meetingInfo?.title || 'Réunion'} — ${new Date().toLocaleDateString('fr-FR')}`);
      formData.append('duration', String(duration));
      try { await api.post('/recordings/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }); }
      catch { console.error('Failed to upload recording'); }
    };
    mr.start(1000);
    mediaRecorderRef.current = mr;
    setIsRecording(true);
    setRecordingStart(Date.now());
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const leaveMeeting = () => {
    if (isRecording) stopRecording();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    peerConnections.current.forEach(pc => pc.close());
    disconnectSocket();
    router.push('/dashboard');
  };

  const allParticipants = Array.from(participants.values());

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Video Grid */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-4">
          <div className={`grid gap-3 h-full ${
            allParticipants.length === 0 ? 'grid-cols-1' :
            allParticipants.length <= 2 ? 'grid-cols-2' :
            allParticipants.length <= 6 ? 'grid-cols-3' : 'grid-cols-4'
          }`}>
            {/* Local video */}
            <div className="relative bg-gray-800 rounded-2xl overflow-hidden flex items-center justify-center">
              <video ref={localVideoRef} autoPlay muted playsInline
                className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`} />
              {isVideoOff && (
                <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold text-white">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-lg backdrop-blur-sm">
                  {user?.name} (Vous)
                </span>
                {isMuted && <MicOff size={14} className="text-red-400 bg-black/60 rounded p-0.5" />}
                {handRaised && <span className="text-sm">✋</span>}
              </div>
            </div>

            {/* Remote videos */}
            {allParticipants.map(p => (
              <RemoteVideo key={p.socketId} participant={p} stream={remoteStreams.get(p.socketId)} />
            ))}
          </div>
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <aside className="w-80 bg-gray-900 border-l border-white/10 flex flex-col">
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold flex items-center gap-2">
                  <MessageSquare size={16} /> Chat
                  <span className="text-xs text-gray-500">({allParticipants.length + 1} participant{allParticipants.length !== 0 ? 's' : ''})</span>
                </span>
                <button onClick={() => setShowChat(false)} className="text-gray-500 hover:text-white">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chat.map(msg => (
                <div key={msg.id}>
                  <p className="text-xs text-gray-500 mb-0.5">
                    {msg.senderName} · {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-sm text-gray-200 bg-white/5 rounded-xl px-3 py-2">{msg.message}</p>
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t border-white/10 flex gap-2">
              <input value={chatMsg} onChange={e => setChatMsg(e.target.value)}
                placeholder="Message..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors" />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors">
                <ChevronRight size={16} />
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* Floating Reactions */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 pointer-events-none flex gap-3 z-50">
        {reactions.map(rx => (
          <div key={rx.id} className="text-4xl animate-bounce flex flex-col items-center gap-1">
            {rx.emoji}
            <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full">{rx.senderName}</span>
          </div>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="bg-gray-900 border-t border-white/10 px-6 py-4 flex items-center justify-between">
        {/* Meeting info */}
        <div className="hidden md:block text-xs text-gray-500 font-mono">
          {meetingInfo?.title || code}
          <span className="ml-2 bg-white/5 rounded px-2 py-0.5">{code}</span>
          {isRecording && (
            <span className="ml-2 flex items-center gap-1 text-red-400 animate-pulse">
              <Circle size={8} className="fill-red-400" /> REC
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mx-auto">
          <ControlButton onClick={toggleMute} active={isMuted} label={isMuted ? 'Activer micro' : 'Couper micro'} danger={isMuted}>
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </ControlButton>

          <ControlButton onClick={toggleVideo} active={isVideoOff} label={isVideoOff ? 'Activer caméra' : 'Couper caméra'} danger={isVideoOff}>
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </ControlButton>

          <ControlButton onClick={toggleHand} active={handRaised} label="Lever la main">
            <Hand size={20} />
          </ControlButton>

          <div className="relative">
            <ControlButton onClick={() => setShowEmojis(s => !s)} label="Réactions">
              <Smile size={20} />
            </ControlButton>
            {showEmojis && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-gray-800 border border-white/10 rounded-2xl p-3 flex gap-2 shadow-xl">
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => sendReaction(e)}
                    className="text-2xl hover:scale-125 transition-transform">{e}</button>
                ))}
              </div>
            )}
          </div>

          <ControlButton onClick={isRecording ? stopRecording : startRecording}
            active={isRecording} danger={isRecording} label={isRecording ? 'Arrêter REC' : 'Enregistrer'}>
            {isRecording ? <Square size={20} /> : <Circle size={20} />}
          </ControlButton>

          {!showChat && (
            <ControlButton onClick={() => setShowChat(true)} label="Chat">
              <MessageSquare size={20} />
            </ControlButton>
          )}

          <button onClick={leaveMeeting}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors shadow-lg shadow-red-600/30 ml-2">
            <PhoneOff size={20} />
          </button>
        </div>

        <div className="hidden md:flex items-center gap-1 text-xs text-gray-500">
          <Users size={14} /> {allParticipants.length + 1}
        </div>
      </div>
    </div>
  );
}

function ControlButton({ children, onClick, active, danger, label }: {
  children: React.ReactNode; onClick: () => void;
  active?: boolean; danger?: boolean; label?: string;
}) {
  return (
    <button onClick={onClick} title={label}
      className={`rounded-full w-11 h-11 flex items-center justify-center transition-all ${
        danger ? 'bg-red-600/20 text-red-400 hover:bg-red-600/40' :
        active ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/40' :
        'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
      }`}>
      {children}
    </button>
  );
}

function RemoteVideo({ participant, stream }: { participant: Participant; stream?: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative bg-gray-800 rounded-2xl overflow-hidden flex items-center justify-center">
      {stream ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-2xl font-bold text-white">
          {participant.userName[0]?.toUpperCase()}
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-lg backdrop-blur-sm">
          {participant.userName}
        </span>
        {participant.isAudioMuted && <MicOff size={12} className="text-red-400" />}
        {participant.handRaised && <span className="text-sm">✋</span>}
      </div>
    </div>
  );
}
