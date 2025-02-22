const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",  // Tillad forbindelser fra alle origins
    methods: ["GET", "POST"]
  }
});

// Serve statiske filer fra public mappen
app.use(express.static(path.join(__dirname, 'public')));

// Lobbyer og spildata
const lobbies = {};
const words = [
  'hund', 'kat', 'hus', 'bil', 'tog', 'elefant', 'computer', 'pizza',
  'chokolade', 'musik', 'fodbold', 'strand', 'sol', 'måne', 'stjerne',
  'sky', 'regn', 'sne', 'blomst', 'træ', 'fisk', 'fugl', 'sommerfugl',
  'regnbue', 'ferie', 'skole', 'telefon', 'internet', 'Danmark', 'København'
];

// Genererer en unik lobby-kode
function generateLobbyCode() {
  const codeWords = [
    'Tiger', 'Elefant', 'Panda', 'Zebra', 'Giraf', 'Løve', 'Abe',
    'Gorilla', 'Koala', 'Bjørn', 'Ræv', 'Ulv', 'Pingvin', 'Delfin', 'Hval'
  ];
  const randomWord = codeWords[Math.floor(Math.random() * codeWords.length)];
  const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-cifret tal
  const code = `${randomWord}${randomNum}`;
  
  // Tjek at koden er unik
  if (lobbies[code]) {
    return generateLobbyCode();
  }
  return code;
}

// Funktion til at få et tilfældigt ord
function getRandomWord() {
  return words[Math.floor(Math.random() * words.length)];
}

// Funktion til at få spillerantal i en lobby
function getPlayerCount(lobbyId) {
  return Object.keys(lobbies[lobbyId]?.players || {}).length;
}

// Funktion til at oprydde inaktive lobbyer
function cleanupLobbies() {
  const now = Date.now();
  for (const lobbyId in lobbies) {
    // Fjern lobbyer der har været tomme i mere end 1 time
    if (getPlayerCount(lobbyId) === 0 && now - lobbies[lobbyId].lastEmptied > 60 * 60 * 1000) {
      delete lobbies[lobbyId];
    }
    // Fjern lobbyer der er mere end 12 timer gamle
    else if (now - lobbies[lobbyId].createdAt > 12 * 60 * 60 * 1000) {
      delete lobbies[lobbyId];
    }
  }
}

// Kør oprydning hver time
setInterval(cleanupLobbies, 60 * 60 * 1000);

// Hent public lobbyer
function getPublicLobbies() {
  const publicLobbies = [];
  for (const lobbyId in lobbies) {
    if (lobbies[lobbyId].isPublic) {
      publicLobbies.push({
        id: lobbyId,
        name: lobbies[lobbyId].name,
        playerCount: getPlayerCount(lobbyId),
        maxPlayers: lobbies[lobbyId].maxPlayers,
        roundTime: lobbies[lobbyId].roundTime,
        maxRounds: lobbies[lobbyId].maxRounds,
        gameInProgress: lobbies[lobbyId].gameInProgress,
        createdAt: lobbies[lobbyId].createdAt
      });
    }
  }
  return publicLobbies;
}

// Start en ny spillerunde
function startNewRound(lobbyId) {
  if (!lobbies[lobbyId]) return;
  
  const lobby = lobbies[lobbyId];
  const playerIds = Object.keys(lobby.players);
  if (playerIds.length < 2) return;
  
  // Vælg den næste tegner
  let nextDrawerIndex = 0;
  if (lobby.currentDrawer) {
    const currentIndex = playerIds.indexOf(lobby.currentDrawer);
    nextDrawerIndex = (currentIndex + 1) % playerIds.length;
  }
  
  lobby.currentDrawer = playerIds[nextDrawerIndex];
  lobby.currentWord = getRandomWord();
  lobby.timeLeft = lobby.roundTime;
  
  // Increment round counter if we've gone through all players
  if (nextDrawerIndex === 0 && lobby.currentRound < lobby.maxRounds) {
    lobby.currentRound++;
  }
  
  // Tjek om spillet er slut
  if (lobby.maxRounds !== Infinity && lobby.currentRound > lobby.maxRounds) {
    endGame(lobbyId);
    return;
  }
  
  // Nulstil alle gæt
  Object.keys(lobby.players).forEach(playerId => {
    lobby.players[playerId].hasGuessed = false;
  });
  
  // Send besked om ny runde til alle
  io.to(lobbyId).emit('newRound', {
    currentDrawer: lobby.currentDrawer,
    word: lobby.currentWord, 
    roundInfo: `${lobby.currentRound}/${lobby.maxRounds === Infinity ? '∞' : lobby.maxRounds}`,
    timeLeft: lobby.timeLeft,
    resetCanvas: true
  });
  
  // Send opdateret spillerliste
  io.to(lobbyId).emit('updatePlayers', lobby.players);
  
  // Start timer
  updateTimer(lobbyId);
}

