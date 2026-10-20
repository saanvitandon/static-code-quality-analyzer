# Static Code Quality Analyzer (SCQA)

A standalone JavaScript React + TanStack Start application for reviewing C/C++ source code, highlighting code-quality concerns, and prioritizing functions for review.

## Requirements

- Node.js 22 LTS (or a Node version supported by the current Vite/TanStack dependencies)
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Verify before deployment

```bash
npm run test
npm run build
```

## Deploy to Render

1. Push this repository to GitHub.
2. In Render, choose **New → Web Service** and connect the repository.
3. Choose the Node runtime.
4. Set **Build Command** to `npm install && npm run build`.
5. Set **Start Command** to `npm run start`.
6. Deploy and open the public URL shown by Render.
7. After every change, push a commit to GitHub; Render can redeploy from the connected branch.

The app currently analyzes source code in the browser using its bundled JavaScript analysis module. This means no uploaded source is sent to a backend by the current implementation. A server-side Python/FastAPI analysis service, persistent scan history, and isolated Clang/Cppcheck execution are not included in this repository yet.

## Project structure

- `src/routes/` — TanStack Start pages
- `src/components/` — dashboard and graph components
- `src/lib/analyzer.js` — current JavaScript analysis rules and scoring
- `src/lib/samples.js` — sample C/C++ source files
- `src/styles.css` — application styling

## Notes

- The project uses JavaScript (`.js` and `.jsx`), not TypeScript.
- Do not commit `.env` files, API secrets, or uploaded source files.
- This is a heuristic static analyzer, not a replacement for a compiler, security scanner, or a full Clang-based analysis pipeline.
