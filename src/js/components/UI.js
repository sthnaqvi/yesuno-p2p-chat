// UI state
var chat = document.getElementById('chat');
var messageInput = document.getElementById('messageInput');
var connectionStatus = document.getElementById('connectionStatus');
var roomInput = document.getElementById('roomInput');
var peerNameDisplay = document.getElementById('peerName');
var connectionPanel = document.getElementById('connectionPanel');
var chatContainer = document.getElementById('chatContainer');
var typingIndicator = null;

// Notification sound state
var isSoundEnabled = localStorage.getItem('soundEnabled') === 'true'; // Default to false (muted)
var unreadCount = 0;

function updatePeerName(name) {
  if (peerNameDisplay) {
    peerNameDisplay.innerHTML = `
      <div class="flex items-center justify-center space-x-2">
        <i data-feather="user" class="w-4 h-4"></i>
        <span>You: <strong>${name}</strong></span>
      </div>
    `;
    peerNameDisplay.style.display = 'flex';
    peerNameDisplay.style.opacity = '1';
    peerNameDisplay.style.pointerEvents = 'auto';
    feather.replace();
  }
}

function updateRemotePeerName(name) {
  if (peerNameDisplay) {
    peerNameDisplay.innerHTML = `
      <div class="flex items-center justify-center space-x-4">
        <div class="flex items-center space-x-2">
          <i data-feather="user" class="w-4 h-4"></i>
          <span>You: <strong>${peer_name}</strong></span>
        </div>
        <div class="w-px h-4 bg-green-300 dark:bg-green-600"></div>
        <div class="flex items-center space-x-2">
          <i data-feather="users" class="w-4 h-4"></i>
          <span>Peer: <strong>${name}</strong></span>
        </div>
      </div>
    `;
    peerNameDisplay.style.display = 'flex';
    peerNameDisplay.style.opacity = '1';
    peerNameDisplay.style.pointerEvents = 'auto';
    feather.replace();
  }
}

function generateAvatarSVG(name, size) {
  size = size || 32;
  // Deterministic color based on name
  var hash = 0;
  for (var i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  var hue = hash % 360;
  var color = `hsl(${hue}, 70%, 60%)`;
  var colorDark = `hsl(${hue}, 70%, 45%)`;

  // Initials
  var initials = name.split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2);

  // SVG string with gradient and improved styling
  var svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad-${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${colorDark};stop-opacity:1" />
      </linearGradient>
    </defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#grad-${hash})" />
    <text x="50%" y="50%" text-anchor="middle" font-size="${size / 2.5}" fill="#fff" font-family="system-ui, -apple-system, sans-serif" font-weight="600" dominant-baseline="middle" alignment-baseline="middle">${initials}</text>
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
  nameSpan.textContent = name || (sender === 'self' ? peer_name : remote_peer_name);

  var textSpan = document.createElement('span');
  textSpan.className = 'message-text';
  textSpan.textContent = text;

  // Add timestamp
  var timeSpan = document.createElement('span');
  timeSpan.className = 'message-time';
  var now = new Date();
  var timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  var dateString = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  timeSpan.textContent = timeString;
  timeSpan.setAttribute('data-date', dateString); // Use data-date for tooltip

  bubbleDiv.appendChild(nameSpan);
  bubbleDiv.appendChild(textSpan);
  bubbleDiv.appendChild(timeSpan);

  messageDiv.appendChild(avatarImg);
  messageDiv.appendChild(bubbleDiv);
  chat.appendChild(messageDiv);

  // Play notification sound only for received messages (peer messages)
  if (sender === 'peer') {
    playNotificationSound();
    // Update unread count only for received messages
    updateUnreadCount();
  }

  // Smooth scroll to bottom
  setTimeout(function () {
    chat.scrollTo({
      top: chat.scrollHeight,
      behavior: 'smooth'
    });
  }, 100);
}

function addSystemMessage(text) {
  var messageDiv = document.createElement('div');
  messageDiv.className = 'message system';

  var now = new Date();
  var timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  var dateString = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  messageDiv.innerHTML = `
    <div class="flex items-center justify-center space-x-2">
      <i data-feather="alert-triangle" class="w-4 h-4"></i>
      <span>${text}</span>
      <span class="text-xs opacity-75">${dateString} ${timeString}</span>
    </div>
  `;
  chat.appendChild(messageDiv);
  if (typeof feather !== 'undefined') {
    feather.replace();
  }

  // Smooth scroll to bottom
  setTimeout(function () {
    chat.scrollTo({
      top: chat.scrollHeight,
      behavior: 'smooth'
    });
  }, 100);
}

function showChat() {
  if (connectionPanel) connectionPanel.classList.add('hidden');
  if (chatContainer) {
    chatContainer.classList.remove('hidden');
    chatContainer.style.display = 'flex';
  }
  if (messageInput) {
    messageInput.style.display = 'block';
    messageInput.disabled = false;
    messageInput.focus();
  }
  // Don't show peer name display here - it will be shown when connection is established
}

function hideChat() {
  if (connectionPanel) connectionPanel.classList.remove('hidden');
  if (chatContainer) {
    chatContainer.classList.add('hidden');
    chatContainer.style.display = 'none';
  }
  if (messageInput) {
    messageInput.style.display = 'none';
  }
  if (peerNameDisplay) {
    // Hide peer name display completely
    peerNameDisplay.style.display = 'none';
    peerNameDisplay.style.opacity = '0';
    peerNameDisplay.style.pointerEvents = 'none';
  }
}

function updateStatus(text, type) {
  if (connectionStatus) {
    connectionStatus.textContent = text;
    connectionStatus.className = 'mt-4 text-center text-xs font-medium';

    // Add status-specific styling
    if (type === 'connecting') {
      connectionStatus.classList.add('connecting', 'text-blue-600', 'dark:text-blue-400');
    } else if (type === 'connected') {
      connectionStatus.classList.add('text-green-600', 'dark:text-green-400');
    } else if (type === 'error') {
      connectionStatus.classList.add('text-red-600', 'dark:text-red-400');
    } else {
      connectionStatus.classList.add('text-gray-600', 'dark:text-gray-400');
    }
  }
}

function getRoomName() {
  return roomInput ? roomInput.value.trim() : '';
}

function setMessageInputHandler(handler) {
  if (messageInput) {
    // Remove old handler to avoid conflicts
    messageInput.onkeydown = null;

    // Add new handler that includes typing detection
    messageInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        handler(e);
      }
    });

    // Add input handler for typing detection
    messageInput.addEventListener('input', function (e) {
      if (typeof handleTyping === 'function' && is_connected) {
        handleTyping();
      }
    });
  }
}

