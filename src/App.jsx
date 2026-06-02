import React, { useState, useEffect, useRef } from "react";

// ---------- storage (localStorage — data lives in this browser/device) ----------
const KEY = "invite-drawer:v1";

function loadInvites() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return arr.map((i) => ({ ...i, status: i.status || (i.rsvped ? "going" : "undecided") }));
  } catch {
    return [];
  }
}
function persist(arr) {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch (e) {
    console.error("save failed", e);
  }
}

// theme persistence (best-effort; falls back to in-session state)
const THEME_KEY = "invite-drawer:theme";
function loadTheme() { try { return localStorage.getItem(THEME_KEY) || "dark"; } catch { return "dark"; } }
function saveTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch {} }

// ---------- kids, sources, avatars ----------
const KIDS = ["Bradley", "Lilah"];
const KID_COLOR = { Bradley: "#2F80ED", Lilah: "#EC4E9E" };
const KID_TINT = { Bradley: "#E9F2FE", Lilah: "#FCE7F2" };
const KID_TINT_DARK = { Bradley: "#1B2742", Lilah: "#2E1C2F" };
const KID_AVATAR = { Bradley: "data:image/jpeg;base64,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", Lilah: "data:image/jpeg;base64,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" };
const STATUS_COLOR = { all: "#2B2420", undecided: "#CC7A14", going: "#1E8E5A", notgoing: "#D14A3E" };
const SOURCES = ["Evite", "Paperless Post", "Punchbowl", "Partiful", "Mixily", "Text message", "Other"];
const todayISO = () => new Date().toISOString().slice(0, 10);

function fmtDate(iso) {
  if (!iso) return "Date TBD";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
const isPast = (iso) => iso && iso < todayISO();

// ---------- Google Calendar link (no backend — just a prefilled URL) ----------
const pad = (n) => String(n).padStart(2, "0");
function addDayYmd(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10).replace(/-/g, "");
}
function parseTimes(timeText) {
  if (!timeText) return null;
  const re = /(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/gi;
  const ms = [];
  let m;
  while ((m = re.exec(timeText)) !== null && ms.length < 2) {
    if (!m[1]) continue;
    ms.push({ h: parseInt(m[1], 10), min: m[2] ? parseInt(m[2], 10) : 0, mer: m[3] ? m[3].toLowerCase().replace(/\./g, "") : null });
  }
  if (!ms.length) return null;
  const to24 = (o, fb) => {
    let h = o.h; const mer = o.mer || fb;
    if (mer === "pm" && h !== 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    return h * 60 + o.min;
  };
  const end = ms[1] || null;
  const startMin = to24(ms[0], end && end.mer ? end.mer : null);
  let endMin = end ? to24(end, null) : startMin + 120;
  if (endMin <= startMin) endMin = Math.min(startMin + 120, 1439);
  return { startMin, endMin };
}
function gcalUrl(inv) {
  if (!inv.dateISO) return null;
  const ymd = inv.dateISO.replace(/-/g, "");
  const t = parseTimes(inv.timeText);
  let dates;
  if (t) {
    const f = (mins) => pad(Math.floor(mins / 60)) + pad(mins % 60) + "00";
    dates = ymd + "T" + f(t.startMin) + "/" + ymd + "T" + f(t.endMin);
  } else {
    dates = ymd + "/" + addDayYmd(inv.dateISO);
  }
  const details = [
    inv.link ? "Invite: " + inv.link : "",
    inv.source ? "Source: " + inv.source : "",
    inv.rsvpBy ? "RSVP by: " + inv.rsvpBy : "",
    inv.kid ? "For: " + inv.kid : "",
    inv.notes || "",
  ].filter(Boolean).join("\n");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: inv.partyFor || "Birthday party",
    dates,
    details,
    location: inv.location || "",
  });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

// ---------- image + reader ----------
function processImage(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        let w = img.width, h = img.height;
        if (w > max || h > max) {
          const s = Math.min(max / w, max / h);
          w = Math.round(w * s); h = Math.round(h * s);
        }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        const dataUrl = c.toDataURL("image/jpeg", 0.82);
        res({ previewUrl: dataUrl, base64: dataUrl.split(",")[1], mediaType: "image/jpeg" });
      };
      img.onerror = () => rej(new Error("Couldn't open that image file."));
      img.src = reader.result;
    };
    reader.onerror = () => rej(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

async function attemptRead(base64, mediaType) {
  const resp = await fetch("/.netlify/functions/read-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mediaType }),
  });
  let data;
  try { data = await resp.json(); } catch { throw new Error("Reader returned an unreadable response."); }
  if (!resp.ok || data.error) {
    throw new Error(data.error || ("Reader returned HTTP " + resp.status));
  }
  return data;
}
async function readInvite(base64, mediaType) {
  let last;
  for (let i = 0; i < 3; i++) {
    try { return await attemptRead(base64, mediaType); }
    catch (e) { last = e; await new Promise((r) => setTimeout(r, 600)); }
  }
  throw last;
}

