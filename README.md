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
2. Swear to the **Nash clan** or the **Grogs**. The phone finds your real town in Canada or the United States, or you search for it. A longhouse and a few warriors start there. That hall is your one home. It can move once a month. Anyone can see it on the map.
3. Vikings begin with Ryan Nash. Grogs begin with Gorgrath Skullsplitter. The rest of the champions are in the towns.
4. **Saga drive** follows real roads (County Road 31, the Winchester loop, Glengarry, Highway 2, the ride to Ottawa) faster than the speedometer, so you can play at a desk. Or switch to this phone's GPS.
5. **Longhouse** play works from the couch. Build, train, shop, and the saga board do not need GPS. From the map, send a war band, a longship, or a raven. The march is timed by distance. If location is denied, the map centers on your hall (Chesterville if you picked it). **Adventure** starts when the car is moving: the game speaks ambushes, beasts, treasure, rival bands, and mead halls, and the loot comes home. Driving to a town in person pays double. The war is the game. Raise a hall, forge, walls, and a dock. The hall grows the infantry and the heroes, the forge unlocks archers and crafts axes, bows, and mail, the walls become towers in a siege, and the dock unlocks cavalry and the longship. Muster the mix you want: infantry beats cavalry, cavalry beats archers, archers beat infantry, and a monster breaks a shield wall. Drive to a town to recruit its champion, claim it, or besiege the fort that holds it. Towns change hands between the Nash clan and the Grogs. Parked, the battle plays blow by blow. While the wheels turn, it resolves itself and is spoken.
6. Say **Hey Valhalla**, then a command: attack, recruit, claim town, status, heal, raid, build the hall, ride on, pull over. In Chrome this can listen hands-free. Safari on iPhone often cannot hear; speech *out* still works, and Passenger Mode opens the buttons.
7. Above 10 km/h the tap menus lock. That is on purpose. Ontario does not allow a driver to hold a phone. A passenger can flip **Passenger Mode**. Long-press the rune to pull over.
8. Parked, a fight shows each blow. While the wheels turn, you only get the spoken report.
9. The game is free. Skins, weapons, draughts, the Battle Pass, and Nash Points are optional extras. Nobody has to buy anything to claim a town, recruit, or fight. **This demo charges nothing.**
10. Search a destination, or say “Hey Valhalla, navigate to Ottawa.” The route is a real road, with spoken turns, an ETA, and a reroute if you leave it. Say “Hey Valhalla, police” (or construction, crash, hazard, pothole, traffic, road closed, weather, ice, fog, animal, camera). The warband hears an evil wizard, a fortress wall, a chariot wreck, a marching army, and the rest, and the small line under the icon always says what it really is. Gas stations are trading posts. Other drivers on the road are longships and rival warbands. Confirm with “still there” or “not there.” Reports pay gold and seer fame. The speed shows the usual Ontario limit for that kind of road. You cannot type a search while the car is moving.

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

The game is one Node process. `npm start` serves the built site and the realtime websocket on the same port (`PORT`, or 4477). There is no Vite dev server in that mode. Phones need the **https** address: location, the microphone, and the home-screen install all refuse a plain http link. The socket uses `wss` on that same host.

The free host that fits is [Render](https://render.com). The service sleeps after about 15 minutes with no visitors and wakes on the next open, which can take a minute. WebSockets work once it is awake. The saved world lives on that machine's disk and can disappear on a new deploy or a free-tier restart. `render.yaml` already points at the Dockerfile, which includes the narrator (`espeak-ng`). If the narrator is missing, the phone speaks the line itself.

This project is not on GitHub, and Render can only build from a Git host it can clone. The steps to put it there are at the end of this file.

Fly.io can run the same image with `fly.toml`, and a deploy token can upload this folder without GitHub. Fly asks for a credit card even when the bill stays at zero, so Render is the free path.

```bash
npm run build
npm start
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

The socket uses the page host, so a wrapped app needs the game server reachable at a public URL (set the dev server URL in Capacitor's `server.url` while testing). The game stays free. There is no subscription. Optional Nash Points, if they are ever sold, would go through Apple. This build does not take payment.

## Map and roads

Terrain is OpenStreetMap. No API key. The dark grade is a filter on those tiles. Turn-by-turn routes come from the public Valhalla router at `valhalla1.openstreetmap.de`. The spoken line is Valhalla's own instruction. A posted speed is often missing from that data, so the warning uses the usual Ontario limit for the kind of road: 50 in town, 80 on a county road, 100 on a King's Highway. It is labelled **usual**, not a sign you passed. © OpenStreetMap contributors.

## Sound

Music beds are original. The 24 champions each have five spoken lines, made with eSpeak NG, and Grogs are pitched down. Battle hits, the chop, and the coins are Kenney's CC0 packs. Horns, drums, oars, and the roar were made for this game. Credits are in `public/audio/CREDITS.md`. Music ducks under any voice, and it sits lower while the car is moving.

## Art

Ryan's pictures are the art. Champions and hoard pieces are in `public/art/champions` and `public/art/items`. The wolves painting is the title and the Nash clan card. The four orc paintings are the Grog card, and they sit behind battles.

## Put it on Render

1. Open [github.com/new](https://github.com/new). Name the repository `nash-viking-chronicles`. Leave it empty: no README, no license. Create it.
2. In this project, add that repository and push `main` (replace `YOURNAME`):

```bash
git remote add github https://github.com/YOURNAME/nash-viking-chronicles.git
git push -u github main
```

3. Open [dashboard.render.com](https://dashboard.render.com) and sign up. The Google or GitHub button is enough. No credit card.
4. Click **New** → **Blueprint**. Connect the GitHub repository from step 1. Render reads `render.yaml` and creates the free web service. Click **Apply**.
5. Wait until the deploy is **Live**. Open the URL Render shows, ending in `.onrender.com`. That is the address to bookmark and to share. Two phones on that address share one map.

The first open after a quiet stretch takes about a minute while the free instance wakes. After that, play is immediate.

If you would rather not use GitHub, Fly.io can upload this folder with a token. That account asks for a credit card.

1. Sign up at [fly.io/app/sign-up](https://fly.io/app/sign-up).
2. Open [fly.io/user/personal_access_tokens](https://fly.io/user/personal_access_tokens) and create a token named `deploy`. Copy it.
3. On a machine that has this project:

```bash
curl -L https://fly.io/install.sh | sh
export FLY_API_TOKEN='paste-the-token'
fly launch --copy-config --yes
```

`fly.toml` is already filled in. The command prints an `https://….fly.dev` address.
