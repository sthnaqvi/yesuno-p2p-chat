// Connection state
var peer = null;
var conn = null;
var is_connected = false;
var is_connecting = false;
var current_config_index = 0;
var peer_name = generateRandomName();
var remote_peer_name = null;
var has_received_name = false;
var has_sent_name = false;
var reconnect_attempts = 0;
var MAX_RECONNECT_ATTEMPTS = 3;
var connection_timeout = null;

// Typing indicator state
var is_typing = false;
var typing_timeout = null;
var peer_is_typing = false;
var peer_typing_timeout = null;
var TYPING_TIMEOUT = 1000; // 1 second delay

// Update UI with our name immediately
updatePeerName(peer_name);

function generateRandomName() {
  var adjectives = ['Happy', 'Clever', 'Brave', 'Swift', 'Calm', 'Bright', 'Wise', 'Kind', 'Bold', 'Gentle', 'Quick', 'Smart', 'Friendly', 'Creative', 'Energetic'];
  var nouns = ['Panda', 'Tiger', 'Eagle', 'Dolphin', 'Wolf', 'Fox', 'Bear', 'Lion', 'Hawk', 'Owl', 'Dragon', 'Phoenix', 'Unicorn', 'Penguin', 'Koala'];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
}

function cleanup(full = false) {
  if (connection_timeout) {
    clearTimeout(connection_timeout);
    connection_timeout = null;
  }
  
  if (typing_timeout) {
    clearTimeout(typing_timeout);
    typing_timeout = null;
  }
  
  if (peer_typing_timeout) {
    clearTimeout(peer_typing_timeout);
    peer_typing_timeout = null;
  }
  
  if (conn) {
    try {
      conn.close();
    } catch (e) {
      console.log('Error closing connection:', e);
    }
    conn = null;
  }
  
  if (peer && full) {
    try {
      peer.destroy();
    } catch (e) {
      console.log('Error destroying peer:', e);
    }
    peer = null;
  }
  
  is_connected = false;
  is_connecting = false;
  is_typing = false;
  peer_is_typing = false;
  
  if (full) {
    remote_peer_name = null;
    has_received_name = false;
    has_sent_name = false;
    reconnect_attempts = 0;
    hideChat();
    hideTypingIndicator();
    
    // Hide peer name display completely
    if (peerNameDisplay) {
      peerNameDisplay.style.display = 'none';
      peerNameDisplay.style.opacity = '0';
      peerNameDisplay.style.pointerEvents = 'none';
    }
  }
}

