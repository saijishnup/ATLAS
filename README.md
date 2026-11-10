<p align="center">
  <img src="assets/atlas-nav-icon.svg" alt="ATLAS" width="180" />
</p>

# ATLAS

<p align="center"><em>Automotive Technical Lifecycle Analysis System</em></p>

<p align="center">
  <a href="#run-locally"><img src="https://img.shields.io/badge/python-3.11%2B-152935?style=flat-square&labelColor=f8fafc" alt="Python 3.11+" /></a>
  <a href="#run-locally"><img src="https://img.shields.io/badge/react-vite-698ea2?style=flat-square&labelColor=f8fafc" alt="React and Vite" /></a>
  <a href="#features"><img src="https://img.shields.io/badge/knowledge%20base-61%20cards-25062b?style=flat-square&labelColor=f8fafc" alt="61 knowledge cards" /></a>
  <a href="https://github.com/saijishnup/ATLAS/actions"><img src="https://img.shields.io/badge/status-demo-2f9e5b?style=flat-square&labelColor=f8fafc" alt="Demo status" /></a>
</p>

---

ATLAS is an agentic requirements-analysis workspace for automotive software
projects. It gathers clarification answers, drafts traceable requirements
from a curated knowledge base, checks quality and compliance signals, and
recommends an SDLC model with deterministic scoring.

## Stack

FastAPI · SQLite · Chroma · React · Vite · TypeScript · Tailwind · pytest

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python -m uvicorn backend.main:app --reload
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

For a no-key UI/demo run, use:

```powershell
python -m tests.dev_fake_server
```

## Features

- Guided intake and clarification
- Citation-backed requirement drafting
- Human accept, edit, and reject workflow
- Deterministic SDLC fit scoring with explanations
- JSON, Markdown, and PDF-friendly exports
- Project-file import and browser recovery copy

## Notes

Configure an OpenAI-compatible provider in `.env`; never commit real keys.
Outputs are drafts for human review, not compliance advice. Standards are
represented by own-words summaries rather than redistributed documents.
