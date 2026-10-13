// MemeForge frontend
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const state = { mood: "savage", language: "English", customImage: null, lastScenario: "" };

// ---------- navigation ----------
function go(view) {
  const target = view === "fame" ? "gen" : view;
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === target));
  if (target === "gen") {
    loadFame(); loadTrending();
    setTimeout(() => (view === "fame" ? $("#fame").scrollIntoView({ behavior: "smooth" }) : $("#scenario").focus()), 50);
  }
  window.scrollTo(0, 0);
}
$$("[data-go]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); go(b.dataset.go); }));

// ---------- mood + language (kept in sync across both screens) ----------
$$("[data-set]").forEach((group) =>
  group.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-v]");
    if (!btn) return;
    const key = group.dataset.set;
    state[key] = btn.dataset.v;
    $$(`[data-set="${key}"] button`).forEach((b) => b.classList.toggle("on", b.dataset.v === state[key]));
  })
);

// ---------- examples ----------
$$(".example").forEach((b) => b.addEventListener("click", () => { $("#scenario").value = b.textContent; generate(); }));

// ---------- image upload ----------
$("#file").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    // shrink big photos so saving stays fast
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * scale; c.height = img.height * scale;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      state.customImage = c.toDataURL("image/jpeg", 0.85);
      $("#imgPreview img").src = state.customImage;
      $("#imgPreview").hidden = false;
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(f);
});
$("#imgPreview button").addEventListener("click", () => { state.customImage = null; $("#imgPreview").hidden = true; $("#file").value = ""; });

// ---------- voice input ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
$("#mic").addEventListener("click", () => {
  if (!SR) return setStatus("Voice input needs Chrome. Type instead!");
  const rec = new SR();
  rec.lang = state.language === "Tamil" ? "ta-IN" : "en-IN";
  rec.onstart = () => $("#mic").classList.add("live");
  rec.onend = () => $("#mic").classList.remove("live");
  rec.onresult = (e) => { $("#scenario").value = e.results[0][0].transcript; generate(); };
  rec.start();
});

// ---------- generate: search first, generate if not found ----------
$("#form").addEventListener("submit", (e) => { e.preventDefault(); generate(); });

function setStatus(html) { $("#status").innerHTML = html; }

async function generate(forceNew = false) {
  const scenario = $("#scenario").value.trim();
  if (!scenario) return $("#scenario").focus();
  state.lastScenario = scenario;
  $("#go").disabled = true;
  setStatus(`<div class="spinner"></div> ${forceNew ? "Cooking a fresh one…" : "Searching existing memes… then AI will paint one if needed"}`);

  try {
    const r = await fetch("/api/meme", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario, mood: state.mood, language: state.language, forceNew: forceNew || !!state.customImage }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Something broke");

    if (data.online) {
      setStatus(`<span class="badge found">FOUND ONLINE</span> Real ${data.memes[0].indian ? "Indian " : ""}meme from the internet. <button class="link" id="fresh">Make our own instead</button>`);
      $("#fresh").onclick = () => generate(true);
    } else if (data.found) {
      setStatus(`<span class="badge found">FOUND IT</span> This meme already exists. <button class="link" id="fresh">Make a new one instead</button>`);
      $("#fresh").onclick = () => generate(true);
    } else {
      setStatus(`<span class="badge fresh">FRESHLY GENERATED</span> No match found — made ${data.memes.length} new ones ${data.engine === "ai" ? "with AI" : ""}`);
    }
    const memes = data.memes.map((m) => (state.customImage && m.source === "generated" ? { ...m, customImage: state.customImage } : m));
    renderResults(memes);
    if (!data.found && !state.customImage) runSmart(scenario, memes);
  } catch (err) {
    setStatus(`⚠️ ${err.message}. Is the server running?`);
  } finally {
    $("#go").disabled = false;
  }
}

// ---------- smart pipeline (plan → generate → judge → refine → caption) ----------
async function runSmart(scenario, current) {
  const box = document.createElement("div");
  box.className = "smart glass";
  box.innerHTML = `<div class="smart-head"><div class="spinner"></div><b>Smart AI is working…</b></div>
    <ol class="smart-steps"><li>🧠 Planning 3 scene ideas</li><li>🎨 Generating images in parallel</li><li>🔍 Vision AI judging accuracy</li><li>🔁 Refining the best one</li><li>✍️ Writing the caption</li></ol>`;
  $("#results").prepend(box);
  try {
    const r = await fetch("/api/smart", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario, mood: state.mood, language: state.language }) });
    const d = await r.json();
    if (state.lastScenario !== scenario) return box.remove();
    if (!d.ok) { box.innerHTML = `<div class="smart-head">💡 <span>${esc(d.reason || "Smart AI unavailable")}</span></div>`; return; }
    box.remove();
    renderResults([d.meme, ...current]);
    const done = document.createElement("div");
    done.className = "smart glass";
    done.innerHTML = `<div class="smart-head">✅ <b>Smart AI pipeline</b></div><ol class="smart-steps">${d.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`;
    $("#results").prepend(done);
  } catch { box.remove(); }
}