const blank = () => ({
  id: null, partyFor: "", dateISO: "", timeText: "", location: "",
  rsvpBy: "", source: "", link: "", kid: "", notes: "", status: "undecided",
});

export default function App() {
  const [invites, setInvites] = useState([]);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState(loadTheme());
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState("list");
  const [calY, setCalY] = useState(new Date().getFullYear());
  const [calM, setCalM] = useState(new Date().getMonth());
  const [selDay, setSelDay] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [err, setErr] = useState("");
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");
  const fileRef = useRef(null);
  const importRef = useRef(null);

  useEffect(() => { setInvites(loadInvites()); setReady(true); }, []);

  const save = (arr) => { setInvites(arr); persist(arr); };
  const toggleTheme = () => { const t = theme === "dark" ? "light" : "dark"; setTheme(t); saveTheme(t); };
  const startAdd = () => { setEditing(blank()); setPreview(null); setErr(""); };
  const startEdit = (inv) => { setEditing({ ...inv }); setPreview(null); setErr(""); };

  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setErr(""); setParsing(true);
    try {
      const img = await processImage(file);
      setPreview(img.previewUrl);
      const p = await readInvite(img.base64, img.mediaType);
      setEditing((cur) => ({
        ...cur,
        partyFor: p.partyFor || cur.partyFor,
        dateISO: p.dateISO || cur.dateISO,
        timeText: p.timeText || cur.timeText,
        location: p.location || cur.location,
        rsvpBy: p.rsvpBy || cur.rsvpBy,
        source: p.source || cur.source,
        notes: p.notes || cur.notes,
      }));
    } catch (e) {
      console.error(e);
      setErr("Couldn't auto-read this one (" + (e.message || "unknown error") + "). Fill in the details below and you're set.");
    } finally {
      setParsing(false);
    }
  };

  const commit = () => {
    if (!editing.kid) { setErr("Pick whose party it is (Bradley or Lilah)."); return; }
    if (!editing.partyFor.trim()) { setErr("Add a name for the party."); return; }
    let next;
    if (editing.id) next = invites.map((i) => (i.id === editing.id ? editing : i));
    else next = [...invites, { ...editing, id: Date.now().toString() }];
    save(next); setEditing(null); setPreview(null);
  };

  const remove = (id) => save(invites.filter((i) => i.id !== id));
  const setStatus = (id, s) => save(invites.map((i) => (i.id === id ? { ...i, status: i.status === s ? "undecided" : s } : i)));

  const exportData = () => {
    try {
      const blob = new Blob([JSON.stringify(invites, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "invite-drawer-backup-" + todayISO() + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackupMsg("Backup downloaded — keep it somewhere safe.");
    } catch { setBackupMsg("Couldn't create the backup file."); }
  };
  const importData = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arr = JSON.parse(reader.result);
        if (!Array.isArray(arr)) throw new Error("not a list");
        const have = new Set(invites.map((i) => i.id));
        const add = arr.filter((i) => i && i.id && !have.has(i.id))
          .map((i) => ({ ...i, status: i.status || (i.rsvped ? "going" : "undecided") }));
        save([...invites, ...add]);
        setBackupMsg("Restored " + add.length + " " + (add.length === 1 ? "party" : "parties") + " from your backup.");
      } catch { setBackupMsg("That file doesn't look like a valid backup."); }
    };
    reader.readAsText(file);
  };

  const counts = {
    all: invites.length,
    Bradley: invites.filter((i) => i.kid === "Bradley").length,
    Lilah: invites.filter((i) => i.kid === "Lilah").length,
  };
  const statusCounts = {
    all: invites.length,
    undecided: invites.filter((i) => i.status === "undecided").length,
    going: invites.filter((i) => i.status === "going").length,
    notgoing: invites.filter((i) => i.status === "notgoing").length,
  };
  const shown = invites
    .filter((i) => filter === "all" || i.kid === filter)
    .filter((i) => statusFilter === "all" || i.status === statusFilter)
    .sort((a, b) => {
      if (!a.dateISO) return 1;
      if (!b.dateISO) return -1;
      return a.dateISO.localeCompare(b.dateISO);
    });

  const byDay = {};
  shown.forEach((i) => { if (i.dateISO) (byDay[i.dateISO] = byDay[i.dateISO] || []).push(i); });
  const monthLabel = new Date(calY, calM, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const monthPrefix = calY + "-" + pad(calM + 1);
  const firstDow = new Date(calY, calM, 1).getDay();
  const daysInMonth = new Date(calY, calM + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const stepMonth = (delta) => {
    setSelDay(null);
    let m = calM + delta, y = calY;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCalM(m); setCalY(y);
  };
  const agenda = selDay ? (byDay[selDay] || []) : shown.filter((i) => i.dateISO && i.dateISO.indexOf(monthPrefix) === 0);

  const upcoming = shown.filter((i) => !isPast(i.dateISO));
  const past = shown.filter((i) => isPast(i.dateISO)).reverse();
  const tintOf = (kid) => (theme === "dark" ? KID_TINT_DARK[kid] : KID_TINT[kid]) || "var(--surface)";

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    .id-root {
      --text:#2B2420; --muted:#5C5249; --soft:#8a7d70;
      --surface:#ffffff; --sheet:#FFF6EA; --input:#ffffff;
      --border:#2B242016; --border2:#2B242018; --ghost:#ffffffcc; --toggle:#ffffffcc;
      --vtoff:#a99; --srcbg:#ffffffb0; --srccol:#5C5249;
      --cell:#ffffff; --cellnum:#2B2420; --sel:#2B2420; --openbg:#2B2420; --opencol:#ffffff;
      font-family:'Hanken Grotesk',sans-serif; color:var(--text); min-height:100%;
      background:linear-gradient(180deg,#FFF1F6 0%,#FCF7EE 44%,#EDF5FC 100%); }
    .id-root.dark {
      --text:#EFE9F4; --muted:#BDB6C8; --soft:#948DA1;
      --surface:#221F33; --sheet:#1A1828; --input:#2A2740;
      --border:#FFFFFF1F; --border2:#FFFFFF26; --ghost:#FFFFFF14; --toggle:#FFFFFF12;
      --vtoff:#9b94a8; --srcbg:#FFFFFF16; --srccol:#BDB6C8;
      --cell:#221F33; --cellnum:#EFE9F4; --sel:#6C63A6; --openbg:#3D3A57; --opencol:#ffffff;
      background:linear-gradient(180deg,#191628 0%,#141220 58%,#161A28 100%); }
    .id-wrap { max-width:640px; margin:0 auto; padding:18px 16px 130px; }

    .id-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
      background:linear-gradient(115deg,#FF6FA5 0%,#FFB04D 38%,#3FD6A0 70%,#4FB6F2 100%);
      border-radius:24px; padding:20px 18px 18px; margin-bottom:16px; position:relative; overflow:hidden;
      box-shadow:0 14px 32px -16px #E0457F66; }
    .id-head:before { content:"🎈"; position:absolute; right:104px; top:-4px; font-size:30px; transform:rotate(12deg); }
    .id-head:after { content:"🎉"; position:absolute; right:16px; bottom:8px; font-size:24px; }
    .id-h1 { font-family:'Fredoka',sans-serif; font-size:32px; font-weight:700; letter-spacing:-.3px; margin:0;
      color:#fff; text-shadow:0 2px 0 #00000022, 0 1px 8px #0000001f; }
    .id-sub { font-size:14px; color:#fff; margin:4px 0 0; font-weight:700; text-shadow:0 1px 4px #00000026; }
    .id-headbtns { display:flex; gap:8px; flex:none; }
    .id-iconbtn { width:44px; height:44px; border-radius:15px; border:none; cursor:pointer;
      background:#ffffffe6; color:#2B2420; font-size:19px; box-shadow:0 3px 10px #0000002b; }

    .id-viewtoggle { display:flex; gap:6px; background:var(--toggle); border-radius:15px; padding:5px; margin-bottom:16px;
      box-shadow:inset 0 0 0 2px var(--border), 0 2px 10px -6px #2B242033; }
    .id-vt { flex:1; border:none; background:transparent; border-radius:11px; padding:11px; font-family:'Fredoka',sans-serif;
      font-size:16px; font-weight:600; color:var(--vtoff); cursor:pointer; }
    .id-vt.on { background:linear-gradient(135deg,#EC4E9E,#2F80ED); color:#fff; box-shadow:0 4px 12px -3px #2F80ED66; }

    .id-chips { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
    .id-chip { border:2.5px solid var(--border); background:var(--surface); border-radius:999px; padding:5px 14px 5px 6px;
      font-size:14px; font-weight:800; cursor:pointer; display:flex; gap:7px; align-items:center; color:var(--text); }
    .id-chip .ct { font-weight:800; opacity:.5; }
    .id-chipav { width:27px; height:27px; border-radius:50%; object-fit:cover; border:2.5px solid; }
    .id-chipemoji { font-size:18px; padding-left:7px; }
    .id-chips2 { margin-top:-4px; }
    .id-chip-s { padding:7px 14px; font-size:13px; }

    .id-card { border-radius:20px; padding:16px 16px 14px; margin-bottom:15px; position:relative; overflow:hidden;
      box-shadow:0 3px 0 #00000010, 0 16px 34px -20px #00000088;
      animation:idUp .45s cubic-bezier(.2,.7,.3,1) both; }
    .id-card:nth-child(1){animation-delay:.02s}.id-card:nth-child(2){animation-delay:.06s}
    .id-card:nth-child(3){animation-delay:.10s}.id-card:nth-child(4){animation-delay:.14s}
    .id-card:nth-child(5){animation-delay:.18s}.id-card:nth-child(6){animation-delay:.22s}
    .id-card.past { opacity:.5; }
    .id-bar { position:absolute; left:0; top:0; bottom:0; width:8px; }
    .id-toprow { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .id-party { font-family:'Fredoka',sans-serif; font-size:21px; font-weight:700; line-height:1.1; margin:0; }
    .id-when { font-size:14px; color:var(--muted); margin-top:4px; font-weight:700; }
    .id-cardav { flex:none; width:50px; height:50px; border-radius:50%; object-fit:cover; border:3.5px solid;
      box-shadow:0 3px 10px #00000026; }
    .id-meta { font-size:13.5px; color:var(--muted); margin-top:8px; line-height:1.5; font-weight:500; }
    .id-badges { display:flex; gap:6px; flex-wrap:wrap; margin-top:11px; align-items:center; }
    .id-pill { font-size:11.5px; font-weight:800; padding:4px 10px; border-radius:999px; letter-spacing:.2px; }
    .id-kidpill { font-size:12px; font-weight:800; padding:3px 11px 3px 3px; border-radius:999px; border:2.5px solid;
      display:inline-flex; align-items:center; gap:6px; background:var(--surface); }
    .id-kidpillav { width:18px; height:18px; border-radius:50%; object-fit:cover; }
    .id-src { background:var(--srcbg); color:var(--srccol); }
    .id-rsvp { background:#FFF0D6; color:#B26A00; }
    .id-done { background:#1E8E5A; color:#fff; }
    .id-no { background:#D14A3E; color:#fff; }

    .id-seg { display:flex; gap:8px; margin-top:13px; }
    .id-segbtn { flex:1; border:2.5px solid var(--border2); background:var(--surface); color:var(--muted); border-radius:13px;
      padding:11px; font-family:'Fredoka',sans-serif; font-size:15px; font-weight:600; cursor:pointer; }
    .id-seg-go.on { background:#1E8E5A; color:#fff; border-color:#1E8E5A; }
    .id-seg-no.on { background:#D14A3E; color:#fff; border-color:#D14A3E; }

    .id-actions { display:flex; gap:8px; margin-top:9px; }
    .id-btn { flex:1; text-align:center; border:none; border-radius:13px; padding:11px; font-family:inherit;
      font-size:13.5px; font-weight:800; cursor:pointer; text-decoration:none; display:block; }
    .id-open { background:var(--openbg); color:var(--opencol); }
    .id-cal { background:var(--surface); color:#2F80ED; box-shadow:inset 0 0 0 2px #2F80ED44; }
    .id-ghost { background:var(--ghost); color:var(--muted); }
    .id-danger { background:#D14A3E; color:#fff; }

    .id-pastbtn { width:100%; border:none; background:transparent; color:var(--soft); font-family:'Fredoka',sans-serif;
      font-size:16px; font-weight:600; cursor:pointer; padding:12px; margin-top:4px; display:flex;
      align-items:center; justify-content:center; gap:8px; }
    .id-pastbtn .ct { background:var(--ghost); border-radius:999px; padding:1px 10px; font-size:12.5px; }

    .id-empty { text-align:center; padding:46px 20px; color:var(--soft); font-weight:700; }
    .id-fab { position:fixed; bottom:22px; left:50%; transform:translateX(-50%); z-index:30;
      background:linear-gradient(135deg,#EC4E9E 0%,#FF8A5B 50%,#2F80ED 100%); color:#fff; border:none; border-radius:999px;
      padding:16px 30px; font-family:'Fredoka',sans-serif; font-size:18px; font-weight:600; cursor:pointer;
      box-shadow:0 12px 28px -6px #EC4E9E88; }

    .id-cal-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .id-cal-month { font-family:'Fredoka',sans-serif; font-size:22px; font-weight:600; }
    .id-cal-nav { border:2.5px solid var(--border); background:var(--surface); border-radius:13px; width:42px; height:42px;
      font-size:21px; line-height:1; color:var(--text); cursor:pointer; }
    .id-dow { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin-bottom:5px; }
    .id-dow span { text-align:center; font-size:11px; font-weight:800; color:var(--soft); text-transform:uppercase; }
    .id-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin-bottom:20px; }
    .id-cell { background:var(--cell); border-radius:13px; min-height:46px; padding:5px 0 4px; position:relative;
      cursor:pointer; display:flex; flex-direction:column; align-items:center; box-shadow:0 1px 4px #00000012; }
    .id-cell.empty { background:transparent; box-shadow:none; cursor:default; }
    .id-cell.today { outline:3px solid #FFB23E; }
    .id-cell.sel { background:var(--sel); }
    .id-cell.sel .id-cellnum { color:#fff; }
    .id-cellnum { font-size:13px; font-weight:800; color:var(--cellnum); }
    .id-dots { display:flex; gap:2px; margin-top:3px; min-height:7px; flex-wrap:wrap; justify-content:center; }
    .id-dot { width:7px; height:7px; border-radius:7px; }
    .id-agenda-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;
      font-family:'Fredoka',sans-serif; font-size:19px; font-weight:600; }
    .id-clear { border:none; background:var(--ghost); color:var(--muted); border-radius:999px; padding:6px 12px;
      font-family:inherit; font-size:12.5px; font-weight:800; cursor:pointer; }

    .id-sheet { position:fixed; inset:0; background:#00000066; z-index:40; display:flex; align-items:flex-end;
      justify-content:center; }
    .id-form { background:var(--sheet); width:100%; max-width:640px; border-radius:26px 26px 0 0; padding:22px 18px 30px;
      max-height:92vh; overflow:auto; animation:idSheet .28s ease both; }
    .id-form h2 { font-family:'Fredoka',sans-serif; font-size:24px; margin:2px 0 14px; color:var(--text); }
    .id-note { font-size:13.5px; color:var(--muted); line-height:1.5; margin:0 0 16px; font-weight:500; }
    .id-okmsg { background:#1E8E5A22; color:#1E8E5A; border-radius:11px; padding:10px 12px; font-weight:800; margin-top:14px; }
    .id-label { font-size:12.5px; font-weight:800; color:var(--soft); text-transform:uppercase; letter-spacing:.4px;
      margin:14px 0 6px; display:block; }
    .id-input, .id-select { width:100%; border:2.5px solid var(--border); background:var(--input); border-radius:13px;
      padding:12px; font-family:inherit; font-size:16px; color:var(--text); }
    .id-kidrow { display:flex; gap:10px; }
    .id-kidbtn { flex:1; border:2.5px solid; background:var(--surface); border-radius:14px; padding:12px; font-family:'Fredoka',sans-serif;
      font-size:16px; font-weight:600; cursor:pointer; }
    .id-photo { border:3px dashed var(--border2); border-radius:16px; padding:18px; text-align:center; cursor:pointer;
      background:var(--surface); font-weight:700; color:var(--muted); font-size:14.5px; }
    .id-prev { width:100%; border-radius:14px; margin-top:10px; max-height:230px; object-fit:cover; }
    .id-err { background:#FFE1EC; color:#C23E6E; border-radius:12px; padding:10px 12px; font-size:13.5px;
      font-weight:700; margin-top:12px; }
    .id-save { background:linear-gradient(135deg,#EC4E9E,#2F80ED); color:#fff; border:none; border-radius:15px; padding:15px; width:100%;
      font-family:'Fredoka',sans-serif; font-size:18px; font-weight:600; cursor:pointer; margin-top:18px; }
    .id-restore { background:var(--surface); color:#2F80ED; border:2.5px solid #2F80ED; border-radius:15px; padding:14px; width:100%;
      font-family:'Fredoka',sans-serif; font-size:16px; font-weight:600; cursor:pointer; margin-top:10px; }
    .id-cancel { background:none; border:none; color:var(--soft); font-family:inherit; font-size:14px; font-weight:800;
      cursor:pointer; width:100%; padding:12px; margin-top:6px; }
    .id-spin { display:inline-block; width:15px; height:15px; border:2.5px solid #00000022; border-top-color:#EC4E9E;
      border-radius:50%; animation:idspin .7s linear infinite; }

    @keyframes idUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
    @keyframes idSheet { from { transform:translateY(40px); opacity:.6; } to { transform:none; opacity:1; } }
    @keyframes idspin { to { transform: rotate(360deg); } }
  `;

  const f = editing || {};
  const set = (k, v) => setEditing((c) => ({ ...c, [k]: v }));
  const srcOptions = f.source && !SOURCES.includes(f.source) ? [f.source, ...SOURCES] : SOURCES;

  const renderCard = (i) => (
    <div key={i.id} className={"id-card" + (isPast(i.dateISO) ? " past" : "")} style={{ background: tintOf(i.kid) }}>
      <div className="id-bar" style={{ background: KID_COLOR[i.kid] || "#ccc" }} />
      <div className="id-toprow">
        <div>
          <p className="id-party" style={{ color: KID_COLOR[i.kid] || "var(--text)" }}>{i.partyFor || "Party"}</p>
          <div className="id-when">{fmtDate(i.dateISO)}{i.timeText ? " · " + i.timeText : ""}</div>
        </div>
        {KID_AVATAR[i.kid] && <img className="id-cardav" style={{ borderColor: KID_COLOR[i.kid] }} src={KID_AVATAR[i.kid]} alt={i.kid} />}
      </div>
      {i.location && <div className="id-meta">📍 {i.location}</div>}
      {i.notes && <div className="id-meta">📝 {i.notes}</div>}
      <div className="id-badges">
        <span className="id-kidpill" style={{ borderColor: KID_COLOR[i.kid] }}>
          {KID_AVATAR[i.kid] && <img className="id-kidpillav" src={KID_AVATAR[i.kid]} alt="" />}
          <span style={{ color: KID_COLOR[i.kid] }}>{i.kid}</span>
        </span>
        {i.source && <span className="id-pill id-src">{i.source}</span>}
        {i.status === "going" && <span className="id-pill id-done">Going ✓</span>}
        {i.status === "notgoing" && <span className="id-pill id-no">Not going</span>}
        {i.status === "undecided" && <span className="id-pill id-rsvp">To decide{i.rsvpBy ? " by " + i.rsvpBy : ""}</span>}
      </div>
      <div className="id-seg">
        <button className={"id-segbtn id-seg-go" + (i.status === "going" ? " on" : "")} onClick={() => setStatus(i.id, "going")}>
          {i.status === "going" ? "✓ Going" : "Going"}
        </button>
        <button className={"id-segbtn id-seg-no" + (i.status === "notgoing" ? " on" : "")} onClick={() => setStatus(i.id, "notgoing")}>
          {i.status === "notgoing" ? "✓ Not going" : "Not going"}
        </button>
      </div>
      <div className="id-actions">
        {gcalUrl(i) && <a className="id-btn id-cal" href={gcalUrl(i)} target="_blank" rel="noreferrer">📅 Add to Calendar</a>}
        {i.link && <a className="id-btn id-open" href={i.link} target="_blank" rel="noreferrer">↗ Invite</a>}
      </div>
      <div className="id-actions">
        {confirmDel === i.id ? (
          <>
            <button className="id-btn id-danger" onClick={() => { remove(i.id); setConfirmDel(null); }}>Delete for good</button>
            <button className="id-btn id-ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
          </>
        ) : (
          <>
            <button className="id-btn id-ghost" onClick={() => startEdit(i)}>Edit</button>
            <button className="id-btn id-ghost" onClick={() => setConfirmDel(i.id)}>Delete</button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className={"id-root" + (theme === "dark" ? " dark" : "")}>
      <style>{css}</style>
      <div className="id-wrap">
        <div className="id-head">
          <div>
            <h1 className="id-h1">The Invite Drawer</h1>
            <p className="id-sub">Every party, one place 🎈</p>
          </div>
          <div className="id-headbtns">
            <button className="id-iconbtn" onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? "☀️" : "🌙"}</button>
            <button className="id-iconbtn" onClick={() => { setBackupOpen(true); setBackupMsg(""); }} aria-label="Back up">☁︎</button>
          </div>
        </div>

        <div className="id-viewtoggle">
          {[["list", "List"], ["calendar", "Calendar"]].map(([v, label]) => (
            <button key={v} className={"id-vt" + (view === v ? " on" : "")} onClick={() => setView(v)}>{label}</button>
          ))}
        </div>

        <div className="id-chips">
          {["all", "Bradley", "Lilah"].map((c) => {
            const on = filter === c;
            const kidActive = on && c !== "all";
            return (
              <button key={c} className={"id-chip" + (on ? " on" : "")} onClick={() => setFilter(c)}
                style={kidActive ? { background: KID_COLOR[c], borderColor: KID_COLOR[c], color: "#fff" }
                  : on ? { background: "var(--openbg)", borderColor: "var(--openbg)", color: "var(--opencol)" } : undefined}>
                {c === "all"
                  ? <span className="id-chipemoji">🎉</span>
                  : <img className="id-chipav" style={{ borderColor: kidActive ? "#fff" : KID_COLOR[c] }} src={KID_AVATAR[c]} alt={c} />}
                {c === "all" ? "All" : c}
                <span className="ct">{counts[c]}</span>
              </button>
            );
          })}
        </div>

        <div className="id-chips id-chips2">
          {[["all", "All"], ["undecided", "To decide"], ["going", "Going"], ["notgoing", "Not going"]].map(([v, label]) => {
            const on = statusFilter === v;
            const col = STATUS_COLOR[v];
            const style = v === "all"
              ? (on ? { background: "var(--openbg)", borderColor: "var(--openbg)", color: "var(--opencol)" }
                    : { borderColor: "var(--border2)", color: "var(--text)" })
              : (on ? { background: col, borderColor: col, color: "#fff" }
                    : { borderColor: col + "66", color: col });
            return (
              <button key={v} className={"id-chip id-chip-s" + (on ? " on" : "")} onClick={() => setStatusFilter(v)}
                style={style}>
                {label}<span className="ct">{statusCounts[v]}</span>
              </button>
            );
          })}
        </div>

        {!ready ? (
          <p className="id-empty">Loading…</p>
        ) : view === "calendar" ? (
          <>
            <div className="id-cal-head">
              <button className="id-cal-nav" onClick={() => stepMonth(-1)}>‹</button>
              <div className="id-cal-month">{monthLabel}</div>
              <button className="id-cal-nav" onClick={() => stepMonth(1)}>›</button>
            </div>
            <div className="id-dow">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, di) => <span key={di}>{d}</span>)}
            </div>
            <div className="id-grid">
              {cells.map((c, idx) => {
                if (c === null) return <div key={idx} className="id-cell empty" />;
                const iso = monthPrefix + "-" + pad(c);
                const items = byDay[iso] || [];
                const cls = "id-cell" + (iso === todayISO() ? " today" : "") + (iso === selDay ? " sel" : "");
                return (
                  <div key={idx} className={cls} onClick={() => setSelDay(selDay === iso ? null : iso)}>
                    <span className="id-cellnum">{c}</span>
                    <div className="id-dots">
                      {items.slice(0, 3).map((it, di) => (
                        <span key={di} className="id-dot" style={{ background: KID_COLOR[it.kid] || "#ccc" }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="id-agenda-head">
              <span>{selDay ? fmtDate(selDay) : monthLabel}</span>
              {selDay && <button className="id-clear" onClick={() => setSelDay(null)}>Whole month</button>}
            </div>
            {agenda.length === 0 ? (
              <div className="id-empty">{selDay ? "No parties this day." : "No parties this month."}</div>
            ) : (
              agenda.map(renderCard)
            )}
          </>
        ) : shown.length === 0 ? (
          <div className="id-empty">
            <div style={{ fontFamily: "Fredoka, sans-serif", fontSize: 20, marginBottom: 6 }}>No parties here yet</div>
            Tap “Add an invite” and drop in a screenshot.
          </div>
        ) : (
          <>
            {upcoming.length === 0 ? (
              <div className="id-empty" style={{ padding: "30px 20px" }}>Nothing coming up.</div>
            ) : (
              upcoming.map(renderCard)
            )}
            {past.length > 0 && (
              <>
                <button className="id-pastbtn" onClick={() => setShowPast(!showPast)}>
                  {showPast ? "▾ Hide past" : "▸ Past parties"} <span className="ct">{past.length}</span>
                </button>
                {showPast && past.map(renderCard)}
              </>
            )}
          </>
        )}
      </div>

      {!editing && !backupOpen && (
        <button className="id-fab" onClick={startAdd}>✦ Add an invite</button>
      )}

      {backupOpen && (
        <div className="id-sheet" onClick={(e) => { if (e.target.classList.contains("id-sheet")) { setBackupOpen(false); setBackupMsg(""); } }}>
          <div className="id-form">
            <h2>Back up your parties</h2>
            <p className="id-note">Your invites live on this device only. Download a backup file to keep them safe — then you can restore it here anytime, or on a new phone. Restoring adds any parties not already in your list.</p>
            <button className="id-save" onClick={exportData}>⬇ Download backup</button>
            <button className="id-restore" onClick={() => importRef.current && importRef.current.click()}>⬆ Restore from a file</button>
            <input ref={importRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={importData} />
            {backupMsg && <div className="id-okmsg">{backupMsg}</div>}
            <button className="id-cancel" onClick={() => { setBackupOpen(false); setBackupMsg(""); }}>Close</button>
          </div>
        </div>
      )}

      {editing && (
        <div className="id-sheet" onClick={(e) => { if (e.target.classList.contains("id-sheet")) setEditing(null); }}>
          <div className="id-form">
            <h2>{f.id ? "Edit invite" : "New invite"}</h2>

            {!f.id && (
              <>
                <div className="id-photo" onClick={() => fileRef.current && fileRef.current.click()}>
                  {parsing ? (<span><span className="id-spin" /> &nbsp;Reading the invite…</span>)
                    : "📸 Take a photo or choose a screenshot"}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
                {preview && <img className="id-prev" src={preview} alt="invite" />}
              </>
            )}

            <label className="id-label">Whose party?</label>
            <div className="id-kidrow">
              {KIDS.map((k) => (
                <button key={k} className="id-kidbtn"
                  style={{ borderColor: KID_COLOR[k], background: f.kid === k ? KID_COLOR[k] : "var(--surface)", color: f.kid === k ? "#fff" : KID_COLOR[k] }}
                  onClick={() => set("kid", k)}>{k}</button>
              ))}
            </div>

            <label className="id-label">Party name / birthday kid</label>
            <input className="id-input" value={f.partyFor} placeholder="e.g. Mia turns 6" onChange={(e) => set("partyFor", e.target.value)} />

            <label className="id-label">Date</label>
            <input className="id-input" type="date" value={f.dateISO} onChange={(e) => set("dateISO", e.target.value)} />

            <label className="id-label">Time</label>
            <input className="id-input" value={f.timeText} placeholder="e.g. 2:00–4:00 PM" onChange={(e) => set("timeText", e.target.value)} />

            <label className="id-label">Location</label>
            <input className="id-input" value={f.location} placeholder="Venue or address" onChange={(e) => set("location", e.target.value)} />

            <label className="id-label">Source</label>
            <select className="id-select" value={f.source} onChange={(e) => set("source", e.target.value)}>
              <option value="">Select…</option>
              {srcOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <label className="id-label">Link to invite (paste)</label>
            <input className="id-input" value={f.link} placeholder="https://…" onChange={(e) => set("link", e.target.value)} />

            <label className="id-label">Going?</label>
            <div className="id-kidrow">
              <button type="button" className="id-kidbtn"
                style={{ borderColor: "#CC7A14", background: f.status === "undecided" ? "#CC7A14" : "var(--surface)", color: f.status === "undecided" ? "#fff" : "#CC7A14" }}
                onClick={() => set("status", "undecided")}>Not yet</button>
              <button type="button" className="id-kidbtn"
                style={{ borderColor: "#1E8E5A", background: f.status === "going" ? "#1E8E5A" : "var(--surface)", color: f.status === "going" ? "#fff" : "#1E8E5A" }}
                onClick={() => set("status", "going")}>Going</button>
              <button type="button" className="id-kidbtn"
                style={{ borderColor: "#D14A3E", background: f.status === "notgoing" ? "#D14A3E" : "var(--surface)", color: f.status === "notgoing" ? "#fff" : "#D14A3E" }}
                onClick={() => set("status", "notgoing")}>Not going</button>
            </div>

            <label className="id-label">RSVP by</label>
            <input className="id-input" value={f.rsvpBy} placeholder="e.g. June 10" onChange={(e) => set("rsvpBy", e.target.value)} />

            <label className="id-label">Notes</label>
            <input className="id-input" value={f.notes} placeholder="What to bring, parking, etc." onChange={(e) => set("notes", e.target.value)} />

            {err && <div className="id-err">{err}</div>}
            <button className="id-save" onClick={commit}>{f.id ? "Save changes" : "Save to drawer"}</button>
            <button className="id-cancel" onClick={() => { setEditing(null); setPreview(null); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
