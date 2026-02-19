Domain name: alexlake.xyz
Registrar: Porkbun
Frontend hosting provider: netlify
Backend hosting provider: render

Tech Stack:
Frontend:
-HTML
-CSS
-JS
Backend:
-Python
-Flask

Database:
PostgreSQL
Render Postgres

Deploy:
Push code to GitHub
Netlify connects to repo and deploys frontend.
Render connects to repo and deploys the backend.
DATABASE_URL environment variable is configured in Render.

Update:
Push new code to GitHub
Netlify and Render auto redeploy the frontend and backend
(note: if the backend has gone idle for too long, render may need to be manually redeployed)

env vars are configured in the hosting provider
