# Audio credits

## Music

The six music beds are original compositions made for Nash's Viking Chronicles:

- `explore-viking.mp3` and `explore-grog.mp3` — driving
- `battle-viking.mp3` and `battle-grog.mp3` — a fight
- `victory.mp3` and `defeat.mp3` — the result

They are not taken from Warhammer or any other game. The game may bundle them. No royalty is due.

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
