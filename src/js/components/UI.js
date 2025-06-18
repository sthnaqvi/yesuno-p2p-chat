// UI state
var chat = document.getElementById('chat');
var messageInput = document.getElementById('messageInput');
var connectionStatus = document.getElementById('connectionStatus');
var roomInput = document.getElementById('roomInput');
var peerNameDisplay = document.getElementById('peerName');

function updatePeerName(name) {
  if (peerNameDisplay) {
    peerNameDisplay.innerHTML =
      '<span class="label">Your name:</span> ' +
      '<span class="my-name">' + name + '</span>';
  }
}

function updateRemotePeerName(name) {
  if (peerNameDisplay) {
    peerNameDisplay.innerHTML =
      '<span class="label">Your name:</span> ' +
      '<span class="my-name">' + peer_name + '</span> ' +
      '<span class="label">| Connected with:</span> ' +
      '<span class="peer-name-value">' + name + '</span>';
  }
}

function generateAvatarSVG(name, size) {
  size = size || 32;
  // Deterministic color based on name
  var hash = 0;
  for (var i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  var color = 'hsl(' + (hash % 360) + ',70%,60%)';
  // Initials
  var initials = name.split(' ').map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
  // SVG string with improved vertical centering
  var svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${color}" />
    <text x="50%" y="50%" text-anchor="middle" font-size="${size/2}" fill="#fff" font-family="Arial" dominant-baseline="middle" alignment-baseline="middle">${initials}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

function addMessage(text, sender, name) {
  var messageDiv = document.createElement('div');
  messageDiv.className = 'message ' + sender;
  
  var avatarImg = document.createElement('img');
  avatarImg.className = 'avatar-img';
  avatarImg.src = generateAvatarSVG(name || (sender === 'self' ? peer_name : remote_peer_name));
  avatarImg.alt = 'avatar';
  
  var bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble';
  
  var nameSpan = document.createElement('span');
  nameSpan.className = 'message-name';
  nameSpan.textContent = name;
  
  var textSpan = document.createElement('span');
  textSpan.className = 'message-text';
  textSpan.textContent = text;
  
  bubbleDiv.appendChild(nameSpan);
  bubbleDiv.appendChild(textSpan);
  
  messageDiv.appendChild(avatarImg);
  messageDiv.appendChild(bubbleDiv);
  chat.appendChild(messageDiv);
  chat.scrollTop = chat.scrollHeight;
}

function addSystemMessage(text) {
  var messageDiv = document.createElement('div');
  messageDiv.className = 'message system';
  messageDiv.textContent = text;
  chat.appendChild(messageDiv);
  chat.scrollTop = chat.scrollHeight;
}

function showChat() {
  chat.style.display = 'block';
  messageInput.style.display = 'block';
  messageInput.disabled = false;
  messageInput.focus();
}

function hideChat() {
  chat.style.display = 'none';
  messageInput.style.display = 'none';
}

function updateStatus(text) {
  connectionStatus.textContent = text;
}

function getRoomName() {
  return roomInput.value.trim();
}

function setMessageInputHandler(handler) {
  messageInput.onkeydown = handler;
}

function setRoomInputHandler(handler) {
  roomInput.addEventListener('keypress', handler);
}

function clearMessageInput() {
  messageInput.value = '';
} 