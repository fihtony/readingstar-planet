# ReadingStar Planet

ReadingStar Planet is a Next.js reading support app designed for children who benefit from structured, low-friction reading assistance. It combines reading focus tools, text-to-speech support, document management, and role-based administration in a single web app.

## Features

- Guided reading modes with adjustable font size, line spacing, masking, and themed focus views
- Text-to-speech support with voice preview and reading companion controls
- PDF, TXT, and pasted-text import flows with preview and editing before saving
- Library management with document grouping, search, sorting, editing, and reading history
- Role-aware account management, profile editing, and admin-only global defaults
- English and Chinese UI support, plus PWA support for an app-like experience

## Screenshots

### Homepage
An inviting entry point into the ReadingStar planet adventure.

<img src="images/homepage.png" alt="Reading Star Planet Homepage" width="800" />

### Spotlight Reading
Keep the paragraph focused by highlighting a chosen character.

<img src="images/spotlight_reading.png" alt="Spotlight Reading Mode" width="800" />

### Letter Detective
Practice spotting letters that are easy to confuse.

<img src="images/letter_detective.png" alt="Letter Detective Game" width="500" />

## Tech Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- SQLite via better-sqlite3
- Vitest and Playwright for testing

## How To Run

### Requirements

- Node.js 22+
- npm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:3000.

### Production Build

```bash
npm run build
npm start
```

### Tests

```bash
npm test
```

For end-to-end coverage:

```bash
npm run test:e2e
```

## Environment Notes

- Google sign-in is optional and requires local environment variables such as `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`.
- The SQLite database is created locally under `data/` by default, or you can override the location with `READINGSTAR_DB_PATH`.
- You can seed an initial admin account with `INITIAL_ADMIN_EMAIL`.

## License

This project is licensed under the MIT License. See the LICENSE file for details.