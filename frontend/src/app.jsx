import { useState, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Activity, Star, AlertTriangle, ChevronUp, ChevronDown, Search, Bell, RefreshCw, PlusCircle, Briefcase, Calendar, Award, Zap, Upload, X, Check, ArrowUpRight, ArrowDownRight, Database, Wifi, WifiOff } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function useApi(endpoint, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetch_ = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}${endpoint}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [endpoint, ...deps]);
  useEffect(() => { fetch_(); }, [fetch_]);
  return { data, loading, error, refetch: fetch_ };
}

const fmt = (n, dec = 0) => n != null ? Number(n).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : "—";
const fmtPct = (n) => n != null ? `${n >= 0 ? "+" : ""}${Number(n).toFixed(2)}%` : "—";

const Spinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
  </div>
);

const VarBadge = ({ val, size = "sm" }) => {
  if (val == null) return <span className="text-slate-500 text-xs">—</span>;
  const pos = val >= 0;
  const sz = size === "lg" ? "px-3 py-1 text-sm" : "px-1.5 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded font-bold ${sz} ${pos ? "bg-emerald-400/15 text-emerald-400" : "bg-rose-400/15 text-rose-400"}`}>
      {pos ? <ArrowUpRight size={size === "lg" ? 14 : 10} /> : <ArrowDownRight size={size === "lg" ? 14 : 10} />}
      {fmtPct(val)}
    </span>
  );
};

