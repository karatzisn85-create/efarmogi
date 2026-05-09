# ERGOHUB

Πληροφοριακό Σύστημα Διαχείρισης Έργων & Προμηθειών

## Απαιτήσεις

- Node.js 18+
- npm 9+
- Windows 10/11

## Εγκατάσταση

```bash
npm install
```

## Εκτέλεση (Development)

```bash
npm start
```

Ανοίγει την εφαρμογή σε Electron χρησιμοποιώντας το υπάρχον build.

## Build

```bash
npm run build
```

Δημιουργεί optimized production build στον φάκελο `build/`.

## Build & Upload (Production)

```bash
npm run build:upload
```

Κάνει build, δημιουργεί NSIS installer, και ανεβάζει στο Dropbox.

## Δομή Φακέλων

- `src/` — React components και UI
- `public/` — Electron main process, preload, config
- `scripts/` — Build scripts, Dropbox upload
- `dist/` — Output εγκαταστάτη (μετά από build)

## Ρόλοι Χρηστών

| Ρόλος | Δικαιώματα |
|-------|-----------|
| SUPERADMIN | Πλήρης πρόσβαση, διαχείριση χρηστών, backups |
| ADMIN | Επεξεργασία έργων, εντάξεων, εγκρίσεων |
| USER | Ανάγνωση μόνο |

## Άδεια

Ιδιωτική χρήση