function setRoomInputHandler(handler) {
  if (roomInput) {
    roomInput.addEventListener('keypress', handler);
  }
}

function clearMessageInput() {
  if (messageInput) {
    messageInput.value = '';
  }
}

// Enhanced UI functions
function showLoadingState() {
  updateStatus('Connecting to peer...', 'connecting');
  if (roomInput) roomInput.disabled = true;
  var joinButton = document.getElementById('joinButton');
  if (joinButton) joinButton.disabled = true;
  showLoadingSpinner();
}

function hideLoadingState() {
  if (roomInput) roomInput.disabled = false;
  var joinButton = document.getElementById('joinButton');
  if (joinButton) joinButton.disabled = false;
  hideLoadingSpinner();
}

function showLoadingSpinner() {
  var spinner = document.getElementById('loadingSpinner');
  if (spinner) {
    spinner.classList.remove('hidden');
  }
}

function hideLoadingSpinner() {
  var spinner = document.getElementById('loadingSpinner');
  if (spinner) {
    spinner.classList.add('hidden');
  }
}

function showError(message) {
  updateStatus(message, 'error');
  hideLoadingState();

  // Add error animation
  if (connectionStatus) {
    connectionStatus.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(function () {
      connectionStatus.style.animation = '';
    }, 500);
  }
}

function showSuccess(message) {
  updateStatus(message, 'connected');
  hideLoadingState();
}

// Add shake animation for errors
var style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);

