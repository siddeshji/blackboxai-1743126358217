class ChatManager {
  constructor(socket) {
    this.socket = socket;
    this.currentChat = null;
    this.typingTimeout = null;
    this.unreadMessages = new Set();
    
    this.initElements();
    this.initEventListeners();
    this.connectSocket();
  }

  initElements() {
    this.chatContainer = document.getElementById('chat-container');
    this.messageList = document.getElementById('message-list');
    this.messageInput = document.getElementById('message-input');
    this.sendButton = document.getElementById('send-button');
    this.typingIndicator = document.getElementById('typing-indicator');
  }

  initEventListeners() {
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
    
    this.messageInput.addEventListener('input', () => {
      this.socket.emit('typing', this.currentChat);
      clearTimeout(this.typingTimeout);
      this.typingTimeout = setTimeout(() => {
        this.socket.emit('stop-typing', this.currentChat);
      }, 2000);
    });

    // Track when messages become visible for read receipts
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const messageId = entry.target.dataset.messageId;
          if (messageId && this.unreadMessages.has(messageId)) {
            this.socket.emit('mark-as-read', [messageId]);
            this.unreadMessages.delete(messageId);
            this.updateReadStatus(messageId);
          }
        }
      });
    }, { threshold: 0.5 });

    this.observer = observer;
  }

  connectSocket() {
    this.socket.on('connect', () => {
      console.log('Connected to chat server');
    });

    this.socket.on('new-message', (message) => {
      const isOwn = message.sender._id === this.socket.userId;
      this.appendMessage(message, isOwn);
      if (!isOwn) {
        this.unreadMessages.add(message._id);
      }
    });

    this.socket.on('messages-read', (data) => {
      data.messageIds.forEach(id => this.updateReadStatus(id, data.readerId));
    });

    this.socket.on('typing', (data) => {
      this.showTypingIndicator(data.username);
    });

    this.socket.on('stop-typing', () => {
      this.hideTypingIndicator();
    });

    this.socket.on('error', (error) => {
      console.error('Chat error:', error);
    });
  }

  async appendMessage(message, isOwn) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOwn ? 'own-message' : 'other-message'}`;
    messageElement.dataset.messageId = message._id;
    
    let readReceipt = '';
    if (isOwn) {
      try {
        // Fetch message with latest read status
        const response = await fetch(`/api/chat/messages/${message._id}`);
        const { data: fullMessage } = await response.json();
        
        if (fullMessage.readBy && fullMessage.readBy.length > 0) {
          const readers = fullMessage.readBy.map(r => r.username || 'User').join(', ');
          readReceipt = `
            <div class="read-receipt">
              Read by ${readers}
              <div class="read-receipt-tooltip">
                ${readers}
              </div>
            </div>
          `;
        }
      } catch (err) {
        console.error('Failed to fetch message read status:', err);
      }
    }

    messageElement.innerHTML = `
      <div class="message-header">
        <span class="sender">${message.sender.username}</span>
        <span class="time">${new Date(message.createdAt).toLocaleTimeString()}</span>
      </div>
      <div class="message-content">${message.content}</div>
      ${readReceipt}
    `;
    
    this.messageList.appendChild(messageElement);
    this.messageList.scrollTop = this.messageList.scrollHeight;
    this.observer.observe(messageElement);
  }

  updateReadStatus(messageId, readerId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      const readReceipt = messageElement.querySelector('.read-receipt');
      if (readReceipt) {
        // Update existing read receipt
        const currentCount = parseInt(readReceipt.textContent.match(/\d+/)[0]);
        readReceipt.textContent = `Read by ${currentCount + 1}`;
      } else {
        // Add new read receipt
        messageElement.innerHTML += '<div class="read-receipt">Read by 1</div>';
      }
    }
  }

  // ... rest of the existing methods ...
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const socket = io({
    auth: {
      token: localStorage.getItem('token')
    }
  });
  
  window.chatManager = new ChatManager(socket);
});