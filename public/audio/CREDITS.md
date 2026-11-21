# Audio credits

## Music

The live score is original music synthesized for this game and stored in the repo. It is not copied from a recording, a game, or a folk archive. No royalty is due.

- `village.mp3` — slow drone, a plucked line, a soft drum, and a low chant.
- `march.mp3` — marching drums and horns for the map and the road.
- `battle.mp3` — fast war drums, horn stabs, and a throat-singing style chant.
- `victory-sting.mp3` and `defeat-sting.mp3` — the result.

Grogs play the same beds a little slower. The volume slider and the mute cover the score, the effects, and the voices together. Any spoken line ducks the music.

Earlier original beds are still in this folder (`explore-viking.mp3`, `explore-grog.mp3`, `battle-viking.mp3`, `battle-grog.mp3`, `victory.mp3`, `defeat.mp3`). The live game does not play them. They are not from Warhammer or any other game.

## Places

Towns and villages outside the saga's own list come from the GeoNames gazetteer for Canada and the United States (feature class P). GeoNames is used under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Credit: GeoNames, https://www.geonames.org/

Map tiles are OpenFreeMap (OpenStreetMap data, ODbL). Roads are routed live with Valhalla, and with OSRM if Valhalla does not answer. © OpenStreetMap contributors.

## Voices

Character lines and the driving narrator are generated with [eSpeak NG](https://github.com/espeak-ng/espeak-ng) 1.51, which is GPL-3.0. The files in `voices/` are output of that program, then, for the Grogs, pitched down and roughened with ffmpeg. The narrator speaks fresh battle reports through the same engine on the server (`en-gb-x-rp`). eSpeak NG itself is not copied into the web app; a host that wants the narrator installs the `espeak-ng` package. The Docker image does this.

Each of the 24 champions has five lines: recruit, battle cry, victory, defeat, and low health.

## Sound effects

These recordings are from Kenney's CC0 packs (public domain, no credit required; credit is given anyway):

- Impact Sounds: `clash.mp3` (metal), `shield.mp3` (plate), `shield-wood.mp3`, `bell.mp3`
- RPG Audio: `axe.mp3` (chop), `sword.mp3` (knife), `coins.mp3`

https://kenney.nl/assets/impact-sounds  
https://kenney.nl/assets/rpg-audio  
Kenney (www.kenney.nl), CC0 1.0

These were made for this game, also free to bundle:

- `horn.mp3`, `drums.mp3`, `drink.mp3`, `oars.mp3`
- `arrow.mp3` — a short synthesized whoosh for shafts in the 3D battle
- `roar.mp3` — an eSpeak shout, then the same grit used on the Grogs

While the car is moving, music sits lower and drops further under any voice. The volume slider and mute cover music, effects, and voices together.
