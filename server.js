// MemeForge backend
// Flow: scenario -> SEARCH existing memes -> found? return them : GENERATE new ones
const express = require("express");
const fs = require("fs");
const path = require("path");

// --- load .env (no extra package needed) ---
try {
  fs.readFileSync(path.join(__dirname, ".env"), "utf8").split("\n").forEach((line) => {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
} catch {}

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- Templates (Imgflip) ----------
// Hardcoded fallback so the app works even if Imgflip is unreachable.
let TEMPLATES = [
  { id: "181913649", name: "Drake Hotline Bling", url: "https://i.imgflip.com/30b1gx.jpg", layout: "drake", tags: ["prefer", "instead", "better", "choose", "no", "yes", "rather"] },
  { id: "87743020", name: "Two Buttons", url: "https://i.imgflip.com/1g8my4.jpg", layout: "tb", tags: ["choice", "decide", "dilemma", "confused", "or", "both"] },
  { id: "112126428", name: "Distracted Boyfriend", url: "https://i.imgflip.com/1ur9b0.jpg", layout: "tb", tags: ["distracted", "new", "attention", "ignore", "look", "prize", "money"] },
  { id: "129242436", name: "Change My Mind", url: "https://i.imgflip.com/24y43o.jpg", layout: "tb", tags: ["opinion", "fact", "believe", "argue", "mine", "truth"] },
  { id: "131940431", name: "Gru's Plan", url: "https://i.imgflip.com/26jxvz.jpg", layout: "tb", tags: ["plan", "idea", "steps", "hackathon", "build", "fail"] },
  { id: "55311130", name: "This Is Fine", url: "https://i.imgflip.com/wxica.jpg", layout: "tb", tags: ["fine", "fire", "deadline", "bug", "crash", "lose", "panic", "late"] },
  { id: "97984", name: "Disaster Girl", url: "https://i.imgflip.com/23ls.jpg", layout: "tb", tags: ["chaos", "evil", "burn", "revenge", "company", "take"] },
  { id: "188390779", name: "Woman Yelling At Cat", url: "https://i.imgflip.com/345v97.jpg", layout: "tb", tags: ["angry", "yell", "fight", "argue", "boss", "judge"] },
  { id: "124822590", name: "Left Exit 12 Off Ramp", url: "https://i.imgflip.com/22bdq6.jpg", layout: "tb", tags: ["exit", "suddenly", "switch", "turn", "instead"] },
  { id: "217743513", name: "UNO Draw 25 Cards", url: "https://i.imgflip.com/3lmzyx.jpg", layout: "tb", tags: ["refuse", "never", "rather", "draw", "won't"] },
  // ---- Custom local templates (judge's company + the purse) ----
  { id: "astraalis-logo", name: "Astraalis Best Company", url: "/templates/astraalis-logo.png", layout: "band", local: true, tags: ["astraalis", "best", "company", "ai", "top", "dream", "which"] },
  { id: "astraalis-thankyou", name: "Astraalis Got Placed", url: "/templates/astraalis-thankyou.png", layout: "band", local: true, tags: ["astraalis", "placed", "placement", "selected", "offer", "joined", "hired", "got"] },
  { id: "astraalis-walkin", name: "Astraalis Walk-in Drive", url: "/templates/astraalis-walkin.png", layout: "band", local: true, tags: ["interview", "job", "need", "walk", "drive", "hiring", "career", "fresher", "astraalis"] },
  { id: "purse-judge", name: "The Purse Is Mine", url: "/templates/purse-judge.png", layout: "tb", local: true, tags: ["purse", "mine", "wallet", "prize", "judge", "win", "lost", "lose", "got"] },
];

// Special captions for the custom templates, by mood
const SPECIAL = {
  "The Purse Is Mine": {
    happy: { top: "When the judge finally says", bottom: "\"The purse is yours\" 🥹" },
    sad: { top: "Me watching my purse", bottom: "walk away with someone else 💔" },
    motivation: { top: "Eyes on the purse", bottom: "That purse is MINE 😤" },
  },
  "Astraalis Best Company": {
    any: { top: "Which is the best company?", bottom: "" },
  },
  "Astraalis Got Placed": {
    any: { top: "Me after getting placed in Astraalis AI", bottom: "" },
  },
  "Astraalis Walk-in Drive": {
    any: { top: "Me: I need a job\nThe universe:", bottom: "" },
  },
};

// Which purse mood fits the scenario (happy / sad / motivation)
function purseMood(scenario, mood) {
  const s = scenario.toLowerCase();
  if (/(lost|lose|losing|missed|gone|sad|cry)/.test(s) || mood === "sad") return "sad";
  if (/(got|won|win|happy|yay|finally)/.test(s) || mood === "wholesome" || mood === "happy") return "happy";
  return "motivation";
}

// Extra keywords for popular Imgflip templates (name words are added automatically)
const KEYWORDS = {
  "Drake Hotline Bling": "prefer instead better choose rather no yes",
  "Two Buttons": "choice decide dilemma confused or both",
  "Distracted Boyfriend": "distracted new attention ignore look tempted",
  "Change My Mind": "opinion fact believe argue truth",
  "Gru's Plan": "plan idea steps fail backfire",
  "This Is Fine": "fine fire deadline bug crash panic late",
  "Disaster Girl": "chaos evil burn revenge",
  "Woman Yelling At Cat": "angry yell fight argue blame",
  "Expanding Brain": "smart genius levels galaxy brain",
  "Batman Slapping Robin": "slap shut up stop interrupt",
  "Running Away Balloon": "run away chase lose dream goal",
  "Bernie I Am Once Again Asking For Your Financial Support": "money ask help again support",
  "Sad Pablo Escobar": "sad alone lonely waiting bored",
  "Waiting Skeleton": "waiting forever reply late",
  "Is This A Pigeon": "confused mistake wrong think",
  "Hide the Pain Harold": "pain fake smile hurt pretend",
  "Roll Safe Think About It": "smart hack logic think",
  "One Does Not Simply": "hard impossible simply",
  "Epic Handshake": "agree same common both",
  "Always Has Been": "always truth secret realize",
  "Monkey Puppet": "awkward nervous look away caught",
  "Buff Doge vs. Cheems": "then now before after strong weak",
  "Panik Kalm Panik": "panic calm scared relief",
  "Trade Offer": "offer deal trade exchange",
  "Bike Fall": "self blame own fault mistake",
  "Mocking Spongebob": "mock sarcastic repeat",
  "Futurama Fry": "not sure suspicious doubt",
  "Success Kid": "success win happy finally",
  "Leonardo Dicaprio Cheers": "cheers celebrate congrats",
  "Grus Plan": "plan",
};

let MEME_SOURCES = { imgflip: 0, memegen: 0 };
const layoutFor = (name) => (/drake/i.test(name) ? "drake" : "tb");

async function loadImgflip() {
  try {
    const r = await fetch("https://api.imgflip.com/get_memes", { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    if (!j.success) return;
    const have = new Map(TEMPLATES.map((t) => [t.id, t]));
    for (const m of j.data.memes) {
      if (have.has(m.id)) { have.get(m.id).url = m.url; continue; }
      if (m.box_count > 3) continue; // too many panels for top/bottom text
      TEMPLATES.push({ id: m.id, name: m.name, url: m.url, layout: layoutFor(m.name), tags: [...words(m.name), ...words(KEYWORDS[m.name] || "")] });
    }
    MEME_SOURCES.imgflip = j.data.memes.length;
  } catch { console.log("Imgflip unreachable — using built-in templates"); }
}

async function loadMemegen() {
  try {
    const r = await fetch("https://api.memegen.link/templates/", { signal: AbortSignal.timeout(6000) });
    const list = await r.json();
    const names = new Set(TEMPLATES.map((t) => t.name.toLowerCase()));
    for (const m of list) {
      if (!m.blank || names.has(String(m.name).toLowerCase()) || (m.lines || 2) > 3) continue;
      TEMPLATES.push({ id: "mg-" + m.id, name: m.name, url: m.blank, layout: layoutFor(m.name), tags: [...words(m.name), ...words((m.keywords || []).join(" "))] });
    }
    MEME_SOURCES.memegen = list.length;
  } catch { console.log("memegen.link unreachable — skipping"); }
}

// ---------- ONLINE memes (meme-api.com, free, no key) ----------
// Indian communities first, then global ones as backup. Missing subreddits are skipped safely.
const INDIAN_SUBS = ["IndianDankMemes", "dankinindia", "indianmemer", "IndianMeyMeys", "TamilMemes", "BollywoodMemes", "desimemes", "dankrishu"];
const GLOBAL_SUBS = ["memes", "wholesomememes", "ProgrammerHumor"];
let ONLINE = [];

async function fetchSub(sub) {
  try {
    const r = await fetch(`https://meme-api.com/gimme/${sub}/50`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    return (j.memes || [])
      .filter((m) => !m.nsfw && !m.spoiler && /\.(jpe?g|png)$/i.test(m.url))
      .map((m) => ({ title: m.title, image: m.url, sub: m.subreddit, ups: m.ups, link: m.postLink, indian: INDIAN_SUBS.includes(sub) }));
  } catch { return []; }
}

async function loadOnline() {
  const all = await Promise.all([...INDIAN_SUBS, ...GLOBAL_SUBS].map(fetchSub));
  const seen = new Set();
  const pool = all.flat().filter((m) => !seen.has(m.image) && seen.add(m.image));
  if (pool.length) ONLINE = pool;
  console.log(`Online memes: ${ONLINE.length} loaded (${ONLINE.filter((m) => m.indian).length} Indian)`);
}

function searchOnline(scenario) {
  const q = [...new Set(words(scenario))].filter((w) => w.length > 2);
  if (!q.length) return [];
  return ONLINE
    .map((m) => {
      const target = new Set(words(m.title).map(stem));
      const hits = q.filter((w) => target.has(stem(w))).length;
      return { m, hits, s: hits / q.length + (m.indian ? 0.15 : 0) };
    })
    .filter((x) => x.hits >= Math.min(2, q.length))
    .sort((a, b) => b.s - a.s || b.m.ups - a.m.ups)
    .slice(0, 3)
    .map(({ m }) => ({ template: `r/${m.sub}`, image: m.image, layout: "raw", top: "", bottom: "", title: m.title, link: m.link, source: "online", indian: m.indian }));
}

// ---------- Existing meme DB ----------
const DB = path.join(__dirname, "data", "memes.json");
const loadDB = () => { try { return JSON.parse(fs.readFileSync(DB, "utf8")); } catch { return []; } };
const saveDB = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));

// ---------- Text helpers ----------
const STOP = new Set("a an the is was were be been am are i me my we our you your he she it they them his her its their to of in on at for with and or but so if then that this those these just very really from by as into about when while said says say gave give got get has have had do did will would can could not no yes".split(" "));
const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9஀-௿\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
const stem = (w) => w.replace(/(ing|ed|es|s)$/, "");

function score(queryWords, text) {
  const target = new Set(words(text).map(stem));
  if (!queryWords.length) return 0;
  let hit = 0;
  for (const w of queryWords) if (target.has(stem(w))) hit++;
  return hit / queryWords.length;
}

// ---------- SEARCH ----------
function searchExisting(scenario) {
  const q = [...new Set(words(scenario))];
  return loadDB()
    .map((m) => ({ ...m, score: score(q, `${m.scenario} ${m.tags.join(" ")} ${m.top} ${m.bottom}`) }))
    .filter((m) => m.score >= 0.5)
    .sort((a, b) => b.score - a.score || b.likes - a.likes)
    .slice(0, 3);
}

// ---------- GENERATE (rule engine — always works offline) ----------
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const RECENT = []; // recently shown templates, so "make new" gives different images
function pickTemplates(scenario, n = 3) {
  const q = words(scenario);
  const pool = TEMPLATES.filter((t) => !t.local && !RECENT.includes(t.name));
  const ranked = pool
    .map((t) => ({ t, s: score(q, t.tags.join(" ") + " " + t.name) }))
    .sort((a, b) => b.s - a.s);
  const relevant = ranked.filter((x) => x.s > 0).slice(0, 8).sort(() => Math.random() - 0.5);
  const random = ranked.filter((x) => x.s === 0).sort(() => Math.random() - 0.5);
  // up to 2 relevant templates, the rest random for variety
  const chosen = [...relevant.slice(0, Math.min(2, n - 1)), ...random].slice(0, n).map((x) => x.t);
  chosen.forEach((t) => { RECENT.push(t.name); if (RECENT.length > Math.min(30, TEMPLATES.length - 6)) RECENT.shift(); });
  return chosen;
}

const PUNCH = {
  English: {
    savage: ["and I took that personally", "plan B: buy the whole company", "skill issue tbh"],
    funny: ["this is fine 🙂", "it works on my laptop", "nobody asked but here we are"],
    sad: ["and that's how I lost my peace", "at least I tried", "mom said it's my turn to cry"],
    wholesome: ["we still won as friends", "love that for us", "best day ever honestly"],
    happy: ["best day ever 🥹", "we actually did it", "main character energy"],
    motivation: ["that prize is MINE 😤", "never giving up", "one more try, then we win"],
  },
  Tanglish: {
    savage: ["Ithu namma area da 😤", "Plan B: company-ye vaanguvom", "Enna da nadakuthu inga"],
    funny: ["Ellam set aagidum bro 🙂", "Vera level scene da", "Yaarum kekala, aana sollren"],
    sad: ["Manasu valikuthu da", "Try pannom, athu podhum", "Enakku mattum yen ipdi"],
    wholesome: ["Friends irundha podhum da", "Semma feel bro", "Happy ah irukom"],
    happy: ["Vera level happy da 🥹", "Namma jeichitom!", "Semma day bro"],
    motivation: ["Purse namma dhaan da 😤", "Vidave maaten", "Next round namma dhaan"],
  },
};

function ruleGenerate(scenario, mood = "savage", language = "English") {
  const clean = scenario.replace(/\s+/g, " ").trim();
  const quote = (clean.match(/["“'‘]([^"”'’]{3,60})["”'’]/) || [])[1];
  const keys = words(clean).filter((w) => w.length > 3);
  const thing = keys[0] || "this";
  const lang = PUNCH[language] ? language : "English";
  const punches = PUNCH[lang][mood] || PUNCH[lang].savage;
  const short = clean.length > 70 ? clean.slice(0, 67) + "…" : clean;

  return pickTemplates(clean, 4).map((t) => {
    let top, bottom;
    switch (t.layout === "drake" ? "drake" : t.name) {
      case "drake": top = `Playing fair for the ${thing}`; bottom = quote ? `Just saying "${quote}"` : pick(punches); break;
      case "Two Buttons": top = `Stay calm about the ${thing}`; bottom = `Make it my whole personality`; break;
      case "Change My Mind": top = ""; bottom = quote ? `"${cap(quote)}"` : `The ${thing} was mine all along`; break;
      case "Distracted Boyfriend": top = `Me | the ${thing} | my actual work`; bottom = pick(punches); break;
      default: {
        const tops = quote
          ? [`When they say "${quote}"`, `Them: "${quote}"`, `"${cap(quote)}"`]
          : [short, `Me when ${clean.toLowerCase().replace(/^(i|me|when)\s+/i, "")}`.slice(0, 70), `Nobody:\nMe: ${short}`];
        top = pick(tops); bottom = pick(punches);
      }
    }
    return { template: t.name, image: t.url, layout: t.layout, top, bottom, source: "generated" };
  });
}

// ---------- SPECIAL memes (custom images) ----------
function specialMemes(scenario, mood) {
  const s = scenario.toLowerCase();
  const T = (name) => TEMPLATES.find((t) => t.name === name);
  const make = (name, cap) => { const t = T(name); return { template: t.name, image: t.url, layout: t.layout, top: cap.top, bottom: cap.bottom, source: "generated" }; };
  const out = [];

  if (/(purse|wallet)/.test(s)) {
    const first = purseMood(scenario, mood);
    const order = [first, ...["motivation", "happy", "sad"].filter((m) => m !== first)];
    order.forEach((m) => out.push({ ...make("The Purse Is Mine", SPECIAL["The Purse Is Mine"][m]), variant: m }));
  }
  if (/(placed|placement|selected|offer letter|hired|got the job)/.test(s)) out.push(make("Astraalis Got Placed", SPECIAL["Astraalis Got Placed"].any));
  else if (/(interview|job|walk.?in|hiring|career|unemployed)/.test(s)) out.push(make("Astraalis Walk-in Drive", SPECIAL["Astraalis Walk-in Drive"].any));
  if (/(best company|which company|dream company|astraalis|top company)/.test(s)) out.push(make("Astraalis Best Company", SPECIAL["Astraalis Best Company"].any));
  return out;
}

// ---------- AI IMAGE (Pollinations.ai — free, no key) ----------
// Generates a brand-new picture of the scenario, then we put meme captions on it.
const STYLE = {
  savage: "smug confident expression, dramatic lighting",
  funny: "exaggerated funny facial expression, comedic",
  sad: "dramatic sad expression, rain, cinematic",
  happy: "overjoyed celebrating, bright colors",
  motivation: "determined heroic pose, epic cinematic lighting",
  wholesome: "warm wholesome friendly mood, soft light",
};
// ---------- REAL PHOTO SEARCH (Openverse — free, no key, ~800M openly licensed images) ----------
// Gives an EXACT picture of the main subject (e.g. "flight" -> a real plane photo).
const ISSUED = new Set(); // image URLs we handed out, so the proxy may fetch them
const FEEL = new Set("happy sad angry funny crying laughing scared tired bored excited confused shocked late lost won fail".split(" "));
function subjectWords(scenario) {
  return words(scenario).filter((w) => w.length > 2 && !FEEL.has(w) && !/^(friend|mine|said|told|went|came|today|yesterday|tomorrow|very|much|really|always|never|bro|da|dei)$/.test(w));
}
async function openverse(q, n = 8) {
  try {
    const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${n}&mature=false`, {
      headers: { "user-agent": "MemeForge hackathon app" }, signal: AbortSignal.timeout(7000),
    });
    const j = await r.json();
    return (j.results || []).filter((x) => x.url && /^https:/.test(x.url));
  } catch { return []; }
}
async function photoMemes(scenario, mood, language, top, bottom) {
  const subj = subjectWords(scenario);
  if (!subj.length) return [];
  // try the most specific query first, then broaden
  const queries = [subj.slice(0, 3).join(" "), subj.slice(0, 2).join(" "), subj[0]];
  let results = [];
  for (const q of [...new Set(queries)]) { results = await openverse(q); if (results.length) break; }
  const chosen = results.sort(() => Math.random() - 0.5).slice(0, 2);
  return chosen.map((x) => {
    ISSUED.add(x.url); if (x.thumbnail) ISSUED.add(x.thumbnail);
    return { template: `Real photo · ${subj.slice(0, 2).join(" ")}`, image: x.url, fallbackImage: x.thumbnail, layout: "tb", photo: true,
      credit: x.creator ? `Photo: ${x.creator} (${String(x.license || "").toUpperCase()})` : "", top, bottom, source: "generated" };
  });
}

// Shared LLM call (Gemini or Claude) — returns null when no key is set
async function llmText(prompt) {
  try {
    if (process.env.GEMINI_API_KEY) {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      return (await r.json()).candidates?.[0]?.content?.parts?.[0]?.text || null;
    }
    if (process.env.ANTHROPIC_API_KEY) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal: AbortSignal.timeout(10000),
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5", max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
      });
      return (await r.json()).content?.[0]?.text || null;
    }
  } catch {}
  return null;
}

// Step 1: turn the scenario into a precise visual scene + caption (free text AI, no key)
async function planScene(scenario, mood, language) {
  const ask = `You design memes. Scenario: "${scenario}". Mood: ${mood}. Caption language: ${language} (Tanglish = Tamil in English letters).
Return ONLY JSON: {"scene":"one vivid sentence describing exactly what the picture shows: who, doing what, where, facial expression (Indian people/setting if it fits)","top":"short meme top text","bottom":"short punchline"}. No text inside the picture. Captions under 50 characters.`;
  try {
    let t = await llmText(ask);
    if (!t) {
      const r = await fetch(`https://text.pollinations.ai/${encodeURIComponent(ask)}?json=true&seed=${Date.now() % 100000}`, { signal: AbortSignal.timeout(9000) });
      t = await r.text();
    }
    const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    if (j.scene) return j;
  } catch {}
  return null;
}

// Step 2: build image prompts (two styles generated in parallel by the browser)
const ART = [
  { key: "photo", label: "AI photo", style: "realistic candid photo, sharp focus, natural light" },
  { key: "cartoon", label: "AI cartoon", style: "bold cartoon illustration, vibrant colors, comic style" },
];
async function aiImageMemes(scenario, mood = "savage", language = "English") {
  const plan = await planScene(scenario, mood, language);
  const scene = plan?.scene || `${scenario.replace(/["“”]/g, "").slice(0, 200)}, Indian setting`;
  const quote = (scenario.match(/["“'‘]([^"”'’]{3,60})["”'’]/) || [])[1];
  const lang = PUNCH[language] ? language : "English";
  const punches = PUNCH[lang][mood] || PUNCH[lang].savage;
  const short = scenario.length > 60 ? scenario.slice(0, 57) + "…" : scenario;
  const top = plan?.top || (quote ? `"${quote}"` : short);
  const bottom = plan?.bottom || pick(punches);
  const fb = TEMPLATES.filter((t) => !t.local);
  return ART.map((a) => {
    const prompt = `${scene}. ${STYLE[mood] || STYLE.funny}, ${a.style}, meme reaction image, no text, no letters, no watermark`;
    const url = `/api/ai-image?seed=${Math.floor(Math.random() * 1e9)}&p=${encodeURIComponent(prompt)}`;
    return { template: `${a.label}${plan ? " · smart prompt" : ""}`, image: url, layout: "tb", aiImage: true, scene,
      fallbackImage: null, top, bottom, source: "generated" };
  });
}

// ---------- GENERATE (AI — optional, better captions) ----------
async function aiGenerate(scenario, mood, language) {
  const shortlist = pickTemplates(scenario, 12);
  const list = shortlist.map((t) => t.name).join(", ");
  const prompt = `You are a viral meme writer. Scenario: "${scenario}". Mood: ${mood}. Language: ${language} (Tanglish = Tamil words in English letters).
Pick 3 DIFFERENT templates from: ${list}.
Return ONLY a JSON array: [{"template":"<exact name>","top":"...","bottom":"..."}]. Each line under 60 characters. Be clever, keep it clean.`;
  let text = "";
  try {
    if (process.env.GEMINI_API_KEY) {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const j = await r.json();
      text = j.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (process.env.ANTHROPIC_API_KEY) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal: AbortSignal.timeout(10000),
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
      });
      const j = await r.json();
      text = j.content?.[0]?.text || "";
    } else return null;
    const arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
    return arr.map((m) => {
      const t = shortlist.find((x) => x.name.toLowerCase() === String(m.template).toLowerCase()) || pick(shortlist);
      return { template: t.name, image: t.url, layout: t.layout, top: m.top || "", bottom: m.bottom || "", source: "generated" };
    });
  } catch (e) {
    console.log("AI failed, using rule engine:", e.message);
    return null;
  }
}

