# Knowledge Vault — Upgraded

This repo contains the Knowledge Vault PWA: a local-first notes app with attachments, PDF viewer, trash, export/import, folders, tags, and optional realtime sync.

## Quick deploy
1. Put these files in the repository root: `index.html`, `style.css`, `script.js`, `manifest.json`, `sw.js`, `README.md`.
2. Push to GitHub. For username `xmanflo` the site will be at: `https://xmanflo.github.io/`.

## Enable Realtime (optional)
- To enable Firebase realtime:
  - Set `FIREBASE_ENABLED = true` in `script.js`.
  - Paste your Firebase config into the `firebaseConfig` object.
  - Ensure Firestore is enabled.
- To use Supabase, replace the Firebase placeholder with Supabase client and subscribe.

## Notes & next steps
- AI summaries are placeholders — I can wire OpenAI or other providers (requires server-side key).
- I can provide PNG icons if you'd like proper install icons.
- For richer PDF annotation (drag/highlight), I can integrate an annotation library.

If you want, I’ll:
- Wire Firebase realtime and set a basic security rule set for testing.
- Provide PNG icons (192px + 512px) and a favicon file.
- Add an optional serverless endpoint to handle AI summaries securely.
