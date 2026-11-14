/**
 * JT-Meet Real-Time WebRTC Signaling, Chat, Emojis & Collaboration
 */

export const setupMeetingSocket = (io) => {
  // Store active rooms and participants in memory
  // Map: roomId -> Map(socketId -> { userId, userName, isHost, isAudioMuted, isVideoOff, handRaised })
  const rooms = new Map();

  io.on('connection', (socket) => {
    let currentRoom = null;
    let currentUser = null;

    console.log(`🔌 New client connected: ${socket.id}`);

    // 1. Join Room
    socket.on('join-room', ({ roomId, userId, userName, isHost = false }) => {
      currentRoom = roomId;

      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          participants: new Map(),
          settings: {
            isLocked: false,
            allowChat: true,
            allowScreenShare: true,
            allowAudienceMic: true
          },
          hostSocketId: isHost ? socket.id : null
        });
      }

      const roomData = rooms.get(roomId);

      // Check if room is locked and user is not host
      if (roomData.settings.isLocked && !isHost && roomData.hostSocketId !== socket.id) {
        socket.emit('room-error', { message: 'La réunion est verrouillée par l\'organisateur.' });
        return;
      }

      // If user is host or first user, assign host
      const isActualHost = isHost || (roomData.participants.size === 0);
      if (isActualHost && !roomData.hostSocketId) {
        roomData.hostSocketId = socket.id;
      }

      currentUser = {
        socketId: socket.id,
        userId: userId || socket.id,
        userName: userName || 'Invité',
        isHost: isActualHost,
        isCoHost: false,
        isAudioMuted: false,
        isVideoOff: false,
        handRaised: false,
        role: isActualHost ? 'host' : 'participant', // 'host' | 'speaker' | 'audience'
        joinedAt: new Date()
      };

      socket.join(roomId);
      roomData.participants.set(socket.id, currentUser);

      // Send existing participants list and room settings
      const existingUsers = Array.from(roomData.participants.values()).filter(p => p.socketId !== socket.id);
      socket.emit('room-users', {
        users: existingUsers,
        you: currentUser,
        settings: roomData.settings,
        totalCount: roomData.participants.size
      });

      // Broadcast to other peers that a new user joined
      socket.to(roomId).emit('user-connected', {
        user: currentUser,
        totalCount: roomData.participants.size
      });

      console.log(`👤 User "${currentUser.userName}" (${socket.id}, role: ${currentUser.role}) joined room "${roomId}". Total: ${roomData.participants.size}`);
    });

    // 2. WebRTC Signaling: Offer
    socket.on('signal-offer', ({ targetSocketId, offer, callerData }) => {
      io.to(targetSocketId).emit('signal-offer', {
        callerSocketId: socket.id,
        offer,
        callerData: callerData || currentUser
      });
    });

    // 3. WebRTC Signaling: Answer
    socket.on('signal-answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('signal-answer', {
        responderSocketId: socket.id,
        answer
      });
    });

    // 4. WebRTC Signaling: ICE Candidate
    socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('ice-candidate', {
        senderSocketId: socket.id,
        candidate
      });
    });

    // 5. Chat Message
    socket.on('send-message', ({ roomId, message }) => {
      if (!roomId || !message) return;
      const chatPayload = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        senderId: currentUser ? currentUser.userId : socket.id,
        senderName: currentUser ? currentUser.userName : 'Anonyme',
        message: message.trim(),
        timestamp: new Date().toISOString()
      };

      io.in(roomId).emit('new-message', chatPayload);
    });

    // 6. Emoji Reaction
    socket.on('send-reaction', ({ roomId, emoji }) => {
      if (!roomId || !emoji) return;
      io.in(roomId).emit('new-reaction', {
        id: `rx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        emoji,
        senderName: currentUser ? currentUser.userName : 'Participant',
        timestamp: Date.now()
      });
    });

    // 7. Toggle Media States (Mute, Video off)
    socket.on('toggle-media', ({ isAudioMuted, isVideoOff }) => {
      if (currentRoom && rooms.has(currentRoom)) {
        const roomData = rooms.get(currentRoom);
        const participant = roomData.participants.get(socket.id);
        if (participant) {
          if (isAudioMuted !== undefined) participant.isAudioMuted = isAudioMuted;
          if (isVideoOff !== undefined) participant.isVideoOff = isVideoOff;

          socket.to(currentRoom).emit('user-media-toggled', {
            socketId: socket.id,
            isAudioMuted: participant.isAudioMuted,
            isVideoOff: participant.isVideoOff
          });
        }
      }
    });

    // 8. Hand Raise
    socket.on('toggle-hand', ({ raised }) => {
      if (currentRoom && rooms.has(currentRoom)) {
        const roomData = rooms.get(currentRoom);
        const participant = roomData.participants.get(socket.id);
        if (participant) {
          participant.handRaised = raised;
          io.in(currentRoom).emit('user-hand-toggled', {
            socketId: socket.id,
            userName: participant.userName,
            handRaised: raised
          });
        }
      }
    });

    // ==========================================
    // 👑 HOST & MODERATOR CONTROLS (Google Meet / Zoom style)
    // ==========================================

    const isHostOrCoHost = (roomId, socketId) => {
      if (!rooms.has(roomId)) return false;
      const roomData = rooms.get(roomId);
      const user = roomData.participants.get(socketId);
      return user && (user.isHost || user.isCoHost);
    };

    // Host Action: Mute specific user
    socket.on('host-mute-user', ({ targetSocketId }) => {
      if (!currentRoom || !isHostOrCoHost(currentRoom, socket.id)) return;
      io.to(targetSocketId).emit('force-mute', {
        by: currentUser ? currentUser.userName : 'L\'organisateur'
      });
      console.log(`🔇 Host ${socket.id} muted participant ${targetSocketId}`);
    });

    // Host Action: Mute ALL participants in 1 click
    socket.on('host-mute-all', () => {
      if (!currentRoom || !isHostOrCoHost(currentRoom, socket.id)) return;
      socket.to(currentRoom).emit('force-mute', {
        by: currentUser ? currentUser.userName : 'L\'organisateur',
        isAll: true
      });
      console.log(`🔇 Host ${socket.id} muted ALL participants in ${currentRoom}`);
    });

    // Host Action: Disable camera of specific user
    socket.on('host-disable-video', ({ targetSocketId }) => {
      if (!currentRoom || !isHostOrCoHost(currentRoom, socket.id)) return;
      io.to(targetSocketId).emit('force-video-off', {
        by: currentUser ? currentUser.userName : 'L\'organisateur'
      });
      console.log(`📹 Host ${socket.id} disabled camera of ${targetSocketId}`);
    });

    // Host Action: Kick / Expel participant from room
    socket.on('host-kick-user', ({ targetSocketId, reason }) => {
      if (!currentRoom || !isHostOrCoHost(currentRoom, socket.id)) return;
      const roomData = rooms.get(currentRoom);
      const targetUser = roomData.participants.get(targetSocketId);

      // Prevent kicking the main host
      if (targetUser && targetUser.isHost) return;

      io.to(targetSocketId).emit('kicked-from-room', {
        reason: reason || 'Vous avez été retiré de la réunion par l\'organisateur.'
      });

      if (targetUser) {
        roomData.participants.delete(targetSocketId);
        io.in(currentRoom).emit('user-disconnected', {
          socketId: targetSocketId,
          user: targetUser,
          totalCount: roomData.participants.size
        });
      }
      console.log(`🚪 Host ${socket.id} kicked user ${targetSocketId}`);
    });

    // Host Action: Promote to Co-Host
    socket.on('host-make-cohost', ({ targetSocketId }) => {
      if (!currentRoom || !isHostOrCoHost(currentRoom, socket.id)) return;
      const roomData = rooms.get(currentRoom);
      const targetUser = roomData.participants.get(targetSocketId);
      if (targetUser) {
        targetUser.isCoHost = true;
        io.in(currentRoom).emit('user-promoted-cohost', {
          socketId: targetSocketId,
          userName: targetUser.userName
        });
      }
    });

    // Host Action: Lock / Unlock Room
    socket.on('host-toggle-lock', ({ isLocked }) => {
      if (!currentRoom || !isHostOrCoHost(currentRoom, socket.id)) return;
      const roomData = rooms.get(currentRoom);
      roomData.settings.isLocked = isLocked;
      io.in(currentRoom).emit('room-settings-updated', roomData.settings);
      console.log(`🔒 Room ${currentRoom} locked state: ${isLocked}`);
    });

    // Host Action: Update Room Permissions (Chat, Screen share, Mic)
    socket.on('host-update-permissions', ({ settingKey, value }) => {
      if (!currentRoom || !isHostOrCoHost(currentRoom, socket.id)) return;
      const roomData = rooms.get(currentRoom);
      if (roomData.settings.hasOwnProperty(settingKey)) {
        roomData.settings[settingKey] = value;
        io.in(currentRoom).emit('room-settings-updated', roomData.settings);
        console.log(`⚙️ Room ${currentRoom} setting ${settingKey} set to ${value}`);
      }
    });

    // Host Action: Promote Audience Member to Speaker Stage (1000+ mode)
    socket.on('host-invite-stage', ({ targetSocketId }) => {
      if (!currentRoom || !isHostOrCoHost(currentRoom, socket.id)) return;
      io.to(targetSocketId).emit('promoted-to-stage', {
        by: currentUser ? currentUser.userName : 'L\'organisateur'
      });
    });

    // Host Action: End call for everyone (Google Meet style)
    socket.on('host-end-meeting', () => {
      if (!currentRoom || !isHostOrCoHost(currentRoom, socket.id)) return;
      io.in(currentRoom).emit('meeting-ended-by-host', {
        by: currentUser ? currentUser.userName : 'L\'organisateur'
      });
      console.log(`🛑 Host ${socket.id} ended meeting ${currentRoom} for everyone`);
      rooms.delete(currentRoom);
    });

    // 9. Collaborative Whiteboard Sync
    socket.on('whiteboard-draw', (drawData) => {
      if (currentRoom) {
        socket.to(currentRoom).emit('whiteboard-draw', drawData);
      }
    });

    // 10. Collaborative Code Editor Sync
    socket.on('code-change', (codeData) => {
      if (currentRoom) {
        socket.to(currentRoom).emit('code-change', codeData);
      }
    });

    // 11. Disconnect / Leave
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      if (currentRoom && rooms.has(currentRoom)) {
        const roomData = rooms.get(currentRoom);
        roomData.participants.delete(socket.id);

        socket.to(currentRoom).emit('user-disconnected', {
          socketId: socket.id,
          user: currentUser,
          totalCount: roomData.participants.size
        });

        // If host leaves and other users remain, promote first co-host or next user
        if (currentUser && currentUser.isHost && roomData.participants.size > 0) {
          const nextHost = Array.from(roomData.participants.values())[0];
          nextHost.isHost = true;
          roomData.hostSocketId = nextHost.socketId;
          io.to(nextHost.socketId).emit('promoted-to-host');
          io.in(currentRoom).emit('new-host-assigned', {
            socketId: nextHost.socketId,
            userName: nextHost.userName
          });
        }

        if (roomData.participants.size === 0) {
          rooms.delete(currentRoom);
          console.log(`🧹 Room "${currentRoom}" is now empty and cleaned up.`);
        }
      }
    });
  });
};

export default setupMeetingSocket;