// ---------- API ----------
// Main endpoint: search first, generate if not found
app.post("/api/meme", async (req, res) => {
  const scenario = String(req.body.scenario || "").trim().slice(0, 300);
  const mood = String(req.body.mood || "savage").toLowerCase();
  const language = String(req.body.language || "English");
  if (!scenario) return res.status(400).json({ error: "Type a scenario first!" });

  if (!req.body.forceNew) {
    const found = searchExisting(scenario);
    if (found.length) return res.json({ found: true, memes: found.map((m) => ({ ...m, source: "existing" })) });
    const online = searchOnline(scenario);
    if (online.length) return res.json({ found: true, online: true, memes: online });
  }
  const special = specialMemes(scenario, mood);
  const [ai, aiImgRaw] = await Promise.all([
    aiGenerate(scenario, mood, language),
    req.body.noAiImage ? [] : aiImageMemes(scenario, mood, language),
  ]);
  const generic = ai || ruleGenerate(scenario, mood, language);
  const capTop = aiImgRaw[0]?.top || generic[0]?.top || scenario, capBottom = aiImgRaw[0]?.bottom || generic[0]?.bottom || "";
  const photos = await photoMemes(scenario, mood, language, capTop, capBottom);
  // if the AI picture fails to load, the browser swaps in the real photo
  const aiImg = aiImgRaw.map((m, i) => ({ ...m, fallbackImage: photos[i % Math.max(1, photos.length)]?.image || null }));
  const memes = [...aiImg, ...photos, ...special, ...generic].slice(0, aiImg.length + photos.length + Math.max(2, special.length));
  res.json({ found: false, engine: ai ? "ai" : "rules", memes });
});

