# TeslaMate Dash — Android companion app

A tiny self-hosted Android wrapper around your TeslaMate Dash web UI. It opens the dashboard
in a **fullscreen WebView** — no browser chrome, no URL bar, no three-dot menu — on any phone,
regardless of which browser (if any) is installed.

## Features

- **First-run setup.** The first time you open the app it asks for:
  - **Address** — where your Dash instance lives (e.g. `https://dash.example.com` or `http://192.168.1.10:4002`).
    Required. `https://` is added automatically if you omit the scheme; plain HTTP is allowed
    for LAN deployments.
  - **Login / Password** — optional HTTP Basic Auth credentials. **Leave them empty if your
    server has auth disabled (the default)**; they are only sent when the server actually asks
    for Basic Auth.
- **Fullscreen.** System bars are hidden; swipe from the edge to reveal them briefly.
- **Back button = back** in the dashboard's navigation history.
- **External links** (anything outside your configured host) open in the default browser.
- **Error page** with a Retry link if the server is unreachable.
- **No telemetry, no permissions** beyond `INTERNET`.

To change the settings later: Android Settings → Apps → *Tesla Mate Dash* → *Clear data*,
then relaunch — the setup screen appears again.

## Building the APK

Requirements: **JDK 17** and an **Android SDK** (compileSdk 36, build-tools 36.x, platform
android-36). The Gradle wrapper (8.11.1) downloads everything else.

```bash
# 1. (recommended) create a signing keystore — the same keystore is needed for every update:
keytool -genkey -v -keystore mydash.keystore -alias mydash -keyalg RSA -keysize 2048 -validity 10000

# 2. create keystore.properties (see keystore.properties.example):
#    storeFile=.../mydash.keystore
#    storePassword=...
#    keyAlias=mydash
#    keyPassword=...

# 3. build
export JAVA_HOME=/path/to/jdk17          # Windows: set to your JDK 17 home
export ANDROID_HOME=/path/to/android-sdk # or create local.properties with sdk.dir=...
./gradlew assembleRelease

# 4. APK output:
#    app/build/outputs/apk/release/app-release.apk
```

If `keystore.properties` is missing the release APK is built **unsigned** — fine for a quick
sideload, but you must sign it (with the *same* keystore) to install updates over an existing
install.

## Server-side auth (optional)

Dash's access protection is **disabled by default**. To enable it, set `TC_AUTH_USER` and
`TC_AUTH_PASS` on the server; the first successful Basic Auth exchange sets a persistent
session cookie (HMAC-signed with `TC_AUTH_SECRET`), so the app is only asked for credentials
once per server. The app sends the saved credentials automatically; if they are wrong or
missing, it shows a manual login dialog.

## Files

| File | Role |
|---|---|
| `app/src/main/java/pro/netcraze/tmdash/SetupActivity.java` | First-run setup form (address / login / password) |
| `app/src/main/java/pro/netcraze/tmdash/MainActivity.java` | Fullscreen WebView, auth forwarding, error page |
| `app/build.gradle` | Build config; optional signing via `keystore.properties` |
| `keystore.properties.example` | Template for signing config |
