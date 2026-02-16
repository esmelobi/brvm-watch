"""
BRVMWatch — Backend FastAPI
Connecté au collector calibré sur les vrais bulletins PDF BRVM.
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import sqlite3
import os
import shutil
import tempfile
from datetime import datetime, date, timedelta
from pathlib import Path

# Importer le collector validé
from collector import (
    init_db, process_bulletin, collect_date,
    generate_excel, DB_PATH, PDF_DIR, EXCEL_DIR, SECTEURS
)
from apscheduler.schedulers.background import BackgroundScheduler

app = FastAPI(title="BRVMWatch API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DÉMARRAGE ─────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup():
    init_db()
    # Scheduler : collecte automatique à 18h05 WAT chaque jour ouvré
    scheduler = BackgroundScheduler(timezone="Africa/Abidjan")
    scheduler.add_job(
        lambda: collect_date(date.today()),
        "cron",
        day_of_week="mon-fri",
        hour=18,
        minute=5,
        id="collecte_auto"
    )
    scheduler.start()


# ── HELPERS ───────────────────────────────────────────────────────────────────

def get_db():
    return sqlite3.connect(DB_PATH)

def row_to_dict(cursor, row):
    return {col[0]: row[i] for i, col in enumerate(cursor.description)}


# ── ENDPOINTS MARCHÉ ──────────────────────────────────────────────────────────

@app.get("/api/seances")
def get_seances(limit: int = 90):
    """Historique des séances (indices BRVM)."""
    conn = get_db()
    cur = conn.execute("""
        SELECT date, seance_num, composite, var_composite, var_composite_annuelle,
               brvm30, var_brvm30, prestige, var_prestige,
               capitalisation, volume_total, valeur_totale,
               nb_titres, nb_hausse, nb_baisse, nb_inchange
        FR
