// temples data is now loaded from data.js

/* ---------------- Render main cards ---------------- */
const cards = document.getElementById('cards');
function renderCards(list) {
    cards.innerHTML = '';
    list.forEach(t => {
        const a = document.createElement('article');
        a.className = 'card';
        a.innerHTML = `
      <div class="card-media" style="background-image:url('${t.img}')"></div>
      <div class="card-body"><h3>${t.name}</h3><p>${t.desc}</p></div>
    `;
        // open temple page in NEW TAB (same file, with query param)
        a.addEventListener('click', () => {
            const url = location.pathname + '?temple=' + encodeURIComponent(t.id);
            window.open(url, '_blank');
        });
        cards.appendChild(a);
    });
    // reveal animation
    document.querySelectorAll('.card').forEach((c, i) => setTimeout(() => c.classList.add('show'), 160 + i * 70));
}
renderCards(temples);

/* ---------------- Search & sort ---------------- */
document.getElementById('search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) { renderCards(temples); return; }
    const filtered = temples.filter(t => (t.name + ' ' + t.desc + ' ' + t.long).toLowerCase().includes(q));
    renderCards(filtered);
});
document.getElementById('searchBtn').addEventListener('click', () => {
    const q = document.getElementById('search').value.trim();
    if (!q) return;
    window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank');
});
document.getElementById('sort').addEventListener('change', (e) => {
    if (e.target.value === 'name') {
        const sorted = [...temples].sort((a, b) => a.name.localeCompare(b.name));
        renderCards(sorted);
    } else renderCards(temples);
});

/* ---------------- Particle animation (decorative) ---------------- */
(function spawnParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    const total = 14;
    for (let i = 0; i < total; i++) {
        const p = document.createElement('span');
        p.className = 'particle';
        const size = 6 + Math.random() * 18;
        p.style.width = p.style.height = size + 'px';
        p.style.left = (Math.random() * 100) + 'vw';
        p.style.top = (60 + Math.random() * 30) + 'vh';
        container.appendChild(p);
        const dur = 9 + Math.random() * 6;
        p.animate([
            { transform: 'translateY(0) scale(0.6)', opacity: 0 },
            { transform: 'translateY(-160vh) scale(1)', opacity: 1 }
        ], { duration: dur * 1000, iterations: Infinity, delay: Math.random() * -dur * 1000, easing: 'ease-in-out' });
    }
})();

/* ---------------- URL routing: detect ?temple=... ---------------- */
function getQuery(name) {
    const u = new URLSearchParams(location.search);
    return u.get(name);
}
const templeId = getQuery('temple');
if (templeId) {
    showTemplePage(templeId);
}

/* ---------------- Show temple page (renders in same file) ---------------- */
let map, marker;
function showTemplePage(id) {
    // hide main view
    document.getElementById('mainContainer').style.display = 'none';
    document.getElementById('hero').style.display = 'none';
    document.getElementById('templeView').style.display = 'block';

    // find temple
    const t = temples.find(x => x.id === id);
    if (!t) {
        document.getElementById('templeName').textContent = 'Temple not found';
        return;
    }
    document.getElementById('templeImage').style.backgroundImage = `url('${t.img}')`;
    document.getElementById('templeName').textContent = t.name;
    document.getElementById('templeDesc').textContent = t.desc;
    document.getElementById('templeLong').textContent = t.long;

    // Setup map after layout
    setTimeout(() => {
        if (!map) {
            map = L.map('map').setView([t.lat, t.lon], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        } else {
            map.setView([t.lat, t.lon], 14);
        }
        if (!marker) marker = L.marker([t.lat, t.lon]).addTo(map);
        else marker.setLatLng([t.lat, t.lon]);
    }, 150);

    // fetch weather via backend /api/weather (recommended) or client fallback
    fetchWeatherForTemple(t.lat, t.lon);

    // set up chat initial message
    const chatLog = document.getElementById('chatLog');
    chatLog.innerHTML = `<div style="color:#6b563f">You opened <strong>${t.name}</strong>. Ask me about this place or nearby things.</div>`;
    // wire send button (it calls /api/ai on server)
    document.getElementById('sendChat').onclick = sendChat;
    document.getElementById('chatInput').onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };
}

/* ---------------- Weather: call server endpoint /api/weather?lat=..&lon=.. ----------------
  Recommended: set up the backend described below and keep your OpenWeather key on server.
  If you do not have the backend yet, set CLIENT_OPENWEATHER_KEY below (not secure).
*/

