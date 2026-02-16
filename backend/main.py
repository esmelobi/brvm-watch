from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import sqlite3
import re
from datetime import datetime, date, timedelta
from pathlib import Path
from collector import init_db, process_bulletin, collect_date, generate_excel, DB_PATH, PDF_DIR, EXCEL_DIR, SECTEURS
from apscheduler.schedulers.background import BackgroundScheduler

app = FastAPI(title="BRVMWatch API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()
    scheduler = BackgroundScheduler(timezone="Africa/Abidjan")
    scheduler.add_job(lambda: collect_date(date.today()), "cron", day_of_week="mon-fri", hour=18, minute=5, id="collecte_auto")
    scheduler.start()

def get_db():
    return sqlite3.connect(DB_PATH)

def row_to_dict(cursor, row):
    return {col[0]: row[i] for i, col in enumerate(cursor.description)}

@app.get("/api/seances")
def get_seances(limit: int = 90):
    conn = get_db()
    cur = conn.execute(
        "SELECT date, seance_num, composite, var_composite, var_composite_annuelle, brvm30, var_brvm30, prestige, var_prestige, capitalisation, volume_total, valeur_totale, nb_titres, nb_hausse, nb_baisse, nb_inchange FROM seances ORDER BY date DESC LIMIT ?",
        (limit,)
    )
    rows = [row_to_dict(cur, r) for r in cur.fetchall()]
    conn.close()
    return list(reversed(rows))

@app.get("/api/seances/derniere")
def get_derniere_seance():
    conn = get_db()
    cur = conn.execute("SELECT * FROM seances ORDER BY date DESC LIMIT 1")
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Aucune seance en base")
    result = row_to_dict(cur, row)
    conn.close()
    return result

@app.get("/api/actions")
def get_actions(date_seance: Optional[str] = None, compartiment: Optional[str] = None):
    conn = get_db()
    if not date_seance:
        row = conn.execute("SELECT MAX(date) FROM cours").fetchone()
        date_seance = row[0] if row and row[0] else date.today().strftime("%Y-%m-%d")
    query = "SELECT symbole, titre, compartiment, secteur_code, secteur_libelle, cours_precedent, cours_ouverture, cours_cloture, variation_jour, volume, valeur_seance, cours_reference, variation_annuelle, dividende_montant, dividende_date, rendement_net, per FROM cours WHERE date = ?"
    params = [date_seance]
    if compartiment:
        query += " AND compartiment = ?"
        params.append(compartiment.upper())
    query += " ORDER BY compartiment, secteur_code, symbole"
    cur = conn.execute(query, params)
    rows = [row_to_dict(cur, r) for r in cur.fetchall()]
    conn.close()
    return {"date": date_seance, "actions": rows, "count": len(rows)}

@app.get("/api/actions/{symbole}")
def get_action_detail(symbole: str, limit: int = 90):
    symbole = symbole.upper()
    conn = get_db()
    cur = conn.execute("SELECT * FROM cours WHERE symbole = ? ORDER BY date DESC LIMIT 1", (symbole,))
    last = cur.fetchone()
    if not last:
        raise HTTPException(404, f"Action {symbole} introuvable")
    last_dict = row_to_dict(cur, last)
    cur2 = conn.execute("SELECT date, cours_cloture, variation_jour, volume, valeur_seance FROM cours WHERE symbole = ? ORDER BY date DESC LIMIT ?", (symbole, limit))
    historique = [row_to_dict(cur2, r) for r in cur2.fetchall()]
    conn.close()
    return {"symbole": symbole, "derniere": last_dict, "historique": list(reversed(historique))}

@app.get("/api/pepite")
def get_pepite(jours: int = 7):
    conn = get_db()
    date_debut = (date.today() - timedelta(days=jours)).strftime("%Y-%m-%d")
    cur = conn.execute(
        "SELECT symbole, MAX(titre) as titre, MAX(secteur_code) as secteur_code, MAX(secteur_libelle) as secteur_libelle, MAX(compartiment) as compartiment, AVG(variation_jour) as var_moy, SUM(volume) as vol_total, MAX(cours_cloture) as dernier_cours, MIN(cours_cloture) as cours_min, COUNT(*) as nb_seances FROM cours WHERE date >= ? AND variation_jour IS NOT NULL GROUP BY symbole HAVING nb_seances >= 1 ORDER BY var_moy DESC",
        (date_debut,)
    )
    data = [row_to_dict(cur, r) for r in cur.fetchall()]
    conn.close()
    return {"periode_jours": jours, "depuis": date_debut, "pepites": data[:5], "flops": list(reversed(data[-5:])) if len(data) >= 5 else data, "tous": data}

@app.get("/api/secteurs")
def get_secteurs(date_seance: Optional[str] = None):
    conn = get_db()
    if not date_seance:
        row = conn.execute("SELECT MAX(date) FROM cours").fetchone()
        date_seance = row[0] if row and row[0] else date.today().strftime("%Y-%m-%d")
    cur = conn.execute(
        "SELECT secteur_code, secteur_libelle, COUNT(*) as nb_titres, AVG(variation_jour) as var_moy, SUM(volume) as vol_total, SUM(valeur_seance) as valeur_totale, SUM(CASE WHEN variation_jour > 0 THEN 1 ELSE 0 END) as nb_hausse, SUM(CASE WHEN variation_jour < 0 THEN 1 ELSE 0 END) as nb_baisse FROM cours WHERE date = ? AND secteur_code IS NOT NULL GROUP BY secteur_code ORDER BY var_moy DESC",
        (date_seance,)
    )
    rows = [row_to_dict(cur, r) for r in cur.fetchall()]
    conn.close()
    return {"date": date_seance, "secteurs": rows}

class ConseilCreate(BaseModel):
    symbole: str
    titre: Optional[str] = ""
    type: str
    prix_entree: float
    prix_cible: float
    stop_loss: float
    commentaire: Optional[str] = ""

@app.get("/api/conseils")
def get_conseils(actif_only: bool = True):
    conn = get_db()
    query = "SELECT * FROM conseils"
    if actif_only:
        query += " WHERE actif = 1"
    query += " ORDER BY date_conseil DESC"
    cur = conn.execute(query)
    rows = [row_to_dict(cur, r) for r in cur.fetchall()]
    for conseil in rows:
        sym = conseil["symbole"]
        row = conn.execute("SELECT cours_cloture, date FROM cours WHERE symbole = ? ORDER BY date DESC LIMIT 1", (sym,)).fetchone()
        if row:
            conseil["cours_actuel"] = row[0]
            conseil["date_cours"] = row[1]
            if conseil["prix_entree"] and row[0]:
                pv = round((row[0] - conseil["prix_entree"]) / conseil["prix_entree"] * 100, 2)
                conseil["pv_latente_pct"] = -pv if conseil["type"] == "VENTE" else pv
        else:
            conseil["cours_actuel"] = None
            conseil["date_cours"] = None
            conseil["pv_latente_pct"] = None
    conn.close()
    return rows

@app.post("/api/conseils")
def add_conseil(conseil: ConseilCreate):
    conn = get_db()
    titre = conseil.titre
    if not titre:
        row = conn.execute("SELECT titre FROM cours WHERE symbole = ? LIMIT 1", (conseil.symbole.upper(),)).fetchone()
        titre = row[0] if row else conseil.symbole
    conn.execute(
        "INSERT INTO conseils (date_conseil, symbole, titre, type, prix_entree, prix_cible, stop_loss, commentaire) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (date.today().strftime("%Y-%m-%d"), conseil.symbole.upper(), titre, conseil.type.upper(), conseil.prix_entree, conseil.prix_cible, conseil.stop_loss, conseil.commentaire)
    )
    conn.commit()
    conseil_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"status": "ok", "id": conseil_id}

