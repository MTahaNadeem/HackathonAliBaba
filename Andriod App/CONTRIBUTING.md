# Contributing to DustZero

## Version Bump Workflow

Before building a release APK, it is important to correctly update the application version to ensure users receive the update properly.

We use **Semantic Versioning** for `versionName` and incremental +1 for `versionCode`.

1. Open `app/build.gradle.kts`.
2. Locate the `defaultConfig` block:
   ```kotlin
   defaultConfig {
       // ...
       versionCode = 1
       versionName = "2.1.3"
   }
   ```
3. **Bump `versionCode`**: Add exactly `+1` to the current `versionCode`. This is strictly required by the Google Play Store for every new upload.
4. **Update `versionName`**: Follow semantic versioning (`MAJOR.MINOR.PATCH`):
   - **MAJOR**: Incompatible API changes or massive UI overhauls (e.g., `2.1.3` -> `3.0.0`).
   - **MINOR**: New features added in a backwards compatible manner (e.g., `2.1.3` -> `2.2.0`).
   - **PATCH**: Backwards compatible bug fixes (e.g., `2.1.3` -> `2.1.4`).
5. The "Settings > About" screen in the app will automatically reflect this new version. Do not hardcode the version string anywhere in the Compose UI code.

*Note: This is a manual step for now. If CI/CD is added in the future, this process may be automated.*
