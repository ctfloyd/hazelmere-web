# Hazelmere - RuneScape Hiscore Tracker

A modern web application for tracking RuneScape hiscore snapshots over time, built with React, TypeScript, and Tailwind CSS.

## Features

- 📊 **Interactive Charts**: Beautiful visualizations using Recharts
- 🌙 **Dark Mode**: Primarily themed for dark mode experience
- 🎯 **Skill Tracking**: Monitor skill progression with detailed graphs
- ⚔️ **Boss Analytics**: Track boss kill counts and performance
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Built with shadcn/ui components

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Routing**: React Router
- **Build Tool**: Vite
- **Icons**: Lucide React

## API Integration

This application is designed to work with the [Hazelmere API](../hazelmere-api) which provides:

- Hiscore snapshot storage and retrieval
- User management
- Data aggregation endpoints

### Key API Types

The application includes TypeScript types that mirror the API structure:

```typescript
interface HiscoreSnapshot {
  id: string;
  userId: string;
  timestamp: string;
  skills: SkillSnapshot[];
  bosses: BossSnapshot[];
  activities: ActivitySnapshot[];
}
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── charts/          # Chart components (Recharts)
│   ├── layout/          # Layout components (Sidebar, etc.)
│   └── ui/              # shadcn/ui components
├── lib/
│   ├── api.ts           # API client
│   └── utils.ts         # Utility functions
├── pages/               # Route pages
│   ├── Dashboard.tsx
│   ├── Skills.tsx
│   └── Bosses.tsx
├── types/
│   └── api.ts           # TypeScript type definitions
└── App.tsx              # Main application component
```

## Features Overview

### Dashboard
- Overview of player statistics
- Recent activity tracking
- Key metrics display

### Skills Page  
- Individual skill progress charts
- Toggle between experience and level tracking
- Skill statistics and rankings

### Bosses Page
- Boss kill count tracking
- Categorized boss selection (Raids, God Wars, etc.)
- Kill count progression charts

## API Configuration

The application is pre-configured to connect to `https://api.hazelmere.xyz`. 

### Setting up the API

To use this application with real data, you'll need:

1. **Running Hazelmere API**: Deploy or run the [Hazelmere API](https://github.com/ctfloyd/hazelmere-api)
2. **Create Snapshots**: Use the API to create hiscore snapshots for users
3. **User IDs**: Get valid user IDs (UUIDs) to query data

### API Endpoints Used

- `GET /v1/snapshot/{userId}` - Get all snapshots for a user
- `GET /v1/snapshot/{userId}/nearest/{timestamp}` - Get snapshot nearest to timestamp  
- `POST /v1/snapshot` - Create new snapshot

### Local Development

To use a local API instance, update `src/lib/api.ts`:

```typescript
const API_BASE_URL = 'http://localhost:8080'; // Your local API URL
```

### Testing Without API

The application gracefully handles API unavailability by:
- Showing API status indicator
- Displaying helpful error messages  
- Providing fallback UI states
- Offering retry functionality

## Contributing

This is a personal project for RuneScape hiscore tracking. Feel free to fork and modify for your own use.

## License

MIT