// Save a meme -> it becomes "existing" for future searches (and shows in Hall of Fame)
app.post("/api/memes", (req, res) => {
  const { scenario, template, image, layout, top, bottom, customImage } = req.body;
  if (!scenario) return res.status(400).json({ error: "scenario required" });
  const db = loadDB();
  const item = {
    id: Date.now().toString(36), scenario: String(scenario).slice(0, 300), tags: [...new Set(words(scenario))],
    template, image, layout: layout || "tb", top: top || "", bottom: bottom || "",
    customImage: /^data:image\//.test(customImage || "") ? customImage : undefined, likes: 0,
  };
  db.unshift(item); saveDB(db); res.json(item);
});

app.get("/api/memes", (_, res) => res.json(loadDB().sort((a, b) => b.likes - a.likes).slice(0, 30)));

app.post("/api/memes/:id/like", (req, res) => {
  const db = loadDB(); const m = db.find((x) => x.id === req.params.id);
  if (!m) return res.status(404).end();
  m.likes++; saveDB(db); res.json(m);
});

// Image proxy so the canvas can export (avoids CORS taint)
app.get("/api/img", async (req, res) => {
  const url = String(req.query.url || "");
  const known = /^https:\/\/(image\.pollinations\.ai|i\.imgflip\.com|api\.memegen\.link|i\.redd\.it|preview\.redd\.it|i\.imgur\.com)\//.test(url);
  if (!known && !ISSUED.has(url)) return res.status(400).end();
  try {
    const r = await fetch(url, { headers: { "user-agent": "MemeForge hackathon app" }, redirect: "follow", signal: AbortSignal.timeout(url.includes("pollinations") ? 60000 : 12000) });
    if (!r.ok || !(r.headers.get("content-type") || "").startsWith("image/")) return res.status(502).end();
    res.set("content-type", r.headers.get("content-type") || "image/jpeg");
    res.set("cache-control", "public, max-age=86400");
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch { res.status(502).end(); }
});

// AI image: uses POLLINATIONS_KEY if set (reliable), else tries the old keyless endpoint
app.get("/api/ai-image", async (req, res) => {
  const p = String(req.query.p || "").slice(0, 900), seed = String(req.query.seed || "1").replace(/\D/g, "") || "1";
  if (!p) return res.status(400).end();
  const key = process.env.POLLINATIONS_KEY;
  const tries = [];
  if (key) tries.push({ url: `https://gen.pollinations.ai/image/${encodeURIComponent(p)}?model=${process.env.POLLINATIONS_MODEL || "flux"}&width=768&height=768&seed=${seed}&nologo=true`, headers: { authorization: `Bearer ${key}` } });
  tries.push({ url: `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=768&height=768&seed=${seed}&nologo=true&model=flux`, headers: {} });
  for (const t of tries) {
    try {
      const r = await fetch(t.url, { headers: t.headers, signal: AbortSignal.timeout(45000) });
      const type = r.headers.get("content-type") || "";
      if (!r.ok || !type.startsWith("image/")) continue;
      res.set("content-type", type); res.set("cache-control", "public, max-age=86400");
      return res.send(Buffer.from(await r.arrayBuffer()));
    } catch {}
  }
  res.status(502).end();
});

app.get("/api/templates", (_, res) => res.json(TEMPLATES));

// Trending Indian memes (random sample from the online pool)
app.get("/api/trending", (_, res) => {
  const indian = ONLINE.filter((m) => m.indian);
  const src = indian.length ? indian : ONLINE;
  const pickN = [...src].sort(() => Math.random() - 0.5).slice(0, 6);
  res.json(pickN.map((m) => ({ template: `r/${m.sub}`, image: m.image, layout: "raw", top: "", bottom: "", title: m.title, link: m.link, source: "online", indian: m.indian })));
});

const PORT = process.env.PORT || 3000;
loadOnline(); setInterval(loadOnline, 30 * 60 * 1000);
Promise.all([loadImgflip(), loadMemegen()]).finally(() => console.log(`Templates: ${TEMPLATES.length} total (Imgflip ${MEME_SOURCES.imgflip}, memegen ${MEME_SOURCES.memegen})`)).finally(() =>
  app.listen(PORT, () => console.log(`\n  MemeForge ready → http://localhost:${PORT}\n  AI captions: ${process.env.GEMINI_API_KEY ? "Gemini" : process.env.ANTHROPIC_API_KEY ? "Claude" : "off (rule engine)"}\n  AI images: ${process.env.POLLINATIONS_KEY ? "Pollinations (key)" : "Pollinations keyless (may fail) + Openverse photos"}\n`))
);