const StatCard = ({ label, value, sub, icon: Icon, accent = "amber", trend }) => {
  const accents = { amber: "border-amber-400/30 bg-amber-400/5 text-amber-400", emerald: "border-emerald-400/30 bg-emerald-400/5 text-emerald-400", sky: "border-sky-400/30 bg-sky-400/5 text-sky-400", rose: "border-rose-400/30 bg-rose-400/5 text-rose-400" };
  return (
    <div className={`border rounded-xl p-4 ${accents[accent]} backdrop-blur-sm transition-all hover:scale-[1.01]`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70">{label}</p>
        {Icon && <Icon size={16} className="opacity-60" />}
      </div>
      <p className="text-2xl font-black text-white tracking-tight">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
      {trend != null && <VarBadge val={trend} />}
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0e1623] border border-amber-400/20 rounded-lg p-3 shadow-2xl text-xs">
      <p className="text-slate-400 mb-2 font-mono">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-bold text-white">{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const UploadModal = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const dropRef = useRef();
  const handleFile = (f) => { if (f && f.name.endsWith(".pdf")) setFile(f); else setErr("Fichier PDF requis"); };
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setErr(null);
    const fd = new FormData(); fd.append("file", file);
    try {
      const res = await fetch(`${API}/api/upload-bulletin`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erreur serveur");
      setResult(data); onSuccess?.();
    } catch (e) { setErr(e.message); }
    finally { setUploading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0e1623] border border-amber-400/20 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold text-lg">Importer un Bulletin</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400"><X size={16} /></button>
        </div>
        {!result ? (
          <>
            <div ref={dropRef} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }} onClick={() => document.getElementById("pdf-input").click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${file ? "border-amber-400/50 bg-amber-400/5" : "border-slate-600 hover:border-amber-400/30"}`}>
              <Upload size={28} className={`mx-auto mb-3 ${file ? "text-amber-400" : "text-slate-500"}`} />
              {file ? <p className="text-amber-400 font-semibold text-sm">{file.name}</p> : <><p className="text-slate-300 text-sm font-medium">Glissez le PDF ici</p><p className="text-slate-500 text-xs mt-1">ou cliquez pour parcourir</p></>}
              <input id="pdf-input" type="file" accept=".pdf" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            </div>
            {err && <p className="mt-3 text-rose-400 text-xs bg-rose-400/10 rounded-lg p-2">{err}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-all">Annuler</button>
              <button onClick={handleUpload} disabled={!file || uploading} className="flex-1 py-2.5 rounded-xl bg-amber-400 text-black text-sm font-bold hover:bg-amber-300 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                {uploading ? <><RefreshCw size={14} className="animate-spin" />Traitement...</> : <><Upload size={14} />Importer</>}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-emerald-400/15 rounded-full flex items-center justify-center mx-auto mb-4"><Check size={28} className="text-emerald-400" /></div>
            <h4 className="text-white font-bold text-lg mb-1">Bulletin importé !</h4>
            <p className="text-slate-400 text-sm mb-4">{result.date} — Séance N°{result.seance_num}</p>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-amber-400 text-black font-bold text-sm hover:bg-amber-300 transition-all">Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
};

const PageMarche = () => {
  const { data: seances, loading } = useApi("/api/seances?limit=60");
  const { data: derniere } = useApi("/api/seances/derniere");
  const [periode, setPeriode] = useState("1M");
  const periodes = { "2S": 10, "1M": 21, "3M": 60 };
  const chartData = seances?.slice(-periodes[periode]) || [];
  if (loading) return <Spinner />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="BRVM Composite" value={fmt(derniere?.composite, 2)} trend={derniere?.var_composite} icon={TrendingUp} accent="amber" />
        <StatCard label="BRVM 30" value={fmt(derniere?.brvm30, 2)} trend={derniere?.var_brvm30} icon={Activity} accent="sky" />
        <StatCard label="BRVM Prestige" value={fmt(derniere?.prestige, 2)} trend={derniere?.var_prestige} icon={Star} accent="emerald" />
        <StatCard label="Volume" value={fmt(derniere?.volume_total)} sub="titres échangés" icon={Activity} accent="rose" />
      </div>
      {derniere && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[{ l: "Titres transigés", v: derniere.nb_titres }, { l: "En hausse", v: derniere.nb_hausse, col: "text-emerald-400" }, { l: "En baisse", v: derniere.nb_baisse, col: "text-rose-400" }, { l: "Inchangés", v: derniere.nb_inchange }, { l: "Capitalisation", v: derniere.capitalisation ? `${(derniere.capitalisation / 1e12).toFixed(1)}T` : "—", sub: "FCFA" }, { l: "Valeur transigée", v: derniere.valeur_totale ? `${(derniere.valeur_totale / 1e9).toFixed(1)}Mrd` : "—", sub: "FCFA" }].map(({ l, v, col, sub }) => (
            <div key={l} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 text-center">
              <p className="text-slate-500 text-xs mb-1">{l}</p>
              <p className={`font-black text-lg ${col || "text-white"}`}>{v}</p>
              {sub && <p className="text-slate-600 text-xs">{sub}</p>}
            </div>
          ))}
        </div>
      )}
      <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div><h3 className="text-white font-bold">Evolution des Indices</h3><p className="text-slate-500 text-xs mt-0.5">BRVM Composite · BRVM 30 · Prestige</p></div>
          <div className="flex gap-1 bg-slate-900/60 rounded-lg p-1">
            {Object.keys(periodes).map(p => (
              <button key={p} onClick={() => setPeriode(p)} className={`px-3 py-1 text-xs rounded-md font-bold transition-all ${periode === p ? "bg-amber-400 text-black" : "text-slate-400 hover:text-white"}`}>{p}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              {[["gc", "#f59e0b"], ["g30", "#38bdf8"], ["gp", "#34d399"]].map(([id, color]) => (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} /><stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "#475569", fontSize: 9 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="composite" name="Composite" stroke="#f59e0b" strokeWidth={2} fill="url(#gc)" dot={false} />
            <Area type="monotone" dataKey="brvm30" name="BRVM 30" stroke="#38bdf8" strokeWidth={1.5} fill="url(#g30)" dot={false} />
            <Area type="monotone" dataKey="prestige" name="Prestige" stroke="#34d399" strokeWidth={1.5} fill="url(#gp)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const PageActions = () => {
  const { data, loading } = useApi("/api/actions");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("variation_jour");
  const [sortDir, setSortDir] = useState(-1);
  const [selected, setSelected] = useState(null);
  const { data: detail, loading: detailLoading } = useApi(selected ? `/api/actions/${selected}` : null, [selected]);
  const actions = data?.actions || [];
  const filtered = actions.filter(a => !search || a.symbole.includes(search.toUpperCase()) || a.titre?.toLowerCase().includes(search.toLowerCase())).sort((a, b) => { const va = a[sort], vb = b[sort]; if (va == null) return 1; if (vb == null) return -1; return typeof va === "string" ? sortDir * va.localeCompare(vb) : sortDir * (va - vb); });
  const SortBtn = ({ col, label }) => (<button onClick={() => { if (sort === col) setSortDir(d => -d); else { setSort(col); setSortDir(-1); } }} className="flex items-center gap-1 hover:text-amber-400 transition-colors whitespace-nowrap">{label}{sort === col && (sortDir === -1 ? <ChevronDown size={10} /> : <ChevronUp size={10} />)}</button>);
  const secteurColors = { FIN: "bg-sky-400/15 text-sky-300", CB: "bg-emerald-400/15 text-emerald-300", CD: "bg-amber-400/15 text-amber-300", IND: "bg-violet-400/15 text-violet-300", ENE: "bg-orange-400/15 text-orange-300", TEL: "bg-rose-400/15 text-rose-300", SPU: "bg-teal-400/15 text-teal-300" };
  if (loading) return <Spinner />;
  return (
    <div className="flex gap-4">
      <div className={`${selected ? "w-3/5" : "w-full"} bg-slate-800/40 border border-slate-700/40 rounded-2xl overflow-hidden transition-all`}>
        <div className="p-4 border-b border-slate-700/40 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" className="w-full bg-slate-900/60 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400/50" />
          </div>
          <span className="text-slate-500 text-xs font-mono">{filtered.length} titres</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-700/40">
                {[["symbole", "Code"], ["titre", "Societe"], ["compartiment", "Comp."], ["secteur_code", "Sect."], ["cours_cloture", "Cloture"], ["variation_jour", "Var. Jour"], ["variation_annuelle", "Var. An."], ["volume", "Volume"]].map(([col, lbl]) => (
                  <th key={col} className="text-left p-3 font-semibold"><SortBtn col={col} label={lbl} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.symbole} onClick={() => setSelected(selected === a.symbole ? null : a.symbole)} className={`border-b border-slate-700/20 cursor-pointer transition-colors ${selected === a.symbole ? "bg-amber-400/10" : i % 2 === 0 ? "hover:bg-slate-700/30" : "bg-slate-900/20 hover:bg-slate-700/30"}`}>
                  <td className="p-3"><span className="font-mono font-black text-amber-400 text-xs bg-amber-400/10 px-2 py-0.5 rounded">{a.symbole}</span></td>
                  <td className="p-3 text-slate-300 max-w-[180px] truncate">{a.titre}</td>
                  <td className="p-3 text-slate-500 text-[10px]">{a.compartiment}</td>
                  <td className="p-3"><span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${secteurColors[a.secteur_code] || "bg-slate-700 text-slate-300"}`}>{a.secteur_code}</span></td>
                  <td className="p-3 text-right font-bold text-white font-mono">{fmt(a.cours_cloture)}</td>
                  <td className="p-3 text-right"><VarBadge val={a.variation_jour} /></td>
                  <td className="p-3 text-right"><VarBadge val={a.variation_annuelle} /></td>
                  <td className="p-3 text-right text-slate-500 font-mono">{a.volume ? fmt(a.volume) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected && (
        <div className="w-2/5 bg-slate-800/40 border border-amber-400/20 rounded-2xl p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="flex items-center justify-between">
            <div><span className="text-amber-400 font-black text-xl font-mono">{selected}</span><p className="text-slate-400 text-xs mt-0.5">{detail?.derniere?.titre}</p></div>
            <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400"><X size={14} /></button>
          </div>
          {detailLoading ? <Spinner /> : detail && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {[["Cloture", fmt(detail.derniere?.cours_cloture)], ["Variation", fmtPct(detail.derniere?.variation_jour)], ["Reference", fmt(detail.derniere?.cours_reference)], ["Var. annuelle", fmtPct(detail.derniere?.variation_annuelle)], ["Volume", fmt(detail.derniere?.volume)], ["Valeur", detail.derniere?.valeur_seance ? `${(detail.derniere.valeur_seance / 1e6).toFixed(1)}M` : "—"], ["PER", detail.derniere?.per?.toFixed(2) || "—"], ["Rendement", detail.derniere?.rendement_net ? `${detail.derniere.rendement_net}%` : "—"]].map(([l, v]) => (
                  <div key={l} className="bg-slate-900/60 rounded-lg p-2"><p className="text-slate-500 text-[10px]">{l}</p><p className="text-white font-bold text-sm">{v}</p></div>
                ))}
              </div>
              {detail.historique?.length > 1 && (
                <div>
                  <p className="text-slate-400 text-xs mb-2 font-semibold">Historique cours</p>
                  <ResponsiveContainer width="100%" height={100}>
                    <AreaChart data={detail.historique} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                      <defs><linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient></defs>
                      <XAxis dataKey="date" hide /><YAxis domain={["auto", "auto"]} hide />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="cours_cloture" name="Cours" stroke="#f59e0b" strokeWidth={2} fill="url(#gd)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const PagePepite = () => {
  const [jours, setJours] = useState(7);
  const { data, loading } = useApi(`/api/pepite?jours=${jours}`, [jours]);
  if (loading) return <Spinner />;
  const RankCard = ({ action, rank, type }) => {
    const isPos = type === "pepite";
    return (
      <div className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all hover:scale-[1.01] ${isPos ? "bg-emerald-400/5 border-emerald-400/15 hover:border-emerald-400/30" : "bg-rose-400/5 border-rose-400/15 hover:border-rose-400/30"}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0 ${isPos ? "bg-emerald-400/15 text-emerald-400" : "bg-rose-400/15 text-rose-400"}`}>{rank}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5"><span className="font-mono font-black text-amber-400 text-xs">{action.symbole}</span><span className="text-slate-400 text-xs truncate">{action.titre}</span></div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500"><span>{action.secteur_code}</span><span>·</span><span>{action.nb_seances} seances</span><span>·</span><span>Vol: {fmt(action.vol_total)}</span></div>
        </div>
        <div className="text-right flex-shrink-0"><VarBadge val={action.var_moy} size="lg" /><p className="text-slate-500 text-[10px] mt-0.5">{fmt(action.dernier_cours)} FCFA</p></div>
      </div>
    );
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <p className="text-slate-400 text-sm">Periode :</p>
        <div className="flex gap-1 bg-slate-800/60 rounded-lg p-1">
          {[5, 7, 14, 30].map(j => (<button key={j} onClick={() => setJours(j)} className={`px-3 py-1 text-xs rounded-md font-bold transition-all ${jours === j ? "bg-amber-400 text-black" : "text-slate-400 hover:text-white"}`}>{j}j</button>))}
        </div>
        <p className="text-slate-500 text-xs">Depuis le {data?.depuis}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4"><div className="w-9 h-9 bg-emerald-400/15 rounded-xl flex items-center justify-center"><Award size={18} className="text-emerald-400" /></div><div><h3 className="text-white font-bold">Pepites</h3><p className="text-slate-500 text-xs">Meilleures performances</p></div></div>
          <div className="space-y-2">{(data?.pepites || []).map((a, i) => <RankCard key={a.symbole} action={a} rank={i + 1} type="pepite" />)}</div>
        </div>
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4"><div className="w-9 h-9 bg-rose-400/15 rounded-xl flex items-center justify-center"><AlertTriangle size={18} className="text-rose-400" /></div><div><h3 className="text-white font-bold">Flops</h3><p className="text-slate-500 text-xs">Plus faibles performances</p></div></div>
          <div className="space-y-2">{(data?.flops || []).map((a, i) => <RankCard key={a.symbole} action={a} rank={i + 1} type="flop" />)}</div>
        </div>
      </div>
      <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
        <h3 className="text-white font-bold mb-4 text-sm">Comparaison toutes actions ({jours}j)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data?.tous || []} margin={{ top: 5, right: 5, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="symbole" tick={{ fill: "#475569", fontSize: 9 }} tickLine={false} axisLine={false} angle={-45} textAnchor="end" />
            <YAxis tick={{ fill: "#475569", fontSize: 9 }} tickLine={false} axisLine={false} />
            <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="var_moy" name="Var. moy. %" radius={[4, 4, 0, 0]}>
              {(data?.tous || []).map((a, i) => (<Cell key={i} fill={a.var_moy >= 0 ? "#34d399" : "#f43f5e"} />))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const PageConseils = () => {
  const { data: conseils, loading, refetch } = useApi("/api/conseils");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ symbole: "", type: "ACHAT", prix_entree: "", prix_cible: "", stop_loss: "", commentaire: "" });
  const [saving, setSaving] = useState(false);
  const typeColor = { ACHAT: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30", VENTE: "bg-rose-400/15 text-rose-400 border-rose-400/30", NEUTRE: "bg-amber-400/15 text-amber-400 border-amber-400/30" };
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/conseils`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, prix_entree: +form.prix_entree, prix_cible: +form.prix_cible, stop_loss: +form.stop_loss }) });
      if (!res.ok) throw new Error("Erreur sauvegarde");
      setForm({ symbole: "", type: "ACHAT", prix_entree: "", prix_cible: "", stop_loss: "", commentaire: "" });
      setShowForm(false); refetch();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };
  const handleClose = async (id) => { if (!confirm("Cloturer ce conseil ?")) return; await fetch(`${API}/api/conseils/${id}`, { method: "DELETE" }); refetch(); };
  if (loading) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-white font-bold text-lg">Conseils d'Investissement</h2><p className="text-slate-500 text-xs mt-0.5">{conseils?.length || 0} positions actives</p></div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-black px-4 py-2 rounded-xl font-bold text-sm transition-all"><PlusCircle size={15} /> Nouveau</button>
      </div>
      {showForm && (
        <div className="bg-slate-800/60 border border-amber-400/20 rounded-2xl p-5">
          <h3 className="text-white font-bold mb-4 text-sm">Nouveau Conseil</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <div><label className="text-xs text-slate-400 mb-1 block">Symbole</label><input value={form.symbole} onChange={e => setForm(f => ({ ...f, symbole: e.target.value.toUpperCase() }))} placeholder="ex: SGBC" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-amber-400/50" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Type</label><div className="flex gap-1">{["ACHAT", "VENTE", "NEUTRE"].map(t => (<button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${form.type === t ? typeColor[t] : "border-slate-700 text-slate-500"}`}>{t}</button>))}</div></div>
            {[["Prix d'entree", "prix_entree"], ["Prix cible", "prix_cible"], ["Stop-loss", "stop_loss"]].map(([l, k]) => (<div key={k}><label className="text-xs text-slate-400 mb-1 block">{l} (FCFA)</label><input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400/50" /></div>))}
            <div className="col-span-2 lg:col-span-3"><label className="text-xs text-slate-400 mb-1 block">These d'investissement</label><textarea value={form.commentaire} onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))} rows={2} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400/50 resize-none" /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving || !form.symbole || !form.prix_entree} className="bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black px-5 py-2 rounded-lg font-bold text-sm transition-all">{saving ? "Enregistrement..." : "Enregistrer"}</button>
            <button onClick={() => setShowForm(false)} className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2 rounded-lg font-bold text-sm transition-all">Annuler</button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {!conseils?.length && (<div className="text-center py-12 text-slate-500"><Zap size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Aucun conseil actif. Creez votre premier conseil !</p></div>)}
        {(conseils || []).map(c => {
          const potentiel = c.cours_actuel && c.prix_cible ? ((c.prix_cible - c.cours_actuel) / c.cours_actuel * 100).toFixed(1) : null;
          const risque = c.cours_actuel && c.stop_loss ? ((c.cours_actuel - c.stop_loss) / c.cours_actuel * 100).toFixed(1) : null;
          const rratio = potentiel && risque && risque > 0 ? (Math.abs(potentiel) / Math.abs(risque)).toFixed(1) : null;
          const progress = c.cours_actuel && c.prix_entree && c.prix_cible ? Math.max(0, Math.min(100, (c.cours_actuel - c.prix_entree) / (c.prix_cible - c.prix_entree) * 100)) : 0;
          return (
            <div key={c.id} className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5 hover:border-slate-600/50 transition-all">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3"><span className="font-mono font-black text-amber-400">{c.symbole}</span><span className={`text-xs px-2 py-0.5 rounded border font-bold ${typeColor[c.type]}`}>{c.type}</span>{c.pv_latente_pct != null && <VarBadge val={c.pv_latente_pct} size="lg" />}</div>
                <div className="flex items-center gap-2"><span className="text-slate-500 text-xs flex items-center gap-1"><Calendar size={10} />{c.date_conseil}</span><button onClick={() => handleClose(c.id)} className="p-1.5 rounded-lg bg-slate-700 hover:bg-rose-400/20 text-slate-400 hover:text-rose-400 transition-all"><X size={12} /></button></div>
              </div>
              {c.commentaire && <p className="text-slate-400 text-xs mb-4 italic border-l-2 border-amber-400/30 pl-3">{c.commentaire}</p>}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[["Entree", fmt(c.prix_entree), "slate"], ["Actuel", fmt(c.cours_actuel), c.cours_actuel >= c.prix_entree ? "emerald" : "rose"], ["Cible", fmt(c.prix_cible), "sky"], ["Stop", fmt(c.stop_loss), "amber"]].map(([l, v, col]) => {
                  const cols = { slate: "text-slate-300", emerald: "text-emerald-400", rose: "text-rose-400", sky: "text-sky-400", amber: "text-amber-400" };
                  return (<div key={l} className="bg-slate-900/60 rounded-lg p-2.5 text-center"><p className="text-[10px] text-slate-500 mb-1">{l}</p><p className={`font-bold text-sm font-mono ${cols[col]}`}>{v}</p></div>);
                })}
              </div>
              <div className="space-y-1">
                <div className="w-full bg-slate-900 rounded-full h-1.5"><div className={`h-1.5 rounded-full transition-all ${progress > 100 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, progress)}%` }} /></div>
                <div className="flex gap-4 text-xs text-slate-500">
                  {potentiel && <span>Potentiel: <span className="text-sky-400 font-bold">+{potentiel}%</span></span>}
                  {risque && <span>Risque: <span className="text-amber-400 font-bold">-{risque}%</span></span>}
                  {rratio && <span>R/R: <span className="text-white font-bold">{rratio}x</span></span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PagePortefeuille = () => {
  const { data: conseils } = useApi("/api/conseils");
  const { data: stats } = useApi("/api/stats");
  const positions = (conseils || []).filter(c => c.cours_actuel);
  const totalInvesti = positions.reduce((s, c) => s + (c.prix_entree || 0) * 100, 0);
  const totalActuel = positions.reduce((s, c) => s + (c.cours_actuel || 0) * 100, 0);
  const pvTotale = totalInvesti ? ((totalActuel - totalInvesti) / totalInvesti * 100).toFixed(2) : 0;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Valeur investie" value={`${(totalInvesti / 1000).toFixed(0)}K`} sub="FCFA (base 100)" icon={Briefcase} accent="sky" />
        <StatCard label="Valeur actuelle" value={`${(totalActuel / 1000).toFixed(0)}K`} sub="FCFA" icon={Activity} accent="emerald" />
        <StatCard label="PV Latente" value={`${pvTotale > 0 ? "+" : ""}${pvTotale}%`} icon={TrendingUp} accent={pvTotale >= 0 ? "emerald" : "rose"} />
        <StatCard label="Positions" value={positions.length} sub={`${stats?.nb_seances || 0} seances en base`} icon={Database} accent="amber" />
      </div>
      {stats && (
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
          <h3 className="text-white font-bold mb-4 text-sm flex items-center gap-2"><Database size={14} className="text-amber-400" /> Base de donnees</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[["Seances", stats.nb_seances], ["Cours enregistres", stats.nb_cours], ["Premiere seance", stats.premiere_seance || "—"], ["Derniere seance", stats.derniere_seance || "—"]].map(([l, v]) => (
              <div key={l} className="bg-slate-900/60 rounded-xl p-3 text-center"><p className="text-slate-500 text-xs mb-1">{l}</p><p className="text-white font-bold text-sm">{v}</p></div>
            ))}
          </div>
        </div>
      )}
      {positions.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
          <h3 className="text-white font-bold mb-4 text-sm">Positions et Progression</h3>
          <div className="space-y-3">
            {positions.map(c => {
              const pv = c.pv_latente_pct;
              const progress = c.prix_entree && c.prix_cible ? Math.max(0, Math.min(100, (c.cours_actuel - c.prix_entree) / (c.prix_cible - c.prix_entree) * 100)) : 0;
              return (
                <div key={c.id} className="bg-slate-900/40 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="font-mono font-black text-amber-400 text-sm">{c.symbole}</span><span className="text-slate-400 text-xs">{c.titre}</span></div><VarBadge val={pv} size="lg" /></div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1.5"><span>Entree: {fmt(c.prix_entree)}</span><span className="text-white">Actuel: {fmt(c.cours_actuel)}</span><span className="text-sky-400">Cible: {fmt(c.prix_cible)}</span></div>
                  <div className="w-full bg-slate-800 rounded-full h-2"><div className={`h-2 rounded-full transition-all ${pv >= 0 ? "bg-emerald-400" : "bg-rose-400"}`} style={{ width: `${Math.min(100, Math.max(2, progress))}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const TABS = [
  { id: "marche", label: "Marche", icon: Activity },
  { id: "actions", label: "Actions", icon: TrendingUp },
  { id: "pepite", label: "Pepite / Flop", icon: Award },
  { id: "conseils", label: "Conseils", icon: Zap },
  { id: "portefeuille", label: "Portefeuille", icon: Briefcase },
];

export default function App() {
  const [tab, setTab] = useState("marche");
  const [showUpload, setShowUpload] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [apiOk, setApiOk] = useState(null);
  const { data: derniere } = useApi("/api/seances/derniere");
  useEffect(() => { fetch(`${API}/health`).then(r => setApiOk(r.ok)).catch(() => setApiOk(false)); }, []);
  const handleRefresh = async () => { setRefreshing(true); await fetch(`${API}/api/refresh`); setTimeout(() => setRefreshing(false), 2000); };
  const PAGES = { marche: <PageMarche />, actions: <PageActions />, pepite: <PagePepite />, conseils: <PageConseils />, portefeuille: <PagePortefeuille /> };
  return (
    <div className="min-h-screen text-white" style={{ background: "linear-gradient(135deg, #060d16 0%, #0a1628 50%, #060d16 100%)", fontFamily: "'Syne', 'Trebuchet MS', sans-serif" }}>
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #f59e0b 1px, transparent 0)", backgroundSize: "40px 40px" }} />
      <header className="sticky top-0 z-40 bg-[#060d16]/90 backdrop-blur-xl border-b border-slate-800/60">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 bg-amber-400 rounded-xl flex items-center justify-center"><Activity size={18} className="text-black" /></div>
              {apiOk === true && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#060d16]" />}
              {apiOk === false && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-400 rounded-full border-2 border-[#060d16]" />}
            </div>
            <div><h1 className="font-black text-base tracking-tight">BRVM<span className="text-amber-400">Watch</span></h1><p className="text-slate-600 text-[10px] leading-none">Bourse Regionale · UEMOA</p></div>
          </div>
          {derniere && (
            <div className="hidden sm:flex items-center gap-4 bg-slate-900/60 border border-slate-700/40 rounded-xl px-4 py-2">
              {[["Composite", derniere.composite, derniere.var_composite], ["BRVM 30", derniere.brvm30, derniere.var_brvm30], ["Prestige", derniere.prestige, derniere.var_prestige]].map(([l, v, var_]) => (
                <div key={l} className="flex items-center gap-2 text-xs"><span className="text-slate-500">{l}</span><span className="font-black text-white font-mono">{v?.toFixed(2)}</span><VarBadge val={var_} /></div>
              ))}
              <div className="w-px h-4 bg-slate-700" />
              <span className="text-slate-500 text-[10px]">Seance N{derniere.seance_num}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/20 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"><Upload size={12} /> Bulletin</button>
            <button onClick={handleRefresh} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700/50"><RefreshCw size={13} className={`text-slate-400 ${refreshing ? "animate-spin" : ""}`} /></button>
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700/50 rounded-lg px-2.5 py-1.5">
              {apiOk ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-rose-400" />}
              <span className={`text-[10px] font-semibold ${apiOk ? "text-emerald-400" : "text-rose-400"}`}>{apiOk ? "API OK" : "Hors ligne"}</span>
            </div>
          </div>
        </div>
        <div className="max-w-screen-xl mx-auto px-4 flex gap-0 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${tab === id ? "border-amber-400 text-amber-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}><Icon size={13} />{label}</button>
          ))}
        </div>
      </header>
      <main className="max-w-screen-xl mx-auto px-4 py-6">
        {apiOk === false && (
          <div className="mb-4 bg-rose-400/10 border border-rose-400/20 rounded-xl p-4 flex items-center gap-3">
            <WifiOff size={16} className="text-rose-400 flex-shrink-0" />
            <div><p className="text-rose-300 text-sm font-semibold">API non disponible</p><p className="text-rose-400/70 text-xs">Verifiez que le backend est demarre sur <code className="font-mono">{API}</code></p></div>
          </div>
        )}
        {PAGES[tab]}
      </main>
      <footer className="border-t border-slate-800/60 py-4 text-center mt-8">
        <p className="text-slate-600 text-xs">BRVMWatch v2.0 · Donnees issues des Bulletins Officiels de la Cote · <span className="text-amber-400/60">Derniere seance: {derniere?.date || "—"}</span></p>
      </footer>
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => setShowUpload(false)} />}
    </div>
  );
}
