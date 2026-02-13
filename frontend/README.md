# Circle for Life — Mobile Frontend

React Native (Expo) app for the Circle for Life gamified AI social platform.

## Setup

```bash
cd circle-for-life/frontend
npm install
```

## Run

```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
```

## Environment

Create `.env` or set `EXPO_PUBLIC_API_URL` for the API base URL. Default: `https://api.circleforlife.app/v1`.

## Project Structure

```
src/
├── config/        # API client, env
├── store/         # Zustand (auth, gems)
├── hooks/         # React Query (feed, generation)
├── screens/       # Feed, Create, Profile
├── components/    # PostCard, GemBadge, VoteButton
├── navigation/    # Bottom tabs + stack
├── services/      # On-device AI (placeholder)
└── utils/         # Sharing, helpers
```

## Assets

Replace placeholder assets in `assets/` with your app icon, splash, and favicon. Recommended sizes: icon 1024×1024, splash 1284×2778.