// Opdater timer
function updateTimer(lobbyId) {
  if (!lobbies[lobbyId]) return;
  
  const lobby = lobbies[lobbyId];
  
  lobby.timer = setTimeout(() => {
    lobby.timeLeft--;
    
    // Send timer-opdatering
    io.to(lobbyId).emit('timerUpdate', { timeLeft: lobby.timeLeft });
    
    if (lobby.timeLeft <= 0) {
      // Tiden er udløbet
      io.to(lobbyId).emit('chatMessage', {
        username: "System",
        message: `Tiden er udløbet! Ordet var: ${lobby.currentWord}`
      });
      
      // Start ny runde
      setTimeout(() => startNewRound(lobbyId), 3000);
    } else {
      // Fortsæt timeren
      updateTimer(lobbyId);
    }
  }, 1000);
}

// Afslut spillet og vis resultater
function endGame(lobbyId) {
  if (!lobbies[lobbyId]) return;
  
  const lobby = lobbies[lobbyId];
  lobby.gameInProgress = false;
  
  // Sorter spillere efter score
  const sortedPlayers = Object.values(lobby.players).sort((a, b) => b.score - a.score);
  
  // Send slut-spil besked med vindere
  io.to(lobbyId).emit('gameEnded', {
    winners: sortedPlayers.slice(0, 3),
    allPlayers: sortedPlayers,
    roundsPlayed: lobby.currentRound - 1
  });
  
  // Nulstil lobby-state
  clearTimeout(lobby.timer);
  lobby.currentRound = 1;
  lobby.currentWord = null;
  lobby.currentDrawer = null;
  
  // Nulstil alle scores hvis enabled
  if (lobby.resetScoresAfterGame) {
    for (const playerId in lobby.players) {
      lobby.players[playerId].score = 0;
      lobby.players[playerId].hasGuessed = false;
    }
  }
  
  // Opdater spillerlisten
  io.to(lobbyId).emit('updatePlayers', lobby.players);
  io.to(lobbyId).emit('returnToLobby');
}

