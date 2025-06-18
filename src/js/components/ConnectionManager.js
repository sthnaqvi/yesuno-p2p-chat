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

// Update UI with our name immediately
updatePeerName(peer_name);

function generateRandomName() {
  var adjectives = ['Happy', 'Clever', 'Brave', 'Swift', 'Calm', 'Bright', 'Wise', 'Kind', 'Bold', 'Gentle'];
  var nouns = ['Panda', 'Tiger', 'Eagle', 'Dolphin', 'Wolf', 'Fox', 'Bear', 'Lion', 'Hawk', 'Owl'];
  var random_num = Math.floor(Math.random() * 1);
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
}

function cleanup() {
  if (conn) {
    conn.close();
    conn = null;
  }
  if (peer) {
    peer.destroy();
    peer = null;
  }
  is_connected = false;
  is_connecting = false;
  remote_peer_name = null;
  has_received_name = false;
  has_sent_name = false;
  hideChat();
}

function connectWithFallback(room_name, config_index) {
  config_index = config_index || 0;
  
  if (is_connecting) {
    console.log('Already attempting to connect...');
    return;
  }

  if (config_index >= PEERJS_CONFIGS.length) {
    updateStatus('Connection failed. Please check your internet connection and try again.');
    is_connecting = false;
    return;
  }

  is_connecting = true;
  current_config_index = config_index;
  var config = PEERJS_CONFIGS[config_index];
  
  updateStatus('Connecting...');
  
  try {
    cleanup();
    peer = new Peer(room_name, config);
    
    peer.on('open', function(id) {
      console.log('Connected to signaling server with ID:', id);
      updateStatus('Waiting for someone to join...');
      
      peer.on('connection', function(c) {
        console.log('Peer connection received');
        conn = c;
        setupConnection();
      });
    });

    peer.on('error', function(err) {
      console.error('PeerJS error:', err);
      
      if (err.type === 'unavailable-id') {
        cleanup();
        peer = new Peer(null, config);
        
        peer.on('open', function(id) {
          console.log('Connecting to peer with ID:', room_name);
          updateStatus('Connecting to peer...');
          conn = peer.connect(room_name);
          
          conn.on('open', function() {
            console.log('Connection established');
            setupConnection();
          });
          
          conn.on('error', function(err) {
            console.error('Connection error:', err);
            updateStatus('Connection failed. Trying another server...');
            connectWithFallback(room_name, config_index + 1);
          });
        });
        
        peer.on('error', function(err) {
          console.error('Peer error:', err);
          updateStatus('Connection failed. Trying another server...');
          connectWithFallback(room_name, config_index + 1);
        });
      } else {
        updateStatus('Connection failed. Trying another server...');
        connectWithFallback(room_name, config_index + 1);
      }
    });

    peer.on('disconnected', function() {
      console.log('Disconnected from signaling server');
      updateStatus('Connection lost. Trying to reconnect...');
      connectWithFallback(room_name, config_index + 1);
    });

  } catch (error) {
    console.error('Error creating peer:', error);
    updateStatus('Connection failed. Trying another server...');
    connectWithFallback(room_name, config_index + 1);
  }
}

function joinRoom() {
  var room_name = getRoomName();
  if (!room_name) {
    updateStatus('Please enter a room name');
    return;
  }
  
  if (is_connecting) {
    console.log('Already attempting to connect...');
    return;
  }
  
  connectWithFallback(room_name);
}

function sendName() {
  if (conn && is_connected && !has_sent_name) {
    conn.send(JSON.stringify({
      type: 'name',
      name: peer_name
    }));
    has_sent_name = true;
  }
}

function setupConnection() {
  is_connected = true;
  is_connecting = false;
  updateStatus('Connected! You can start chatting now.');
  showChat();
  
  // Send our name immediately when connection is established
  sendName();
  addSystemMessage('Connected! Your name is: ' + peer_name);
  
  conn.on('data', function(data) {
    console.log('Message received:', data);
    try {
      var parsed_data = JSON.parse(data);
      if (parsed_data.type === 'name') {
        remote_peer_name = parsed_data.name;
        updateRemotePeerName(remote_peer_name);
        addSystemMessage('Connected with: ' + remote_peer_name);
        sendName();
      } else if (parsed_data.text !== undefined) {
        // Set remote_peer_name from message if present
        if (parsed_data.name) {
          remote_peer_name = parsed_data.name;
          updateRemotePeerName(remote_peer_name);
        }
        addMessage(parsed_data.text, 'peer', remote_peer_name || 'Peer');
      }
    } catch (e) {
      addMessage(data, 'peer', remote_peer_name || 'Peer');
    }
  });
  
  conn.on('close', function() {
    console.log('Connection closed');
    cleanup();
    updateStatus('Connection closed. You can try joining again.');
    addSystemMessage('Connection closed');
  });
  
  conn.on('error', function(err) {
    console.error('Connection error:', err);
    updateStatus('Connection lost. Trying to reconnect...');
    connectWithFallback(getRoomName(), current_config_index + 1);
  });
}

function sendMessage(e) {
  if (e.key === 'Enter' && e.target.value.trim() && is_connected) {
    var msg = e.target.value.trim();
    try {
      // Send message with name
      conn.send(JSON.stringify({ text: msg, name: peer_name }));
      addMessage(msg, 'self', peer_name);
      clearMessageInput();
    } catch (error) {
      console.error('Error sending message:', error);
      updateStatus('Failed to send message. Please try again.');
    }
  }
} 