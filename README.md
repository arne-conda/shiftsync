# ShiftSync v2

Quinyx → Tripletex lønnsimport. Konverterer Quinyx-eksportfiler til CSV-format for import i Tripletex.

## Arkitektur

```
frontend (Vercel)  →  backend (Render)  →  Supabase (PostgreSQL)
React + Vite          FastAPI + Python
```

## Kom i gang

### 1. Supabase

1. Logg inn på [supabase.com](https://supabase.com) og åpne prosjektet ditt
2. Gå til **SQL Editor**
3. Kjør innholdet i `supabase_setup.sql`
4. Gå til **Settings → API** og noter deg:
   - **Project URL** (f.eks. `https://abcxyz.supabase.co`)
   - **service_role** key (under "Project API keys") -- ikke `anon`, men `service_role`

---

### 2. Backend på Render

1. Push dette repoet til GitHub
2. Logg inn på [render.com](https://render.com)
3. Klikk **New → Web Service**
4. Koble til GitHub-repoet
5. Fyll inn:
   - **Root directory**: `backend`
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Runtime**: Python 3
6. Under **Environment Variables**, legg til:
   ```
   SUPABASE_URL=https://ditt-prosjekt.supabase.co
   SUPABASE_SERVICE_KEY=din-service-role-key
   ALLOWED_ORIGINS=http://localhost:5173,https://din-app.vercel.app
   ```
7. Klikk **Create Web Service**
8. Når deploy er ferdig, noter deg URL-en (f.eks. `https://shiftsync-backend.onrender.com`)

> **NB:** Render gratis tier spinner ned etter 15 min inaktivitet. Første request tar ~30 sek.
> Oppgrader til Starter ($7/mnd) for å unngå dette.

---

### 3. Frontend på Vercel

1. Logg inn på [vercel.com](https://vercel.com)
2. Klikk **Add New → Project**
3. Importer GitHub-repoet
4. Fyll inn:
   - **Root directory**: `frontend`
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
5. Under **Environment Variables**, legg til:
   ```
   VITE_API_URL=https://shiftsync-backend.onrender.com
   ```
6. Klikk **Deploy**

---

### 4. Oppdater CORS på Render

Når du har Vercel-URL-en (f.eks. `https://shiftsync.vercel.app`), gå tilbake til Render og oppdater:
```
ALLOWED_ORIGINS=https://shiftsync.vercel.app
```

---

## Lokal utvikling

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # fyll inn Supabase-verdier
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env.local  # sett VITE_API_URL=http://localhost:8000
npm run dev
```

API docs tilgjengelig på `http://localhost:8000/docs` når backend kjører.

---

## Arbeidsflyt i appen

| Steg | Handling | Frekvens |
|------|----------|----------|
| 1 | Last opp employer-fil (Lønnstakernr-mapping) | Én gang / ved endringer |
| 2 | Velg Quinyx-eksport + ansatttype (sjåfør/lager) | Hver lønnskjøring |
| 3 | Aggreger timer (parser ∑-rader i Quinyx-filen) | Hver lønnskjøring |
| 4 | Forhåndsvis lønnslinjer | Hver lønnskjøring |
| 5 | Last ned CSV for Tripletex | Hver lønnskjøring |

**Lønnstype-mapping** (Quinyx-kode → Tripletex lønnsart + sats) administreres på `/mappings`.

---

## Employer-filformat

Forventet Excel/CSV-struktur (data starter fra **rad 3**):

| Kol A | **Kol B** | Kol C | Kol D | Kol E | **Kol F** | **Kol G** |
|-------|-----------|-------|-------|-------|-----------|-----------|
| ...   | Lønnstakernr | ... | ... | ... | Fornavn | Etternavn |

---

## Quinyx-filformat

Standard Quinyx lønnseksport (.xlsx). Header på rad 2. Appen leter etter rader der
`Salary type`-kolonnen starter med `∑ ` (sigma = summeringsrader per ansatt).

Påkrevde kolonner: `Full name`, `Salary type`, `Amount`

---

## CSV-output (Tripletex-format)

Semikolon-separert, UTF-8:
```
Lønnstakernr;Lønnsart;Antall;Sats;Fradato;Tildato;Kommentar
12345;1234;37,50;250,00;01/04/2026;15/04/2026;
```
