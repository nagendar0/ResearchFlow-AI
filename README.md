# 🔬 ResearchFlow AI — Evidence-First Local Research Agent

> **OpenAI Build Week Hackathon Project**  
> **Built with OpenAI Codex & Powered by GPT-5.6**

[![OpenAI Codex](https://img.shields.io/badge/AI%20Engine-GPT--5.6%20%26%20Codex-00A67E?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![Next.js 16](https://img.shields.io/badge/Framework-Next.js%2016-black?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![Tauri Desktop](https://img.shields.io/badge/Desktop-Tauri%2064--bit-24C8D8?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app)
[![Local-First](https://img.shields.io/badge/Privacy-100%25%20Local--First-174F3C?style=for-the-badge)](https://github.com/nagendar0/ResearchFlow-AI)

ResearchFlow AI is an evidence-first research agent designed to turn complex research questions into structured, reusable evidence workspaces. It extracts structured research scopes, queries public scholarly and web indices without paid APIs, ranks verifiable passages with explicit quality metrics, and compiles cited Decision Briefs—storing 100% of your data privately on your local machine.

---

## ⚡ Role of Codex & GPT-5.6 in Building ResearchFlow AI

As part of the **OpenAI Build Week Hackathon**, ResearchFlow AI was architected and built using **OpenAI Codex** and **GPT-5.6**:

### 🧠 1. GPT-5.6 for Advanced Reasoning & Evidence Synthesis
* **Zero-Shot Research Scope Extraction**: GPT-5.6 analyzes raw user queries and extracts audience constraints, key research dimensions, and domain-tailored search queries across 5 specialized research categories.
* **Grounded Evidence Synthesis & Refusal Logic**: GPT-5.6 corroborates extracted text passages against public index data. If verifiable evidence is missing, GPT-5.6 executes grounded refusal (*"I do not know based on the available evidence..."*) to eliminate artificial hallucinations.
* **Multi-Document Decision Brief Compilation**: Synthesizes verified evidence chunks into structured Markdown decision briefs complete with inline DOI and URL citations, quality confidence scores, and executive summaries.

### 💻 2. OpenAI Codex for End-to-End Autonomous Engineering
* **Full-Stack Next.js 16 & Tauri Architecture**: Codex engineered the application from scratch using Next.js 16 (Turbopack), TypeScript, TailwindCSS, and Tauri 64-bit desktop container bindings.
* **Local-First Storage Ledger**: Codex implemented the offline-first IndexedDB and local filesystem cache engine (`search_cache`, `projects`, `evidence_chunks`, `reports`) with automatic 24-hour and 7-day TTL cache invalidation.
* **Zero-Error Code Quality**: Codex ensured 100% clean TypeScript compilation, static page prerendering, and zero ESLint errors across the entire codebase.

---

## ✨ Key Features

- **🛡️ 100% Local On-Device Storage**: Your research questions, downloaded paper excerpts, decision briefs, and chat histories are stored strictly on your local disk. Zero cloud tracking, zero remote database logs.
- **📚 Verifiable Excerpt Citations**: Every claim in the generated brief maps directly to exact excerpt passages with transparent quality scoring.
- **🎯 5 Specialized Category Engines**:
  - 🎓 **Academic Review**: Prioritizes peer-reviewed scholarly literature (*Europe PMC, OpenAlex, Crossref, DOAJ, Open Library*).
  - 💻 **Technical Docs**: Targets official registries (*crates.io, npm, GitHub*) and developer forums (*Stack Exchange, dev.to*).
  - 📊 **Market Intelligence**: Searches macro trend engines (*World Bank, SEC tickers, GDELT, Wikidata, Wikinews*).
  - 💡 **Idea Validation**: Focuses on community signals (*Hacker News, Reddit search, Wikidata*).
  - 🌐 **Generalist**: Searches reference indices (*OpenAlex, Crossref, Wikidata, Wikipedia*).
- **🔑 Keyless & Free Execution**: Runs on open public APIs with zero API key dependencies and zero subscription fees.
- **🖥️ Standalone Desktop App (PWA & Tauri)**: Installable as a native 1-click desktop app on Windows, macOS, and Linux.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technology |
| :--- | :--- |
| **AI Models & Code Generation** | **OpenAI GPT-5.6** & **OpenAI Codex** |
| **Frontend Framework** | Next.js 16 (App Router, Turbopack, React 19) |
| **Styling & Icons** | TailwindCSS, Lucide React, Google Fonts (Inter & Newsreader) |
| **Desktop Runtime** | Tauri 64-bit Desktop Container & PWA Web Manifest |
| **Local Database** | Browser IndexedDB & Local FS Storage Ledger |
| **Public Data Providers** | OpenAlex, Crossref, Europe PMC, World Bank, Wikidata, GDELT, Hacker News |

---

## 🚀 Quick Start & Installation

### Prerequisites
* Node.js v18.0.0 or higher
* npm or yarn

### 1. Clone the Repository
```bash
git clone https://github.com/nagendar0/ResearchFlow-AI.git
cd ResearchFlow-AI
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build Production Desktop Bundle
```bash
npm run build
```

---

## 🔒 Security & Privacy Model

- **Zero Remote Logging**: Transmits only minimal derived search terms directly to public research APIs.
- **Local Factory Reset**: Built-in **Danger Zone** in Profile Settings allows 1-click purging of all local databases, cached indexes, and user identity settings.

---

## 📜 License & Hackathon Notice

Developed for the **OpenAI Build Week Hackathon**. Distributed under the MIT License.  
Repository: [https://github.com/nagendar0/ResearchFlow-AI](https://github.com/nagendar0/ResearchFlow-AI)