function connectWithFallback(room_name, config_index) {
  config_index = config_index || 0;
  
  if (is_connecting) {
    console.log('Already attempting to connect...');
    return;
  }

  if (config_index >= PEERJS_CONFIGS.length) {
    showError('All connection servers are unavailable. Please try again later.');
    cleanup(true);
    return;
  }

  if (reconnect_attempts >= MAX_RECONNECT_ATTEMPTS) {
    showError('Connection unstable. Please try again later.');
    cleanup(true);
    return;
  }

  is_connecting = true;
  current_config_index = config_index;
  var config = PEERJS_CONFIGS[config_index];
  
  showLoadingState();
  updateStatus(`Connecting to server ${config_index + 1}...`, 'connecting');
  
  // Set connection timeout
  connection_timeout = setTimeout(function() {
    if (is_connecting) {
      console.log('Connection timeout, trying next server...');
      reconnect_attempts++;
      cleanup(false);
      setTimeout(function() {
        connectWithFallback(room_name, config_index + 1);
      }, 500);
    }
  }, 15000); // Increased timeout to 15 seconds
  
  try {
    cleanup(true);
    peer = new Peer(room_name, config);
    
    peer.on('open', function(id) {
      console.log('Connected to signaling server with ID:', id);
      clearTimeout(connection_timeout);
      connection_timeout = null;
      
      updateStatus('Waiting for someone to join...', 'connecting');
      
      peer.on('connection', function(c) {
        console.log('Peer connection received');
        if (conn) {
          console.log('Connection already exists, closing new one');
          c.close();
          return;
        }
        conn = c;
        setupConnection();
      });
    });

    peer.on('error', function(err) {
      console.error('PeerJS error:', err);
      clearTimeout(connection_timeout);
      connection_timeout = null;
      
      if (err.type === 'unavailable-id') {
        console.log('ID unavailable, trying to connect to existing peer...');
        cleanup(false);
        peer = new Peer(null, config);
        
        peer.on('open', function(id) {
          console.log('Connecting to peer with ID:', room_name);
          updateStatus('Connecting to peer...', 'connecting');
          
          // Set connection timeout for peer connection
          connection_timeout = setTimeout(function() {
            if (is_connecting && !is_connected) {
              console.log('Peer connection timeout');
              reconnect_attempts++;
              cleanup(false);
              setTimeout(function() {
                connectWithFallback(room_name, config_index + 1);
              }, 500);
            }
          }, 8000);
          
          conn = peer.connect(room_name, {
            reliable: true,
            serialization: 'json',
            metadata: { name: peer_name }
          });
          
          conn.on('open', function() {
            console.log('Connection established');
            clearTimeout(connection_timeout);
            connection_timeout = null;
            setupConnection();
          });
          
          conn.on('error', function(err) {
            console.error('Connection error:', err);
            clearTimeout(connection_timeout);
            connection_timeout = null;
            reconnect_attempts++;
            updateStatus('Connection failed. Trying another server...', 'error');
            setTimeout(function() {
              connectWithFallback(room_name, config_index + 1);
            }, 1000);
          });
        });
        
        peer.on('error', function(err) {
          console.error('Peer error:', err);
          clearTimeout(connection_timeout);
          connection_timeout = null;
          reconnect_attempts++;
          updateStatus('Connection failed. Trying another server...', 'error');
          setTimeout(function() {
            connectWithFallback(room_name, config_index + 1);
          }, 1000);
        });
      } else if (err.type === 'network' || err.type === 'server-error') {
        // Network or server errors - try next server
        reconnect_attempts++;
        updateStatus('Server error. Trying another server...', 'error');
        setTimeout(function() {
          connectWithFallback(room_name, config_index + 1);
        }, 1000);
      } else {
        // Other errors - try next server
        reconnect_attempts++;
        updateStatus('Connection failed. Trying another server...', 'error');
        setTimeout(function() {
          connectWithFallback(room_name, config_index + 1);
        }, 1000);
      }
    });

    peer.on('disconnected', function() {
      console.log('Disconnected from signaling server');
      if (!is_connected) {
        updateStatus('Connection lost. Trying to reconnect...', 'error');
        reconnect_attempts++;
        try {
          peer.reconnect();
        } catch (e) {
          console.log('Reconnect failed, trying next server');
          setTimeout(function() {
            connectWithFallback(room_name, config_index + 1);
          }, 1000);
        }
      }
    });

  } catch (error) {
    console.error('Error creating peer:', error);
    clearTimeout(connection_timeout);
    connection_timeout = null;
    reconnect_attempts++;
    showError('Connection failed. Trying another server...');
    setTimeout(function() {
      connectWithFallback(room_name, config_index + 1);
    }, 1000);
  }
}

function joinRoom() {
  var room_name = getRoomName();
  if (!room_name) {
    showError('Please enter a room name');
    return;
  }
  
  if (is_connecting) {
    console.log('Already attempting to connect...');
    return;
  }
  
  // Reset connection state
  reconnect_attempts = 0;
  current_config_index = 0;
  
  connectWithFallback(room_name);
}

function sendName() {
  if (conn && conn.open && is_connected && !has_sent_name) {
    try {
      conn.send(JSON.stringify({
        type: 'name',
        name: peer_name
      }));
      has_sent_name = true;
      console.log('Name sent:', peer_name);
    } catch (e) {
      console.error('Error sending name:', e);
    }
  }
}

