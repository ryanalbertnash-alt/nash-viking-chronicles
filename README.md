# Nash's Viking Chronicles

A mobile-first strategy game by **Ryan Nash** of Chesterville, Ontario. The real road is the warboard. You drive the towns of Stormont, Dundas, Glengarry, and Ottawa, recruit the Nash clan or the Grogs, and fight other players for the ground.

Two phones on the same server share one map. Villages, held towns, and longships are visible to everyone.

## Play

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4477](http://127.0.0.1:4477). On a phone, use the computer's LAN address and the same port. Add it to the iPhone home screen with Share → Add to Home Screen.

1. Take a name. The hall shows a recovery word so you can sign in again on another phone.
2. Swear to the **Nash clan** or the **Grogs**. Start in Chesterville, Morrisburg, or Cornwall, or use this phone's GPS if you are already in the Seaway.
3. Vikings begin with Ryan Nash. Grogs begin with Gorgrath Skullsplitter. The rest of the champions are in the towns.
4. **Saga drive** follows real roads (County Road 31, the Winchester loop, Glengarry, Highway 2, the ride to Ottawa) faster than the speedometer, so you can play at a desk. Or switch to this phone's GPS.
5. Enter a town to claim it, recruit a champion of your faction, or attack the player who holds it. Raise a hall, forge, walls, and a longship dock.
6. Say **Hey Valhalla**, then a command: attack, recruit, claim town, status, heal, raid, build the hall, ride on, pull over. In Chrome this can listen hands-free. Safari on iPhone often cannot hear; speech *out* still works, and Passenger Mode opens the buttons.
7. Above 10 km/h the tap menus lock. That is on purpose. Ontario does not allow a driver to hold a phone. A passenger can flip **Passenger Mode**. Long-press the rune to pull over.
8. Parked, a fight shows each blow. While the wheels turn, you only get the spoken report.
9. The hoard sells skins, weapons, longships, and draughts for Nash Points. **Every purchase in this prototype is a demo. Nothing is charged.**

## Two players

Open the game twice. Use two names, two factions, and two start towns (Chesterville and Morrisburg is a good pair). Each hall shows on the other's map. Saga-drive toward a held town, or attack a hall when you are close. The saga board is the same for both.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Game and websocket server on port 4477 |
| `npm test` | Rules tests and a two-player socket test |
| `npm run build` | Typecheck and build the web app |
| `npm start` | Serve the built app (`NODE_ENV=production`) |

`PORT` changes the port. The saved world is `server/data/world.json`.

## Later, the App Store

This is a Vite single-page app with no server rendering, which is what Capacitor wraps. `capacitor.config.json` is already here. When you are ready:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npm run build
npx cap add ios
```

The socket uses the page host, so a wrapped app needs the game server reachable at a public URL (set the dev server URL in Capacitor's `server.url` while testing). Real Nash Points and the oath (first month free, then $10 a month or $120 a year) belong to Apple In-App Purchase in that build. This prototype does not take payment.

## Map and roads

Terrain is OpenStreetMap via CARTO dark tiles. No API key. Driving lines come from the public OSRM router. © OpenStreetMap contributors, © CARTO.

## Art

Every Nash champion, every Grog, and all 27 hoard pieces have original illustrations in `public/art`. The uploaded portrait files were not present on the build machine, so these drawings stand in for them.
