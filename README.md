# Solo Project 3 — Production Collection Manager (MySQL)

This project is a production-ready Collection Manager:
- Full CRUD backed by **MySQL**
- Images (image URL per record + placeholder fallback)
- Search + filter (title search + genre filter)
- Sorting
- Paging + page size selector
- Page size stored in a **cookie** and restored on reload
- Stats view (total records, current page size, avg rating, top genre)

---

## 1) Local Setup (MySQL)

### A) Create a MySQL database + user
Open MySQL and run:

```sql
CREATE DATABASE collection_manager;
CREATE USER 'cm_user'@'localhost' IDENTIFIED BY 'cm_password';
GRANT ALL PRIVILEGES ON collection_manager.* TO 'cm_user'@'localhost';
FLUSH PRIVILEGES;
```

### B) Create `.env` (do NOT commit)
In `backend/`, copy `.env.example` to `.env` and fill in your connection string:

```
DATABASE_URL=mysql+pymysql://cm_user:cm_password@localhost:3306/collection_manager
PORT=5000
```

### C) Install + run backend
From `backend/`:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate

pip install -r requirements.txt

# Mac/Linux:
export DATABASE_URL="mysql+pymysql://cm_user:cm_password@localhost:3306/collection_manager"
export PORT=5000

python app.py
```

Backend will auto-create tables and auto-seed 30 records if the DB is empty.

### D) Run frontend
Open `frontend/index.html` in your browser OR serve it:

```bash
cd frontend
python -m http.server 5500
```

Then visit `http://localhost:5500`

---

## 2) Deployment Notes (what you must do for the assignment)

You must:
1. Deploy your backend and make it publicly accessible via HTTPS
2. Use a real MySQL database provided by your hosting platform
3. Set `DATABASE_URL` as an environment variable on the host (never commit secrets)
4. Point your custom domain to your deployed app (and enable HTTPS)

Your hosting provider decides how you set env vars + connect to MySQL, but the app expects:

```
DATABASE_URL=mysql+pymysql://USER:PASSWORD@HOST:3306/DBNAME
```

If your MySQL provider requires SSL, you will typically still use the same URL and configure SSL via the provider settings.

---

## 3) API Endpoints

- `GET /api/movies` (supports paging/filtering/sorting)
  - query params: `page`, `pageSize`, `q`, `genre`, `sort`, `dir`
- `POST /api/movies`
- `GET /api/movies/<id>`
- `PUT /api/movies/<id>`
- `DELETE /api/movies/<id>`
- `GET /api/stats?pageSize=10`
- `GET /health`

---

## 4) Production run command

This project includes a Procfile:

```
web: gunicorn app:app
```
