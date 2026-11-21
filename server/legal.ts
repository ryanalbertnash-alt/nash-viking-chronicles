import { APP_NAME } from "../src/shared/app.ts"

const page = (title: string, body: string) => `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · ${APP_NAME}</title>
<style>
  body { margin: 0; background: #0c0a08; color: #f4ecdf; font: 18px/1.5 Palatino, Georgia, serif; }
  main { max-width: 40rem; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 2rem; line-height: 1.2; }
  a { color: #e2c07a; }
</style>
<main>
  <p><a href="/">${APP_NAME}</a></p>
  <h1>${title}</h1>
  ${body}
</main>
</html>`

export function privacyPage(): string {
  return page("Privacy", `
  <p>This game is free to play. Nash Points are optional and, on iPhone, are sold by Apple.</p>
  <h2>Location</h2>
  <p>If you allow it, the app reads your location while you use it, and can keep reading it in the background while you drive. That is how the map, the road reports, and Adventure Mode follow the real road. If you say no, the game still plays from your hall. You pick a town by searching.</p>
  <h2>Microphone and speech</h2>
  <p>If you allow it, the app hears “Hey Valhalla” and turns that into a game command. The words are recognized on the phone. They are not sold.</p>
  <h2>What is stored</h2>
  <p>The game server keeps your warrior name, a device token, your hall, your army, and your towns so the saga can continue. That token is an app user id. It is not your Apple ID. Apple’s purchase system handles payment. We do not receive your card number.</p>
  <h2>What we do not do</h2>
  <p>We do not sell personal information. We do not use advertising trackers. We do not ask for contacts, photos, or health data.</p>
  <p>You can leave a name from the hall. The recovery word on that screen is how you sign in again.</p>`)
}

export function supportPage(): string {
  return page("Support", `
  <p>Nash's Viking Chronicles is a free strategy game. You do not have to drive, and you do not have to buy anything.</p>
  <h2>Play from the couch</h2>
  <p>Open the app, take a name, and swear to the Nash clan or the Grogs. If the phone will not share a location, search for your town. Chesterville is there if you want the saga’s home. From the village you can build, train, and send a war band. The march is timed. Driving to a town in person pays more, and it is optional.</p>
  <h2>Another phone</h2>
  <p>The hall shows a recovery word. Enter that word with the same name to come back.</p>
  <h2>Purchases</h2>
  <p>On the website, the shop is a placeholder and charges nothing. On iPhone, Nash Points are optional consumable purchases from Apple. Towns, recruits, and fights do not require them. Refunds for those purchases go through Apple.</p>
  <h2>If something breaks</h2>
  <p>Force-quit the app and open it again. The saga line reconnects when the server is awake. The free host can take a minute to wake after a quiet stretch.</p>`)
}