function setupConnection() {
  is_connected = true;
  is_connecting = false;
  reconnect_attempts = 0;
  
  if (connection_timeout) {
    clearTimeout(connection_timeout);
    connection_timeout = null;
  }
  
  showSuccess('Connected! You can start chatting now.');
  showChat();
  
  // Show peer name display with your name initially
  if (peerNameDisplay) {
    peerNameDisplay.innerHTML = `
      <div class="flex items-center justify-center space-x-2">
        <i data-feather="user" class="w-4 h-4"></i>
        <span>You: <strong>${peer_name}</strong></span>
      </div>
    `;
    peerNameDisplay.style.display = 'flex';
    peerNameDisplay.style.opacity = '1';
    peerNameDisplay.style.pointerEvents = 'auto';
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }
  
  // Wait for connection to be fully open before sending name
  if (conn && conn.open) {
    sendName();
    addSystemMessage('Connected! Your name is: ' + peer_name);
  } else {
    // Wait for connection to open
    conn.on('open', function() {
      sendName();
      addSystemMessage('Connected! Your name is: ' + peer_name);
    });
  }
  
  conn.on('data', function(data) {
    console.log('Message received:', data);
    try {
      var parsed_data = JSON.parse(data);
      if (parsed_data.type === 'name') {
        remote_peer_name = parsed_data.name;
        updateRemotePeerName(remote_peer_name);
        addSystemMessage('Connected with: ' + remote_peer_name);
        if (!has_sent_name && conn && conn.open) {
          sendName();
        }
      } else if (parsed_data.type === 'typing') {
        handlePeerTyping(parsed_data.isTyping);
      } else if (parsed_data.text !== undefined) {
        if (parsed_data.name) {
          remote_peer_name = parsed_data.name;
          updateRemotePeerName(remote_peer_name);
        }
        addMessage(parsed_data.text, 'peer', remote_peer_name || 'Peer');
        // Hide typing indicator when message is received
        handlePeerTyping(false);
      }
    } catch (e) {
      console.error('Error parsing message:', e);
      addMessage(data, 'peer', remote_peer_name || 'Peer');
    }
  });
  
  conn.on('close', function() {
    console.log('Connection closed');
    if (reconnect_attempts < MAX_RECONNECT_ATTEMPTS) {
      cleanup(false);
      updateStatus('Connection lost. Trying to reconnect...', 'error');
      setTimeout(function() {
        connectWithFallback(getRoomName(), current_config_index);
      }, 2000);
    } else {
      cleanup(true);
      showError('Connection closed. You can try joining again.');
      addSystemMessage('Connection closed');
    }
  });
  
  conn.on('error', function(err) {
    console.error('Connection error:', err);
    if (reconnect_attempts < MAX_RECONNECT_ATTEMPTS) {
      updateStatus('Connection lost. Trying to reconnect...', 'error');
      setTimeout(function() {
        connectWithFallback(getRoomName(), current_config_index + 1);
      }, 2000);
    } else {
      cleanup(true);
      showError('Connection unstable. Please try again later.');
    }
  });
}

function sendTypingStatus(isTyping) {
  if (conn && conn.open && is_connected) {
    try {
      conn.send(JSON.stringify({
        type: 'typing',
        isTyping: isTyping
      }));
    } catch (e) {
      console.error('Error sending typing status:', e);
    }
  }
}

function handleTyping() {
  if (!is_typing) {
    is_typing = true;
    sendTypingStatus(true);
    showUserTypingIndicator();
  }
  
  // Clear existing timeout
  if (typing_timeout) {
    clearTimeout(typing_timeout);
  }
  
  // Set new timeout to stop typing indicator
  typing_timeout = setTimeout(function() {
    is_typing = false;
    sendTypingStatus(false);
    hideUserTypingIndicator();
  }, TYPING_TIMEOUT);
}

function handlePeerTyping(isTyping) {
  if (isTyping) {
    peer_is_typing = true;
    showTypingIndicator();
    
    // Clear existing timeout
    if (peer_typing_timeout) {
      clearTimeout(peer_typing_timeout);
    }
    
    // Set timeout to hide typing indicator
    peer_typing_timeout = setTimeout(function() {
      peer_is_typing = false;
      hideTypingIndicator();
    }, TYPING_TIMEOUT + 500); // Slightly longer timeout for peer
  } else {
    peer_is_typing = false;
    hideTypingIndicator();
    
    if (peer_typing_timeout) {
      clearTimeout(peer_typing_timeout);
      peer_typing_timeout = null;
    }
  }
}

function sendMessage(e) {
  if (e.key === 'Enter' && e.target.value.trim() && is_connected && conn && conn.open) {
    var msg = e.target.value.trim();
    try {
      // Stop typing indicator
      if (typing_timeout) {
        clearTimeout(typing_timeout);
        typing_timeout = null;
      }
      is_typing = false;
      sendTypingStatus(false);
      hideUserTypingIndicator();
      
      // Send message with name
      conn.send(JSON.stringify({ text: msg, name: peer_name }));
      addMessage(msg, 'self', peer_name);
      clearMessageInput();
    } catch (error) {
      console.error('Error sending message:', error);
      showError('Failed to send message. Please try again.');
    }
  } else if (e.target.value.trim() && is_connected && conn && conn.open) {
    // User is typing
    handleTyping();
  }
} 