import { useState, useEffect, useRef, useCallback } from "react";

// ── Constants ──────────────────────────────────────────────────────────────
const CATEGORIES = ["Camping & Shelter","Hiking & Footwear","Climbing & Technical","Water Sports","Snow & Winter"];
const CONDITIONS = ["New","Good","Fair","Worn","Replace"];
const CONDITION_COLORS = {
  New:"bg-emerald-100 text-emerald-800", Good:"bg-green-100 text-green-700",
  Fair:"bg-amber-100 text-amber-700", Worn:"bg-orange-100 text-orange-700", Replace:"bg-red-100 text-red-700",
};
const TRIP_TYPES = [
  { label:"Backpacking",         emoji:"🏕️", cats:["Camping & Shelter","Hiking & Footwear"],           unit:"nights" },
  { label:"Day Hike",            emoji:"🥾", cats:["Hiking & Footwear"],                               unit:"days"   },
  { label:"Rock Climbing",       emoji:"🧗", cats:["Climbing & Technical","Hiking & Footwear"],         unit:"days"   },
  { label:"Kayaking / Paddling", emoji:"🚣", cats:["Water Sports"],                                    unit:"days"   },
  { label:"Skiing / Snowboarding",emoji:"⛷️",cats:["Snow & Winter"],                                   unit:"days"   },
  { label:"Winter Camping",      emoji:"❄️", cats:["Camping & Shelter","Hiking & Footwear","Snow & Winter"], unit:"nights" },
];
const STORAGE_LOCATIONS = ["Garage","Basement","Closet","Car","Attic","Gear Room","Storage Unit","Other"];
const WEATHER_TAGS   = ["Cold","Hot","Wet / Rainy","Windy","High Altitude","Desert","Snow","Humid"];
const SERVICE_TYPES  = ["Cleaned","Waterproofed","Repaired","Inspected","Replaced Part","Retreated","Sharpened","Other"];
const USAGE_UNITS    = ["nights","days","miles","hours"];
const PRIORITY_LEVELS = ["Low","Medium","High","Must Have"];
const PRIORITY_COLORS = {
  Low:"bg-stone-100 text-stone-600", Medium:"bg-blue-100 text-blue-700",
  High:"bg-orange-100 text-orange-700", "Must Have":"bg-red-100 text-red-700",
};
const TRIP_ESSENTIALS = {
  "Backpacking":          ["tent","sleeping bag","backpack","headlamp"],
  "Day Hike":             ["shoes","boots","daypack","headlamp"],
  "Rock Climbing":        ["harness","helmet","belay"],
  "Kayaking / Paddling":  ["pfd","life jacket","paddle","dry bag"],
  "Skiing / Snowboarding":["ski","snowboard","helmet","boots","goggles"],
  "Winter Camping":       ["tent","sleeping bag","boots","beacon"],
};

const initialGear = [
  { id:"1", name:"2-Person Tent",       category:"Camping & Shelter",    condition:"Good",  weight:4.2, location:"Garage",    notes:"Needs new stakes",    photo:null, cost:350,  purchaseDate:"2022-06-15", expiryDate:"",           lentTo:null,    serviceLog:[], usageLog:[] },
  { id:"2", name:"Sleeping Bag (20°F)", category:"Camping & Shelter",    condition:"New",   weight:2.1, location:"Closet",    notes:"",                    photo:null, cost:280,  purchaseDate:"2024-01-10", expiryDate:"",           lentTo:null,    serviceLog:[], usageLog:[] },
  { id:"3", name:"Trail Running Shoes", category:"Hiking & Footwear",    condition:"Worn",  weight:1.8, location:"Closet",    notes:"300 miles on them",   photo:null, cost:140,  purchaseDate:"2023-03-20", expiryDate:"",           lentTo:null,    serviceLog:[], usageLog:[{id:"u1",date:"2024-08-10",tripName:"Zion Weekend",amount:3,unit:"days"}] },
  { id:"4", name:"Trekking Poles",      category:"Hiking & Footwear",    condition:"Good",  weight:1.0, location:"Garage",    notes:"",                    photo:null, cost:120,  purchaseDate:"2021-09-05", expiryDate:"",           lentTo:null,    serviceLog:[], usageLog:[] },
  { id:"5", name:"Climbing Harness",    category:"Climbing & Technical", condition:"Good",  weight:0.9, location:"Gear Room", notes:"",                    photo:null, cost:85,   purchaseDate:"2020-04-12", expiryDate:"2025-06-12", lentTo:null,    serviceLog:[{id:"s1",date:"2024-06-01",type:"Inspected",notes:"No wear on belay loop"}], usageLog:[] },
  { id:"6", name:"Dry Bag Set",         category:"Water Sports",         condition:"Good",  weight:0.6, location:"Garage",    notes:"",                    photo:null, cost:45,   purchaseDate:"2022-07-22", expiryDate:"",           lentTo:"Marcus",serviceLog:[], usageLog:[] },
  { id:"7", name:"Ski Boots",           category:"Snow & Winter",        condition:"Fair",  weight:7.5, location:"Garage",    notes:"",                    photo:null, cost:420,  purchaseDate:"2019-11-30", expiryDate:"",           lentTo:null,    serviceLog:[], usageLog:[] },
];

// ── Helpers ────────────────────────────────────────────────────────────────
const genId  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const today  = () => new Date().toISOString().split("T")[0];
const daysUntil = d => d ? Math.round((new Date(d) - new Date()) / 86400000) : null;
const isExpired  = d => d && new Date(d) < new Date();
const isExpiringSoon = d => { const n = daysUntil(d); return n !== null && n >= 0 && n <= 90; };
const fmt$ = v => v != null && v !== "" ? `$${Number(v).toLocaleString()}` : "—";
const fmtDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "—";
const gearGaps = (tripLabel, gear) => (TRIP_ESSENTIALS[tripLabel] || []).filter(kw => !gear.some(g => g.name.toLowerCase().includes(kw)));

