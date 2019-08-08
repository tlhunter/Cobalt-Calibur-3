# Cobalt Calibur 3.x

![Cobalt Calibur 3.x Screenshot](https://github.com/tlhunter/Cobalt-Calibur-3/raw/master/resources/screenshot.png)

Cobalt Calibur 3 is a rather old (2012) browser-based sandbox game. The backend
is written in Node.js (originally **Node.js v0.8**!). Data is pushed using
WebSockets. The frontend uses the HTML5 Canvas tag to handle drawing of the
map, and the map is sized when the page loads to fit the size of the users
screen. It also uses some HTML5 audio for sound effects.

Example Server: [cobaltcalibur.net](http://cobaltcalibur.net)

## How To Play

Movement is done with the WASD and arrow keys. Pressing 1-6 will attempt to
build the specified tile. Pressing F will attempt to harvest / mine / chop
/ collect the tile in front of the player. As you harvest materials, your
inventory in the upper right will increase. As you place tiles, the inventory
will decrease. Unlike other building games (e.g. Minecraft), you don't keep the
items you created in inventory, just the raw materials.

## Synthetic Tiles:

1. Wooden Wall (4 wood)
2. Wooden Floor (2 wood)
3. Stone Wall (4 stone)
4. Stone Floor (2 stone)
5. Wooden Door (12 wood)
6. Glass Window (4 sand)

Placing synthetic tiles will cause the corruption to slowly be pushed away.
Doors will block enemies but will not block players.

## Naturally Occurring Tiles

* Trees: Mine to receive 2 wood, becomes stump
* Stump: Mine to receive 1 wood, becomes grass
* Grass: Walk on it. Randomly becomes tree
* Dirt: Walk on it. Randomly becomes grass
* Big Ore: Mine to receive 2 ore, becomes small ore
* Small Ore: Mine to receive 1 ore, becomes rubble
* Big Stone: Mine to receive 2 stone, becomes small stone
* Small Stone: Mine to receive 1 stone, becomes rubble
* Rubble: Mine to receive 1 stone, becomes dirt
* Water: Makes sand from adjacent ground

Every morning, grass can grow a tree, dirt can grow grass. Dirt and grass
adjacent to water will become sand. When there is an earthquake (every few
days), it will deposit more stone and ore into the world (and possibly damage
buildings).

When the server starts, NPCs can spawn on naturally occurring tiles. They then
walk around, (currently) never dying.

## Game Mechanics

Walking in the corruption has a chance of hurting the player. Standing adjacent
to an enemy will hurt the player. Enemies have very simple AI, they move
towards the player. There are day and night cycles, but they don't affect
gameplay much. There are occasional earthquakes, and they change the landscape.
Health slowly gets restored.

## Installation

```sh
$ npm install
```

## Running Game Server

You'll want to specify the port number as the first argument to the script:

```sh
$ ./server.js 8000
```

You can also run it using Docker:

```
$ docker build -t cobalt-calibur .
$ docker run -p 8000:8000 -d cobalt-calibur
```
