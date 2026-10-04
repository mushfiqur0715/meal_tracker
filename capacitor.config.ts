import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mealtrack.app',
  appName: 'MealTrack',
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
};

export default config;