function resizeImage(file, maxW=800, maxH=800, q=0.82) {
  return new Promise(res => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        const r = Math.min(maxW/img.width, maxH/img.height, 1);
        c.width = Math.round(img.width*r); c.height = Math.round(img.height*r);
        c.getContext("2d").drawImage(img,0,0,c.width,c.height);
        res(c.toDataURL("image/jpeg", q));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Icons ──────────────────────────────────────────────────────────────────
const Icon = ({ d, size=22, stroke="currentColor", fill="none", strokeWidth=1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const Icons = {
  gear:     "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6.93-2a6.97 6.97 0 0 0 .06-1c0-.34-.03-.68-.07-1l2.16-1.68a.5.5 0 0 0 .12-.63l-2.05-3.55a.5.5 0 0 0-.61-.22l-2.55 1.03a7 7 0 0 0-1.72-.99l-.38-2.71A.49.49 0 0 0 13 3h-2a.49.49 0 0 0-.49.42l-.38 2.71a7 7 0 0 0-1.72.99L5.86 6.09a.5.5 0 0 0-.61.22L3.2 9.86a.49.49 0 0 0 .12.63L5.49 12c-.04.32-.07.65-.07 1s.03.68.07 1l-2.16 1.68a.5.5 0 0 0-.12.63l2.05 3.55a.5.5 0 0 0 .61.22l2.55-1.03c.54.37 1.11.69 1.72.99l.38 2.71c.06.28.3.42.49.42h2c.19 0 .43-.14.49-.42l.38-2.71a7 7 0 0 0 1.72-.99l2.55 1.03a.5.5 0 0 0 .61-.22l2.05-3.55a.49.49 0 0 0-.12-.63Z",
  trips:    "M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13V7m0 13 6-2m-6-11 6-2m0 15 5.447 2.724A1 1 0 0 0 21 19.382V8.618a1 1 0 0 0-1.447-.894L15 10m0 5V10",
  pack:     "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2m-6 9 2 2 4-4",
  plus:     "M12 5v14M5 12h14",
  trash:    "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  edit:     "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z",
  weight:   "M6 2h12l4 7-10 13L2 9Z",
  location: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z",
  check:    "M20 6 9 17l-5-5",
  x:        "M18 6 6 18M6 6l12 12",
  back:     "M19 12H5M12 5l-7 7 7 7",
  warning:  "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01",
  camera:   "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  expand:   "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7",
  qr:       "M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 15h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2zM21 3v2M21 7v2M3 9v2M9 3v2M9 7v2M3 21v2M9 15v2",
  wrench:   "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  clock:    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  dollar:   "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  share:    "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13",
  star:     "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  history:  "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  handshake:"M17 20l-5-5-5 5M12 15V3M7.5 8.5L3 12l4.5 3.5M16.5 8.5L21 12l-4.5 3.5",
  flag:     "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
  link:     "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
};

// ── Shared UI ──────────────────────────────────────────────────────────────
const inputCls   = "w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-emerald-400";
const selectCls  = inputCls + " appearance-none";
const btnPrimary = "w-full bg-emerald-600 text-white font-semibold rounded-xl py-3 text-sm active:bg-emerald-700 transition-colors";
const btnSecond  = "w-full border border-stone-200 text-stone-600 font-semibold rounded-xl py-3 text-sm mt-2 active:bg-stone-100 transition-colors";

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background:"rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-md bg-white rounded-t-3xl p-6 pb-10 overflow-y-auto" style={{ maxHeight:"92vh" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-stone-800">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500">
            <Icon d={Icons.x} size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, []);
  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[70] bg-stone-900 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg">
      {msg}
    </div>
  );
}

function Lightbox({ photo, name, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center" style={{ background:"rgba(0,0,0,0.92)" }} onClick={onClose}>
      <button className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center" onClick={onClose}>
        <Icon d={Icons.x} size={20} stroke="white" />
      </button>
      <img src={photo} alt={name} className="max-w-full rounded-2xl object-contain shadow-2xl" style={{ maxHeight:"80vh" }} onClick={e => e.stopPropagation()} />
      <p className="text-white/70 text-sm mt-4 font-medium">{name}</p>
    </div>
  );
}

function PhotoUploader({ photo, onChange }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleFile = useCallback(async file => {
    if (!file || !file.type.startsWith("image/")) return;
    setLoading(true);
    onChange(await resizeImage(file));
    setLoading(false);
  }, [onChange]);
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Photo</label>
      {photo ? (
        <div className="relative rounded-2xl overflow-hidden border border-stone-200" style={{ height:150 }}>
          <img src={photo} alt="gear" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-2 right-2 flex gap-2">
            <button onClick={() => inputRef.current.click()} className="bg-white/90 text-stone-700 rounded-full px-3 py-1 text-xs font-semibold shadow">Change</button>
            <button onClick={() => onChange(null)} className="bg-red-500 text-white rounded-full px-3 py-1 text-xs font-semibold shadow">Remove</button>
          </div>
        </div>
      ) : (
        <div onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)}
          onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files?.[0])}}
          onClick={()=>inputRef.current.click()}
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed cursor-pointer py-7 transition-all ${dragging?"border-emerald-400 bg-emerald-50":"border-stone-200 bg-stone-50"}`}>
          {loading ? <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            : <><div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Icon d={Icons.camera} size={21} /></div>
                <div className="text-center"><p className="text-sm font-semibold text-stone-600">Add a photo</p><p className="text-xs text-stone-400 mt-0.5">Tap or drag · camera on mobile</p></div></>}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);e.target.value="";}} />
    </div>
  );
}

// ── QR Code Modal ──────────────────────────────────────────────────────────
function QRModal({ item, onClose }) {
  const data = encodeURIComponent(`${item.name}\n${item.category}\n${item.condition} condition\n📍 ${item.location}${item.cost ? "\n$"+item.cost : ""}`);
  return (
    <Modal title="QR Label" onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${data}`} alt="QR" className="w-52 h-52 rounded-xl border border-stone-100 shadow" />
        <p className="text-xs text-stone-400 text-center">Print and attach to your storage bin or gear bag so anyone can scan to see what's inside.</p>
        <div className="bg-stone-50 border border-stone-100 rounded-xl p-3 w-full text-sm text-stone-700 space-y-0.5">
          <p className="font-bold">{item.name}</p>
          <p className="text-xs text-stone-500">{item.category} · {item.location} · {item.condition}</p>
          {item.cost ? <p className="text-xs text-emerald-700 font-medium">${item.cost}</p> : null}
        </div>
      </div>
    </Modal>
  );
}

// ── Service Entry Modal ─────────────────────────────────────────────────────
function ServiceEntryModal({ onSave, onClose }) {
  const [form, setForm] = useState({ date: today(), type: SERVICE_TYPES[0], notes: "" });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <Modal title="Log Service" onClose={onClose}>
      <FieldRow label="Date"><input className={inputCls} type="date" value={form.date} onChange={e=>set("date",e.target.value)} /></FieldRow>
      <FieldRow label="Service Type">
        <select className={selectCls} value={form.type} onChange={e=>set("type",e.target.value)}>
          {SERVICE_TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Notes (optional)">
        <textarea className={inputCls} rows={2} placeholder="Any details..." value={form.notes} onChange={e=>set("notes",e.target.value)} />
      </FieldRow>
      <button className={btnPrimary} onClick={()=>{onSave({...form,id:genId()});onClose();}}>Save Entry</button>
      <button className={btnSecond} onClick={onClose}>Cancel</button>
    </Modal>
  );
}

