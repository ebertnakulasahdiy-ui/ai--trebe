document.addEventListener('DOMContentLoaded', () => {
    // --- Initialize Libraries ---
    initParticlesConfig('#6366f1');
    setupMarkdownRenderer();

    // --- UI Elements ---
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const htmlElement = document.documentElement;
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatArea = document.getElementById('chatArea');
    const chatContainer = document.getElementById('chatContainer');
    const emptyState = document.getElementById('emptyState');
    const actionButtons = document.getElementById('actionButtons');
    const stopBtn = document.getElementById('stopBtn');
    
    // Sidebar & Navigation
    const menuBtn = document.getElementById('menuBtn');
    const sidebar = document.getElementById('sidebar');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const searchInput = document.getElementById('searchInput');
    const newChatBtn = document.getElementById('newChatBtn');
    
    // Suggestion Chips
    const suggestionChips = document.querySelectorAll('.suggestion-chip');

    // --- State ---
    let isGenerating = false;
    let currentStreamInterval = null;
    let isFirstMessage = true;

    // --- Setup Markdown & Highlight.js ---
    function setupMarkdownRenderer() {
        const renderer = new marked.Renderer();
        
        // Override code block rendering for macOS style window
        renderer.code = function(code, language) {
            const lang = language || 'text';
            const validLang = hljs.getLanguage(lang) ? lang : 'plaintext';
            const highlightedCode = hljs.highlight(validLang, code).value;
            
            // Unique ID for copy/preview actions
            const codeId = 'code-' + Math.random().toString(36).substr(2, 9);
            
            let previewBtn = '';
            // If it's HTML, add a preview button
            if (lang.toLowerCase() === 'html' || lang.toLowerCase() === 'xml') {
                previewBtn = `<button class="code-action-btn" onclick="previewHTML('${codeId}')"><i class="fa-solid fa-play"></i> Preview</button>`;
            }

            return `
            <div class="code-block-wrapper">
                <div class="code-block-header">
                    <div class="mac-dots">
                        <div class="mac-dot dot-red"></div>
                        <div class="mac-dot dot-yellow"></div>
                        <div class="mac-dot dot-green"></div>
                    </div>
                    <div class="code-lang">${lang}</div>
                    <div class="code-actions">
                        ${previewBtn}
                        <button class="code-action-btn" onclick="copyCode(this, '${codeId}')">
                            <i class="fa-regular fa-copy"></i> Copy
                        </button>
                    </div>
                </div>
                <div class="code-block-body">
                    <pre><code id="${codeId}" class="hljs ${validLang}">${highlightedCode}</code></pre>
                </div>
            </div>`;
        };
        
        marked.setOptions({ renderer: renderer, breaks: true });
    }

    // Global functions for inline HTML event handlers (Copy/Preview)
    window.copyCode = function(btn, codeId) {
        const codeEl = document.getElementById(codeId);
        const textArea = document.createElement("textarea");
        textArea.value = codeEl.innerText; // Get raw text without HTML tags
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("Copy");
        textArea.remove();
        
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check" style="color:var(--success)"></i> Copied';
        setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
    };

    window.previewHTML = function(codeId) {
        const codeEl = document.getElementById(codeId);
        const htmlContent = codeEl.innerText;
        const newWindow = window.open('', '_blank');
        newWindow.document.write(htmlContent);
        newWindow.document.close();
    };

    // --- Theme Logic ---
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            htmlElement.setAttribute('data-theme', newTheme);
        
        const themeIcon = document.getElementById('themeIcon');
        const highlightTheme = document.getElementById('highlightTheme');
        
            if (newTheme === 'light') {
                themeIcon.className = 'fa-solid fa-moon';
                updateParticlesColor('#4f46e5');
            } else {
                themeIcon.className = 'fa-solid fa-sun';
                updateParticlesColor('#6366f1');
            }
        });
    }

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        // Ctrl+K -> Focus Search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if(window.innerWidth <= 768) sidebar.classList.add('active');
            searchInput.focus();
        }
        // Ctrl+N -> New Chat
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            startNewChat();
        }
    });

    newChatBtn.addEventListener('click', startNewChat);

    function startNewChat() {
        chatContainer.innerHTML = '';
        chatContainer.appendChild(emptyState);
        emptyState.style.display = 'flex';
        isFirstMessage = true;
        chatInput.focus();
    }

    // --- Sidebar Mobile ---
    menuBtn.addEventListener('click', () => sidebar.classList.add('active'));
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('active'));
    
    // --- Input & Textarea Logic ---
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        
        if (this.value.trim() !== '') {
            sendBtn.removeAttribute('disabled');
            sendBtn.classList.add('active');
        } else {
            sendBtn.setAttribute('disabled', 'true');
            sendBtn.classList.remove('active');
        }
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (chatInput.value.trim() !== '' && !isGenerating) handleSendMessage();
        }
    });

    sendBtn.addEventListener('click', () => {
        if (chatInput.value.trim() !== '' && !isGenerating) handleSendMessage();
    });

    // Suggestion Chips Click
    suggestionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.innerText.trim();
            chatInput.dispatchEvent(new Event('input'));
            handleSendMessage();
        });
    });

    // --- Drag and Drop File Upload ---
    const dragOverlay = document.getElementById('dragDropOverlay');
    
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        dragOverlay.classList.add('active');
    });
    
    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if(e.relatedTarget === null) dragOverlay.classList.remove('active');
    });
    
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        dragOverlay.classList.remove('active');
        if (e.dataTransfer.files.length > 0) {
            const fileName = e.dataTransfer.files[0].name;
            if(isFirstMessage) removeEmptyState();
            appendUserMessage(`*File dilampirkan: \`${fileName}\`*`);
            simulateAIResponse(`Saya telah menerima file **${fileName}**. Analisis awal menunjukkan struktur data yang valid. Apa yang ingin Anda ekstrak atau modifikasi dari dokumen ini?`);
        }
    });

    // --- Messaging Logic ---
    function removeEmptyState() {
        if(isFirstMessage) {
            emptyState.style.display = 'none';
            isFirstMessage = false;
        }
    }

    function scrollToBottom() {
        chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
    }

    function appendUserMessage(text) {
        removeEmptyState();
        // Secure basic XSS for user text (except when we programmatically inject markdown logic above)
        const safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');
        
        const html = `
            <div class="message user-message fade-up">
                <div class="message-content-wrapper">
                    <div class="message-content">
                        ${marked.parse(text)}
                    </div>
                </div>
                <div class="message-avatar">
                    <img src="https://i.pravatar.cc/150?img=11" alt="Avatar" class="user-avatar-img">
                </div>
            </div>
        `;
        chatContainer.insertAdjacentHTML('beforeend', html);
        scrollToBottom();
    }

    function handleSendMessage() {
        const text = chatInput.value.trim();
        appendUserMessage(text);
        
        // Reset
        chatInput.value = '';
        chatInput.style.height = 'auto';
        sendBtn.setAttribute('disabled', 'true');
        sendBtn.classList.remove('active');

        // Dynamic Mock Response based on input
        let mockResponse = "";
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('react') || lowerText.includes('landing page')) {
            mockResponse = getReactMock();
        } else if (lowerText.includes('python') || lowerText.includes('scrap')) {
            mockResponse = getPythonMock();
        } else {
            mockResponse = getGeneralMock();
        }

        simulateAIResponse(mockResponse);
    }

    function simulateAIResponse(markdownText) {
        isGenerating = true;
        actionButtons.style.display = 'flex';
        
        // 1. Show "Thinking" Phase
        const messageId = 'ai-msg-' + Date.now();
        const initialHtml = `
            <div class="message ai-message fade-up" id="${messageId}">
                <div class="message-avatar">
                    <div class="ai-avatar"><i class="fa-solid fa-layer-group"></i></div>
                </div>
                <div class="message-content-wrapper" style="max-width:100%; width:100%">
                    <div class="message-content ai-thinking">
                        <i class="fa-solid fa-circle-notch fa-spin"></i>
                        <span>Menganalisis arsitektur dan konteks ruang kerja...</span>
                    </div>
                    <div class="message-content markdown-body ai-response-content" style="display:none;" id="${messageId}-content"></div>
                    <div class="ai-actions" id="actions-${messageId}" style="display:none; gap:12px; margin-top:12px; align-items:center;">
                        <button class="action-btn" title="Copy" onclick="copyCode(this, '${messageId}-content')"><i class="fa-regular fa-copy"></i></button>
                        <button class="action-btn" title="Regenerate"><i class="fa-solid fa-rotate-right"></i></button>
                        <button class="action-btn" title="Like"><i class="fa-regular fa-thumbs-up"></i></button>
                        <button class="action-btn" title="Dislike"><i class="fa-regular fa-thumbs-down"></i></button>
                    </div>
                </div>
            </div>
        `;
        chatContainer.insertAdjacentHTML('beforeend', initialHtml);
        scrollToBottom();

        // 2. Transition to Streaming Phase after delay
        setTimeout(() => {
            if (!isGenerating) return;
            
            const msgEl = document.getElementById(messageId);
            const thinkingEl = msgEl.querySelector('.ai-thinking');
            const contentEl = msgEl.querySelector('.ai-response-content');
            
            thinkingEl.style.display = 'none';
            contentEl.style.display = 'block';
            
            let i = 0;
            let currentText = "";
            
            // Stream in chunks rather than characters for better markdown rendering performance
            currentStreamInterval = setInterval(() => {
                if(!isGenerating) {
                    clearInterval(currentStreamInterval);
                    return;
                }
                
                const chunkSize = Math.floor(Math.random() * 4) + 2;
                currentText += markdownText.substring(i, i + chunkSize);
                i += chunkSize;
                
                // Parse markdown incrementally. Note: Incremental markdown parsing can sometimes break code blocks until closed.
                // For a robust app, a specialized streaming markdown parser is used, but marked handles it reasonably well.
                contentEl.innerHTML = marked.parse(currentText) + '<span class="streaming-cursor"></span>';
                scrollToBottom();
                
                if (i >= markdownText.length) {
                    clearInterval(currentStreamInterval);
                    contentEl.innerHTML = marked.parse(markdownText);
                    finishGenerating();
                }
            }, 10); // Fast streaming
        }, 1200); // Thinking duration
    }

    stopBtn.addEventListener('click', () => {
        if(currentStreamInterval) clearInterval(currentStreamInterval);
        
        const streamingCursors = document.querySelectorAll('.streaming-cursor');
        streamingCursors.forEach(el => el.remove());
        
        finishGenerating();
    });

    function finishGenerating() {
        isGenerating = false;
        actionButtons.style.display = 'none';
        
        // Show the latest action buttons
        const allActions = document.querySelectorAll('.ai-actions');
        if (allActions.length > 0) {
            allActions[allActions.length - 1].style.display = 'flex';
        }
    }

    // --- Mock Data Generators (Structured Output) ---
    function getGeneralMock() {
        return `Tentu, berikut adalah solusi untuk kebutuhan Anda yang telah disesuaikan dengan praktik terbaik (*best practices*).

### 1. Ringkasan Pendekatan
Kita akan menggunakan **Vanilla JavaScript** dengan *Event Delegation* untuk memastikan performa tetap tinggi dan memori terkelola dengan baik, tanpa membebani DOM.

### 2. Langkah Implementasi
- Tangkap referensi elemen root induk.
- Tambahkan *event listener* tunggal.
- Lakukan validasi target (*event.target*).

### 3. Implementasi Kode
Berikut kode HTML/JS lengkap yang bisa Anda **Preview** langsung:

\`\`\`html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; background: #0f172a; color: white; padding: 2rem; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .card { background: #1e293b; padding: 20px; text-align: center; border-radius: 8px; cursor: pointer; border: 1px solid #334155; }
        .card:hover { border-color: #6366f1; }
    </style>
</head>
<body>
    <h3>Event Delegation Demo</h3>
    <div class="grid" id="container">
        <div class="card" data-id="1">Item 1</div>
        <div class="card" data-id="2">Item 2</div>
        <div class="card" data-id="3">Item 3</div>
    </div>
    
    <script>
        document.getElementById('container').addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            if(card) {
                alert('Anda mengklik Item ID: ' + card.dataset.id);
            }
        });
    </script>
</body>
</html>
\`\`\`

### 4. Hasil & Tindak Lanjut
Klik tombol **Preview** pada blok kode di atas untuk melihat hasilnya. Pendekatan ini menghemat memori karena hanya 1 event listener yang dibuat untuk 3 item (atau 100 item sekalipun).`;
    }

    function getReactMock() {
        return `### 1. Ringkasan Arsitektur
Saya telah membuat *boilerplate* untuk **React (Vite)** dipadukan dengan **TailwindCSS**. Struktur ini dioptimalkan untuk performa dan skalabilitas tinggi.

### 2. Struktur Folder
\`\`\`text
src/
 ├── components/
 │    └── ui/ (komponen atomic)
 ├── hooks/
 ├── pages/
 ├── store/ (state management)
 └── utils/
\`\`\`

### 3. Kode Utama (App.jsx)
Berikut adalah struktur dasar halaman modern dengan efek *Glassmorphism*:

\`\`\`jsx
import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl shadow-2xl max-w-md w-full">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-4">
          NexAI Dashboard
        </h1>
        <p className="text-slate-400 mb-6">
          Sistem Anda telah berhasil diinisialisasi dengan konfigurasi Enterprise.
        </p>
        <button className="w-full bg-indigo-500 hover:bg-indigo-600 transition-colors py-3 rounded-lg font-medium">
          Mulai Explorasi
        </button>
      </div>
    </div>
  );
}
\`\`\`

Silakan klik **Copy** dan tempel di project Anda. Jika Anda ingin mengunduh keseluruhan project ini dalam bentuk \`.zip\`, gunakan tombol **Download** di pojok kanan atas Header.`;
    }

    function getPythonMock() {
        return `### 1. Analisis Kebutuhan
Script ini dirancang menggunakan \`BeautifulSoup4\` dan \`requests\` untuk *web scraping* dengan penanganan *error* dan *Rate Limiting* (penundaan waktu) agar IP tidak terblokir.

### 2. Persiapan (Dependencies)
Jalankan perintah ini di terminal Anda:
\`\`\`bash
pip install requests beautifulsoup4
\`\`\`

### 3. Implementasi Script
\`\`\`python
import requests
from bs4 import BeautifulSoup
import time
import json

def scrape_tech_news(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    print(f"[*] Menghubungi {url}...")
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        articles = soup.find_all('article')
        
        results = []
        for index, article in enumerate(articles[:5]): # Ambil 5 artikel
            title = article.find('h2').text.strip() if article.find('h2') else 'No Title'
            link = article.find('a')['href'] if article.find('a') else '#'
            
            results.append({
                'id': index + 1,
                'title': title,
                'url': link
            })
            
        return json.dumps(results, indent=4)
        
    except requests.exceptions.RequestException as e:
        return f"[!] Error scraping data: {e}"

# Eksekusi
if __name__ == "__main__":
    target_url = "https://example.com/news"
    data = scrape_tech_news(target_url)
    print(data)
    time.sleep(2) # Praktik etis scraping
\`\`\`

### 4. Penjelasan Tambahan
- **Headers**: Digunakan untuk menghindari blokir dasar dari server.
- **Timeout**: Menghindari *hanging* jika server lambat.
- **JSON**: Output di-format sebagai JSON agar mudah diproses oleh sistem lain (seperti *backend* API).`;
    }

    // --- Particle JS Config ---
    function initParticlesConfig(color) {
        if (window.pJSDom && window.pJSDom.length > 0) {
            window.pJSDom[0].pJS.fn.vendors.destroypJS();
            window.pJSDom = [];
        }
        particlesJS('particles-js', {
            "particles": {
                "number": { "value": 40, "density": { "enable": true, "value_area": 800 } },
                "color": { "value": color },
                "shape": { "type": "circle" },
                "opacity": { "value": 0.5, "random": true, "anim": { "enable": true, "speed": 1, "opacity_min": 0.1 } },
                "size": { "value": 3, "random": true },
                "line_linked": { "enable": true, "distance": 150, "color": color, "opacity": 0.2, "width": 1 },
                "move": { "enable": true, "speed": 1, "direction": "none", "random": true, "out_mode": "out" }
            },
            "interactivity": {
                "detect_on": "canvas",
                "events": { "onhover": { "enable": true, "mode": "grab" }, "onclick": { "enable": true, "mode": "push" }, "resize": true },
                "modes": { "grab": { "distance": 140, "line_linked": { "opacity": 0.6 } }, "push": { "particles_nb": 2 } }
            },
            "retina_detect": true
        });
    }

    function updateParticlesColor(color) { initParticlesConfig(color); }
});