async function fetchWeatherForTemple(lat, lon) {
    const weatherBox = document.getElementById('weatherBox');

    // 1. Try server proxy
    try {
        const res = await fetch(`http://localhost:5000/api/weather?lat=${lat}&lon=${lon}`);
        if (res.ok) {
            const j = await res.json();
            renderWeather(j);
            return;
        }
    } catch (e) {
        console.warn('Backend weather failed, trying mock fallback.');
    }

    // 2. Mock Fallback (Demo Mode)
    // Generate a consistent "nice" weather for demo
    renderWeather({
        name: 'Mathura (Demo)',
        main: { temp: 28 + Math.random() * 2, humidity: 45 },
        weather: [{ description: 'Sunny (Demo)' }],
        wind: { speed: 3.5 }
    });

    function renderWeather(j) {
        if (!j || !j.main) { weatherBox.innerHTML = `<div style="color:#6b563f">Unable to get weather.</div>`; return; }
        weatherBox.innerHTML = `
      <div><strong>${j.name || 'Nearby'}</strong></div>
      <div>Temp: ${Math.round(j.main.temp)}°C — ${j.weather?.[0]?.description || ''}</div>
      <div>Humidity: ${j.main.humidity}% | Wind: ${j.wind.speed} m/s</div>
    `;
    }
}

/* ---------------- Chat frontend ----------------
  Sends messages to server endpoint POST /api/ai with JSON { message, context }.
  Server should reply { reply: "..." }.
*/
async function sendChat() {
    const input = document.getElementById('chatInput');
    const txt = input.value.trim();
    if (!txt) return;
    appendChat('You', txt);
    input.value = '';
    appendChat('Bot', 'Typing…');

    try {
        // Try backend
        const res = await fetch('http://localhost:5000/api/ai', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: txt })
        });
        if (!res.ok) throw new Error("Backend offline");
        const j = await res.json();
        replaceLastBotMessage(j.reply || 'Sorry, no reply.');
    } catch (err) {
        // Mock Response logic
        console.log('Backend offline, using mock chat.');

        let reply = "Radhe Radhe! I am in Demo Mode (Backend unavailable). ";
        const lower = txt.toLowerCase();

        if (lower.includes('time') || lower.includes('open')) reply += "Most temples open at 5 AM and close by 9 PM.";
        else if (lower.includes('food') || lower.includes('eat')) reply += "Don't miss the Peda in Mathura and Lassi!";
        else if (lower.includes('distance') || lower.includes('far')) reply += "Vrindavan is about 15km from Mathura.";
        else reply += "That is a wonderful question about the holy dham.";

        setTimeout(() => replaceLastBotMessage(reply), 600);
    }
}
function appendChat(who, text) {
    const d = document.createElement('div');
    d.style.marginBottom = '8px';
    d.innerHTML = `<strong style="color:#6b563f">${who}:</strong> <span style="color:#3c3224">${escapeHtml(text)}</span>`;
    const log = document.getElementById('chatLog');
    log.appendChild(d); log.scrollTop = log.scrollHeight;
}
function replaceLastBotMessage(text) {
    const nodes = document.getElementById('chatLog').children;
    if (nodes.length > 0) {
        nodes[nodes.length - 1].innerHTML = `<strong style="color:#6b563f">Bot:</strong> <span style="color:#3c3224">${escapeHtml(text)}</span>`;
        document.getElementById('chatLog').scrollTop = document.getElementById('chatLog').scrollHeight;
    } else appendChat('Bot', text);
}
function escapeHtml(s) { return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }


/* ---------------- Map View Toggle ---------------- */
let mainMapInitialized = false;
let mainMap;

const viewToggleBtn = document.getElementById('viewToggle');
if (viewToggleBtn) {
    viewToggleBtn.addEventListener('click', () => {
        const cards = document.getElementById('cards');
        const mapDiv = document.getElementById('mainMap');

        if (cards.style.display !== 'none') {
            // Switch to Map
            cards.style.display = 'none';
            mapDiv.style.display = 'block';
            viewToggleBtn.textContent = '📋 List View';

            if (!mainMapInitialized) {
                initMainMap();
                mainMapInitialized = true;
            } else {
                setTimeout(() => mainMap.invalidateSize(), 100);
            }
        } else {
            // Switch to List
            cards.style.display = 'grid';
            mapDiv.style.display = 'none';
            viewToggleBtn.textContent = '📍 Map View';
        }
    });
}

function initMainMap() {
    // Default center roughly between Mathura and Vrindavan
    mainMap = L.map('mainMap').setView([27.53, 77.67], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(mainMap);

    temples.forEach(t => {
        const marker = L.marker([t.lat, t.lon]).addTo(mainMap);
        marker.bindPopup(`
            <div style="text-align:center">
                <div style="background:url('${t.img}') center/cover; height:80px; width:100%; border-radius:8px; margin-bottom:4px"></div>
                <b>${t.name}</b><br>
                <div style="font-size:12px;color:#666">${t.desc}</div>
                <a href="${location.pathname}?temple=${encodeURIComponent(t.id)}" target="_blank" style="display:inline-block;margin-top:6px;color:#d89f10;text-decoration:none;font-weight:bold">View Details</a>
            </div>
        `);
    });
}