// Socket.IO forbindelser
io.on('connection', (socket) => {
  console.log(`Ny forbindelse: ${socket.id}`);
  
  // Når en bruger anmoder om listen af lobbyer
  socket.on('getLobbies', () => {
    socket.emit('lobbiesList', getPublicLobbies());
  });
  
  // Når en bruger opretter en ny lobby
  socket.on('createLobby', (settings) => {
    const lobbyId = generateLobbyCode();
    
    // Opret lobbyen med de angivne indstillinger
    lobbies[lobbyId] = {
      name: settings.name || `${settings.username}'s Lobby`,
      isPublic: settings.isPublic !== false,
      maxPlayers: settings.maxPlayers || 8,
      roundTime: settings.roundTime || 80,
      maxRounds: settings.maxRounds || 10,
      players: {},
      currentDrawer: null,
      currentWord: null,
      timeLeft: 0,
      currentRound: 1,
      gameInProgress: false,
      owner: socket.id,
      createdAt: Date.now(),
      lastEmptied: null,
      timer: null,
      resetScoresAfterGame: settings.resetScoresAfterGame !== false
    };
    
    // Tilføj spilleren til lobbyen
    lobbies[lobbyId].players[socket.id] = {
      id: socket.id,
      username: settings.username,
      score: 0,
      hasGuessed: false,
      isOwner: true
    };
    
    // Tilmeld socket til lobby-rummet
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;
    
    // Send bekræftelse til klienten
    socket.emit('lobbyCreated', {
      lobbyId: lobbyId,
      lobbyInfo: {
        ...lobbies[lobbyId],
        players: lobbies[lobbyId].players
      }
    });
    
    // Opdater lobby-listen for alle i browse-tilstand
    io.emit('lobbyListUpdated');
  });
  
  // Når en spiller tilslutter sig en eksisterende lobby
  socket.on('joinLobby', (data) => {
    const { lobbyId, username } = data;
    
    // Tjek om lobbyen eksisterer
    if (!lobbies[lobbyId]) {
      return socket.emit('error', { message: 'Lobbyen findes ikke' });
    }
    
    const lobby = lobbies[lobbyId];
    
    // Tjek om spillet allerede er i gang
    if (lobby.gameInProgress) {
      return socket.emit('error', { message: 'Spillet er allerede i gang' });
    }
    
    // Tjek om lobbyen er fuld
    if (getPlayerCount(lobbyId) >= lobby.maxPlayers) {
      return socket.emit('error', { message: 'Lobbyen er fuld' });
    }
    
    // Tilføj spilleren til lobbyen
    lobby.players[socket.id] = {
      id: socket.id,
      username: username,
      score: 0,
      hasGuessed: false,
      isOwner: false
    };
    
    // Tilmeld socket til lobby-rummet
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;
    
    // Send lobby-info til den nye spiller
    socket.emit('joinedLobby', {
      lobbyId: lobbyId,
      lobbyInfo: {
        ...lobby,
        players: lobby.players
      }
    });
    
    // Fortæl alle i lobbyen om den nye spiller
    io.to(lobbyId).emit('playerJoinedLobby', lobby.players[socket.id]);
    
    // Send den opdaterede spillerliste til alle i lobbyen
    io.to(lobbyId).emit('updateLobbyPlayers', lobby.players);
    
    // Opdater lobby-listen for alle i browse-tilstand
    io.emit('lobbyListUpdated');
  });
  
  // Når lobby-ejeren starter spillet
  socket.on('startGame', () => {
    const lobbyId = socket.lobbyId;
    if (!lobbyId || !lobbies[lobbyId]) return;
    
    const lobby = lobbies[lobbyId];
    
    // Tjek om anmoderen er ejeren
    if (socket.id !== lobby.owner) {
      return socket.emit('error', { message: 'Kun ejeren kan starte spillet' });
    }
    
    // Tjek om der er nok spillere
    if (getPlayerCount(lobbyId) < 2) {
      return socket.emit('error', { message: 'Der skal være mindst 2 spillere for at starte' });
    }
    
    // Start spillet
    lobby.gameInProgress = true;
    lobby.currentRound = 1;
    
    // Informer alle spillere om at spillet starter
    io.to(lobbyId).emit('gameStarting');
    
    // Start første runde efter kort delay
    setTimeout(() => {
      startNewRound(lobbyId);
    }, 1500);
    
    // Opdater lobby-listen for alle i browse-tilstand
    io.emit('lobbyListUpdated');
  });
  
  // Når en spiller tegner noget
  socket.on('draw', (data) => {
    const lobbyId = socket.lobbyId;
    if (!lobbyId || !lobbies[lobbyId] || !lobbies[lobbyId].gameInProgress) return;
    
    // Tjek om spilleren er den nuværende tegner
    if (socket.id !== lobbies[lobbyId].currentDrawer) return;
    
    // Send tegne-data til alle andre i lobbyen
    data.drawerId = socket.id;
    socket.to(lobbyId).emit('draw', data);
  });
  
  // Når en spiller sender en chat-besked
  socket.on('chatMessage', (data) => {
    const lobbyId = socket.lobbyId;
    if (!lobbyId || !lobbies[lobbyId]) return;
    
    const lobby = lobbies[lobbyId];
    
    // Håndter besked forskelligt baseret på om spillet er i gang
    if (lobby.gameInProgress && lobby.currentWord) {
      // Tjek om spilleren gættede rigtigt
      if (
        data.message.toLowerCase() === lobby.currentWord.toLowerCase() && 
        socket.id !== lobby.currentDrawer &&
        !lobby.players[socket.id].hasGuessed
      ) {
        // Beregn point baseret på tid
        const timeBonus = Math.floor(lobby.timeLeft / lobby.roundTime * 50);
        const pointsAwarded = 50 + timeBonus;
        
        // Opdater spiller-status
        lobby.players[socket.id].hasGuessed = true;
        lobby.players[socket.id].score += pointsAwarded;
        
        // Giv point til tegneren
        if (lobby.players[lobby.currentDrawer]) {
          lobby.players[lobby.currentDrawer].score += 25;
        }
        
        // Send besked om korrekt gæt
        io.to(lobbyId).emit('chatMessage', {
          username: "System",
          message: `${data.username} gættede ordet!`,
          guessedCorrectly: true
        });
        
        // Informer om spillerens gæt
        io.to(lobbyId).emit('playerGuessed', {
          playerId: socket.id,
          pointsAwarded: pointsAwarded
        });
        
        // Send opdateret spillerliste
        io.to(lobbyId).emit('updatePlayers', lobby.players);
        
        // Tjek om alle har gættet
        const players = lobby.players;
        const allGuessed = Object.keys(players).every(id => 
          id === lobby.currentDrawer || players[id].hasGuessed
        );
        
        if (allGuessed) {
          clearTimeout(lobby.timer);
          setTimeout(() => startNewRound(lobbyId), 3000);
        }
      } else {
        // Normal chat-besked under spil (skjul hvis det ligner ordet og man selv tegner)
        const shouldHide =
          lobby.currentWord &&
          data.message.toLowerCase().includes(lobby.currentWord.toLowerCase()) &&
          socket.id === lobby.currentDrawer;
        
        if (!shouldHide) {
          io.to(lobbyId).emit('chatMessage', data);
        } else {
          socket.emit('chatMessage', {
            username: "System",
            message: "Du kan ikke afsløre ordet i chatten!",
            isWarning: true
          });
        }
      }
    } else {
      // Normal lobby-chat (når spillet ikke er i gang)
      io.to(lobbyId).emit('chatMessage', data);
    }
  });
  
  // Når en spiller anmoder om at forlade lobbyen
  socket.on('leaveLobby', () => {
    handlePlayerDisconnect();
  });
  
  // Håndter lobby-indstillinger
  socket.on('updateLobbySettings', (settings) => {
    const lobbyId = socket.lobbyId;
    if (!lobbyId || !lobbies[lobbyId]) return;
    
    const lobby = lobbies[lobbyId];
    
    // Tjek om anmoderen er ejeren
    if (socket.id !== lobby.owner) {
      return socket.emit('error', { message: 'Kun ejeren kan ændre indstillinger' });
    }
    
    // Opdater indstillinger
    if (settings.name) lobby.name = settings.name;
    if (settings.isPublic !== undefined) lobby.isPublic = settings.isPublic;
    if (settings.maxPlayers) lobby.maxPlayers = settings.maxPlayers;
    if (settings.roundTime) lobby.roundTime = settings.roundTime;
    if (settings.maxRounds !== undefined) lobby.maxRounds = settings.maxRounds;
    if (settings.resetScoresAfterGame !== undefined) lobby.resetScoresAfterGame = settings.resetScoresAfterGame;
    
    // Informer alle spillere om ændringerne
    io.to(lobbyId).emit('lobbySettingsUpdated', {
      name: lobby.name,
      isPublic: lobby.isPublic,
      maxPlayers: lobby.maxPlayers,
      roundTime: lobby.roundTime,
      maxRounds: lobby.maxRounds,
      resetScoresAfterGame: lobby.resetScoresAfterGame
    });
    
    // Opdater lobby-listen hvis synligheden ændrede sig
    if (settings.isPublic !== undefined || settings.name) {
      io.emit('lobbyListUpdated');
    }
  });
  
  // Håndter spillerafbrydelse/forlad lobby
  function handlePlayerDisconnect() {
    const lobbyId = socket.lobbyId;
    if (!lobbyId || !lobbies[lobbyId]) return;
    
    const lobby = lobbies[lobbyId];
    const isOwner = socket.id === lobby.owner;
    
    // Fjern spilleren fra lobbyen
    if (lobby.players[socket.id]) {
      delete lobby.players[socket.id];
    }
    
    // Fjern spilleren fra rummet
    socket.leave(lobbyId);
    socket.lobbyId = null;
    
    // Informer alle andre om afbrydelsen
    io.to(lobbyId).emit('playerLeftLobby', {
      playerId: socket.id,
      wasOwner: isOwner
    });
    
    // Tæl spillere
    const remainingPlayers = getPlayerCount(lobbyId);
    
    // Hvis lobbyen er tom, marker den til oprydning
    if (remainingPlayers === 0) {
      lobbies[lobbyId].lastEmptied = Date.now();
    }
    // Hvis ejeren forlod og der er andre spillere, udpeg en ny ejer
    else if (isOwner && remainingPlayers > 0) {
      const newOwnerId = Object.keys(lobby.players)[0];
      lobby.owner = newOwnerId;
      lobby.players[newOwnerId].isOwner = true;
      
      // Informer om den nye ejer
      io.to(lobbyId).emit('newOwner', {
        newOwnerId: newOwnerId,
        newOwnerName: lobby.players[newOwnerId].username
      });
    }
    
    // Send opdateret spillerliste
    io.to(lobbyId).emit('updateLobbyPlayers', lobby.players);
    
    // Hvis spillet er i gang og den nuværende tegner forlod
    if (lobby.gameInProgress && socket.id === lobby.currentDrawer) {
      clearTimeout(lobby.timer);
      io.to(lobbyId).emit('chatMessage', {
        username: "System",
        message: "Den nuværende tegner forlod spillet. Starter ny runde..."
      });
      
      // Start en ny runde hvis der er nok spillere tilbage
      if (remainingPlayers >= 2) {
        setTimeout(() => startNewRound(lobbyId), 3000);
      } else {
        // Afslut spillet hvis der ikke er nok spillere
        lobby.gameInProgress = false;
        io.to(lobbyId).emit('gameEnded', {
          reason: "Ikke nok spillere",
          returnToLobby: true
        });
      }
    }
    
    // Opdater lobby-listen
    io.emit('lobbyListUpdated');
  }
  
  // Når en spiller afbryder forbindelsen
  socket.on('disconnect', () => {
    handlePlayerDisconnect();
  });
});

// Start serveren (Railway bruger process.env.PORT i praksis)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server kører på port ${PORT}`);
});
