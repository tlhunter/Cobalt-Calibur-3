# Cobalt Calibur 3.x

Cobalt Calibur 3 is a browser-based MMORPG (or, at least one day, it will be). The backend is written in Node.js and
uses MongoDB for a database engine. The frontend uses the HTML5 Canvas tag to handle drawing of the map, and the map is
resized when the page loads to fit the size of the users screen. It also uses some HTML5 audio for sound effects.

Example Server: [cobaltcalibur.net](http://cobaltcalibur.net)

## Free Node.js/MongoDB Hosting and Guide

I wrote a step-by-step guide for how to download Cobalt Calibur, and get all of the hosting on Red Hat's
OpenShift platform. This includes setting up a Node.js app and configuring MongoDB. The best part is that
it is completely free, and only takes about 30 minutes to setup. Check it out here:

[Guide to installing Cobalt Calibur on RedHat OpenShift](https://openshift.redhat.com/community/blogs/hosting-and-developing-the-html5-game-cobalt-calibur-free-on-openshift)

## How To Play

Movement is done with the WASD keys. Pressing 1-6 will attempt to build the specified tile. Pressing F will attempt to
harvest / mine / chop / collect the tile in front of the player. As you harvest materials, your inventory in the upper
right will increase. As you place tiles, the inventory will decrease. Unlike other building games (e.g. Minecraft), you
don't keep the items you created in inventory, just the raw materials.

You can optionally use the arrows to select different actions and the space bar to perform them.

## Synthetic Tiles:

    1 -> Wooden Wall (4 wood)
    2 -> Wooden Floor (2 wood)
    3 -> Stone Wall (4 stone)
    4 -> Stone Floor (2 stone)
    5 -> Wooden Door (12 wood)
    6 -> Glass Window (4 sand)

Placing synthetic tiles will cause the corruption to be pushed back. Doors will block enemies but will not block players.

## Naturally Occuring Tiles

    Trees -> Mine to receive 2 wood, becomes stump
    Stump -> Mine to receive 1 wood, becomes grass
    Grass -> Walk on it. Randomly becomes tree
    Dirt -> Walk on it. Randomly becomes grass
    Big Ore -> Mine to receive 2 ore, becomes small ore
    Small Ore -> Mine to receive 1 ore, becomes rubble
    Big Stone -> Mine to receive 2 stone, becomes small stone
    Small Stone -> Mine to receive 1 stone, becomes rubble
    Rubble -> Mine to receive 1 stone, becomes dirt
    Watter -> Mine to receive 1 water, becomes dirt

Every morning, grass can grow a tree, dirt can grow grass. Dirt and grass adjacent to water will become sand. When there
is an earthquake (every few days), it will deposit more stone and ore into the world (and possibly damage buildings).

When the server starts, NPCs can spawn on naturally occuring tiles. They then walk around, never dying.

## Game Mechanics

Walking in the corruption has a chance of hurting the player. Standing adjacent to an enemy will hurt the player.
Enemies have very simple AI, they move towards the player. There are day and night cycles, but they don't affect
gameplay. There are occasional earthquakes, and they change the landscape. Health slowly gets restored.

## Installation

	npm install

## Running Game Server

You'll

    sudo node server.js 80

I personally run the app using Forever:

    sudo npm install forever -g
    screen sudo forever start server.js

## Requirements

MongoDB, Node.js 0.6+

## Screenshot

![Cobalt Calibur 3.x Screenshot](https://github.com/tlhunter/Cobalt-Calibur-3/raw/master/resources/screenshot.png)
This is a nighttime screenshot (notice it is dark out). The blob at the top of the screen is a corrupted area.

## License

Dual BSD/GPL
