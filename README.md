# ResearchFlow AI

An evidence-first research agent built with Next.js, React, TailwindCSS, and Tauri. It parses user research questions, gathers information from public search indexes, matches and ranks extracted passages, and compiles cited Markdown briefs, preserving all details on the local device.

---

## Getting Started

To run the Next.js development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the results.

To run the Tauri desktop container:

```bash
npm run tauri dev
```

---

## 🛠️ System Features & Policies

### 1. Supported Research Categories
ResearchFlow AI optimizes search queries and source priorities dynamically by category:
*   🔬 **Academic Review**: Prioritizes peer-reviewed scholarly literature (Europe PMC, OpenAlex, Crossref, DOAJ) with Open Library fallbacks.
*   💻 **Technical Docs**: Targets official package registries and repositories (crates.io, npm, GitHub) with developer forums (Stack Exchange, dev.to) as secondary fallbacks.
*   📊 **Market Intelligence**: Searches institutional statistical portals and macro trend engines (World Bank, SEC company tickers list, GDELT, Wikidata, Wikinews).
*   💡 **Idea Validation**: Focuses on community discussions, public launch records, and early user signals (Hacker News, Reddit search, Wikidata, Wikinews).
*   🌐 **Generalist**: Uses reference indices and public encyclopedias (OpenAlex, Crossref, Wikidata, Wikipedia, Open Library).

### 2. Grounded Evidence Policy
*   **Exact Excerpts**: Every citation in the generated brief maps directly to a real url and a verified text passage.
*   **Transparent Scoring**: Evidence chunks are evaluated using a strict mathematical ranking score based on source quality, keyword density, recency, category alignment, and duplicate penalties.
*   **Semantic Labeling**: Confidence metrics are represented using descriptive grounding classes:
    *   *High-quality evidence*
    *   *Supporting evidence*
    *   *Limited evidence*
    *   *Conflicting evidence*
    *   *No evidence found*
*   **Grounding Refusal**: If no high-confidence sources can be found, the engine refuses to speculate and outputs a grounded notice (*"I do not know based on the available evidence..."*).

### 3. Local-First Cache Behavior
*   Search results are stored in the local cache (`search_cache.json` under Tauri, or a browser IndexedDB `search_cache` store) to speed up workspace loads.
*   **24-Hour Expiry**: Community discussions and news sources (Reddit, Hacker News, GDELT, Stack Exchange, dev.to, Wikinews).
*   **7-Day Expiry**: Academic publications, package registries, corporate listings, and general reference material (Europe PMC, OpenAlex, Crossref, Wikidata, Wikipedia, GitHub, npm, crates.io).
*   **Bypass Action**: A manual **Refresh** action is available in the UI to bypass valid cache entries and trigger a fresh crawler execution.

### 4. Security & Privacy Model
*   **No Cloud Sync**: Save files, project details, reports, and search histories entirely on your laptop. No remote servers or cloud accounts are used.
*   **Keyless Execution**: Utilizes only open, free public APIs. No API keys or paid model subscriptions are required.
*   **Minimum Exposure**: Transmits only the minimal derived search keywords to public endpoints.

---

## ⚠️ Known Limitations
1.  **Browser CORS Blocks**: Running in a standard browser dev server may trigger CORS blocks on select public API endpoints (e.g. Europe PMC, crates.io). Running inside the Tauri desktop shell bypasses these limitations.
2.  **Product Hunt GraphQL Constraint**: Product Hunt search is limited due to OAuth token mandates.
3.  **Local Storage Volume**: Cleanups of old projects can be done via the context sidebar menus.
