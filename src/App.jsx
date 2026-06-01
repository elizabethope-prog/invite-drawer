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

// ---------- misc helpers ----------
const KIDS = ["Bradley", "Lilah"];
const KID_COLOR = { Bradley: "#1F6E63", Lilah: "#E0584B" };
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
    dates = ymd + "/" + addDayYmd(inv.dateISO); // all-day, exclusive end
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

// Downscale + compress in-browser so full-res phone screenshots don't blow the payload.
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
  return data; // already-parsed invite fields from the server
}

// Retry: in-artifact model calls fail intermittently; a second attempt usually clears it.
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
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState("list");
  const [calY, setCalY] = useState(new Date().getFullYear());
  const [calM, setCalM] = useState(new Date().getMonth());
  const [selDay, setSelDay] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [editing, setEditing] = useState(null); // null = list view; object = form
  const [preview, setPreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  useEffect(() => { setInvites(loadInvites()); setReady(true); }, []);

  const save = (arr) => { setInvites(arr); persist(arr); };

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
    if (editing.id) {
      next = invites.map((i) => (i.id === editing.id ? editing : i));
    } else {
      next = [...invites, { ...editing, id: Date.now().toString() }];
    }
    save(next); setEditing(null); setPreview(null);
  };

  const remove = (id) => save(invites.filter((i) => i.id !== id));
  const setStatus = (id, s) => save(invites.map((i) => (i.id === id ? { ...i, status: i.status === s ? "undecided" : s } : i)));

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

  // ----- calendar derivations (respect the active kid + status filters via `shown`) -----
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
  const agenda = selDay
    ? (byDay[selDay] || [])
    : shown.filter((i) => i.dateISO && i.dateISO.indexOf(monthPrefix) === 0);

  // List view: lead with upcoming (+ undated), tuck past away. shown is ascending.
  const upcoming = shown.filter((i) => !isPast(i.dateISO));
  const past = shown.filter((i) => isPast(i.dateISO)).reverse(); // most recent first

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    .id-root { font-family: 'Hanken Grotesk', sans-serif; color: #2B2420; min-height: 100%;
      background-color: #FBF6EE;
      background-image: radial-gradient(#E0584B22 1.5px, transparent 1.6px), radial-gradient(#1F6E6322 1.5px, transparent 1.6px);
      background-size: 38px 38px, 38px 38px; background-position: 0 0, 19px 19px; }
    .id-serif { font-family: 'Fraunces', serif; }
    .id-wrap { max-width: 640px; margin: 0 auto; padding: 22px 16px 120px; }
    .id-h1 { font-family:'Fraunces',serif; font-size: 30px; font-weight:600; letter-spacing:-.5px; margin:0; }
    .id-sub { font-size: 13px; color:#7A6E62; margin: 2px 0 18px; }
    .id-chips { display:flex; gap:8px; margin-bottom: 18px; flex-wrap:wrap; }
    .id-chip { border:1.5px solid #2B242022; background:#fff; border-radius:999px; padding:7px 14px;
      font-size:14px; font-weight:600; cursor:pointer; display:flex; gap:7px; align-items:center; }
    .id-chip.on { background:#2B2420; color:#FBF6EE; border-color:#2B2420; }
    .id-chip .ct { font-weight:600; opacity:.6; }
    .id-card { background:#fff; border-radius:16px; padding:16px 16px 14px; margin-bottom:14px;
      box-shadow: 0 2px 0 #2B24200d, 0 10px 24px -16px #2B242055; position:relative; overflow:hidden; }
    .id-card.past { opacity:.5; }
    .id-bar { position:absolute; left:0; top:0; bottom:0; width:5px; }
    .id-toprow { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
    .id-party { font-family:'Fraunces',serif; font-size:19px; font-weight:600; line-height:1.15; margin:0; }
    .id-when { font-size:14px; color:#5C5249; margin-top:3px; }
    .id-meta { font-size:13.5px; color:#5C5249; margin-top:8px; line-height:1.5; }
    .id-badges { display:flex; gap:6px; flex-wrap:wrap; margin-top:11px; align-items:center; }
    .id-pill { font-size:11.5px; font-weight:700; padding:4px 9px; border-radius:999px; letter-spacing:.2px; }
    .id-kid { color:#fff; }
    .id-src { background:#2B24200f; color:#5C5249; }
    .id-rsvp { background:#E0584B18; color:#B23A2E; }
    .id-actions { display:flex; gap:8px; margin-top:13px; }
    .id-btn { flex:1; text-align:center; border:none; border-radius:11px; padding:10px; font-family:inherit;
      font-size:13.5px; font-weight:700; cursor:pointer; text-decoration:none; display:block; }
    .id-open { background:#2B2420; color:#FBF6EE; }
    .id-ghost { background:#2B24200f; color:#5C5249; }
    .id-empty { text-align:center; padding:50px 20px; color:#7A6E62; }
    .id-fab { position:fixed; bottom:22px; left:50%; transform:translateX(-50%); z-index:30;
      background:#E0584B; color:#fff; border:none; border-radius:999px; padding:15px 26px;
      font-family:'Fraunces',serif; font-size:16px; font-weight:600; cursor:pointer;
      box-shadow:0 8px 22px -6px #E0584B99; display:flex; gap:8px; align-items:center; }
    .id-sheet { position:fixed; inset:0; background:#2B242066; z-index:40; display:flex; align-items:flex-end;
      justify-content:center; padding:0; }
    .id-form { background:#FBF6EE; width:100%; max-width:640px; border-radius:22px 22px 0 0; padding:20px 18px 28px;
      max-height:92vh; overflow:auto; }
    .id-form h2 { font-family:'Fraunces',serif; font-size:22px; margin:2px 0 16px; }
    .id-label { font-size:12.5px; font-weight:700; color:#7A6E62; text-transform:uppercase; letter-spacing:.4px;
      margin:14px 0 6px; display:block; }
    .id-input, .id-select { width:100%; border:1.5px solid #2B242022; background:#fff; border-radius:11px;
      padding:12px; font-family:inherit; font-size:16px; color:#2B2420; }
    .id-kidrow { display:flex; gap:10px; }
    .id-kidbtn { flex:1; border:2px solid; background:#fff; border-radius:12px; padding:12px; font-family:'Fraunces',serif;
      font-size:16px; font-weight:600; cursor:pointer; }
    .id-photo { border:2px dashed #2B242033; border-radius:14px; padding:18px; text-align:center; cursor:pointer;
      background:#fff8; font-weight:600; color:#5C5249; font-size:14.5px; }
    .id-prev { width:100%; border-radius:12px; margin-top:10px; max-height:230px; object-fit:cover; }
    .id-err { background:#E0584B18; color:#B23A2E; border-radius:10px; padding:10px 12px; font-size:13.5px;
      font-weight:600; margin-top:12px; }
    .id-save { background:#1F6E63; color:#fff; border:none; border-radius:13px; padding:15px; width:100%;
      font-family:'Fraunces',serif; font-size:17px; font-weight:600; cursor:pointer; margin-top:20px; }
    .id-cancel { background:none; border:none; color:#7A6E62; font-family:inherit; font-size:14px; font-weight:600;
      cursor:pointer; width:100%; padding:12px; margin-top:4px; }
    .id-spin { display:inline-block; width:15px; height:15px; border:2.5px solid #ffffff66; border-top-color:#fff;
      border-radius:50%; animation:idspin .7s linear infinite; }
    .id-chips2 { margin-top:-8px; }
    .id-chip-s { padding:6px 12px; font-size:13px; }
    .id-done { background:#1F6E6318; color:#1F6E63; }
    .id-no { background:#7A6E6218; color:#5C5249; }
    .id-seg { display:flex; gap:8px; margin-top:13px; }
    .id-segbtn { flex:1; border:1.5px solid #2B242022; background:#fff; color:#5C5249; border-radius:11px;
      padding:11px; font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; }
    .id-seg-go.on { background:#1F6E63; color:#fff; border-color:#1F6E63; }
    .id-seg-no.on { background:#B23A2E; color:#fff; border-color:#B23A2E; }
    .id-cal { background:#E8F1EF; color:#1F6E63; }
    .id-actions { margin-top:9px; }
    .id-viewtoggle { display:flex; gap:6px; background:#2B24200d; border-radius:12px; padding:4px; margin-bottom:16px; }
    .id-vt { flex:1; border:none; background:transparent; border-radius:9px; padding:9px; font-family:inherit;
      font-size:14px; font-weight:700; color:#7A6E62; cursor:pointer; }
    .id-vt.on { background:#fff; color:#2B2420; box-shadow:0 1px 4px #2B242022; }
    .id-cal-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .id-cal-month { font-family:'Fraunces',serif; font-size:20px; font-weight:600; }
    .id-cal-nav { border:1.5px solid #2B242022; background:#fff; border-radius:10px; width:38px; height:38px;
      font-size:20px; line-height:1; color:#2B2420; cursor:pointer; }
    .id-dow { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin-bottom:5px; }
    .id-dow span { text-align:center; font-size:11px; font-weight:700; color:#A89D90; text-transform:uppercase; }
    .id-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin-bottom:20px; }
    .id-cell { background:#fff; border-radius:10px; min-height:46px; padding:5px 0 4px; position:relative;
      cursor:pointer; display:flex; flex-direction:column; align-items:center; box-shadow:0 1px 3px #2B24200f; }
    .id-cell.empty { background:transparent; box-shadow:none; cursor:default; }
    .id-cell.today { outline:2px solid #1F6E63; }
    .id-cell.sel { background:#2B2420; }
    .id-cell.sel .id-cellnum { color:#fff; }
    .id-cellnum { font-size:13px; font-weight:600; color:#2B2420; }
    .id-dots { display:flex; gap:2px; margin-top:3px; min-height:7px; flex-wrap:wrap; justify-content:center; }
    .id-dot { width:6px; height:6px; border-radius:6px; }
    .id-agenda-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;
      font-family:'Fraunces',serif; font-size:18px; font-weight:600; }
    .id-clear { border:none; background:#2B24200f; color:#5C5249; border-radius:999px; padding:6px 12px;
      font-family:inherit; font-size:12.5px; font-weight:700; cursor:pointer; }
    .id-danger { background:#B23A2E; color:#fff; }
    .id-pastbtn { width:100%; border:none; background:transparent; color:#7A6E62; font-family:inherit;
      font-size:14px; font-weight:700; cursor:pointer; padding:12px; margin-top:4px; display:flex;
      align-items:center; justify-content:center; gap:8px; }
    .id-pastbtn .ct { background:#2B24200f; border-radius:999px; padding:1px 9px; font-size:12.5px; }
    @keyframes idspin { to { transform: rotate(360deg); } }
  `;

  const f = editing || {};
  const set = (k, v) => setEditing((c) => ({ ...c, [k]: v }));
  const srcOptions = f.source && !SOURCES.includes(f.source) ? [f.source, ...SOURCES] : SOURCES;

  const renderCard = (i) => (
    <div key={i.id} className={"id-card" + (isPast(i.dateISO) ? " past" : "")}>
      <div className="id-bar" style={{ background: KID_COLOR[i.kid] || "#ccc" }} />
      <div className="id-toprow">
        <div>
          <p className="id-party">{i.partyFor || "Party"}</p>
          <div className="id-when">
            {fmtDate(i.dateISO)}{i.timeText ? " · " + i.timeText : ""}
          </div>
        </div>
      </div>
      {i.location && <div className="id-meta">📍 {i.location}</div>}
      {i.notes && <div className="id-meta">📝 {i.notes}</div>}
      <div className="id-badges">
        <span className="id-pill id-kid" style={{ background: KID_COLOR[i.kid] }}>{i.kid}</span>
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
        {gcalUrl(i) && (
          <a className="id-btn id-cal" href={gcalUrl(i)} target="_blank" rel="noreferrer">📅 Add to Calendar</a>
        )}
        {i.link && (
          <a className="id-btn id-open" href={i.link} target="_blank" rel="noreferrer">↗ Invite</a>
        )}
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
    <div className="id-root">
      <style>{css}</style>
      <div className="id-wrap">
        <h1 className="id-h1">The Invite Drawer</h1>
        <p className="id-sub">Every party, one place. Screenshot it, I'll read it.</p>

        <div className="id-viewtoggle">
          {[["list", "List"], ["calendar", "Calendar"]].map(([v, label]) => (
            <button key={v} className={"id-vt" + (view === v ? " on" : "")} onClick={() => setView(v)}>{label}</button>
          ))}
        </div>

        <div className="id-chips">
          {["all", "Bradley", "Lilah"].map((c) => (
            <button key={c} className={"id-chip" + (filter === c ? " on" : "")} onClick={() => setFilter(c)}>
              {c !== "all" && (
                <span style={{ width: 9, height: 9, borderRadius: 9, background: KID_COLOR[c], display: "inline-block" }} />
              )}
              {c === "all" ? "All" : c}
              <span className="ct">{counts[c]}</span>
            </button>
          ))}
        </div>

        <div className="id-chips id-chips2">
          {[["all", "All"], ["undecided", "To decide"], ["going", "Going"], ["notgoing", "Not going"]].map(([v, label]) => (
            <button key={v} className={"id-chip id-chip-s" + (statusFilter === v ? " on" : "")} onClick={() => setStatusFilter(v)}>
              {label}<span className="ct">{statusCounts[v]}</span>
            </button>
          ))}
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
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, marginBottom: 6 }}>No parties here yet</div>
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

      {!editing && (
        <button className="id-fab" onClick={startAdd}>✦ Add an invite</button>
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
                <input ref={fileRef} type="file" accept="image/*"
                  style={{ display: "none" }} onChange={handleFile} />
                {preview && <img className="id-prev" src={preview} alt="invite" />}
              </>
            )}

            <label className="id-label">Whose party?</label>
            <div className="id-kidrow">
              {KIDS.map((k) => (
                <button key={k} className="id-kidbtn"
                  style={{ borderColor: KID_COLOR[k], background: f.kid === k ? KID_COLOR[k] : "#fff", color: f.kid === k ? "#fff" : KID_COLOR[k] }}
                  onClick={() => set("kid", k)}>{k}</button>
              ))}
            </div>

            <label className="id-label">Party name / birthday kid</label>
            <input className="id-input" value={f.partyFor} placeholder="e.g. Mia turns 6"
              onChange={(e) => set("partyFor", e.target.value)} />

            <label className="id-label">Date</label>
            <input className="id-input" type="date" value={f.dateISO} onChange={(e) => set("dateISO", e.target.value)} />

            <label className="id-label">Time</label>
            <input className="id-input" value={f.timeText} placeholder="e.g. 2:00–4:00 PM"
              onChange={(e) => set("timeText", e.target.value)} />

            <label className="id-label">Location</label>
            <input className="id-input" value={f.location} placeholder="Venue or address"
              onChange={(e) => set("location", e.target.value)} />

            <label className="id-label">Source</label>
            <select className="id-select" value={f.source} onChange={(e) => set("source", e.target.value)}>
              <option value="">Select…</option>
              {srcOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <label className="id-label">Link to invite (paste)</label>
            <input className="id-input" value={f.link} placeholder="https://…"
              onChange={(e) => set("link", e.target.value)} />

            <label className="id-label">Going?</label>
            <div className="id-kidrow">
              <button type="button" className="id-kidbtn"
                style={{ borderColor: "#7A6E62", background: f.status === "undecided" ? "#7A6E62" : "#fff", color: f.status === "undecided" ? "#fff" : "#7A6E62" }}
                onClick={() => set("status", "undecided")}>Not yet</button>
              <button type="button" className="id-kidbtn"
                style={{ borderColor: "#1F6E63", background: f.status === "going" ? "#1F6E63" : "#fff", color: f.status === "going" ? "#fff" : "#1F6E63" }}
                onClick={() => set("status", "going")}>Going</button>
              <button type="button" className="id-kidbtn"
                style={{ borderColor: "#B23A2E", background: f.status === "notgoing" ? "#B23A2E" : "#fff", color: f.status === "notgoing" ? "#fff" : "#B23A2E" }}
                onClick={() => set("status", "notgoing")}>Not going</button>
            </div>

            <label className="id-label">RSVP by</label>
            <input className="id-input" value={f.rsvpBy} placeholder="e.g. June 10"
              onChange={(e) => set("rsvpBy", e.target.value)} />

            <label className="id-label">Notes</label>
            <input className="id-input" value={f.notes} placeholder="What to bring, parking, etc."
              onChange={(e) => set("notes", e.target.value)} />

            {err && <div className="id-err">{err}</div>}
            <button className="id-save" onClick={commit}>{f.id ? "Save changes" : "Save to drawer"}</button>
            <button className="id-cancel" onClick={() => { setEditing(null); setPreview(null); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