function showTypingIndicator() {
  if (!typingIndicator) {
    typingIndicator = document.createElement('div');
    typingIndicator.className = 'message peer typing-indicator';
    typingIndicator.style.height = '48px'; // Fixed height to prevent shifting
    typingIndicator.innerHTML = `
      <img class="avatar-img" src="${generateAvatarSVG(remote_peer_name || 'Peer')}" alt="avatar" />
      <div class="message-bubble">
        <div class="typing-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    `;
  }

  // Only add if not already in chat
  if (!chat.contains(typingIndicator)) {
    chat.appendChild(typingIndicator);

    // Smooth scroll to bottom
    setTimeout(function () {
      chat.scrollTo({
        top: chat.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);
  }
}

function hideTypingIndicator() {
  if (typingIndicator && chat.contains(typingIndicator)) {
    chat.removeChild(typingIndicator);
  }
}

function showUserTypingIndicator() {
  var indicator = document.getElementById('userTypingIndicator');
  if (indicator) {
    indicator.style.opacity = '1';
    indicator.style.pointerEvents = 'auto';
  }
}

function hideUserTypingIndicator() {
  var indicator = document.getElementById('userTypingIndicator');
  if (indicator) {
    indicator.style.opacity = '0';
    indicator.style.pointerEvents = 'none';
  }
}

// Add typing indicator styles
var typingStyle = document.createElement('style');
typingStyle.textContent = `
  .message {
    min-height: 48px;
    display: flex;
    align-items: flex-end;
    width: 100%;
    margin: 8px 0;
    position: relative;
    animation: fadeInUp 0.3s ease-out;
  }
  
  .message-bubble {
    background: #f3f4f6;
    color: #374151;
    border-radius: 16px;
    padding: 8px 12px;
    min-width: 60px;
    max-width: 70%;
    word-break: break-word;
    display: flex;
    flex-direction: column;
    position: relative;
    transition: all 0.2s ease;
  }
  
  .message.self .message-bubble {
    background: #6366f1;
    color: #fff;
    border-bottom-right-radius: 4px;
    border-bottom-left-radius: 16px;
    align-items: flex-end;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
  }
  
  .message.peer .message-bubble {
    background: #f3f4f6;
    color: #374151;
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 16px;
    align-items: flex-start;
  }
  
  .dark .message.peer .message-bubble {
    background: #374151;
    color: #f9fafb;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
  
  /* Enhanced message styling */
  .message-name {
    font-size: 0.75rem;
    font-weight: 700;
    margin-bottom: 2px;
    opacity: 0.9;
    text-transform: capitalize;
    color: #6b7280;
  }
  
  .message.self .message-name {
    color: rgba(255, 255, 255, 0.8);
  }
  
  .message.peer .message-name {
    color: #374151;
    font-weight: 600;
  }
  
  .dark .message.peer .message-name {
    color: #d1d5db;
  }
  
  .message-text {
    font-size: 0.875rem;
    font-weight: 400;
    line-height: 1.4;
    margin-bottom: 4px;
    color: #1f2937;
  }
  
  .message.self .message-text {
    color: #ffffff;
    font-weight: 500;
  }
  
  .message.peer .message-text {
    color: #111827;
    font-weight: 400;
  }
  
  .dark .message.peer .message-text {
    color: #f9fafb;
  }
  
  .message-time {
    font-size: 0.65rem;
    font-weight: 500;
    opacity: 0.7;
    align-self: flex-end;
    margin-top: 2px;
    cursor: pointer;
    position: relative;
    transition: opacity 0.2s ease;
  }
  
  .message-time:hover {
    opacity: 1;
  }
  
  .message-time:hover::after {
    content: attr(data-date);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: #374151;
    color: white;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.75rem;
    white-space: nowrap;
    z-index: 1000;
    margin-bottom: 8px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-weight: 500;
    animation: tooltipFadeIn 0.2s ease-out;
  }
  
  .message-time:hover::before {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: #374151;
    margin-bottom: -6px;
    z-index: 1000;
    animation: tooltipFadeIn 0.2s ease-out;
  }
  
  @keyframes tooltipFadeIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
  
  .dark .message-time:hover::after {
    background: #f3f4f6;
    color: #1f2937;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }
  
  .dark .message-time:hover::before {
    border-top-color: #f3f4f6;
  }
  
  .message.self .message-time {
    color: rgba(255, 255, 255, 0.8);
  }
  
  .message.peer .message-time {
    color: rgba(55, 65, 81, 0.7);
  }
  
  .dark .message.peer .message-time {
    color: rgba(249, 250, 251, 0.7);
  }
  
  .typing-indicator .message-bubble {
    background: #f3f4f6;
    color: #6b7280;
    border-radius: 16px;
    padding: 8px 12px;
    min-width: 60px;
    max-width: 70%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
  }
  
  .dark .typing-indicator .message-bubble {
    background: #374151;
    color: #9ca3af;
  }
  
  .typing-dots {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .typing-dots .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: currentColor;
    animation: typing-bounce 1.4s infinite ease-in-out;
  }
  
  .typing-dots .dot:nth-child(1) {
    animation-delay: -0.32s;
  }
  
  .typing-dots .dot:nth-child(2) {
    animation-delay: -0.16s;
  }
  
  .typing-dots-small {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  
  .typing-dots-small .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: currentColor;
    animation: typing-bounce-small 1.4s infinite ease-in-out;
  }
  
  .typing-dots-small .dot:nth-child(1) {
    animation-delay: -0.32s;
  }
  
  .typing-dots-small .dot:nth-child(2) {
    animation-delay: -0.16s;
  }
  
  @keyframes typing-bounce {
    0%, 80%, 100% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  @keyframes typing-bounce-small {
    0%, 80%, 100% {
      transform: scale(0.7);
      opacity: 0.4;
    }
    40% {
      transform: scale(1);
      opacity: 0.8;
    }
  }
  
  .typing-indicator {
    animation: fadeInUp 0.3s ease-out;
  }
  
  /* Smooth transitions for typing indicators */
  #userTypingIndicator {
    transition: opacity 0.2s ease, pointer-events 0.2s ease;
  }
  
  #peerName {
    transition: opacity 0.2s ease, pointer-events 0.2s ease;
  }
  
  /* Enhanced system message styling */
  .message.system {
    background: #fef3c7;
    color: #92400e;
    margin: 12px auto;
    text-align: center;
    font-style: italic;
    border-radius: 12px;
    padding: 10px 12px;
    box-shadow: 0 2px 4px rgba(251, 191, 36, 0.2);
    font-size: 0.8rem;
    font-weight: 500;
    max-width: 80%;
    border: 1px solid #fde68a;
    transition: all 0.2s ease;
  }
  
  .dark .message.system {
    background: rgba(251, 191, 36, 0.1);
    color: #fde68a;
    border-color: #92400e;
    box-shadow: 0 2px 8px rgba(251, 191, 36, 0.1);
  }
`;
document.head.appendChild(typingStyle);

// Create audio context for notification sound
function createNotificationSound({
  waveform = 'sine',          // sine, triangle, square, sawtooth
  freqs = [420, 620, 420],    // Hz values for frequency transitions
  duration = 0.6,             // total duration in seconds
  volume = 0.2,               // initial gain value
  rampType = 'exponential',   // linear or exponential
} = {}) {
  try {
    var audioContext = new (window.AudioContext || window.webkitAudioContext)();
    var oscillator = audioContext.createOscillator();
    var gainNode = audioContext.createGain();
    var now = audioContext.currentTime;

    oscillator.type = waveform;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Frequency transitions
    var step = duration / freqs.length;
    freqs.forEach((freq, i) => {
      console.log(now + step * i)
      oscillator.frequency.setValueAtTime(freq, now + step * i);
    });

    // Volume ramp
    gainNode.gain.setValueAtTime(volume, now);
    if (rampType === 'exponential') {
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    } else {
      gainNode.gain.linearRampToValueAtTime(0.001, now + duration);
    }

    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch (error) {
    console.log('Audio context not supported, using fallback');
    // Fallback: try to play a simple beep using HTML5 Audio
    try {
      var audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
      audio.play();
    } catch (fallbackError) {
      console.log('Fallback audio also failed');
    }
  }
}


function updateSoundButton() {
  var soundIcon = document.getElementById('soundIcon');
  var soundButton = document.getElementById('soundButton');

  if (soundIcon && soundButton) {
    if (isSoundEnabled) {
      soundIcon.innerHTML = '<i data-feather="volume-2" class="w-5 h-5 text-gray-600 dark:text-gray-300"></i>';
      soundButton.title = 'Mute notifications';
    } else {
      soundIcon.innerHTML = '<i data-feather="volume-x" class="w-5 h-5 text-gray-600 dark:text-gray-300"></i>';
      soundButton.title = 'Unmute notifications';
    }

    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }
}

function toggleSound() {
  isSoundEnabled = !isSoundEnabled;
  localStorage.setItem('soundEnabled', isSoundEnabled);
  updateSoundButton();

  // Test sound when enabling
  if (isSoundEnabled) {
    setTimeout(function () {
      createNotificationSound();
    }, 100);
  }
}

function playNotificationSound() {
  if (isSoundEnabled) {
    createNotificationSound();
  }
}

function updateUnreadCount() {
  // Only update if window is not focused or tab is not visible
  if (!document.hasFocus() || document.hidden) {
    unreadCount++;
    updateFavicon();
  }
}

function updateFavicon() {
  var favicon = document.querySelector('link[rel="icon"]');
  if (favicon && unreadCount > 0) {
    // Create a canvas to draw the favicon with badge
    var canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    var ctx = canvas.getContext('2d');

    // Load original favicon
    var img = new Image();
    img.onload = function () {
      ctx.drawImage(img, 0, 0, 32, 32);

      // Draw notification badge
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(24, 8, 8, 0, 2 * Math.PI);
      ctx.fill();

      // Draw count text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var countText = unreadCount > 99 ? '99+' : unreadCount.toString();
      ctx.fillText(countText, 24, 8);

      // Update favicon
      favicon.href = canvas.toDataURL();
    };
    img.src = favicon.href;
  } else if (favicon && unreadCount === 0) {
    // Reset to original favicon
    favicon.href = 'logo_assets/favicon_32x32.png';
  }
}

function resetUnreadCount() {
  unreadCount = 0;
  updateFavicon();
}

// Add event listeners for window focus and visibility
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) {
    resetUnreadCount();
  }
});

window.addEventListener('focus', function () {
  resetUnreadCount();
}); 