@app.delete("/api/conseils/{conseil_id}")
def close_conseil(conseil_id: int):
    conn = get_db()
    row = conn.execute("SELECT symbole, prix_entree, type FROM conseils WHERE id = ?", (conseil_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Conseil introuvable")
    cours_row = conn.execute("SELECT cours_cloture FROM cours WHERE symbole = ? ORDER BY date DESC LIMIT 1", (row[0],)).fetchone()
    resultat = None
    if cours_row and row[1]:
        resultat = round((cours_row[0] - row[1]) / row[1] * 100, 2)
        if row[2] == "VENTE":
            resultat = -resultat
    conn.execute("UPDATE conseils SET actif = 0, date_cloture = ?, resultat_pct = ? WHERE id = ?", (date.today().strftime("%Y-%m-%d"), resultat, conseil_id))
    conn.commit()
    conn.close()
    return {"status": "ok", "resultat_pct": resultat}

@app.post("/api/upload-bulletin")
async def upload_bulletin(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Fichier PDF requis")
    date_match = re.search(r'(\d{8})', file.filename)
    target_date = datetime.strptime(date_match.group(1), "%Y%m%d").date() if date_match else date.today()
    pdf_path = PDF_DIR / f"boc_{target_date.strftime('%Y%m%d')}.pdf"
    content = await file.read()
    pdf_path.write_bytes(content)
    try:
        result = process_bulletin(pdf_path, target_date)
        return {"status": "ok", "date": result["date"], "seance_num": result["seance_num"], "nb_actions": result["nb_actions"], "composite": result["composite"], "var_composite": result["var_composite"]}
    except Exception as e:
        raise HTTPException(500, f"Erreur traitement PDF : {str(e)}")

@app.get("/api/refresh")
def refresh_today():
    today = date.today()
    if today.weekday() >= 5:
        return {"status": "skipped", "reason": "week-end"}
    try:
        result = collect_date(today, force=True)
        if result:
            return {"status": "ok", "nb_actions": result["nb_actions"], "date": result["date"]}
        return {"status": "not_found", "message": "Bulletin non disponible pour aujourd'hui"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/export/excel/{date_seance}")
def export_excel(date_seance: str):
    try:
        target_date = datetime.strptime(date_seance, "%Y-%m-%d").date()
        excel_path = generate_excel(target_date)
        return FileResponse(str(excel_path), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=f"brvm_{date_seance}.xlsx")
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/stats")
def get_stats():
    conn = get_db()
    nb_seances = conn.execute("SELECT COUNT(*) FROM seances").fetchone()[0]
    nb_cours = conn.execute("SELECT COUNT(*) FROM cours").fetchone()[0]
    nb_conseils = conn.execute("SELECT COUNT(*) FROM conseils WHERE actif=1").fetchone()[0]
    premiere = conn.execute("SELECT MIN(date) FROM seances").fetchone()[0]
    derniere = conn.execute("SELECT MAX(date) FROM seances").fetchone()[0]
    conn.close()
    return {"nb_seances": nb_seances, "nb_cours": nb_cours, "nb_conseils_actifs": nb_conseils, "premiere_seance": premiere, "derniere_seance": derniere}

@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat(), "version": "2.0"}
