// === FUNKCJE GLOBALNE ===
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}
function restoreChatHistory() {
  if (window.__restored) return;   // zapobiega duplikatom
  window.__restored = true;

  const raw = getCookie("chat_ctx");
  if (!raw) return;

  let text = raw;
  try { text = decodeURIComponent(raw); } catch (e) {}

  try {
    const history = JSON.parse(text);
    history.forEach(item => {
      appendMessage("user", item.u);
      appendMessage("assistant", item.b);
    });
  } catch (e) {
    console.warn("Błąd przy odczycie historii:", e);
  }
}
function onReady(fn){
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

// === GŁÓWNY BLOK CHATBOTA ===
(function () {
  const api = '/chatbot.php'; // prosto i stabilnie


  async function sendToBot(message){
    try{
      const res = await fetch(api, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({message})
      });
      const data = await res.json().catch(()=>({ error: 'Błąd JSON' }));
      if (!res.ok) throw new Error(data.error || ('HTTP '+res.status));
      return data.reply || data.text || 'Brak odpowiedzi.';
    }catch(e){
      console.error('sendToBot error:', e);
      return 'Błąd połączenia z serwerem ('+e.message+').';
    }
  }

  const w   = document.getElementById('cb-widget');
  const btn = document.getElementById('cb-launcher');
  const cls = document.getElementById('cb-close');
  const box = document.getElementById('cb-messages');
  const ta  = document.getElementById('cb-input');
  const sendBtn = document.getElementById('cb-send');

btn.onclick = ()=> {
  sessionStorage.removeItem('chatClosed');
  localStorage.removeItem('chatClosedSession');
  w.style.display = 'flex';
};

// END ON CLOSE: kliknięcie X kończy rozmowę (po cichu)
cls.onclick = ()=> {
  fetch('/logs/chat/chat_end.php', { cache: 'no-store', keepalive: true }).catch(()=>{});
  w.style.display = 'none';
  sessionStorage.setItem("chatClosed", "true");   // w tej karcie
  localStorage.setItem("chatClosedSession", "1"); // w całej przeglądarce (ta sesja)
};


  
  

  function row(html, cls){
    const d=document.createElement('div');
    d.className='cb-row '+(cls||'');
    d.innerHTML=html; // HTML, nie textContent
    box.appendChild(d);
    box.scrollTop=box.scrollHeight;
  }
  
  // Wyjście/opuszczenie karty → wyślij "end"
window.addEventListener('pagehide', () => {
  try { navigator.sendBeacon('/logs/chat/chat_end.php'); } catch (_) {}
}, { capture: true });
// Zamknięcie w innej karcie → schowaj też tutaj
window.addEventListener('storage', (e) => {
  if (e.key === 'chatClosedSession' && e.newValue === '1' && w && w.style.display !== 'none') {
    w.style.display = 'none';
  }
}, { passive: true });




// API dla restoreChatHistory() – bez żadnych podmian napisów

// Fallback: jeśli globalne appendMessage nie jest dostępne (kolejność ładowania),
// to wystawiamy minimalną wersję zgodną z aktualnym formatem wiadomości.
if (typeof window.appendMessage !== 'function') {
  window.appendMessage = function(role, text){
    if (!text) return;
    if (role === 'user') {
      row(`<b>Ty:</b> ${text}`, 'cb-you');
    } else {
      row(`<b>Bot:</b> ${text}`, 'cb-bot');
    }
  };
}

async function doSend(){
  const msg = ta.value.trim();
  if(!msg) return;
  row(`<b>Ty:</b> ${msg}`, 'cb-you');
  ta.value=''; ta.style.height='42px';
  const id = 't'+Date.now();
  row(`<i id="${id}">Bot pisze…</i>`, 'cb-bot');
  const reply = await sendToBot(msg);
  const t = document.getElementById(id); if (t) t.remove();
  row(`<b>Bot:</b> ${reply}`, 'cb-bot');
}



  sendBtn.onclick = doSend;
  ta.addEventListener('keydown', e=>{
    if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); doSend(); }
  });
  ta.addEventListener('input', ()=>{
    ta.style.height='42px';
    ta.style.height=Math.min(110, ta.scrollHeight)+'px';
  });


// --- ANTI-FLICKER: prehide, aby widget nie mignął zanim ustalimy stan ---
(function () {
  const s = document.createElement('style');
  s.id = 'cb-prehide';
  s.textContent = '#cb-widget{visibility:hidden}';
  document.head.appendChild(s);
})();

onReady(() => {
  restoreChatHistory();

  const closedThisTab = sessionStorage.getItem("chatClosed") === "true";
  const closedAllTabs = localStorage.getItem("chatClosedSession") === "1";

  if (closedThisTab || closedAllTabs) {
    if (w) w.style.display = 'none';
  } else {
    if (w) w.style.removeProperty('display'); // NIE WYMUSZAJ 'flex' – przywróć styl z CSS
  }

  document.getElementById('cb-prehide')?.remove();
});

})();
(() => {
  const CHAT_START = Date.now();

  function sendTranscriptOnExit() {
    const data = new Blob(
      [JSON.stringify({ start: CHAT_START })],
      { type: 'application/json' }
    );
    navigator.sendBeacon('/logs/chat/chat_end.php', data);
  }

  window.addEventListener('pagehide', sendTranscriptOnExit);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendTranscriptOnExit();
  });
})();