// ── Usage Entry Modal ───────────────────────────────────────────────────────
function UsageEntryModal({ onSave, onClose }) {
  const [form, setForm] = useState({ date: today(), tripName: "", amount: "", unit: USAGE_UNITS[0] });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <Modal title="Log Usage" onClose={onClose}>
      <FieldRow label="Date"><input className={inputCls} type="date" value={form.date} onChange={e=>set("date",e.target.value)} /></FieldRow>
      <FieldRow label="Trip / Activity">
        <input className={inputCls} placeholder="e.g. Yosemite Weekend" value={form.tripName} onChange={e=>set("tripName",e.target.value)} />
      </FieldRow>
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Amount</label>
          <input className={inputCls} type="number" placeholder="3" value={form.amount} onChange={e=>set("amount",e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Unit</label>
          <select className={selectCls} value={form.unit} onChange={e=>set("unit",e.target.value)}>
            {USAGE_UNITS.map(u=><option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <button className={btnPrimary} onClick={()=>{if(!form.amount)return alert("Enter an amount.");onSave({...form,id:genId(),amount:parseFloat(form.amount)||0});onClose();}}>Save Entry</button>
      <button className={btnSecond} onClick={onClose}>Cancel</button>
    </Modal>
  );
}

// ── Lend Modal ─────────────────────────────────────────────────────────────
function LendModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  return (
    <Modal title="Mark as Lent" onClose={onClose}>
      <FieldRow label="Lent to"><input className={inputCls} placeholder="Friend's name" value={name} onChange={e=>setName(e.target.value)} /></FieldRow>
      <p className="text-xs text-stone-400 mb-4">A reminder badge will show on this item so you don't forget where it is.</p>
      <button className={btnPrimary} onClick={()=>{if(!name.trim())return alert("Enter a name.");onSave(name.trim());onClose();}}>Mark as Lent</button>
      <button className={btnSecond} onClick={onClose}>Cancel</button>
    </Modal>
  );
}

// ── Gear Detail Sheet ──────────────────────────────────────────────────────
function GearDetailSheet({ item, onClose, onEdit, onDelete, onUpdate }) {
  const [subTab, setSubTab] = useState("overview");
  const [showQR, setShowQR] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [showAddUsage, setShowAddUsage] = useState(false);
  const [showLend, setShowLend] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const du = daysUntil(item.expiryDate);
  const expired = isExpired(item.expiryDate);
  const expiringSoon = isExpiringSoon(item.expiryDate);
  const totalUse = (item.usageLog || []).reduce((s,u)=>s+(u.amount||0),0);

  const addServiceEntry = entry => onUpdate({ ...item, serviceLog: [...(item.serviceLog||[]), entry] });
  const deleteServiceEntry = id => onUpdate({ ...item, serviceLog: (item.serviceLog||[]).filter(e=>e.id!==id) });
  const addUsageEntry = entry => onUpdate({ ...item, usageLog: [...(item.usageLog||[]), entry] });
  const deleteUsageEntry = id => onUpdate({ ...item, usageLog: (item.usageLog||[]).filter(e=>e.id!==id) });

  return (
    <div className="flex flex-col h-screen bg-stone-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <button onClick={onClose} className="flex items-center gap-1 text-emerald-600 text-sm font-semibold">
            <Icon d={Icons.back} size={18} stroke="#059669" /> Gear
          </button>
          <div className="flex gap-2">
            <button onClick={()=>onEdit(item)} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 active:bg-stone-200">
              <Icon d={Icons.edit} size={16} />
            </button>
            <button onClick={()=>{if(confirm("Delete this item?")) { onDelete(item.id); onClose(); }}} className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 active:bg-red-100">
              <Icon d={Icons.trash} size={16} />
            </button>
          </div>
        </div>
        <h1 className="font-bold text-stone-800 text-lg leading-tight">{item.name}</h1>
        <p className="text-xs text-emerald-700 font-medium">{item.category}</p>
      </div>

      {/* Photo */}
      {item.photo && (
        <button onClick={()=>setLightbox(true)} className="relative w-full shrink-0" style={{height:180}}>
          <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          <div className="absolute bottom-2 right-2 bg-black/40 rounded-full px-2 py-0.5 flex items-center gap-1">
            <Icon d={Icons.expand} size={11} stroke="white" strokeWidth={2} />
            <span className="text-white text-xs">View</span>
          </div>
        </button>
      )}

      {/* Alert banners */}
      <div className="px-4 pt-3 shrink-0 space-y-2">
        {expired && item.expiryDate && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
            <Icon d={Icons.warning} size={16} stroke="#ef4444" />
            <p className="text-xs text-red-700 font-semibold">Safety expiry passed on {fmtDate(item.expiryDate)} — retire this item</p>
          </div>
        )}
        {!expired && expiringSoon && item.expiryDate && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
            <Icon d={Icons.warning} size={16} stroke="#f59e0b" />
            <p className="text-xs text-amber-700 font-semibold">Expires in {du} days — {fmtDate(item.expiryDate)}</p>
          </div>
        )}
        {item.lentTo && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon d={Icons.handshake} size={16} stroke="#3b82f6" />
              <p className="text-xs text-blue-700 font-semibold">Lent to {item.lentTo}</p>
            </div>
            <button onClick={()=>onUpdate({...item,lentTo:null})} className="text-xs text-blue-600 font-bold underline">Returned</button>
          </div>
        )}
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-4 gap-2 px-4 mt-3 shrink-0">
        {[
          {label:"Condition", val:<span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CONDITION_COLORS[item.condition]}`}>{item.condition}</span>},
          {label:"Weight",    val:`${item.weight} lbs`},
          {label:"Value",     val:fmt$(item.cost)},
          {label:"Uses",      val:totalUse > 0 ? `${totalUse}` : "—"},
        ].map(s=>(
          <div key={s.label} className="bg-white rounded-xl p-2.5 text-center border border-stone-100 shadow-sm">
            <div className="text-sm font-bold text-stone-800 flex justify-center">{s.val}</div>
            <div className="text-xs text-stone-400 mt-0.5 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 px-4 mt-3 shrink-0">
        {["overview","service","usage"].map(t=>(
          <button key={t} onClick={()=>setSubTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${subTab===t?"bg-emerald-600 text-white":"bg-white border border-stone-200 text-stone-500"}`}>
            {t==="overview"?"Overview":t==="service"?"Service Log":"Usage"}
          </button>
        ))}
      </div>

      {/* Sub content */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8">
        {subTab === "overview" && (
          <div className="space-y-3">
            {item.notes && <div className="bg-white rounded-xl border border-stone-100 p-3"><p className="text-xs text-stone-500 font-semibold uppercase tracking-wide mb-1">Notes</p><p className="text-sm text-stone-700 italic">"{item.notes}"</p></div>}
            <div className="bg-white rounded-xl border border-stone-100 p-3 space-y-2">
              <p className="text-xs text-stone-500 font-semibold uppercase tracking-wide">Details</p>
              {[
                {label:"Location",     val:item.location},
                {label:"Purchased",    val:fmtDate(item.purchaseDate)},
                {label:"Cost",         val:fmt$(item.cost)},
                {label:"Expires",      val:item.expiryDate ? fmtDate(item.expiryDate) : "No expiry set"},
              ].map(r=>(
                <div key={r.label} className="flex justify-between items-center">
                  <span className="text-xs text-stone-500">{r.label}</span>
                  <span className="text-xs font-semibold text-stone-700">{r.val}</span>
                </div>
              ))}
            </div>
            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={()=>setShowQR(true)} className="flex flex-col items-center gap-1.5 bg-white border border-stone-100 rounded-xl p-3 active:bg-stone-50">
                <Icon d={Icons.qr} size={22} stroke="#059669" />
                <span className="text-xs font-semibold text-stone-700">QR Label</span>
              </button>
              <button onClick={()=>item.lentTo ? onUpdate({...item,lentTo:null}) : setShowLend(true)}
                className={`flex flex-col items-center gap-1.5 border rounded-xl p-3 active:bg-stone-50 ${item.lentTo?"bg-blue-50 border-blue-200":"bg-white border-stone-100"}`}>
                <Icon d={Icons.handshake} size={22} stroke={item.lentTo?"#3b82f6":"#78716c"} />
                <span className="text-xs font-semibold text-stone-700">{item.lentTo?"Mark Returned":"Lend Item"}</span>
              </button>
            </div>
          </div>
        )}

        {subTab === "service" && (
          <div>
            <button onClick={()=>setShowAddService(true)} className="w-full border-2 border-dashed border-emerald-300 rounded-xl py-2.5 text-emerald-600 font-semibold text-sm flex items-center justify-center gap-2 mb-3 active:bg-emerald-50">
              <Icon d={Icons.plus} size={16} strokeWidth={2.5} /> Log Service
            </button>
            {(item.serviceLog||[]).length === 0 && <p className="text-center text-stone-400 text-sm py-6">No service entries yet.</p>}
            {[...(item.serviceLog||[])].reverse().map(e=>(
              <div key={e.id} className="bg-white rounded-xl border border-stone-100 p-3 mb-2 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon d={Icons.wrench} size={15} stroke="#059669" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-800">{e.type}</p>
                  <p className="text-xs text-stone-400">{fmtDate(e.date)}</p>
                  {e.notes && <p className="text-xs text-stone-500 mt-1 italic">"{e.notes}"</p>}
                </div>
                <button onClick={()=>deleteServiceEntry(e.id)} className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-400 shrink-0">
                  <Icon d={Icons.x} size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {subTab === "usage" && (
          <div>
            <button onClick={()=>setShowAddUsage(true)} className="w-full border-2 border-dashed border-emerald-300 rounded-xl py-2.5 text-emerald-600 font-semibold text-sm flex items-center justify-center gap-2 mb-3 active:bg-emerald-50">
              <Icon d={Icons.plus} size={16} strokeWidth={2.5} /> Log Usage
            </button>
            {totalUse > 0 && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-3 flex items-center gap-2">
                <Icon d={Icons.clock} size={16} stroke="#059669" />
                <p className="text-sm font-semibold text-emerald-800">Lifetime total: {totalUse} {(item.usageLog||[])[0]?.unit || "uses"}</p>
              </div>
            )}
            {(item.usageLog||[]).length === 0 && <p className="text-center text-stone-400 text-sm py-6">No usage logged yet.</p>}
            {[...(item.usageLog||[])].reverse().map(e=>(
              <div key={e.id} className="bg-white rounded-xl border border-stone-100 p-3 mb-2 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon d={Icons.trips} size={15} stroke="#3b82f6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-800">{e.tripName || "Unnamed activity"}</p>
                  <p className="text-xs text-stone-400">{fmtDate(e.date)} · {e.amount} {e.unit}</p>
                </div>
                <button onClick={()=>deleteUsageEntry(e.id)} className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-400 shrink-0">
                  <Icon d={Icons.x} size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showQR         && <QRModal item={item} onClose={()=>setShowQR(false)} />}
      {showAddService && <ServiceEntryModal onSave={addServiceEntry} onClose={()=>setShowAddService(false)} />}
      {showAddUsage   && <UsageEntryModal onSave={addUsageEntry} onClose={()=>setShowAddUsage(false)} />}
      {showLend       && <LendModal onSave={n=>onUpdate({...item,lentTo:n})} onClose={()=>setShowLend(false)} />}
      {lightbox       && <Lightbox photo={item.photo} name={item.name} onClose={()=>setLightbox(false)} />}
    </div>
  );
}

// ── Gear Form ──────────────────────────────────────────────────────────────
function GearForm({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    name:item?.name??"", category:item?.category??CATEGORIES[0], condition:item?.condition??"Good",
    weight:item?.weight??"", location:item?.location??STORAGE_LOCATIONS[0],
    notes:item?.notes??"", photo:item?.photo??null,
    cost:item?.cost??"", purchaseDate:item?.purchaseDate??"", expiryDate:item?.expiryDate??"",
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const handleSave = () => {
    if (!form.name.trim()) return alert("Please enter a gear name.");
    onSave({ ...form, weight:parseFloat(form.weight)||0, cost:parseFloat(form.cost)||null });
    onClose();
  };
  return (
    <Modal title={item?"Edit Gear":"Add Gear"} onClose={onClose}>
      <PhotoUploader photo={form.photo} onChange={v=>set("photo",v)} />
      <FieldRow label="Item Name"><input className={inputCls} placeholder="e.g. Sleeping Bag" value={form.name} onChange={e=>set("name",e.target.value)} /></FieldRow>
      <FieldRow label="Category"><select className={selectCls} value={form.category} onChange={e=>set("category",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></FieldRow>
      <FieldRow label="Condition">
        <div className="flex gap-2 flex-wrap">
          {CONDITIONS.map(c=>(
            <button key={c} onClick={()=>set("condition",c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${form.condition===c?CONDITION_COLORS[c]+" border-transparent":"border-stone-200 text-stone-500"}`}>
              {c}
            </button>
          ))}
        </div>
      </FieldRow>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div><label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Weight (lbs)</label><input className={inputCls} type="number" step="0.1" placeholder="2.5" value={form.weight} onChange={e=>set("weight",e.target.value)} /></div>
        <div><label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Cost ($)</label><input className={inputCls} type="number" step="1" placeholder="150" value={form.cost} onChange={e=>set("cost",e.target.value)} /></div>
      </div>
      <FieldRow label="Storage Location"><select className={selectCls} value={form.location} onChange={e=>set("location",e.target.value)}>{STORAGE_LOCATIONS.map(l=><option key={l}>{l}</option>)}</select></FieldRow>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div><label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Purchase Date</label><input className={inputCls} type="date" value={form.purchaseDate} onChange={e=>set("purchaseDate",e.target.value)} /></div>
        <div><label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Expiry Date</label><input className={inputCls} type="date" value={form.expiryDate} onChange={e=>set("expiryDate",e.target.value)} /></div>
      </div>
      <FieldRow label="Notes (optional)"><textarea className={inputCls} rows={2} placeholder="Any notes..." value={form.notes} onChange={e=>set("notes",e.target.value)} /></FieldRow>
      <button className={btnPrimary} onClick={handleSave}>Save Gear</button>
      <button className={btnSecond} onClick={onClose}>Cancel</button>
    </Modal>
  );
}

// ── Gear Card ──────────────────────────────────────────────────────────────
function GearCard({ item, onTap }) {
  const expired = isExpired(item.expiryDate);
  const expiring = isExpiringSoon(item.expiryDate);
  return (
    <button onClick={()=>onTap(item)} className="w-full bg-white rounded-2xl shadow-sm border border-stone-100 mb-3 overflow-hidden text-left active:bg-stone-50">
      {item.photo && <div className="relative w-full" style={{height:110}}><img src={item.photo} alt={item.name} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" /></div>}
      <div className="p-3.5 flex items-start gap-3">
        {!item.photo && <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center shrink-0"><Icon d={Icons.camera} size={17} stroke="#d6d3d1" /></div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="font-semibold text-stone-800 text-sm">{item.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${CONDITION_COLORS[item.condition]}`}>{item.condition}</span>
            {item.lentTo && <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">Lent</span>}
            {expired    && <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Expired</span>}
            {!expired && expiring && <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Exp. Soon</span>}
          </div>
          <p className="text-xs text-emerald-700 font-medium mb-1.5">{item.category}</p>
          <div className="flex gap-3 text-xs text-stone-500 flex-wrap">
            <span className="flex items-center gap-1"><Icon d={Icons.weight} size={12} />{item.weight} lbs</span>
            <span className="flex items-center gap-1"><Icon d={Icons.location} size={12} />{item.location}</span>
            {item.cost ? <span className="flex items-center gap-1"><Icon d={Icons.dollar} size={12} />${item.cost}</span> : null}
            {(item.usageLog||[]).length > 0 && <span className="flex items-center gap-1"><Icon d={Icons.clock} size={12} />{(item.usageLog||[]).reduce((s,u)=>s+(u.amount||0),0)} uses</span>}
          </div>
        </div>
        <Icon d={Icons.back} size={16} stroke="#a8a29e" strokeWidth={2} className="rotate-180 shrink-0 mt-1" />
      </div>
    </button>
  );
}

// ── Gear Tab ───────────────────────────────────────────────────────────────
function GearTab({ gear, onAdd, onSelectGear }) {
  const [catFilter, setCatFilter] = useState("All");
  const [subFilter, setSubFilter] = useState(null);

  const totalValue = gear.reduce((s,g)=>s+(g.cost||0),0);
  const lentCount  = gear.filter(g=>g.lentTo).length;
  const expCount   = gear.filter(g=>isExpired(g.expiryDate)||isExpiringSoon(g.expiryDate)).length;
  const replaceCount = gear.filter(g=>g.condition==="Replace").length;

  let filtered = catFilter==="All" ? gear : gear.filter(g=>g.category===catFilter);
  if (subFilter==="lent")     filtered = filtered.filter(g=>g.lentTo);
  if (subFilter==="expiring") filtered = filtered.filter(g=>isExpired(g.expiryDate)||isExpiringSoon(g.expiryDate));
  if (subFilter==="replace")  filtered = filtered.filter(g=>g.condition==="Replace");

  return (
    <div className="flex-1 overflow-y-auto pb-6">
      {/* Alert bar */}
      {(replaceCount>0||lentCount>0||expCount>0) && (
        <div className="mx-4 mt-4 mb-1 space-y-1.5">
          {replaceCount>0 && <div onClick={()=>setSubFilter(subFilter==="replace"?null:"replace")} className="bg-red-50 border border-red-200 rounded-xl p-2.5 flex items-center gap-2 cursor-pointer"><Icon d={Icons.warning} size={15} stroke="#ef4444" /><p className="text-xs text-red-700 font-semibold flex-1">{replaceCount} item{replaceCount>1?"s":""} need replacing</p><span className="text-xs text-red-500 font-bold">{subFilter==="replace"?"✕ Clear":"Filter →"}</span></div>}
          {expCount>0     && <div onClick={()=>setSubFilter(subFilter==="expiring"?null:"expiring")} className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2 cursor-pointer"><Icon d={Icons.clock} size={15} stroke="#f59e0b" /><p className="text-xs text-amber-700 font-semibold flex-1">{expCount} item{expCount>1?"s":""} expiring soon</p><span className="text-xs text-amber-500 font-bold">{subFilter==="expiring"?"✕ Clear":"Filter →"}</span></div>}
          {lentCount>0    && <div onClick={()=>setSubFilter(subFilter==="lent"?null:"lent")} className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 flex items-center gap-2 cursor-pointer"><Icon d={Icons.handshake} size={15} stroke="#3b82f6" /><p className="text-xs text-blue-700 font-semibold flex-1">{lentCount} item{lentCount>1?"s":""} lent out</p><span className="text-xs text-blue-500 font-bold">{subFilter==="lent"?"✕ Clear":"Filter →"}</span></div>}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 px-4 mt-4 mb-4">
        {[
          {label:"Items",  val:gear.length},
          {label:"Lbs",    val:gear.reduce((s,g)=>s+(g.weight||0),0).toFixed(1)},
          {label:"Value",  val:`$${(totalValue/1000).toFixed(1)}k`},
          {label:"📷",     val:gear.filter(g=>g.photo).length},
        ].map(s=>(
          <div key={s.label} className="bg-white rounded-2xl p-2.5 text-center border border-stone-100 shadow-sm">
            <div className="text-base font-bold text-emerald-700">{s.val}</div>
            <div className="text-xs text-stone-400 mt-0.5 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 px-4 overflow-x-auto pb-2 mb-3">
        {["All",...CATEGORIES].map(c=>(
          <button key={c} onClick={()=>{setCatFilter(c);setSubFilter(null)}}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${catFilter===c?"bg-emerald-600 text-white border-emerald-600":"bg-white text-stone-500 border-stone-200"}`}>
            {c==="All"?"All":c.split(" ")[0]}
          </button>
        ))}
      </div>

      <div className="px-4">
        {filtered.length===0 && (
          <div className="text-center py-12 text-stone-400"><div className="text-4xl mb-2">🎒</div><p className="text-sm">No gear here yet.<br/>Tap + to add your first item.</p></div>
        )}
        {filtered.map(item=><GearCard key={item.id} item={item} onTap={onSelectGear} />)}
      </div>

      <button onClick={onAdd} className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center active:bg-emerald-700 z-40">
        <Icon d={Icons.plus} size={26} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ── Trip Form ──────────────────────────────────────────────────────────────
function TripForm({ gear, onSave, onClose }) {
  const [name, setName] = useState("");
  const [tripType, setTripType] = useState(null);
  const [date, setDate] = useState("");
  const [weather, setWeather] = useState([]);
  const [selected, setSelected] = useState({});

  const suggestedGear = tripType ? gear.filter(g=>tripType.cats.includes(g.category)) : [];

  useEffect(()=>{
    if(tripType){ const a={}; suggestedGear.forEach(g=>{a[g.id]=true;}); setSelected(a); }
  },[tripType?.label]);

  const toggleWeather = w => setWeather(ws => ws.includes(w) ? ws.filter(x=>x!==w) : [...ws,w]);
  const toggle = id => setSelected(s=>({...s,[id]:!s[id]}));

  const handleSave = () => {
    if(!name.trim()) return alert("Enter a trip name.");
    if(!tripType) return alert("Select a trip type.");
    onSave({ id:genId(), name, type:tripType.label, date, weatherTags:weather, packedItems:selected, completed:false });
    onClose();
  };

  const gaps = tripType ? gearGaps(tripType.label, gear) : [];

  return (
    <Modal title="Plan a Trip" onClose={onClose}>
      <FieldRow label="Trip Name"><input className={inputCls} placeholder="e.g. Yosemite Weekend" value={name} onChange={e=>setName(e.target.value)} /></FieldRow>
      <FieldRow label="Trip Date (optional)"><input className={inputCls} type="date" value={date} onChange={e=>setDate(e.target.value)} /></FieldRow>
      <FieldRow label="Trip Type">
        <div className="grid grid-cols-2 gap-2">
          {TRIP_TYPES.map(t=>(
            <button key={t.label} onClick={()=>setTripType(t)}
              className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold text-left transition-all ${tripType?.label===t.label?"bg-emerald-50 border-emerald-400 text-emerald-800":"bg-stone-50 border-stone-200 text-stone-600"}`}>
              <span className="text-lg">{t.emoji}</span><span className="leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
      </FieldRow>
      <FieldRow label="Weather Conditions">
        <div className="flex gap-1.5 flex-wrap">
          {WEATHER_TAGS.map(w=>(
            <button key={w} onClick={()=>toggleWeather(w)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${weather.includes(w)?"bg-sky-100 border-sky-400 text-sky-800":"border-stone-200 text-stone-500"}`}>
              {w}
            </button>
          ))}
        </div>
      </FieldRow>
      {gaps.length>0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Possible gear gaps for this trip type:</p>
          <p className="text-xs text-amber-600">{gaps.join(", ")} — consider adding these to your wishlist or renting before you go.</p>
        </div>
      )}
      {tripType && (
        <FieldRow label={`Suggested Gear (${Object.values(selected).filter(Boolean).length} selected)`}>
          {suggestedGear.length===0 ? <p className="text-xs text-stone-400 italic">No matching gear found. Add gear first.</p>
            : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {suggestedGear.map(g=>(
                  <button key={g.id} onClick={()=>toggle(g.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${selected[g.id]?"bg-emerald-50 border-emerald-300":"bg-stone-50 border-stone-200"}`}>
                    {g.photo?<img src={g.photo} alt={g.name} className="w-9 h-9 rounded-lg object-cover shrink-0 border border-stone-200" />
                      :<div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center shrink-0"><Icon d={Icons.camera} size={14} stroke="#a8a29e" /></div>}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected[g.id]?"bg-emerald-600 border-emerald-600":"border-stone-300"}`}>
                      {selected[g.id]&&<Icon d={Icons.check} size={12} stroke="white" strokeWidth={2.5} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-stone-800">{g.name}</div>
                      <div className="text-xs text-stone-400">{g.weight} lbs · {g.location}</div>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${CONDITION_COLORS[g.condition]}`}>{g.condition}</span>
                  </button>
                ))}
              </div>
            )}
        </FieldRow>
      )}
      <button className={btnPrimary} onClick={handleSave}>Create Trip</button>
      <button className={btnSecond} onClick={onClose}>Cancel</button>
    </Modal>
  );
}

// ── Trips Tab ──────────────────────────────────────────────────────────────
function TripsTab({ trips, gear, onAdd, onSelect, onDelete, onComplete }) {
  const [view, setView] = useState("active");
  const active    = trips.filter(t=>!t.completed);
  const completed = trips.filter(t=>t.completed);
  const shown = view==="active" ? active : completed;

  return (
    <div className="flex-1 overflow-y-auto pb-6">
      {/* Toggle */}
      <div className="flex gap-2 px-4 mt-4 mb-4">
        {[["active","Active Trips"],["history","History"]].map(([id,label])=>(
          <button key={id} onClick={()=>setView(id)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${view===id?"bg-emerald-600 text-white border-emerald-600":"bg-white border-stone-200 text-stone-500"}`}>
            {label} {id==="active"?`(${active.length})`:`(${completed.length})`}
          </button>
        ))}
      </div>

      {shown.length===0 && (
        <div className="text-center py-16 text-stone-400">
          <div className="text-4xl mb-2">{view==="active"?"🗺️":"📖"}</div>
          <p className="text-sm">{view==="active"?"No trips planned yet.\nTap + to plan your first adventure.":"No completed trips yet.\nMark a trip as done after you're back!"}</p>
        </div>
      )}

      <div className="px-4 space-y-3">
        {shown.map(trip=>{
          const tripType = TRIP_TYPES.find(t=>t.label===trip.type);
          const packedIds = Object.keys(trip.packedItems||{}).filter(id=>trip.packedItems[id]);
          const totalWeight = packedIds.reduce((s,id)=>{ const g=gear.find(x=>x.id===id); return s+(g?.weight||0); },0);
          const heroGear = packedIds.map(id=>gear.find(x=>x.id===id)).filter(Boolean).find(g=>g?.photo);
          const checkedCount = packedIds.filter(id=>trip.checked?.[id]).length;

          return (
            <div key={trip.id} className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
              {heroGear && (
                <div className="relative w-full" style={{height:75}}>
                  <img src={heroGear.photo} alt={trip.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
                  {trip.weatherTags?.length>0 && (
                    <div className="absolute bottom-1.5 left-3 flex gap-1">
                      {trip.weatherTags.map(w=><span key={w} className="text-xs bg-white/20 text-white rounded-full px-2 py-0.5 backdrop-blur-sm">{w}</span>)}
                    </div>
                  )}
                </div>
              )}
              <button onClick={()=>!trip.completed && onSelect(trip)} className={`w-full p-4 text-left ${trip.completed?"opacity-75":""}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{tripType?.emoji??"🏔️"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-stone-800 text-sm">{trip.name}</p>
                      {trip.completed && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">Done</span>}
                    </div>
                    <p className="text-xs text-stone-500">{trip.type}{trip.date?" · "+fmtDate(trip.date):""}</p>
                    {!heroGear && trip.weatherTags?.length>0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">{trip.weatherTags.map(w=><span key={w} className="text-xs bg-sky-100 text-sky-700 rounded-full px-1.5 py-0.5">{w}</span>)}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold text-emerald-700">{totalWeight.toFixed(1)} lbs</div>
                    <div className="text-xs text-stone-400">{packedIds.length} items</div>
                    {trip.completed && checkedCount>0 && <div className="text-xs text-emerald-600">{checkedCount}/{packedIds.length} packed</div>}
                  </div>
                </div>
              </button>
              <div className="border-t border-stone-100 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {packedIds.slice(0,4).map(id=>{
                    const g=gear.find(x=>x.id===id);
                    return g?.photo?<img key={id} src={g.photo} alt={g.name} title={g.name} className="w-7 h-7 rounded-full object-cover border-2 border-white shadow-sm -ml-1 first:ml-0" />
                      :g?<span key={id} className="text-xs bg-stone-100 rounded-full px-2 py-0.5 text-stone-600">{g.name.split(" ")[0]}</span>:null;
                  })}
                  {packedIds.length>4&&<span className="text-xs text-stone-400 ml-1">+{packedIds.length-4}</span>}
                </div>
                <div className="flex gap-1.5 items-center">
                  {!trip.completed && (
                    <button onClick={()=>onComplete(trip.id)} className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-2.5 py-1 font-semibold active:bg-emerald-100">
                      ✓ Complete
                    </button>
                  )}
                  <button onClick={()=>onDelete(trip.id)} className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400">
                    <Icon d={Icons.trash} size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {view==="active" && (
        <button onClick={onAdd} className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center active:bg-emerald-700 z-40">
          <Icon d={Icons.plus} size={26} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

// ── Pack View ──────────────────────────────────────────────────────────────
function PackView({ trip, allGear, onBack, onToggleCheck, onAddGear, onRemoveItem, onComplete }) {
  const tripType = TRIP_TYPES.find(t=>t.label===trip.type);
  const packedIds = Object.keys(trip.packedItems||{}).filter(id=>trip.packedItems[id]);
  const packedGear = packedIds.map(id=>allGear.find(g=>g.id===id)).filter(Boolean);
  const totalWeight = packedGear.reduce((s,g)=>s+(g.weight||0),0);
  const checkedCount = packedGear.filter(g=>trip.checked?.[g.id]).length;
  const progress = packedGear.length>0 ? checkedCount/packedGear.length : 0;
  const gaps = gearGaps(trip.type, allGear);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [toast, setToast] = useState(null);
  const availableToAdd = allGear.filter(g=>!packedIds.includes(g.id));

  const sharePacking = () => {
    const lines = [
      `🏔️ ${trip.name} — ${trip.type}`,
      trip.date ? `📅 ${fmtDate(trip.date)}` : "",
      trip.weatherTags?.length ? `🌤 ${trip.weatherTags.join(", ")}` : "",
      `⚖️ Total: ${totalWeight.toFixed(1)} lbs`,
      ``,
      ...packedGear.map(g=>`${trip.checked?.[g.id]?"✅":"⬜"} ${g.name} (${g.weight} lbs · ${g.location})`)
    ].filter(Boolean).join("\n");
    if (navigator.share) {
      navigator.share({ title:trip.name, text:lines });
    } else {
      navigator.clipboard.writeText(lines).then(()=>setToast("Packing list copied!")).catch(()=>setToast("Copied!"));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-stone-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-emerald-600 px-4 pt-4 pb-6 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="flex items-center gap-1 text-emerald-100 text-sm">
            <Icon d={Icons.back} size={16} stroke="currentColor" /> Trips
          </button>
          <button onClick={sharePacking} className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-white text-xs font-semibold active:bg-white/30">
            <Icon d={Icons.share} size={14} stroke="white" /> Share
          </button>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">{tripType?.emoji??"🏔️"}</span>
          <div>
            <h2 className="text-white font-bold text-lg">{trip.name}</h2>
            <p className="text-emerald-200 text-sm">{trip.type}{trip.date?" · "+fmtDate(trip.date):""}</p>
          </div>
        </div>
        {trip.weatherTags?.length>0 && <div className="flex gap-1 flex-wrap mb-2">{trip.weatherTags.map(w=><span key={w} className="text-xs bg-white/20 text-white rounded-full px-2 py-0.5">{w}</span>)}</div>}
        <div className="flex gap-3 text-sm text-emerald-100">
          <span>{packedGear.length} items</span><span>·</span><span>{totalWeight.toFixed(1)} lbs</span><span>·</span><span>{checkedCount}/{packedGear.length} packed</span>
        </div>
        <div className="mt-3 bg-emerald-700 rounded-full h-2"><div className="bg-white rounded-full h-2 transition-all" style={{width:`${progress*100}%`}} /></div>
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        {/* Gear gaps */}
        {gaps.length>0 && (
          <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3">
            <p className="text-xs font-bold text-amber-700 mb-1">⚠️ Possible gear gaps for {trip.type}:</p>
            <p className="text-xs text-amber-600">You may not have: {gaps.join(", ")}. Check your inventory or rent before you go.</p>
          </div>
        )}

        <div className="px-4 mt-4">
          {packedGear.length===0 && <p className="text-center text-stone-400 text-sm py-8">No gear selected. Add items below.</p>}
          {packedGear.map(g=>(
            <div key={g.id} className={`flex items-center gap-3 bg-white rounded-2xl border p-3 mb-2.5 transition-all ${trip.checked?.[g.id]?"border-emerald-200 opacity-60":"border-stone-100"}`}>
              <button onClick={()=>onToggleCheck(trip.id,g.id)}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${trip.checked?.[g.id]?"bg-emerald-600 border-emerald-600":"border-stone-300"}`}>
                {trip.checked?.[g.id]&&<Icon d={Icons.check} size={14} stroke="white" strokeWidth={2.5} />}
              </button>
              {g.photo?<button onClick={()=>setLightbox(g)} className="shrink-0"><img src={g.photo} alt={g.name} className="w-12 h-12 rounded-xl object-cover border border-stone-100 shadow-sm" /></button>
                :<div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center shrink-0"><Icon d={Icons.camera} size={17} stroke="#d6d3d1" /></div>}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${trip.checked?.[g.id]?"line-through text-stone-400":"text-stone-800"}`}>{g.name}</p>
                <div className="flex gap-1.5 text-xs text-stone-400 mt-0.5 flex-wrap items-center">
                  <span>{g.weight} lbs</span><span>·</span><span>{g.location}</span>
                  <span className={`font-medium px-1.5 py-0.5 rounded-full ${CONDITION_COLORS[g.condition]}`}>{g.condition}</span>
                  {g.lentTo&&<span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Lent to {g.lentTo}</span>}
                </div>
              </div>
              <button onClick={()=>onRemoveItem(trip.id,g.id)} className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400 shrink-0"><Icon d={Icons.x} size={14} /></button>
            </div>
          ))}

          {!trip.completed && (
            <>
              {availableToAdd.length>0 && (
                <button onClick={()=>setShowAddModal(true)} className="w-full border-2 border-dashed border-emerald-300 rounded-2xl py-3 text-emerald-600 font-semibold text-sm flex items-center justify-center gap-2 mt-2 active:bg-emerald-50">
                  <Icon d={Icons.plus} size={18} strokeWidth={2.5} /> Add More Gear
                </button>
              )}
              <button onClick={()=>onComplete(trip.id)} className="w-full bg-emerald-600 text-white font-semibold rounded-2xl py-3 text-sm flex items-center justify-center gap-2 mt-3 active:bg-emerald-700">
                <Icon d={Icons.check} size={18} stroke="white" strokeWidth={2.5} /> Mark Trip Complete
              </button>
            </>
          )}
          {trip.completed && <div className="text-center mt-6 text-emerald-600 font-semibold text-sm">✅ Trip completed! Usage logged to your gear.</div>}
        </div>
      </div>

      {showAddModal && (
        <Modal title="Add Gear to Trip" onClose={()=>setShowAddModal(false)}>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {availableToAdd.map(g=>(
              <button key={g.id} onClick={()=>{onAddGear(trip.id,g.id);setShowAddModal(false);}}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50 text-left active:bg-emerald-50">
                {g.photo?<img src={g.photo} alt={g.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                  :<div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center shrink-0"><Icon d={Icons.camera} size={15} stroke="#a8a29e" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-800">{g.name}</p>
                  <p className="text-xs text-stone-400">{g.category} · {g.weight} lbs · {g.location}</p>
                </div>
                <Icon d={Icons.plus} size={18} stroke="#059669" strokeWidth={2} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {lightbox&&<Lightbox photo={lightbox.photo} name={lightbox.name} onClose={()=>setLightbox(null)} />}
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)} />}
    </div>
  );
}

// ── Wishlist Form ──────────────────────────────────────────────────────────
function WishlistForm({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    name:item?.name??"", category:item?.category??CATEGORIES[0], priority:item?.priority??"Medium",
    estimatedCost:item?.estimatedCost??"", notes:item?.notes??"", link:item?.link??"",
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const handleSave = () => {
    if(!form.name.trim()) return alert("Enter an item name.");
    onSave({ ...form, estimatedCost: parseFloat(form.estimatedCost)||null });
    onClose();
  };
  return (
    <Modal title={item?"Edit Wishlist Item":"Add to Wishlist"} onClose={onClose}>
      <FieldRow label="Item Name"><input className={inputCls} placeholder="e.g. Down Puffy Jacket" value={form.name} onChange={e=>set("name",e.target.value)} /></FieldRow>
      <FieldRow label="Category"><select className={selectCls} value={form.category} onChange={e=>set("category",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></FieldRow>
      <FieldRow label="Priority">
        <div className="flex gap-2 flex-wrap">
          {PRIORITY_LEVELS.map(p=>(
            <button key={p} onClick={()=>set("priority",p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${form.priority===p?PRIORITY_COLORS[p]+" border-transparent":"border-stone-200 text-stone-500"}`}>
              {p}
            </button>
          ))}
        </div>
      </FieldRow>
      <FieldRow label="Estimated Cost ($)"><input className={inputCls} type="number" placeholder="200" value={form.estimatedCost} onChange={e=>set("estimatedCost",e.target.value)} /></FieldRow>
      <FieldRow label="Link (optional)"><input className={inputCls} type="url" placeholder="https://..." value={form.link} onChange={e=>set("link",e.target.value)} /></FieldRow>
      <FieldRow label="Notes (optional)"><textarea className={inputCls} rows={2} placeholder="Why you want it, alternatives..." value={form.notes} onChange={e=>set("notes",e.target.value)} /></FieldRow>
      <button className={btnPrimary} onClick={handleSave}>Save Item</button>
      <button className={btnSecond} onClick={onClose}>Cancel</button>
    </Modal>
  );
}

// ── Wishlist Tab ───────────────────────────────────────────────────────────
function WishlistTab({ wishlist, onAdd, onEdit, onDelete }) {
  const [priorityFilter, setPriorityFilter] = useState("All");
  const totalEstimated = wishlist.reduce((s,w)=>s+(w.estimatedCost||0),0);
  const filtered = priorityFilter==="All" ? wishlist : wishlist.filter(w=>w.priority===priorityFilter);

  return (
    <div className="flex-1 overflow-y-auto pb-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 px-4 mt-4 mb-4">
        {[
          {label:"Items",    val:wishlist.length},
          {label:"Est. Cost",val:totalEstimated>0?`$${totalEstimated.toLocaleString()}`:"$0"},
          {label:"Must Have",val:wishlist.filter(w=>w.priority==="Must Have").length},
        ].map(s=>(
          <div key={s.label} className="bg-white rounded-2xl p-3 text-center border border-stone-100 shadow-sm">
            <div className="text-lg font-bold text-emerald-700">{s.val}</div>
            <div className="text-xs text-stone-400 mt-0.5 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Priority filter */}
      <div className="flex gap-2 px-4 overflow-x-auto pb-2 mb-3">
        {["All",...PRIORITY_LEVELS].map(p=>(
          <button key={p} onClick={()=>setPriorityFilter(p)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${priorityFilter===p?"bg-emerald-600 text-white border-emerald-600":"bg-white text-stone-500 border-stone-200"}`}>
            {p}
          </button>
        ))}
      </div>

      <div className="px-4">
        {filtered.length===0 && (
          <div className="text-center py-12 text-stone-400"><div className="text-4xl mb-2">⭐</div><p className="text-sm">Your wishlist is empty.<br/>Tap + to add gear you want.</p></div>
        )}
        {filtered.map(item=>(
          <div key={item.id} className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 mb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-stone-800 text-sm">{item.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[item.priority]}`}>{item.priority}</span>
                </div>
                <p className="text-xs text-emerald-700 font-medium mb-1.5">{item.category}</p>
                <div className="flex gap-3 text-xs text-stone-500">
                  {item.estimatedCost&&<span className="flex items-center gap-1"><Icon d={Icons.dollar} size={12} />${item.estimatedCost.toLocaleString()}</span>}
                  {item.link&&<a href={item.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 font-medium" onClick={e=>e.stopPropagation()}><Icon d={Icons.link} size={12} />View</a>}
                </div>
                {item.notes&&<p className="text-xs text-stone-400 mt-1.5 italic">"{item.notes}"</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={()=>onEdit(item)} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 active:bg-stone-200"><Icon d={Icons.edit} size={15} /></button>
                <button onClick={()=>onDelete(item.id)} className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 active:bg-red-100"><Icon d={Icons.trash} size={15} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onAdd} className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center active:bg-emerald-700 z-40">
        <Icon d={Icons.plus} size={26} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [gear,      setGear]      = useState(initialGear);
  const [trips,     setTrips]     = useState([]);
  const [wishlist,  setWishlist]  = useState([]);
  const [tab,       setTab]       = useState("gear");
  const [activeGearId, setActiveGearId] = useState(null);
  const [activeTrip,   setActiveTrip]   = useState(null);
  const [showAddGear,  setShowAddGear]  = useState(false);
  const [editingGear,  setEditingGear]  = useState(null);
  const [showAddTrip,  setShowAddTrip]  = useState(false);
  const [showAddWish,  setShowAddWish]  = useState(false);
  const [editingWish,  setEditingWish]  = useState(null);
  const [loaded,    setLoaded]    = useState(false);

  // Storage
  useEffect(()=>{
    if(!window.storage){setLoaded(true);return;}
    (async()=>{
      try {
        const gR=await window.storage.get("gear_v2");
        const tR=await window.storage.get("trips_v2");
        const wR=await window.storage.get("wishlist_v1");
        if(gR?.value) setGear(JSON.parse(gR.value));
        if(tR?.value) setTrips(JSON.parse(tR.value));
        if(wR?.value) setWishlist(JSON.parse(wR.value));
      } catch(_){}
      setLoaded(true);
    })();
  },[]);

  useEffect(()=>{ if(loaded&&window.storage) window.storage.set("gear_v2",JSON.stringify(gear)).catch(()=>{}); },[gear,loaded]);
  useEffect(()=>{ if(loaded&&window.storage) window.storage.set("trips_v2",JSON.stringify(trips)).catch(()=>{}); },[trips,loaded]);
  useEffect(()=>{ if(loaded&&window.storage) window.storage.set("wishlist_v1",JSON.stringify(wishlist)).catch(()=>{}); },[wishlist,loaded]);

  // Gear actions
  const addGear    = item => setGear(g=>[...g,{...item,id:genId(),serviceLog:[],usageLog:[],lentTo:null}]);
  const updateGear = item => {
    setGear(g=>g.map(x=>x.id===item.id?item:x));
    if(activeGearId===item.id) setActiveGearId(item.id); // trigger re-render
  };
  const deleteGear = id => setGear(g=>g.filter(x=>x.id!==id));

  // Trip actions
  const addTrip   = trip => setTrips(t=>[...t,trip]);
  const deleteTrip = id  => { if(!confirm("Delete this trip?")) return; setTrips(t=>t.filter(x=>x.id!==id)); };

  const completeTrip = (tripId) => {
    const trip = trips.find(t=>t.id===tripId);
    if(!trip||!confirm("Mark this trip as complete? Usage will be auto-logged to your gear.")) return;
    const packedIds = Object.keys(trip.packedItems||{}).filter(id=>trip.packedItems[id]);
    const tripTypeObj = TRIP_TYPES.find(t=>t.label===trip.type);
    const usageEntry = { id:genId(), date:today(), tripName:trip.name, amount:1, unit:tripTypeObj?.unit||"days" };
    setGear(g=>g.map(item=>packedIds.includes(item.id)?{...item,usageLog:[...(item.usageLog||[]),usageEntry]}:item));
    const upd = t=>t.id!==tripId?t:{...t,completed:true,completedDate:today()};
    setTrips(ts=>ts.map(upd));
    setActiveTrip(t=>t?upd(t):t);
  };

  const tripUpdater = (tripId,fn) => t=>t.id!==tripId?t:fn(t);
  const toggleCheck = (tripId,gearId) => {
    const upd=tripUpdater(tripId,t=>({...t,checked:{...t.checked,[gearId]:!t.checked?.[gearId]}}));
    setTrips(ts=>ts.map(upd)); setActiveTrip(t=>t?upd(t):t);
  };
  const removeItemFromTrip = (tripId,gearId) => {
    const upd=tripUpdater(tripId,t=>({...t,packedItems:{...t.packedItems,[gearId]:false}}));
    setTrips(ts=>ts.map(upd)); setActiveTrip(t=>t?upd(t):t);
  };
  const addGearToTrip = (tripId,gearId) => {
    const upd=tripUpdater(tripId,t=>({...t,packedItems:{...t.packedItems,[gearId]:true}}));
    setTrips(ts=>ts.map(upd)); setActiveTrip(t=>t?upd(t):t);
  };

  // Wishlist actions
  const addWish    = item => setWishlist(w=>[...w,{...item,id:genId()}]);
  const updateWish = item => setWishlist(w=>w.map(x=>x.id===item.id?item:x));
  const deleteWish = id   => { if(!confirm("Remove this item?")) return; setWishlist(w=>w.filter(x=>x.id!==id)); };

  const activeGearItem = gear.find(g=>g.id===activeGearId);
  const isFullScreen = activeGearItem || activeTrip;

  const tabs = [
    { id:"gear",     label:"Gear",     icon:Icons.gear  },
    { id:"trips",    label:"Trips",    icon:Icons.trips },
    { id:"wishlist", label:"Wishlist", icon:Icons.star  },
  ];

  return (
    <div className="flex flex-col h-screen bg-stone-50 max-w-md mx-auto relative font-sans">
      {/* Gear detail full-screen */}
      {activeGearItem && (
        <GearDetailSheet
          item={activeGearItem}
          onClose={()=>setActiveGearId(null)}
          onEdit={item=>{setActiveGearId(null);setEditingGear(item);}}
          onDelete={deleteGear}
          onUpdate={updateGear}
        />
      )}

      {/* Pack view full-screen */}
      {!activeGearItem && activeTrip && (
        <PackView
          trip={activeTrip}
          allGear={gear}
          onBack={()=>{setTab("trips");setActiveTrip(null);}}
          onToggleCheck={toggleCheck}
          onAddGear={addGearToTrip}
          onRemoveItem={removeItemFromTrip}
          onComplete={completeTrip}
        />
      )}

      {/* Main tabbed UI */}
      {!isFullScreen && (
        <>
          {/* Header */}
          <div className="bg-white border-b border-stone-100 px-4 py-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏔️</span>
              <div>
                <h1 className="font-bold text-stone-800 text-base leading-tight">Adventure Gear</h1>
                <p className="text-xs text-stone-400">Inventory & Trip Planner</p>
              </div>
            </div>
          </div>

          {/* Tab content */}
          {tab==="gear" && (
            <GearTab gear={gear} onAdd={()=>setShowAddGear(true)} onSelectGear={item=>setActiveGearId(item.id)} />
          )}
          {tab==="trips" && (
            <TripsTab trips={trips} gear={gear} onAdd={()=>setShowAddTrip(true)}
              onSelect={trip=>{setActiveTrip(trip);}}
              onDelete={deleteTrip} onComplete={completeTrip} />
          )}
          {tab==="wishlist" && (
            <WishlistTab wishlist={wishlist} onAdd={()=>setShowAddWish(true)} onEdit={setEditingWish} onDelete={deleteWish} />
          )}

          {/* Bottom nav */}
          <div className="bg-white border-t border-stone-100 flex shrink-0">
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${tab===t.id?"text-emerald-600":"text-stone-400"}`}>
                <Icon d={t.icon} size={22} strokeWidth={tab===t.id?2.2:1.6} />
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      {showAddGear && <GearForm onSave={addGear} onClose={()=>setShowAddGear(false)} />}
      {editingGear  && <GearForm item={editingGear} onSave={updated=>updateGear({...editingGear,...updated})} onClose={()=>setEditingGear(null)} />}
      {showAddTrip  && <TripForm gear={gear} onSave={addTrip} onClose={()=>setShowAddTrip(false)} />}
      {showAddWish  && <WishlistForm onSave={addWish} onClose={()=>setShowAddWish(false)} />}
      {editingWish  && <WishlistForm item={editingWish} onSave={updated=>updateWish({...editingWish,...updated})} onClose={()=>setEditingWish(null)} />}
    </div>
  );
}
