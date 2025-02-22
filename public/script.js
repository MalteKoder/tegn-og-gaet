// Vent på at DOM'en er fuldt indlæst
document.addEventListener('DOMContentLoaded', function() {
    // === GLOBALE VARIABLER ===
    const socket = io();
    let username = "";
    let currentColor = '#000000';
    let isEraser = false;
    let penSize = 5;
    let isDrawing = false;
    let lastPosition = null;
    let strokes = []; // Array til at gemme alle strøg
    let redoHistory = []; // Array til at gemme fortrydede strøg
    let currentStroke = null; // Det nuværende strøg under tegning
    let currentDrawer = null;
    let currentWord = "";
    let roundTime = 60;
    let timerInterval = null;
    let currentLobbyId = null;
    let isLobbyOwner = false;
    let lobbySettings = {};

    // === DOM ELEMENTER ===
    // Skærme
    const mainMenu = document.getElementById('mainMenu');
    const createLobbyScreen = document.getElementById('createLobbyScreen');
    const joinLobbyScreen = document.getElementById('joinLobbyScreen');
    const browseLobbiesScreen = document.getElementById('browseLobbiesScreen');
    const lobbyScreen = document.getElementById('lobbyScreen');
    const gameScreen = document.getElementById('gameScreen');
    const gameEndScreen = document.getElementById('gameEndScreen');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const errorModal = document.getElementById('errorModal');

    // Main Menu
    const mainUsernameInput = document.getElementById('mainUsernameInput');
    const createLobbyBtn = document.getElementById('createLobbyBtn');
    const joinLobbyBtn = document.getElementById('joinLobbyBtn');
    const browseLobbiesBtn = document.getElementById('browseLobbiesBtn');

    // Create Lobby
    const lobbyNameInput = document.getElementById('lobbyNameInput');
    const isPublicToggle = document.getElementById('isPublicToggle');
    const maxPlayersSlider = document.getElementById('maxPlayersSlider');
    const maxPlayersValue = document.getElementById('maxPlayersValue');
    const roundTimeSlider = document.getElementById('roundTimeSlider');
    const roundTimeValue = document.getElementById('roundTimeValue');
    const maxRoundsSlider = document.getElementById('maxRoundsSlider');
    const maxRoundsValue = document.getElementById('maxRoundsValue');
    const infiniteRoundsCheckbox = document.getElementById('infiniteRoundsCheckbox');
    const resetScoresCheckbox = document.getElementById('resetScoresCheckbox');
    const createLobbySubmitBtn = document.getElementById('createLobbySubmitBtn');
    const backToMainFromCreateBtn = document.getElementById('backToMainFromCreateBtn');

    // Join Lobby
    const lobbyCodeInput = document.getElementById('lobbyCodeInput');
    const joinLobbySubmitBtn = document.getElementById('joinLobbySubmitBtn');
    const backToMainFromJoinBtn = document.getElementById('backToMainFromJoinBtn');

    // Browse Lobbies
    const lobbySearchInput = document.getElementById('lobbySearchInput');
    const refreshLobbiesBtn = document.getElementById('refreshLobbiesBtn');
    const hideFullLobbiesCheckbox = document.getElementById('hideFullLobbiesCheckbox');
    const hideInProgressCheckbox = document.getElementById('hideInProgressCheckbox');
    const lobbiesList = document.getElementById('lobbiesList');
    const backToMainFromBrowseBtn = document.getElementById('backToMainFromBrowseBtn');

    // Lobby Screen
    const lobbyName = document.getElementById('lobbyName');
    const lobbyCodeDisplay = document.getElementById('lobbyCodeDisplay');
    const copyLobbyCodeBtn = document.getElementById('copyLobbyCodeBtn');
    const playerCount = document.getElementById('playerCount');
    const maxPlayers = document.getElementById('maxPlayers');
    const lobbyPlayersList = document.getElementById('lobbyPlayersList');
    const lobbyChatMessages = document.getElementById('lobbyChatMessages');
    const lobbyChatInput = document.getElementById('lobbyChatInput');
    const lobbyChatSendBtn = document.getElementById('lobbyChatSendBtn');
    const lobbySettingsPanel = document.getElementById('lobbySettingsPanel');
    const startGameBtn = document.getElementById('startGameBtn');
    const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');

    // Lobby Settings
    const editLobbyNameInput = document.getElementById('editLobbyNameInput');
    const editPublicToggle = document.getElementById('editPublicToggle');
    const editMaxPlayersSlider = document.getElementById('editMaxPlayersSlider');
    const editMaxPlayersValue = document.getElementById('editMaxPlayersValue');
    const editRoundTimeSlider = document.getElementById('editRoundTimeSlider');
    const editRoundTimeValue = document.getElementById('editRoundTimeValue');
    const editMaxRoundsSlider = document.getElementById('editMaxRoundsSlider');
    const editMaxRoundsValue = document.getElementById('editMaxRoundsValue');
    const editInfiniteRoundsCheckbox = document.getElementById('editInfiniteRoundsCheckbox');
    const editResetScoresCheckbox = document.getElementById('editResetScoresCheckbox');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    // Game Screen
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const penSizeSlider = document.getElementById('penSizeSlider');
    const penSizeDisplay = document.getElementById('penSizeDisplay');
    const colorPicker = document.getElementById('colorPicker');
    const eraserButton = document.getElementById('eraserButton');
    const undoButton = document.getElementById('undoButton');
    const redoButton = document.getElementById('redoButton');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const leaderboardContent = document.getElementById('leaderboardContent');
    const currentWordDisplay = document.getElementById('currentWord');
    const roundInfoDisplay = document.getElementById('roundInfo');
    const timeLeftDisplay = document.getElementById('timeLeft');

    // Game End Screen
    const resultsTable = document.getElementById('resultsTable');
    const returnToLobbyBtn = document.getElementById('returnToLobbyBtn');
    const firstPlaceEl = document.getElementById('firstPlace');
    const secondPlaceEl = document.getElementById('secondPlace');
    const thirdPlaceEl = document.getElementById('thirdPlace');

    // Error Modal
    const errorMessage = document.getElementById('errorMessage');
    const errorOkBtn = document.getElementById('errorOkBtn');
    const closeModalBtn = document.querySelector('.close-modal');

    // === INITIALISERING ===
    // Skjul indstillingspanelet hvis brugeren ikke er ejer
    function initializeLobbyScreen() {
        if (!isLobbyOwner) {
            lobbySettingsPanel.style.display = 'none';
            startGameBtn.style.display = 'none';
        } else {
            lobbySettingsPanel.style.display = 'block';
            startGameBtn.style.display = 'inline-block';
        }
    }

    // Opdater slider værdier
    function initializeSliders() {
        // Create Lobby sliders
        maxPlayersSlider.addEventListener('input', () => {
            maxPlayersValue.textContent = maxPlayersSlider.value;
        });
        
        roundTimeSlider.addEventListener('input', () => {
            roundTimeValue.textContent = roundTimeSlider.value;
        });
        
        maxRoundsSlider.addEventListener('input', () => {
            if (!infiniteRoundsCheckbox.checked) {
                maxRoundsValue.textContent = maxRoundsSlider.value;
            }
        });
        
        infiniteRoundsCheckbox.addEventListener('change', () => {
            if (infiniteRoundsCheckbox.checked) {
                maxRoundsValue.textContent = '∞';
                maxRoundsSlider.disabled = true;
            } else {
                maxRoundsValue.textContent = maxRoundsSlider.value;
                maxRoundsSlider.disabled = false;
            }
        });
        
        // Edit Lobby sliders
        editMaxPlayersSlider.addEventListener('input', () => {
            editMaxPlayersValue.textContent = editMaxPlayersSlider.value;
        });
        
        editRoundTimeSlider.addEventListener('input', () => {
            editRoundTimeValue.textContent = editRoundTimeSlider.value;
        });
        
        editMaxRoundsSlider.addEventListener('input', () => {
            if (!editInfiniteRoundsCheckbox.checked) {
                editMaxRoundsValue.textContent = editMaxRoundsSlider.value;
            }
        });
        
        editInfiniteRoundsCheckbox.addEventListener('change', () => {
            if (editInfiniteRoundsCheckbox.checked) {
                editMaxRoundsValue.textContent = '∞';
                editMaxRoundsSlider.disabled = true;
            } else {
                editMaxRoundsValue.textContent = editMaxRoundsSlider.value;
                editMaxRoundsSlider.disabled = false;
            }
        });
    }

    // === HJÆLPEFUNKTIONER ===
    // Vis en skærm, skjul alle andre
    function showScreen(screenToShow) {
        const screens = [
            mainMenu, createLobbyScreen, joinLobbyScreen, 
            browseLobbiesScreen, lobbyScreen, gameScreen, gameEndScreen
        ];
        screens.forEach(screen => {
            if (screen) {
                screen.style.display = (screen === screenToShow) ? 'block' : 'none';
            }
        });
    }
    
    // Vis loading overlay
    function showLoading(message = 'Indlæser...') {
        if (loadingOverlay) {
            document.getElementById('loadingMessage').textContent = message;
            loadingOverlay.style.display = 'flex';
        }
    }
    
    // Skjul loading overlay
    function hideLoading() {
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
    
    // Vis error modal
    function showError(message) {
        if (errorModal && errorMessage) {
            errorMessage.textContent = message;
            errorModal.style.display = 'flex';
        } else {
            alert(message);
        }
    }
    
    // Få museposition relativt til canvas
    function getMousePos(e) {
        if (!canvas) return { x: 0, y: 0 };
        
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    // Validér brugernavn
    function validateUsername() {
        const usernameValue = mainUsernameInput.value.trim();
        if (!usernameValue || usernameValue.length < 2) {
            showError('Indtast et gyldigt navn (mindst 2 tegn)');
            return false;
        }
        username = usernameValue;
        return true;
    }
    
    // Kopier tekst til udklipsholderen
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text)
            .then(() => {
                const originalText = copyLobbyCodeBtn.textContent;
                copyLobbyCodeBtn.textContent = 'Kopieret!';
                setTimeout(() => {
                    copyLobbyCodeBtn.textContent = originalText;
                }, 2000);
            })
            .catch(() => {
                showError('Kunne ikke kopiere til udklipsholderen');
            });
    }

    // === CANVAS FUNKTIONER ===
    // Ryd canvas og initialiser tegnefladen
    function clearCanvas() {
        if (!ctx) return;
        
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        strokes = [];
        redoHistory = [];
    }
    
    // Opdater pensel-størrelse display
    function updatePenSizeDisplay() {
        if (!penSizeDisplay) return;
        
        penSizeDisplay.style.width = penSize + "px";
        penSizeDisplay.style.height = penSize + "px";
        penSizeDisplay.style.background = isEraser ? "#ffffff" : currentColor;
        penSizeDisplay.style.border = "1px solid #ccc";
        penSizeDisplay.style.borderRadius = "50%";
    }
    
    // Start tegning
    function startDrawing(e) {
        e.preventDefault();
        isDrawing = true;
        lastPosition = getMousePos(e);
        
        // Start et nyt strøg
        currentStroke = {
            points: [{ x: lastPosition.x, y: lastPosition.y }],
            color: isEraser ? "#ffffff" : currentColor,
            size: penSize,
            isEraser: isEraser
        };
        
        // Tegn en prik ved klikpunktet
        if (ctx) {
            ctx.beginPath();
            ctx.arc(lastPosition.x, lastPosition.y, penSize/2, 0, Math.PI * 2);
            ctx.fillStyle = currentStroke.color;
            ctx.fill();
        }
    }
    
    // Tegn mens musen bevæges
    function draw(e) {
        if (!isDrawing || !lastPosition || !ctx) return;
        
        const currentPos = getMousePos(e);

        // Tilføj punktet til det nuværende strøg
        if (currentStroke) {
            currentStroke.points.push({ x: currentPos.x, y: currentPos.y });
        }
        
        // Tegn linjen
        ctx.beginPath();
        ctx.moveTo(lastPosition.x, lastPosition.y);
        ctx.lineTo(currentPos.x, currentPos.y);
        ctx.strokeStyle = isEraser ? "#ffffff" : currentColor;
        ctx.lineWidth = penSize;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Send tegnedata til serveren
        socket.emit("draw", {
            x1: lastPosition.x,
            y1: lastPosition.y,
            x2: currentPos.x,
            y2: currentPos.y,
            color: ctx.strokeStyle,
            size: ctx.lineWidth
        });
        
        // Opdater sidste position
        lastPosition = currentPos;
    }
    
    // Stop tegning
    function stopDrawing() {
        if (isDrawing && currentStroke && currentStroke.points.length > 0) {
            // Gem strøget i historikken
            strokes.push(currentStroke);
            redoHistory = [];
        }
        
        isDrawing = false;
        lastPosition = null;
        currentStroke = null;
    }
    
    // Genoptag tegning (når musen kommer tilbage på canvas med knappen trykket ned)
    function resumeDrawing(e) {
        if (e.buttons === 1) { // Venstre museknap stadig nede
            isDrawing = true;
            lastPosition = getMousePos(e);
            
            // Start et nyt strøg
            currentStroke = {
                points: [{ x: lastPosition.x, y: lastPosition.y }],
                color: isEraser ? "#ffffff" : currentColor,
                size: penSize,
                isEraser: isEraser
            };
        }
    }
    
    // Fortryd sidste strøg (undo)
    function undo() {
        if (!ctx || strokes.length === 0) return;
        
        // Flyt sidste strøg til redo-historikken
        const lastStroke = strokes.pop();
        redoHistory.push(lastStroke);
        
        // Gentegn canvas
        redrawCanvas();
    }
    
    // Gendan sidste fortrydede strøg (redo)
    function redo() {
        if (!ctx || redoHistory.length === 0) return;
        
        // Flyt sidste fortrydede strøg tilbage til strokes
        const redoneStroke = redoHistory.pop();
        strokes.push(redoneStroke);
        
        // Gentegn canvas
        redrawCanvas();
    }
    
    // Gentegn hele canvas baseret på stroke-historikken
    function redrawCanvas() {
        if (!ctx) return;
        
        clearCanvas();
        
        // Tegn alle strøg
        strokes.forEach(stroke => {
            if (stroke.points.length < 2) {
                // For enkeltstående punkter
                if (stroke.points.length === 1) {
                    const point = stroke.points[0];
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, stroke.size/2, 0, Math.PI * 2);
                    ctx.fillStyle = stroke.color;
                    ctx.fill();
                }
                return;
            }
            
            // For flere punkter, tegn linjer
            for (let i = 1; i < stroke.points.length; i++) {
                const p1 = stroke.points[i-1];
                const p2 = stroke.points[i];
                
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = stroke.color;
                ctx.lineWidth = stroke.size;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        });
    }
    
    // Skift mellem normal pensel og viskelæder
    function setEraser() {
        isEraser = !isEraser;
        if (eraserButton) {
            eraserButton.classList.toggle('active');
        }
        updatePenSizeDisplay();
    }

    // === LOBBY FUNKTIONER ===
    // Opret lobby
    function createLobby() {
        if (!validateUsername()) return;
        
        const lobbyName = lobbyNameInput.value.trim() || `${username}'s Lobby`;
        const maxRounds = infiniteRoundsCheckbox.checked ? Infinity : parseInt(maxRoundsSlider.value);
        
        const lobbySettings = {
            name: lobbyName,
            username: username,
            isPublic: isPublicToggle.checked,
            maxPlayers: parseInt(maxPlayersSlider.value),
            roundTime: parseInt(roundTimeSlider.value),
            maxRounds: maxRounds,
            resetScoresAfterGame: resetScoresCheckbox.checked
        };
        
        showLoading('Opretter lobby...');
        socket.emit('createLobby', lobbySettings);
    }
    
    // Tilslut til en lobby med kode
    function joinLobbyWithCode() {
        if (!validateUsername()) return;
        
        const code = lobbyCodeInput.value.trim().toUpperCase();
        if (!code) {
            showError('Indtast en gyldig lobby-kode');
            return;
        }
        
        showLoading('Tilslutter til lobby...');
        socket.emit('joinLobby', {
            lobbyId: code,
            username: username
        });
    }
    
    // Opdater lobby-indstillinger (kun for ejeren)
    function updateLobbySettings() {
        if (!currentLobbyId || !isLobbyOwner) return;
        
        const maxRounds = editInfiniteRoundsCheckbox.checked ? Infinity : parseInt(editMaxRoundsSlider.value);
        
        const updatedSettings = {
            name: editLobbyNameInput.value.trim(),
            isPublic: editPublicToggle.checked,
            maxPlayers: parseInt(editMaxPlayersSlider.value),
            roundTime: parseInt(editRoundTimeSlider.value),
            maxRounds: maxRounds,
            resetScoresAfterGame: editResetScoresCheckbox.checked
        };
        
        showLoading('Opdaterer indstillinger...');
        socket.emit('updateLobbySettings', updatedSettings);
    }
    
    // Start spillet (kun for ejeren)
    function startGame() {
        if (!currentLobbyId || !isLobbyOwner) return;
        
        showLoading('Starter spillet...');
        socket.emit('startGame');
    }
    
    // Forlad lobbyen
    function leaveLobby() {
        if (!currentLobbyId) return;
        
        showLoading('Forlader lobby...');
        socket.emit('leaveLobby');
        currentLobbyId = null;
        isLobbyOwner = false;
        showScreen(mainMenu);
        hideLoading();
    }
    
    // Hent listen over lobbyer
    function fetchLobbies() {
        showLoading('Henter lobbyer...');
        socket.emit('getLobbies');
    }
    
    // Filtrer lobbyer baseret på søgekriterier
    function filterLobbies(allLobbies) {
        const searchTerm = lobbySearchInput.value.toLowerCase().trim();
        const hideFullLobbies = hideFullLobbiesCheckbox.checked;
        const hideInProgress = hideInProgressCheckbox.checked;
        
        return allLobbies.filter(lobby => {
            // Filtrer efter søgeterm
            if (searchTerm && !lobby.name.toLowerCase().includes(searchTerm)) {
                return false;
            }
            
            // Filtrer fulde lobbyer
            if (hideFullLobbies && lobby.playerCount >= lobby.maxPlayers) {
                return false;
            }
            
            // Filtrer spil i gang
            if (hideInProgress && lobby.gameInProgress) {
                return false;
            }
            
            return true;
        });
    }
    
    // Rendér lobbyer i browse-listen
    function renderLobbies(lobbies) {
        if (!lobbiesList) return;
        
        lobbiesList.innerHTML = '';
        
        if (lobbies.length === 0) {
            const noLobbiesMsg = document.createElement('div');
            noLobbiesMsg.className = 'no-lobbies-message';
            noLobbiesMsg.textContent = 'Ingen lobbyer fundet';
            lobbiesList.appendChild(noLobbiesMsg);
            return;
        }
        
        lobbies.forEach(lobby => {
            const lobbyItem = document.createElement('div');
            lobbyItem.className = 'lobby-item';
            
            const isFull = lobby.playerCount >= lobby.maxPlayers;
            
            lobbyItem.innerHTML = `
                <div class="lobby-info">
                    <div class="lobby-title">${lobby.name}</div>
                    <div class="lobby-details">
                        <span>${lobby.playerCount}/${lobby.maxPlayers} spillere</span>
                        <span>${lobby.roundTime}s per runde</span>
                        <span>${lobby.maxRounds === Infinity ? '∞' : lobby.maxRounds} runder</span>
                    </div>
                </div>
                <div>
                    <span class="lobby-status ${lobby.gameInProgress ? 'status-in-progress' : 'status-waiting'}">
                        ${lobby.gameInProgress ? 'I gang' : 'Venter'}
                    </span>
                    ${(!lobby.gameInProgress && !isFull) ? 
                        `<button class="join-lobby-btn" data-id="${lobby.id}">Tilslut</button>` : 
                        ''}
                </div>
            `;
            
            lobbiesList.appendChild(lobbyItem);
        });
        
        // Tilføj event listeners til tilslut-knapper
        const joinButtons = lobbiesList.querySelectorAll('.join-lobby-btn');
        joinButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                if (!validateUsername()) return;
                
                const lobbyId = this.getAttribute('data-id');
                showLoading('Tilslutter til lobby...');
                socket.emit('joinLobby', {
                    lobbyId: lobbyId,
                    username: username
                });
            });
        });
    }
    
    // Opdater lobby-spiller listen
    function updateLobbyPlayersList(players) {
        if (!lobbyPlayersList) return;
        
        lobbyPlayersList.innerHTML = '';
        let count = 0;
        
        Object.values(players).forEach(player => {
            count++;
            const playerRow = document.createElement('div');
            playerRow.className = `player-row ${player.isOwner ? 'owner' : ''}`;
            
            playerRow.innerHTML = `
                <div class="player-name">
                    ${player.isOwner ? '<span class="crown-icon">👑</span>' : ''}
                    ${player.username}
                </div>
                <div class="player-score">${player.score}</div>
            `;
            
            lobbyPlayersList.appendChild(playerRow);
        });
        
        // Opdater spillerantal
        if (playerCount) {
            playerCount.textContent = count;
        }
    }
    
    // Opdater lobby information
    function updateLobbyInfo(lobbyInfo) {
        if (lobbyName) {
            lobbyName.textContent = lobbyInfo.name;
        }
        
        if (lobbyCodeDisplay) {
            lobbyCodeDisplay.textContent = currentLobbyId;
        }
        
        if (maxPlayers) {
            maxPlayers.textContent = lobbyInfo.maxPlayers;
        }
        
        // Opdater indstillingerne hvis brugeren er ejer
        if (isLobbyOwner) {
            if (editLobbyNameInput) {
                editLobbyNameInput.value = lobbyInfo.name;
            }
            
            if (editPublicToggle) {
                editPublicToggle.checked = lobbyInfo.isPublic;
            }
            
            if (editMaxPlayersSlider && editMaxPlayersValue) {
                editMaxPlayersSlider.value = lobbyInfo.maxPlayers;
                editMaxPlayersValue.textContent = lobbyInfo.maxPlayers;
            }
            
            if (editRoundTimeSlider && editRoundTimeValue) {
                editRoundTimeSlider.value = lobbyInfo.roundTime;
                editRoundTimeValue.textContent = lobbyInfo.roundTime;
            }
            
            if (editMaxRoundsSlider && editMaxRoundsValue && editInfiniteRoundsCheckbox) {
                if (lobbyInfo.maxRounds === Infinity) {
                    editInfiniteRoundsCheckbox.checked = true;
                    editMaxRoundsValue.textContent = '∞';
                    editMaxRoundsSlider.disabled = true;
                } else {
                    editInfiniteRoundsCheckbox.checked = false;
                    editMaxRoundsSlider.value = lobbyInfo.maxRounds;
                    editMaxRoundsValue.textContent = lobbyInfo.maxRounds;
                    editMaxRoundsSlider.disabled = false;
                }
            }
            
            if (editResetScoresCheckbox) {
                editResetScoresCheckbox.checked = lobbyInfo.resetScoresAfterGame;
            }
        }
    }
    
    // Tilføj besked til lobby chat
    function addLobbyMessage(data) {
        if (!lobbyChatMessages) return;
        
        const messageEl = document.createElement('div');
        
        if (data.username === 'System') {
            messageEl.className = 'chat-message system';
            messageEl.textContent = data.message;
        } else {
            messageEl.className = `chat-message ${data.username === username ? 'self' : 'other'}`;
            
            const authorEl = document.createElement('div');
            authorEl.className = 'message-author';
            authorEl.textContent = data.username;
            
            const contentEl = document.createElement('div');
            contentEl.textContent = data.message;
            
            messageEl.appendChild(authorEl);
            messageEl.appendChild(contentEl);
        }
        
        lobbyChatMessages.appendChild(messageEl);
        lobbyChatMessages.scrollTop = lobbyChatMessages.scrollHeight;
    }
    
    // Send besked i lobby chat
    function sendLobbyMessage() {
        if (!lobbyChatInput || !currentLobbyId) return;
        
        const message = lobbyChatInput.value.trim();
        if (message === '') return;
        
        socket.emit('chatMessage', { username, message });
        lobbyChatInput.value = '';
    }
    
    // Opdater leaderboard under spil
    function updateGameLeaderboard(players) {
        if (!leaderboardContent) return;
        
        leaderboardContent.innerHTML = '';
        
        if (!players || Object.keys(players).length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-leaderboard';
            emptyMsg.textContent = 'Ingen spillere';
            leaderboardContent.appendChild(emptyMsg);
            return;
        }
        
        // Sorter spillere efter score
        const sortedPlayers = Object.values(players)
            .sort((a, b) => b.score - a.score);
        
        sortedPlayers.forEach((player, index) => {
            const playerEl = document.createElement('div');
            playerEl.className = 'player-item';
            
            // Tilføj positionsklasser
            if (index === 0) playerEl.classList.add('position-gold');
            else if (index === 1) playerEl.classList.add('position-silver');
            else if (index === 2) playerEl.classList.add('position-bronze');
            
            // Tilføj andre klasser
            if (player.hasGuessed) playerEl.classList.add('guessed');
            if (player.id === currentDrawer) playerEl.classList.add('drawing');
            if (player.username === username) playerEl.classList.add('self');
            
            playerEl.innerHTML = `
                <span class="player-name">${player.username}</span>
                <span class="player-score">${player.score}</span>
            `;
            
            leaderboardContent.appendChild(playerEl);
        });
    }
    
    // Opdater spil-info (ord, runde, tid)
    function updateGameInfo(gameData) {
        if (gameData.word && currentWordDisplay) {
            if (gameData.currentDrawer === socket.id) {
                currentWordDisplay.textContent = gameData.word;
            } else {
                currentWordDisplay.textContent = gameData.word.replace(/[a-zA-Z]/g, '_ ').trim();
            }
        }
        
        if (gameData.roundInfo && roundInfoDisplay) {
            roundInfoDisplay.textContent = `Runde: ${gameData.roundInfo}`;
        }
        
        if (gameData.timeLeft !== undefined && timeLeftDisplay) {
            timeLeftDisplay.textContent = `Tid: ${gameData.timeLeft}s`;
        }
    }
    
    // Tilføj besked til game chat
    function addGameMessage(data) {
        if (!chatMessages) return;
        
        const msgEl = document.createElement('div');
        
        if (data.username === 'System') {
            msgEl.className = 'system-message';
            msgEl.textContent = data.message;
        } else {
            msgEl.textContent = `${data.username}: ${data.message}`;
            
            if (data.guessedCorrectly) {
                msgEl.style.color = '#4caf50';
                msgEl.style.fontWeight = 'bold';
            }
        }
        
        chatMessages.appendChild(msgEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Send besked i game chat
    function sendGameMessage() {
        if (!chatInput) return;
        
        const message = chatInput.value.trim();
        if (message === '') return;
        
        socket.emit('chatMessage', { username, message });
        chatInput.value = '';
    }
    
    // Vis resultatskærm
    function showGameResults(results) {
        if (!gameEndScreen || !resultsTable) return;
        
        // Vis top 3 vindere
        if (results.winners && results.winners.length > 0) {
            // Første plads
            if (results.winners[0] && firstPlaceEl) {
                firstPlaceEl.querySelector('.winner-name').textContent = results.winners[0].username;
                firstPlaceEl.querySelector('.winner-score').textContent = results.winners[0].score;
            }
            
            // Anden plads
            if (results.winners[1] && secondPlaceEl) {
                secondPlaceEl.querySelector('.winner-name').textContent = results.winners[1].username;
                secondPlaceEl.querySelector('.winner-score').textContent = results.winners[1].score;
            } else if (secondPlaceEl) {
                secondPlaceEl.style.visibility = 'hidden';
            }
            
            // Tredje plads
            if (results.winners[2] && thirdPlaceEl) {
                thirdPlaceEl.querySelector('.winner-name').textContent = results.winners[2].username;
                thirdPlaceEl.querySelector('.winner-score').textContent = results.winners[2].score;
            } else if (thirdPlaceEl) {
                thirdPlaceEl.style.visibility = 'hidden';
            }
        }
        
        // Vis alle resultater i tabellen
        resultsTable.innerHTML = `
            <tr>
                <th>Placering</th>
                <th>Spiller</th>
                <th>Score</th>
            </tr>
        `;
        
        if (results.allPlayers && results.allPlayers.length > 0) {
            results.allPlayers.forEach((player, index) => {
                const row = document.createElement('tr');
                
                // Fremhæv egen spiller
                if (player.username === username) {
                    row.style.fontWeight = 'bold';
                    row.style.backgroundColor = 'rgba(74, 144, 226, 0.1)';
                }
                
                row.innerHTML = `
                    <td>#${index + 1}</td>
                    <td>${player.username}</td>
                    <td>${player.score}</td>
                `;
                
                resultsTable.appendChild(row);
            });
        }
        
        showScreen(gameEndScreen);
    }

    // === SOCKET.IO EVENT HANDLERS ===
    
    // Når en lobby er oprettet
    socket.on('lobbyCreated', (data) => {
        hideLoading();
        currentLobbyId = data.lobbyId;
        isLobbyOwner = true;
        
        // Opdater UI
        initializeLobbyScreen();
        updateLobbyInfo(data.lobbyInfo);
        updateLobbyPlayersList(data.lobbyInfo.players);
        
        // Send velkomstbesked
        addLobbyMessage({
            username: 'System',
            message: `Velkommen til lobby "${data.lobbyInfo.name}"! Del koden med dine venner for at spille sammen.`
        });
        
        showScreen(lobbyScreen);
    });
    
    // Når man har tilsluttet sig en lobby
    socket.on('joinedLobby', (data) => {
        hideLoading();
        currentLobbyId = data.lobbyId;
        isLobbyOwner = data.lobbyInfo.players[socket.id]?.isOwner || false;
        
        // Opdater UI
        initializeLobbyScreen();
        updateLobbyInfo(data.lobbyInfo);
        updateLobbyPlayersList(data.lobbyInfo.players);
        
        // Send velkomstbesked
        addLobbyMessage({
            username: 'System',
            message: `Du har tilsluttet dig "${data.lobbyInfo.name}"!`
        });
        
        showScreen(lobbyScreen);
    });
    
    // Når en ny spiller tilslutter sig lobbyen
    socket.on('playerJoinedLobby', (player) => {
        // Velkomstbesked
        addLobbyMessage({
            username: 'System',
            message: `${player.username} har tilsluttet sig lobbyen!`
        });
    });
    
    // Når en spiller forlader lobbyen
    socket.on('playerLeftLobby', (data) => {
        // Farvel besked
        const departedPlayerName = (data.playerId === socket.id)
            ? 'Du'
            : (data.playerName || 'En spiller');
            
        addLobbyMessage({
            username: 'System',
            message: `${departedPlayerName} har forladt lobbyen.`
        });
        
        // Hvis en ny ejer er blevet udpeget
        if (data.wasOwner && data.newOwnerId === socket.id) {
            isLobbyOwner = true;
            initializeLobbyScreen();
            
            addLobbyMessage({
                username: 'System',
                message: 'Du er nu lobby-ejeren!'
            });
        }
    });
    
    // Når der er en ny lobby-ejer
    socket.on('newOwner', (data) => {
        if (data.newOwnerId === socket.id) {
            isLobbyOwner = true;
            initializeLobbyScreen();
            
            addLobbyMessage({
                username: 'System',
                message: 'Du er nu lobby-ejeren!'
            });
        } else {
            addLobbyMessage({
                username: 'System',
                message: `${data.newOwnerName} er nu lobby-ejeren.`
            });
        }
    });
    
    // Opdatering af spillerlisten i lobbyen
    socket.on('updateLobbyPlayers', (players) => {
        updateLobbyPlayersList(players);
    });
    
    // Opdatering af lobby-indstillinger
    socket.on('lobbySettingsUpdated', (settings) => {
        hideLoading();
        lobbySettings = settings;
        updateLobbyInfo(settings);
        
        addLobbyMessage({
            username: 'System',
            message: 'Lobby-indstillingerne er blevet opdateret.'
        });
    });
    
    // Modtagelse af liste over lobbyer
    socket.on('lobbiesList', (lobbies) => {
        hideLoading();
        const filteredLobbies = filterLobbies(lobbies);
        renderLobbies(filteredLobbies);
    });
    
    // Opdatering af lobby-listen
    socket.on('lobbyListUpdated', () => {
        if (browseLobbiesScreen.style.display === 'block') {
            fetchLobbies();
        }
    });
    
    // Besked om at spillet starter
    socket.on('gameStarting', () => {
        addLobbyMessage({
            username: 'System',
            message: 'Spillet starter om et øjeblik...'
        });
        
        showLoading('Forbereder spil...');
        clearCanvas();
        
        setTimeout(() => {
            showScreen(gameScreen);
            hideLoading();
        }, 1500);
    });
    
    // Ny runde
    socket.on('newRound', (gameData) => {
        hideLoading();
        currentDrawer = gameData.currentDrawer;
        
        // Nulstil canvas hvis nødvendigt
        if (gameData.resetCanvas) {
            clearCanvas();
        }
        
        // Opdater spil-info
        updateGameInfo(gameData);
        
        // Aktiver/deaktiver tegneværktøjer
        if (canvas) {
            if (socket.id === gameData.currentDrawer) {
                canvas.style.pointerEvents = 'auto';
                addGameMessage({
                    username: 'System',
                    message: `Du skal tegne: ${gameData.word}`
                });
            } else {
                canvas.style.pointerEvents = 'none';
                addGameMessage({
                    username: 'System',
                    message: `${gameData.drawerName || 'En spiller'} tegner nu!`
                });
            }
        }
    });
    
    // Timer opdatering
    socket.on('timerUpdate', (data) => {
        if (timeLeftDisplay) {
            timeLeftDisplay.textContent = `Tid: ${data.timeLeft}s`;
        }
    });
    
    // Besked
    socket.on('chatMessage', (data) => {
        if (gameScreen.style.display === 'block') {
            addGameMessage(data);
        } else if (lobbyScreen.style.display === 'block') {
            addLobbyMessage(data);
        }
    });
    
    // Opdatering af spillere i spil
    socket.on('updatePlayers', (players) => {
        updateGameLeaderboard(players);
    });
    
    // Når en spiller gætter korrekt
    socket.on('playerGuessed', (data) => {
        // Opdater leaderboard
        socket.emit('requestPlayers');
    });
    
    // Når spillet slutter
    socket.on('gameEnded', (results) => {
        if (results.returnToLobby) {
            showScreen(lobbyScreen);
            addLobbyMessage({
                username: 'System',
                message: results.reason || 'Spillet er afsluttet.'
            });
        } else {
            showGameResults(results);
        }
    });
    
    // Tilbage til lobby efter spil
    socket.on('returnToLobby', () => {
        showScreen(lobbyScreen);
    });
    
    // Fejlhåndtering
    socket.on('error', (error) => {
        hideLoading();
        showError(error.message || 'Der opstod en fejl.');
    });

    // === EVENT LISTENERS ===
    
    // Main Menu
    createLobbyBtn.addEventListener('click', () => {
        if (!validateUsername()) return;
        showScreen(createLobbyScreen);
    });
    
    joinLobbyBtn.addEventListener('click', () => {
        if (!validateUsername()) return;
        showScreen(joinLobbyScreen);
    });
    
    browseLobbiesBtn.addEventListener('click', () => {
        if (!validateUsername()) return;
        showScreen(browseLobbiesScreen);
        fetchLobbies();
    });
    
    // Create Lobby Screen
    createLobbySubmitBtn.addEventListener('click', createLobby);
    backToMainFromCreateBtn.addEventListener('click', () => showScreen(mainMenu));
    
    // Join Lobby Screen
    joinLobbySubmitBtn.addEventListener('click', joinLobbyWithCode);
    backToMainFromJoinBtn.addEventListener('click', () => showScreen(mainMenu));
    
    // Browse Lobbies Screen
    refreshLobbiesBtn.addEventListener('click', fetchLobbies);
    backToMainFromBrowseBtn.addEventListener('click', () => showScreen(mainMenu));
    
    // Lobby filtreringshåndtering
    lobbySearchInput.addEventListener('input', () => {
        socket.emit('getLobbies');
    });
    
    hideFullLobbiesCheckbox.addEventListener('change', () => {
        socket.emit('getLobbies');
    });
    
    hideInProgressCheckbox.addEventListener('change', () => {
        socket.emit('getLobbies');
    });
    
    // Lobby Screen
    copyLobbyCodeBtn.addEventListener('click', () => {
        if (currentLobbyId) {
            copyToClipboard(currentLobbyId);
        }
    });
    
    saveSettingsBtn.addEventListener('click', updateLobbySettings);
    
    startGameBtn.addEventListener('click', startGame);
    
    leaveLobbyBtn.addEventListener('click', leaveLobby);
    
    // Lobby chat
    lobbyChatSendBtn.addEventListener('click', sendLobbyMessage);
    lobbyChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendLobbyMessage();
        }
    });
    
    // Game Screen
    if (penSizeSlider) {
        penSizeSlider.addEventListener('input', function() {
            penSize = parseInt(this.value);
            updatePenSizeDisplay();
        });
    }
    
    if (colorPicker) {
        colorPicker.addEventListener('input', function() {
            currentColor = this.value;
            if (!isEraser) {
                updatePenSizeDisplay();
            }
        });
    }
    
    if (eraserButton) {
        eraserButton.addEventListener('click', setEraser);
    }
    
    if (undoButton) {
        undoButton.addEventListener('click', undo);
    }
    
    if (redoButton) {
        redoButton.addEventListener('click', redo);
    }
    
    // Game chat
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendGameMessage();
        }
    });
    
    // Canvas events
    if (canvas) {
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);
        canvas.addEventListener('mouseenter', resumeDrawing);
        
        // Touch support
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            startDrawing(mouseEvent);
        });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!isDrawing) return;
            
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            draw(mouseEvent);
        });
        
        canvas.addEventListener('touchend', stopDrawing);
    }
    
    // Game End Screen
    returnToLobbyBtn.addEventListener('click', () => {
        showScreen(lobbyScreen);
    });
    
    // Error Modal
    errorOkBtn.addEventListener('click', () => {
        errorModal.style.display = 'none';
    });
    
    closeModalBtn.addEventListener('click', () => {
        errorModal.style.display = 'none';
    });
    
    // Luk modal ved klik udenfor
    window.addEventListener('click', (e) => {
        if (e.target === errorModal) {
            errorModal.style.display = 'none';
        }
    });

    // === INITIALISERING VED OPSTART ===
    initializeSliders();
    updatePenSizeDisplay();
    
    // Forsøg at hente navn fra localStorage
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
        mainUsernameInput.value = savedUsername;
    }
    
    showScreen(mainMenu);
    console.log('Tegn og Gæt er indlæst og klar!');
});
