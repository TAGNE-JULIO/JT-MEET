# JT-Meet — Plateforme de Visioconférence Moderne & Smart Clipping

**JT-Meet** est une plateforme complète de visioconférence et d'espaces collaboratifs temps réel, conçue avec une architecture moderne full-stack (Next.js 16 / React 19 / Express.js / Socket.io / WebRTC).

Elle intègre les standards de **Google Meet, Zoom, Cisco Webex et GoToMeeting**, tout en proposant des fonctionnalités novatrices de **Smart Video Clipping**, découpage d'extraits précis et partage sécurisé par lien magique.

---

## 🌟 Fonctionnalités Clés

### 1. Visioconférence HD & Temps Réel
- **Rejoindre en 1 clic** via code unique human-friendly (`jt-xxx-xxx`) ou lien direct sans installation.
- **Grille vidéo adaptative** : affichage multi-participants réactif, caméra on/off, micro mute/unmute.
- **Signalisation WebRTC P2P** : latence ultra-faible pour l'audio et la vidéo.
- **Réactions Emoji animées flottantes** (👍, ❤️, 😂, 😮, 👏, 🎉, 🔥).
- **Levée de main interactive** avec notification pour les intervenants.
- **Chat temps réel intégré** persistant pour la durée de l'échange.

### 2. Enregistrement & Smart Clipping (Découpage & Partage d'extraits)
- **Capture intégrée** : Enregistrement de la session directement depuis le navigateur via l'API `MediaRecorder` et synchronisation backend.
- **Studio d'Édition & Timeline** : Définition visuelle des points d'entrée (`IN`) et de sortie (`OUT`).
- **Génération instantanée de clips vidéo** via découpage FFmpeg ou stream copy sans perte.
- **Partage sécurisé par Lien Magique** :
  - Liens publics ou protégés par **mot de passe**.
  - Possibilité de définir une **date d'expiration** (1 jour, 7 jours, 30 jours).
  - Compteur de vues en temps réel et bouton de téléchargement direct.

### 3. Architecture & Sécurité
- Authentification basée sur des tokens **JWT**.
- Base de données **MySQL** avec pool de connexions et système de fallback en mémoire pour un développement continu.
- WebSockets bidirectionnels pour la signalisation et les interactions instantanées.

---

## 🚀 Démarrage Rapide

### Prérequis
- **Node.js** >= 18
- **MySQL 8.0** (Optionnel : le serveur bascule automatiquement en mode mémoire s'il n'est pas encore configuré)

### 1. Cloner et installer les dépendances
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install --legacy-peer-deps
```

### 2. Configuration des variables d'environnement

Dans `backend/.env` :
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=votre_mot_de_passe
DB_NAME=jt_meet

JWT_SECRET=jt_meet_super_secret_jwt_key_2026_modern_collab
UPLOAD_DIR=uploads
```

Dans `frontend/.env.local` :
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

### 3. Lancement des serveurs

**Backend** (Port 5000) :
```bash
cd backend
npm run dev
```

**Frontend** (Port 3000) :
```bash
cd frontend
npm run dev
```

---

## 📁 Structure du Projet

```
JT-Meet/
├── backend/
│   ├── src/
│   │   ├── config/db.js              # Connexion MySQL & fallback résilient
│   │   ├── controllers/
│   │   │   ├── authController.js       # Authentification JWT
│   │   │   ├── meetingController.js    # Gestion des réunions & codes
│   │   │   ├── recordingController.js  # Upload & stockage des vidéos
│   │   │   └── clipController.js       # Découpage, token public & protection
│   │   ├── middlewares/authMiddleware.js
│   │   ├── routes/                     # API REST (/api/auth, /meetings, /recordings, /clips)
│   │   ├── sockets/meetingSocket.js   # Signalisation WebRTC, chat, emojis
│   │   ├── utils/videoTrimmer.js       # Traitement vidéo FFmpeg
│   │   └── server.js                   # Serveur HTTP + Express + Socket.io
│   ├── schema.sql                      # Tables MySQL
│   └── uploads/                        # Stockage des vidéos et clips
│
└── frontend/
    ├── app/
    │   ├── page.tsx                    # Landing page moderne JT-Meet
    │   ├── auth/login/page.tsx         # Connexion
    │   ├── auth/register/page.tsx      # Inscription
    │   ├── dashboard/page.tsx          # Hub utilisateur (réunions & enregistrements)
    │   ├── meet/[code]/page.tsx        # Salle de visioconférence WebRTC
    │   ├── recordings/[id]/page.tsx    # Studio de découpage de clips
    │   └── share/[token]/page.tsx      # Lecteur public de clip sécurisé
    ├── context/AuthContext.tsx         # État global utilisateur & session
    └── lib/
        ├── api.ts                      # Client Axios avec interceptor JWT
        └── socket.ts                   # Client Socket.io singleton
```

---

## 🌐 Endpoints Principaux de l'API

| Méthode | Route | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Créer un compte utilisateur | Non |
| `POST` | `/api/auth/login` | Connexion & obtention du token JWT | Non |
| `POST` | `/api/meetings` | Créer une réunion instantanée ou planifiée | Oui |
| `GET` | `/api/meetings/:code` | Détails de la réunion par son code | Optionnel |
| `POST` | `/api/recordings/upload` | Enregistrer une vidéo de réunion | Oui |
| `POST` | `/api/clips` | Découper un extrait et générer le lien de partage | Oui |
| `GET` | `/api/clips/share/:token` | Consulter un clip public / protégé | Non (ou mdp) |
