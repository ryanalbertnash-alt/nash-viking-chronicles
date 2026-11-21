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
10. Search a destination, or say “Hey Valhalla, navigate to Ottawa.” The route is a real road, with spoken turns, an ETA, and a reroute if you leave it. Say “Hey Valhalla, police” (or construction, crash, hazard, pothole, traffic, road closed, weather, camera) to mark the road for every player. Confirm with “still there” or “not there.” Reports pay gold and scout fame. The speed shows the usual Ontario limit for that kind of road. You cannot type a search while the car is moving.

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

## Host it for other phones

The game is one Node process. It serves the web app and the realtime websocket on the same port, so a host only needs to run that process.

The simplest free host is [Render](https://render.com). Make a Render account with GitHub, push this repo, and create a **Web Service**. Render reads `render.yaml`:

- Build: `npm install && npm run build`
- Start: `npm start`
- Health check: `/api/health`

The free instance sleeps after a stretch of no visitors, and the first open after that takes a minute. The shared world is a file on that machine. A free restart clears it. A paid disk keeps `server/data` if you want the saga to survive restarts.

The same image runs anywhere else that can start a container. `Dockerfile` builds the site and starts the server. Fly.io can run it too. That account asks for a credit card even on the small allowance.

```bash
docker build -t nash-viking-chronicles .
docker run -p 4477:4477 -e PORT=4477 nash-viking-chronicles
```

## Later, the App Store

This is a Vite single-page app with no server rendering, which is what Capacitor wraps. `capacitor.config.json` is already here. When you are ready:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npm run build
npx cap add ios
```

The socket uses the page host, so a wrapped app needs the game server reachable at a public URL (set the dev server URL in Capacitor's `server.url` while testing). Real Nash Points and the oath (first month free, then $10 a month or $120 a year) belong to Apple In-App Purchase in that build. This prototype does not take payment.

## Map and roads

Terrain is OpenStreetMap. No API key. The dark grade is a filter on those tiles. Turn-by-turn routes come from the public Valhalla router at `valhalla1.openstreetmap.de`. The spoken line is Valhalla's own instruction. A posted speed is often missing from that data, so the warning uses the usual Ontario limit for the kind of road: 50 in town, 80 on a county road, 100 on a King's Highway. It is labelled **usual**, not a sign you passed. © OpenStreetMap contributors.

## Sound

Music beds are original. The 24 champions each have five spoken lines, made with eSpeak NG, and Grogs are pitched down. Battle hits, the chop, and the coins are Kenney's CC0 packs. Horns, drums, oars, and the roar were made for this game. Credits are in `public/audio/CREDITS.md`. Music ducks under any voice, and it sits lower while the car is moving.

## Art

Ryan's pictures are the art. Champions and hoard pieces are in `public/art/champions` and `public/art/items`. The wolves painting is the title and the Nash clan card. The four orc paintings are the Grog card, and they sit behind battles.
