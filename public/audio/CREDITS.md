# Audio credits

## Music

The live soundtrack is original and generated in the browser with Web Audio. Nothing is sampled from a recording, a game, or a folk archive.

- Village: a slow drone, a plucked line in D dorian (the tagelharpa or lyre part), and a soft frame drum.
- Map and adventure, while the wheels turn: a marching drum and horn fifths. It sits quieter than the village.
- Battle: faster war drums, horn stabs, and a low two-note chant.
- Victory and defeat: short horn stings.

The older files in `music/` (`explore-viking.mp3`, `explore-grog.mp3`, `battle-viking.mp3`, `battle-grog.mp3`, `victory.mp3`, `defeat.mp3`) are earlier original beds made for this game. The live score no longer plays them. They are not taken from Warhammer or any other game. No royalty is due.

The volume slider and the mute cover the score, the effects, and the voices together. Any spoken line ducks the music.

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
- `roar.mp3` — an eSpeak shout, then the same grit used on the Grogs

While the car is moving, music sits lower and drops further under any voice. The volume slider and mute cover music, effects, and voices together.
