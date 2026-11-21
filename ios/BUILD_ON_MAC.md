# Build Nash's Viking Chronicles on a Mac

The iPhone app is a Capacitor shell around the built website. The game server stays at `https://nash-viking-chronicles.onrender.com`. Change the bundle id in one place: `BUNDLE_ID` in `src/shared/app.ts`, then run `node scripts/apply-bundle-id.mjs` from the repo root.

You need a Mac with Xcode, and an Apple Developer account ($99 a year) before TestFlight or the App Store will accept a build. This Linux checkout can edit the project. It cannot compile the IPA.

## On the Mac mini

1. Install Xcode from the App Store, open it once, and let it install the extra tools.
2. Install Node 22. From the repo root:

```bash
npm ci
npm run build
node scripts/apply-bundle-id.mjs
npx cap sync ios
open ios/App/App.xcodeproj
```

3. In Xcode, select the App target, Signing & Capabilities. Choose your Team. Leave the bundle id as `com.nash.vikingchronicles` unless you changed `BUNDLE_ID`.
4. Plug in an iPhone, pick it as the run destination, and press Run. The phone must trust the developer certificate the first time (Settings, General, VPN & Device Management).
5. For a release build without the GitHub action: Product, Archive, then Distribute App, App Store Connect, Upload.

The first launch is portrait. The battle can turn sideways. Location, microphone, and speech prompts use the strings in `ios/App/App/Info.plist`.

## TestFlight from GitHub

The workflow is `.github/workflows/ios-testflight.yml`. It runs on a push of a `v*` tag, or when you start it by hand from the Actions tab. It is skipped until these repository secrets exist.

Required:

| Secret | What it is |
| --- | --- |
| `ASC_KEY_ID` | App Store Connect API key id, 10 characters |
| `ASC_ISSUER_ID` | The issuer UUID on the same keys page |
| `ASC_KEY_P8` | The downloaded `.p8` file, base64-encoded (`base64 -i AuthKey_XXXX.p8`) |
| `APPLE_TEAM_ID` | The 10-character Team ID from developer.apple.com/account |

The API key needs Admin access, or App Manager plus access to certificates, so fastlane can make a distribution certificate and a TestFlight profile. Create the key in App Store Connect, Users and Access, Integrations, App Store Connect API.

Optional, if you would rather sign with fastlane match than with a certificate fastlane creates on the runner:

| Secret | What it is |
| --- | --- |
| `MATCH_GIT_URL` | Private git repo where match stores certificates |
| `MATCH_PASSWORD` | The passphrase for that match repo |

If `MATCH_GIT_URL` is empty, the lane uses automatic signing: `cert` and `sigh` with the API key, then an App Store export.

## Apple steps that are not in git

1. Enroll in the Apple Developer Program.
2. In App Store Connect, create the app with the bundle id and the name Nash's Viking Chronicles. The workflow uploads a build. It does not submit the listing for review.
3. Create the consumable in-app products, exactly these ids: `com.nash.vikingchronicles.points.500`, `points.1000`, `points.2800`, `points.5000`, and `points.13500`. Suggested US prices, in the Fortnite V-Bucks range: $4.99, $8.99, $22.99, $36.99, $89.99. Attach a review screenshot of the shop. The website shop stays a free placeholder.
4. Set the privacy policy URL to `https://nash-viking-chronicles.onrender.com/privacy` and the support URL to `https://nash-viking-chronicles.onrender.com/support`.
5. After TestFlight processes the build, add yourself as an internal tester. External testers need a short Beta App Review.
6. Fill the App Store listing from `store/listing.md`, then submit that build for review.
