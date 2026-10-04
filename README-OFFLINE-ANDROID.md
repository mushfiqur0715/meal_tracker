# MealTrack — Offline Android version

This version removes the PostgreSQL/server dependency. Meal records, price history, monthly payments, settings, and backups are stored locally on the device using localStorage.

## Build an APK

Requirements: Node.js, Java 21+, Android Studio/Android SDK.

```bash
npm install
npm run cap:add:android
npm run android:build
```

The debug APK will be at:

`android/app/build/outputs/apk/debug/app-debug.apk`

To open the Android project in Android Studio:

```bash
npm run build
npx cap sync android
npx cap open android
```

## Important

- No PostgreSQL database is required.
- No internet is required after the app has been installed.
- Data is stored on the phone/browser storage. Clearing the app's storage can erase it.
- Use the app's Backup/Export feature regularly if the data matters.
