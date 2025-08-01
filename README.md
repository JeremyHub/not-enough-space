# not-enough-space

## About
Not Enough Space is a multiplayer web game built using [SpacetimeDB](https://spacetimedb.com/home) for the server and React + HTML Canvas for the client. You play as a planet who can grow in size by picking up bits floating in space. You gain moons as you play which you can use to attack other players.

## Key features

Grow in size by picking up bits!

Gain moons as you grow larger!

Attack other players and steal their health by hitting them with moons!

You choose the look of your player!

The world wraps around and the borders are invisible to the player (yes, you can pickup bits and attack other players around the "edges" of the world.)

There is a live updating leaderboard with trackers for damage, kills, and size.

The screen grows as your player gets larger. This means you can see more of what is around you.

The whole game is fully server-authoritative meaning that the server makes all the descsions about what happens in the game (ie you cant cheat.) The client sends updates about what direction it wants to move and then recieves updates about what actually happened from the server.

There is client side lag compensation which changes based on the tick rate of the game. The tick rate of the server is currently ~12 ticks per second. The lag compensation is simply linearly interpolating between updates that it gets from the server. There is no client side prediction, only compensation.

The client only subscribes to updates from the server for objects that it needs to render and no more (with some buffer.)

## Developing

If you want to develop, checkout the Makefile (it assumes unix, so use WSL if you are on Windows). It has all the helpful commands that you need to get started!

To get setup you should install [SpacetimeDB](https://spacetimedb.com/install), [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), and [Rust](https://www.rust-lang.org/tools/install), then clone this repository. Next, go to the root of the project and run `make setup`.

To start developing, you should open 3 terminal windows to the root of the project. In one, run `make start-server`, in another run `make dev-client` and in the last one run `make publish-server`. You can then go to http://localhost:5173/not-enough-space/client and start playing! The client will hot-reload. For server changes you will need to re-run `make publish-server`, or, if you want to wipe your database before restarting, `make delete-and-publish-server`.
