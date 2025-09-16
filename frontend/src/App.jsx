import React, { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { chat, getHistory, resetSession } from './services/api';

function Typing({ text }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    setShown('');
    let i = 0;
    const id = setInterval(() => {
      setShown(text.slice(0, i));
      i++;
      if (i > text.length) clearInterval(id);
    }, 20);
    return () => clearInterval(id);
  }, [text]);
  return <div dangerouslySetInnerHTML={{ __html: shown.replace(/\n/g, '<br>') }} />;
}

function Message({ m }) {
  const isUser = m.role === 'user';
  return (
    <div className={`msg ${isUser ? 'user' : 'bot'}`}>
      <div className="avatar">
        {isUser ? 'U' : 'AI'}
      </div>
      <div className="content">
        {isUser ? (
          <div>{m.content}</div>
        ) : (
          <Typing text={m.content} />
        )}
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
    </svg>
  );
}

function Sidebar({ chatSessions, currentSessionId, onNewChat, onSelectChat, onDeleteChat, isCollapsed, onToggle }) {
  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={onNewChat}>
          New Chat
        </button>
        <button className="toggle-btn" onClick={onToggle}>
          <MenuIcon />
        </button>
      </div>
      <div className="chat-history">
        {chatSessions.map((session) => (
          <div
            key={session.id}
            className={`chat-item ${session.id === currentSessionId ? 'active' : ''}`}
            onClick={() => onSelectChat(session.id)}
          >
            <div className="chat-title">
              {session.title || 'New Chat'}
            </div>
            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteChat(session.id);
              }}
            >
              <DeleteIcon />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [sessionId, setSessionId] = useState(() => uuidv4());
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const listRef = useRef(null);
  const textareaRef = useRef(null);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  // Load chat sessions from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem('chatSessions');
    if (savedSessions) {
      const sessions = JSON.parse(savedSessions);
      setChatSessions(sessions);
    } else {
      // Create initial session
      const initialSession = {
        id: sessionId,
        title: 'New Chat',
        lastMessage: new Date().toISOString(),
        messageCount: 0
      };
      setChatSessions([initialSession]);
      localStorage.setItem('chatSessions', JSON.stringify([initialSession]));
    }
  }, []);

  // Load messages for current session
  useEffect(() => {
    (async () => {
      const h = await getHistory(sessionId);
      if (h?.messages) {
        setMessages(h.messages);
        // Update session title based on first message
        if (h.messages.length > 0) {
          updateSessionTitle(sessionId, h.messages[0].content);
        }
      }
    })();
  }, [sessionId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const updateSessionTitle = (id, firstMessage) => {
    const title = firstMessage.length > 30 ? firstMessage.substring(0, 30) + '...' : firstMessage;
    setChatSessions(prev => {
      const updated = prev.map(session => 
        session.id === id 
          ? { ...session, title, lastMessage: new Date().toISOString() }
          : session
      );
      localStorage.setItem('chatSessions', JSON.stringify(updated));
      return updated;
    });
  };

  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    const optimistic = [...messages, { role: 'user', content: text, ts: Date.now() }];
    setMessages(optimistic);
    setLoading(true);
    
    // Update session title if this is the first message
    if (messages.length === 0) {
      updateSessionTitle(sessionId, text);
    }
    
    try {
      const res = await chat(sessionId, text);
      const bot = { role: 'assistant', content: res.answer, ts: Date.now() };
      setMessages((prev) => [...prev, bot]);
      
      // Update session message count
      setChatSessions(prev => {
        const updated = prev.map(session => 
          session.id === sessionId 
            ? { ...session, messageCount: session.messageCount + 2, lastMessage: new Date().toISOString() }
            : session
        );
        localStorage.setItem('chatSessions', JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.', ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const onNewChat = () => {
    const newSessionId = uuidv4();
    const newSession = {
      id: newSessionId,
      title: 'New Chat',
      lastMessage: new Date().toISOString(),
      messageCount: 0
    };
    
    setChatSessions(prev => {
      const updated = [newSession, ...prev];
      localStorage.setItem('chatSessions', JSON.stringify(updated));
      return updated;
    });
    
    setSessionId(newSessionId);
    setMessages([]);
  };

  const onSelectChat = (id) => {
    setSessionId(id);
    setMessages([]);
  };

  const onDeleteChat = async (id) => {
    if (chatSessions.length <= 1) return; // Don't delete the last session
    
    try {
      await resetSession(id);
    } catch (e) {
      console.error('Error deleting session:', e);
    }
    
    setChatSessions(prev => {
      const updated = prev.filter(session => session.id !== id);
      localStorage.setItem('chatSessions', JSON.stringify(updated));
      
      // If we deleted the current session, switch to the first remaining one
      if (id === sessionId && updated.length > 0) {
        setSessionId(updated[0].id);
        setMessages([]);
      }
      
      return updated;
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className="app">
      {sidebarCollapsed && (
        <button 
          className="floating-menu-btn" 
          onClick={() => setSidebarCollapsed(false)}
        >
          <MenuIcon />
        </button>
      )}
      
      <Sidebar
        chatSessions={chatSessions}
        currentSessionId={sessionId}
        onNewChat={onNewChat}
        onSelectChat={onSelectChat}
        onDeleteChat={onDeleteChat}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div className="main-content">
        <header>
          <div className="header-left">
            <h1>RAG News Chatbot</h1>
          </div>
        </header>

        <div ref={listRef} className="chat-list">
          {messages.length === 0 && (
            <div className="welcome">
              <h2>Welcome to RAG News Chatbot</h2>
              <p>Ask me about the latest news and I'll provide answers based on recent articles from trusted sources.</p>
              <div className="suggestions">
                <button onClick={() => setInput("What are today's top headlines?")}>
                  What are today's top headlines?
                </button>
                <button onClick={() => setInput("Tell me about recent market news")}>
                  Tell me about recent market news
                </button>
                <button onClick={() => setInput("What's happening in technology?")}>
                  What's happening in technology?
                </button>
              </div>
            </div>
          )}
          
          {messages.map((m, idx) => (
            <Message key={idx} m={m} />
          ))}
          
          {loading && (
            <div className="status">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
        </div>

        <div className="input-container">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              placeholder="Message RAG News Chatbot..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button 
              className="send-button" 
              onClick={onSend} 
              disabled={!canSend}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
