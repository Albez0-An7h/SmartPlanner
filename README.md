# Smart Planner

A modern React application that integrates with Google Calendar and uses Gemini AI to help generate optimized daily schedules.

## Features

- Google Calendar integration to view and manage your events
- AI-powered schedule generation based on your tasks and existing calendar events
- Priority-based task management
- Automatic calendar updates with generated schedules
- Clean, responsive UI using Tailwind CSS

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- Google Cloud Platform account with Calendar API enabled
- Gemini API key

## Installation

1. Clone the repository:
```bash
git clone (https://github.com/Albez0-An7h/SmartPlanner.git
cd SmartPlanner
```

2. Install dependencies:
```bash
npm install
```

## Dependencies

### Core Dependencies
- React v19: `react`, `react-dom`
- TypeScript: `typescript`
- Vite: Build tool and development server
- Tailwind CSS: Utility-first CSS framework
- Google Generative AI: For AI-powered schedule generation
- Google API Client: For Calendar integration

### Full Dependencies List

```json
"dependencies": {
  "@google/generative-ai": "^0.24.0",
  "@react-oauth/google": "^0.12.1",
  "@tailwindcss/vite": "^4.1.1",
  "axios": "^1.8.4",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "react-icons": "^5.5.0",
  "tailwindcss": "^4.1.1"
},
"devDependencies": {
  "@eslint/js": "^9.21.0",
  "@types/node": "^22.14.0",
  "@types/react": "^19.0.10",
  "@types/react-dom": "^19.0.4",
  "@vitejs/plugin-react": "^4.3.4",
  "eslint": "^9.21.0",
  "eslint-plugin-react-hooks": "^5.1.0",
  "eslint-plugin-react-refresh": "^0.4.19",
  "globals": "^15.15.0",
  "typescript": "~5.7.2",
  "typescript-eslint": "^8.24.1",
  "vite": "^6.2.0"
}
```

## Configuration

1. Create a `.env` file in the root directory of your project:
```env
VITE_GEMINI_API_KEY='your-gemini-api-key'
VITE_GOOGLE_CLIENT_ID='your_google_client_ID'
VITE_GOOGLE_API_KEY='your_google_API_key'

```

2. Set up Google Calendar API credentials:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google Calendar API
   - Create OAuth 2.0 credentials
   - Add authorized JavaScript origins for your development environment (e.g., `http://localhost:5173`)
   - Update the `CLIENT_ID` in the `CalanderData.tsx` file with your OAuth client ID

## Development

Start the development server:
```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

## Building for Production

```bash
npm run build
```

## How to Use

1. Sign in with your Google account to access your calendar
2. View your existing calendar events
3. Set your wake-up and sleep times
4. Add tasks you want to schedule
5. Generate an optimized schedule based on your preferences
6. Add the generated schedule to your Google Calendar

## Technologies Used

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Google Calendar API
- Gemini AI API
- React Icons

### Favicon from - <a href="https://www.freepik.com/free-psd/3d-rendering-ui-icon_20546687.htm">Image by freepik</a>