// ---------- results ----------
function renderResults(memes) {
  const box = $("#results");
  box.innerHTML = "";
  memes.forEach((m) => {
    const card = document.createElement("div");
    card.className = "card glass";
    card.innerHTML = `
      <canvas></canvas>
      ${m.photo ? `<div class="meta"><span class="badge found">📷 EXACT REAL PHOTO</span><span>${esc(m.credit || "")}</span></div>` : ""}
      ${m.aiImage ? `<div class="meta"><span class="badge fresh">✨ AI-GENERATED IMAGE</span></div>${m.scene ? `<div class="meta"><span title="${esc(m.scene)}">🎬 ${esc(m.scene).slice(0, 110)}</span></div>` : ""}` : ""}
      <div class="meta"><span>${m.source === "online" ? `${m.indian ? "🇮🇳 " : ""}${m.template}` : m.template || "Custom"}</span><span>${m.source === "existing" ? `♥ ${m.likes || 0}` : m.source === "online" ? "online" : "new"}</span></div>
      ${m.title ? `<div class="meta"><span>“${esc(m.title).slice(0, 90)}”</span></div>` : ""}
      <div class="edits">
        <input class="t" value="${esc(m.top)}" placeholder="Top text" />
        <input class="b" value="${esc(m.bottom)}" placeholder="Bottom text" />
      </div>
      <div class="actions">
        <button class="dl">Download</button>
        ${m.source === "existing" ? `<button class="like primary">♥ Like</button>` : m.source === "online" ? `<button class="caption primary">Add our caption</button>` : `<button class="save primary">Post to Hall of Fame</button>`}
      </div>`;
    box.appendChild(card);
    const canvas = $("canvas", card);
    const redraw = () => drawMeme(canvas, m);
    redraw();

    $(".t", card).addEventListener("input", (e) => { m.top = e.target.value; redraw(); });
    $(".b", card).addEventListener("input", (e) => { m.bottom = e.target.value; redraw(); });
    $(".dl", card).addEventListener("click", () => download(canvas));
    $(".caption", card)?.addEventListener("click", (e) => { m.layout = "tb"; m.source = "generated"; $(".t", card).focus(); e.target.outerHTML = `<button class="save primary">Post to Hall of Fame</button>`; redraw();
      $(".save", card).addEventListener("click", async (ev) => { ev.target.disabled = true; await fetch("/api/memes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenario: state.lastScenario, ...m }) }); ev.target.textContent = "Posted ✓"; loadFame(); }); });
    $(".save", card)?.addEventListener("click", async (e) => {
      e.target.disabled = true; e.target.textContent = "Posting…";
      await fetch("/api/memes", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: state.lastScenario, ...m }),
      });
      e.target.textContent = "Posted ✓";
      loadFame();
    });
    $(".like", card)?.addEventListener("click", async (e) => {
      const r = await fetch(`/api/memes/${m.id}/like`, { method: "POST" });
      if (r.ok) { const u = await r.json(); $(".meta span:last-child", card).textContent = `♥ ${u.likes}`; e.target.textContent = "Liked ✓"; loadFame(); }
    });
  });
}

function download(canvas) {
  try {
    const a = document.createElement("a");
    a.download = `meme-${Date.now()}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  } catch { alert("Couldn't export this image. Try uploading your own image instead."); }
}

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// ---------- canvas meme renderer ----------
const imgCache = {};
function loadImage(src) {
  if (!imgCache[src]) {
    imgCache[src] = new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = (e) => { delete imgCache[src]; rej(e); };
      img.src = src;
    });
  }
  return imgCache[src];
}

async function drawMeme(canvas, m) {
  const ctx = canvas.getContext("2d");
  await document.fonts.load("40px Anton").catch(() => {});
  const proxied = (u) => (u.startsWith("/") ? u : `/api/img?url=${encodeURIComponent(u)}`);
  let img = null;
  if (m.aiImage && !m.customImage) {
    // show a placeholder while the AI paints the picture (5–20 s)
    canvas.width = 800; canvas.height = 800;
    drawFallback(ctx, 800, 800);
    textBox(ctx, "🎨 AI is painting your meme…", 40, 340, 720, 120, { valign: "middle" });
  }
  try {
    const src = m.customImage || (m.image ? proxied(m.image) : null);
    if (src) img = await loadImage(src);
  } catch {
    img = null;
    if (m.fallbackImage) { try { img = await loadImage(proxied(m.fallbackImage)); if (m.aiImage) m.template = "Real photo (AI image unavailable)"; } catch {} }
  }

  const W = 800;

  // "band" layout: white caption strip on top, image below (Twitter-style meme)
  if (m.layout === "band" && img && !m.customImage) {
    ctx.font = "44px Satoshi, Inter, sans-serif";
    const lines = String(m.top || "").split("\n").flatMap((p) => wrap(ctx, p, W - 64));
    const bandH = Math.max(110, lines.length * 56 + 56);
    const imgH = Math.round((img.height / img.width) * W);
    canvas.width = W; canvas.height = bandH + imgH;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, bandH);
    ctx.font = "700 44px Satoshi, Inter, sans-serif";
    ctx.fillStyle = "#05060a"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    lines.forEach((l, i) => ctx.fillText(l, 32, 30 + i * 56));
    ctx.drawImage(img, 0, bandH, W, imgH);
    textBox(ctx, m.bottom, 20, bandH + imgH * 0.7, W - 40, imgH * 0.28, { valign: "bottom" });
    return;
  }

  // size
  const H = img ? Math.round((img.height / img.width) * W) : 700;
  canvas.width = W; canvas.height = H;

  if (img) ctx.drawImage(img, 0, 0, W, H);
  else drawFallback(ctx, W, H); // offline: still looks good

  if (m.layout === "drake" && img && !m.customImage) {
    // Drake: text goes on the right half, top & bottom panels
    textBox(ctx, m.top, W * 0.5 + 20, 20, W * 0.5 - 40, H * 0.5 - 40, { color: "#111", stroke: false });
    textBox(ctx, m.bottom, W * 0.5 + 20, H * 0.5 + 20, W * 0.5 - 40, H * 0.5 - 40, { color: "#111", stroke: false });
  } else {
    textBox(ctx, m.top, 20, 14, W - 40, H * 0.32, { valign: "top" });
    textBox(ctx, m.bottom, 20, H * 0.66, W - 40, H * 0.32, { valign: "bottom" });
  }
}

function drawFallback(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#2a2440"); g.addColorStop(0.6, "#3b2f7a"); g.addColorStop(1, "#7a4d78");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.18; ctx.fillStyle = "#c6ff3d";
  ctx.beginPath(); ctx.arc(W / 2, H / 2, H * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

function textBox(ctx, text, x, y, w, h, { color = "#fff", stroke = true, valign = "middle" } = {}) {
  text = String(text || "").toUpperCase().trim();
  if (!text) return;
  let size = 64, lines;
  do {
    ctx.font = `${size}px Anton, Impact, sans-serif`;
    lines = wrap(ctx, text, w);
    size -= 2;
  } while ((lines.length * size * 1.15 > h || lines.some((l) => ctx.measureText(l).width > w)) && size > 18);
  const lh = size * 1.15;
  const total = lines.length * lh;
  let ty = valign === "top" ? y : valign === "bottom" ? y + h - total : y + (h - total) / 2;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  lines.forEach((line) => {
    if (stroke) { ctx.strokeStyle = "#000"; ctx.lineWidth = Math.max(4, size / 7); ctx.strokeText(line, x + w / 2, ty); }
    ctx.fillStyle = color; ctx.fillText(line, x + w / 2, ty);
    ty += lh;
  });
}

function wrap(ctx, text, maxW) {
  if (text.includes("\n")) return text.split("\n").flatMap((p) => wrap(ctx, p, maxW));
  const words = text.split(/\s+/); const lines = []; let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ---------- trending Indian memes ----------
async function loadTrending() {
  try {
    const list = await (await fetch("/api/trending")).json();
    if (!list.length) return;
    $("#trendTitle").hidden = false;
    const grid = $("#trendGrid"); grid.innerHTML = "";
    list.forEach((m) => {
      const t = document.createElement("div");
      t.className = "tile";
      t.title = m.title;
      t.innerHTML = `<canvas></canvas><span class="like">${m.indian ? "🇮🇳 " : ""}${esc(m.template)}</span>`;
      t.addEventListener("click", () => { renderResults([{ ...m }]); setStatus(`<span class="badge found">TRENDING</span> ${esc(m.title)}`); window.scrollTo({ top: 0, behavior: "smooth" }); });
      grid.appendChild(t);
      drawMeme($("canvas", t), m);
    });
  } catch {}
}

// ---------- hall of fame ----------
async function loadFame() {
  try {
    const list = await (await fetch("/api/memes")).json();
    const grid = $("#fameGrid");
    grid.innerHTML = "";
    list.slice(0, 10).forEach((m) => {
      const t = document.createElement("div");
      t.className = "tile";
      t.innerHTML = `<canvas></canvas><button class="like">♥ ${m.likes}</button>`;
      grid.appendChild(t);
      drawMeme($("canvas", t), m);
      $(".like", t).addEventListener("click", async () => {
        const r = await fetch(`/api/memes/${m.id}/like`, { method: "POST" });
        if (r.ok) $(".like", t).textContent = `♥ ${(await r.json()).likes}`;
      });
    });
  } catch {}
}
