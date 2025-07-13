import { useEffect, useRef, useState, useCallback } from "react";
import {
	Bit,
	Moon,
	DbConnection,
	ErrorContext,
	EventContext,
	Metadata,
	User,
	LeaderboardEntry,
} from ".././module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import React from "react";
import { Context } from "./Context";
import { ConnectionFormSchema } from "./ConnectionForm";
import z from "zod";
import { SettingsSchema } from "./Settings";

// Helper hook to manage all DB state and provide reset capability
function useDBState(
	conn: DbConnection | null,
	ownIdentity: Identity | null,
	onDeath: () => void,
) {
	// --- Metadata ---
	const [metadata, setMetadata] = useState<Metadata | null>(null);
	useEffect(() => {
		if (!conn) return;
		const onMetadataUpdate = (_ctx: EventContext, newMetadata: Metadata) =>
			setMetadata(newMetadata);
		conn.db.metadata.onInsert(onMetadataUpdate);
		conn.db.metadata.onDelete(() => setMetadata(null));
		return () => {
			conn.db.metadata.removeOnInsert(onMetadataUpdate);
			conn.db.metadata.removeOnDelete(() => setMetadata(null));
		};
	}, [conn]);

	// --- Users ---
	const [users, setUsers] = useState<Map<string, User>>(new Map());
	useEffect(() => {
		if (!conn) return;
		const onInsert = (_ctx: EventContext, user: User) => {
			setUsers((prev) => new Map(prev.set(user.identity.toHexString(), user)));
		};
		conn.db.user.onInsert(onInsert);

		const onUpdate = (_ctx: EventContext, oldUser: User, newUser: User) => {
			setUsers((prev) => {
				prev.delete(oldUser.identity.toHexString());
				return new Map(prev.set(newUser.identity.toHexString(), newUser));
			});
		};
		conn.db.user.onUpdate(onUpdate);

		const onDelete = (_ctx: EventContext, user: User) => {
			if (
				ownIdentity &&
				user.identity.toHexString() === ownIdentity.toHexString()
			) {
				onDeath();
			}
			setUsers((prev) => {
				prev.delete(user.identity.toHexString());
				return new Map(prev);
			});
		};
		conn.db.user.onDelete(onDelete);

		return () => {
			conn.db.user.removeOnInsert(onInsert);
			conn.db.user.removeOnUpdate(onUpdate);
			conn.db.user.removeOnDelete(onDelete);
		};
	}, [conn, ownIdentity, onDeath]);

	// --- Moons ---
	const [moons, setMoons] = useState<Map<number, Moon>>(new Map());
	useEffect(() => {
		if (!conn) return;
		const onInsert = (_ctx: EventContext, moon: Moon) => {
			setMoons((prev) => new Map(prev.set(moon.moonId, moon)));
		};
		conn.db.moon.onInsert(onInsert);

		const onUpdate = (_ctx: EventContext, oldMoon: Moon, newMoon: Moon) => {
			setMoons((prev) => {
				prev.delete(oldMoon.moonId);
				return new Map(prev.set(newMoon.moonId, newMoon));
			});
		};
		conn.db.moon.onUpdate(onUpdate);

		const onDelete = (_ctx: EventContext, moon: Moon) => {
			setMoons((prev) => {
				prev.delete(moon.moonId);
				return new Map(prev);
			});
		};
		conn.db.moon.onDelete(onDelete);

		return () => {
			conn.db.moon.removeOnInsert(onInsert);
			conn.db.moon.removeOnUpdate(onUpdate);
			conn.db.moon.removeOnDelete(onDelete);
		};
	}, [conn]);

	// --- Bits ---
	const [bits, setBits] = useState<Map<number, Bit>>(new Map());
	useEffect(() => {
		if (!conn) return;
		const onInsert = (_ctx: EventContext, bit: Bit) => {
			setBits((prev) => new Map(prev.set(bit.bitId, bit)));
		};
		conn.db.bit.onInsert(onInsert);

		const onUpdate = (_ctx: EventContext, oldBit: Bit, newBit: Bit) => {
			setBits((prev) => {
				prev.delete(oldBit.bitId);
				return new Map(prev.set(newBit.bitId, newBit));
			});
		};
		conn.db.bit.onUpdate(onUpdate);

		const onDelete = (_ctx: EventContext, bit: Bit) => {
			setBits((prev) => {
				prev.delete(bit.bitId);
				return new Map(prev);
			});
		};
		conn.db.bit.onDelete(onDelete);

		return () => {
			conn.db.bit.removeOnInsert(onInsert);
			conn.db.bit.removeOnUpdate(onUpdate);
			conn.db.bit.removeOnDelete(onDelete);
		};
	}, [conn]);

	// --- Leaderboard Entries ---
	const [leaderboardEntries, setLeaderboardEntries] = useState<
		Map<Identity, LeaderboardEntry>
	>(new Map());
	useEffect(() => {
		if (!conn) return;
		const onInsert = (_ctx: EventContext, entry: LeaderboardEntry) => {
			setLeaderboardEntries((prev) => new Map(prev.set(entry.identity, entry)));
		};
		conn.db.leaderboardEntry.onInsert(onInsert);

		const onUpdate = (
			_ctx: EventContext,
			oldEntry: LeaderboardEntry,
			newEntry: LeaderboardEntry,
		) => {
			setLeaderboardEntries((prev) => {
				prev.delete(oldEntry.identity);
				return new Map(prev.set(newEntry.identity, newEntry));
			});
		};
		conn.db.leaderboardEntry.onUpdate(onUpdate);

		const onDelete = (_ctx: EventContext, entry: LeaderboardEntry) => {
			setLeaderboardEntries((prev) => {
				prev.delete(entry.identity);
				return new Map(prev);
			});
		};
		conn.db.leaderboardEntry.onDelete(onDelete);

		return () => {
			conn.db.leaderboardEntry.removeOnInsert(onInsert);
			conn.db.leaderboardEntry.removeOnUpdate(onUpdate);
			conn.db.leaderboardEntry.removeOnDelete(onDelete);
		};
	}, [conn]);

	// Reset function to clear all state
	const resetDBState = useCallback(() => {
		setMetadata(null);
		setUsers(new Map());
		setMoons(new Map());
		setBits(new Map());
		setLeaderboardEntries(new Map());
	}, []);

	return {
		metadata,
		setMetadata,
		users,
		setUsers,
		moons,
		setMoons,
		bits,
		setBits,
		leaderboardEntries,
		setLeaderboardEntries,
		resetDBState,
	};
}

export function DBContextProvider({
	connected,
	setConnected,
	connectionForm,
	settings,
	setCanvasOpen,
	children,
}: {
	connected: boolean;
	setConnected: (connected: boolean) => void;
	connectionForm: z.infer<typeof ConnectionFormSchema>;
	settings: z.infer<typeof SettingsSchema>;
	children: React.ReactNode;
	setCanvasOpen: (open: boolean) => void;
}) {
	const [identity, setIdentity] = useState<Identity | null>(null);
	const [conn, setConn] = useState<DbConnection | null>(null);
	const connectingRef = useRef(false);

	// Add refs for connect and reconnect
	const connectRef = useRef<() => void>(() => {});
	const reconnectRef = useRef<() => void>(() => {});

	const onDeath = useCallback(() => {
		if (settings.auto_reconnect_on_death) {
			reconnectRef.current();
		} else {
			setCanvasOpen(false);
			setConnected(false);
		}
	}, [
		reconnectRef,
		settings.auto_reconnect_on_death,
		setCanvasOpen,
		setConnected,
	]);

	// Use the helper hook for all DB state
	const { metadata, users, bits, moons, leaderboardEntries, resetDBState } =
		useDBState(conn, identity, onDeath);

	const self = identity ? users.get(identity.toHexString()) : null;

	const [queriedX, setQueriedX] = useState<number | null>(null);
	const [queriedY, setQueriedY] = useState<number | null>(null);

	const [changingSubscriptions, setChangingSubscriptions] = useState<
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		any | null
	>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const [basicSubscriptions, setBasicSubscriptions] = useState<any | null>(
		null,
	);

	const viewportWorldWidth = self?.size
		? Math.round(Math.min(Math.max((self.size * 100) / 5) + 200, 1500))
		: null;
	const viewportWorldHeight = self?.size
		? Math.round(Math.min(Math.max((self.size * 100) / 5) + 200, 1500))
		: null;
	const renderBuffer = 200;
	const extraUserRenderBuffer = 150;

	const subscribeToQueries = useCallback(
		(conn: DbConnection, queries: string[]) => {
			const subscriptions = conn
				?.subscriptionBuilder()
				.onApplied(() => {
					console.log("SDK client cache initialized.");
				})
				.subscribe(queries);
			setBasicSubscriptions(subscriptions);
		},
		[],
	);

	const onConnect = useCallback(
		(conn: DbConnection, identity: Identity, token: string) => {
			setIdentity(identity);
			setConnected(true);
			localStorage.setItem("auth_token", token);
			console.log(
				"Connected to SpacetimeDB with identity:",
				identity.toHexString(),
			);

			conn.reducers.setUserMeta(
				connectionForm.username,
				{
					r: parseInt(connectionForm.color.slice(1, 3), 16),
					g: parseInt(connectionForm.color.slice(3, 5), 16),
					b: parseInt(connectionForm.color.slice(5, 7), 16),
				},
				connectionForm.seed,
			);

			subscribeToQueries(conn, [
				`SELECT * FROM user WHERE identity = '${identity.toHexString()}';`,
				"SELECT * FROM metadata;",
				`SELECT * FROM leaderboard_entry;`,
			]);
		},
		[setIdentity, setConnected, connectionForm, subscribeToQueries],
	);

	const onDisconnect = useCallback(() => {
		console.log("Disconnected from SpacetimeDB");
		setConnected(false);
		reconnectRef.current();
	}, [setConnected]);

	const onConnectError = useCallback(
		(_ctx: ErrorContext, err: Error) => {
			console.log("Error connecting to SpacetimeDB:", err);
			setConnected(false);
			reconnectRef.current();
		},
		[setConnected],
	);

	const connect = useCallback(() => {
		if (connectingRef.current) return;
		console.log("Connecting to SpacetimeDB...");
		connectingRef.current = true;

		setConn(
			DbConnection.builder()
				.withUri(connectionForm.uri)
				.withModuleName("nes")
				// .withToken(localStorage.getItem('auth_token') || '')
				.withToken("") // use the above line instead for persisting connection across refreshes
				.onConnect(onConnect)
				.onDisconnect(onDisconnect)
				.onConnectError(onConnectError)
				.build(),
		);
	}, [connectionForm, onConnect, onDisconnect, onConnectError]);

	const reconnect = useCallback(() => {
		setTimeout(() => {
			setConn(null);
			connectingRef.current = false;
			resetDBState();
			// TODO make the below a setting
			// setIdentity(null);
			// localStorage.removeItem('auth_token');
			console.log("Reconnecting...");
			setConnected(false);
			connectRef.current();
		}, 1000); // delay loading
	}, [resetDBState, setConnected]);

	useEffect(() => {
		connectRef.current = connect;
		reconnectRef.current = reconnect;
	}, [reconnect, connect]);

	// Call connect on first render
	useEffect(() => {
		connectRef.current();
		return () => {
			// Cleanup: unsubscribe from all subscriptions
			changingSubscriptions?.unsubscribe();
			basicSubscriptions?.unsubscribe();
			setChangingSubscriptions(null);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		function subscribeToNearbyObjs(
			conn: DbConnection,
			metadata: Metadata,
			x: number,
			y: number,
		) {
			if (
				!viewportWorldHeight ||
				!viewportWorldWidth ||
				(queriedX &&
					queriedY &&
					Math.abs(queriedX - x) < renderBuffer &&
					Math.abs(queriedY - y) < renderBuffer)
			) {
				return;
			}

			setQueriedX(Math.round(x));
			setQueriedY(Math.round(y));

			function getBaseQuery(renderBuffer: number): string {
				if (!viewportWorldHeight || !viewportWorldWidth) {
					return "";
				}
				const withinScreenQuery = `x < ${Math.round(x) + renderBuffer + viewportWorldWidth / 2} AND x > ${Math.round(x) - renderBuffer - viewportWorldWidth / 2} AND y < ${Math.round(y) + renderBuffer + viewportWorldHeight / 2} AND y > ${Math.round(y) - renderBuffer - viewportWorldHeight / 2}`;
				const leftEdgeQuery =
					x - renderBuffer < viewportWorldWidth / 2
						? ` OR (x > ${metadata.worldWidth - (viewportWorldWidth / 2 + renderBuffer - Math.round(x))} AND (y > ${Math.round(y) - (viewportWorldHeight / 2 + renderBuffer)}) AND (y < ${Math.round(y) + (viewportWorldHeight / 2 + renderBuffer)}))`
						: "";
				const rightEdgeQuery =
					x + renderBuffer > metadata.worldWidth - viewportWorldWidth / 2
						? ` OR (x < ${viewportWorldWidth / 2 + renderBuffer + Math.round(x) - metadata.worldWidth} AND (y > ${Math.round(y) - (viewportWorldHeight / 2 + renderBuffer)}) AND (y < ${Math.round(y) + (viewportWorldHeight / 2 + renderBuffer)}))`
						: "";
				const topEdgeQuery =
					y - renderBuffer < viewportWorldHeight / 2
						? ` OR (y > ${metadata.worldHeight - (viewportWorldHeight / 2 + renderBuffer - Math.round(y))} AND (x > ${Math.round(x) - (viewportWorldWidth / 2 + renderBuffer)}) AND (x < ${Math.round(x) + (viewportWorldWidth / 2 + renderBuffer)}))`
						: "";
				const bottomEdgeQuery =
					y + renderBuffer > metadata.worldHeight - viewportWorldHeight / 2
						? ` OR (y < ${viewportWorldHeight / 2 + renderBuffer + Math.round(y) - metadata.worldHeight} AND (x > ${Math.round(x) - (viewportWorldWidth / 2 + renderBuffer)}) AND (x < ${Math.round(x) + (viewportWorldWidth / 2 + renderBuffer)}))`
						: "";
				const topLeftCornerQuery =
					x - renderBuffer < viewportWorldWidth / 2 &&
					y - renderBuffer < viewportWorldHeight / 2
						? ` OR (x > ${metadata.worldWidth - (viewportWorldWidth / 2 + renderBuffer - Math.round(x))} AND y > ${metadata.worldHeight - (viewportWorldHeight / 2 + renderBuffer - Math.round(y))})`
						: "";
				const topRightCornerQuery =
					x + renderBuffer > metadata.worldWidth - viewportWorldWidth / 2 &&
					y - renderBuffer < viewportWorldHeight / 2
						? ` OR (x < ${viewportWorldWidth / 2 + renderBuffer + Math.round(x) - metadata.worldWidth} AND y > ${metadata.worldHeight - (viewportWorldHeight / 2 + renderBuffer - Math.round(y))})`
						: "";
				const bottomLeftCornerQuery =
					x - renderBuffer < viewportWorldWidth / 2 &&
					y + renderBuffer > metadata.worldHeight - viewportWorldHeight / 2
						? ` OR (x > ${metadata.worldWidth - (viewportWorldWidth / 2 + renderBuffer - Math.round(x))} AND y < ${viewportWorldHeight / 2 + renderBuffer + Math.round(y) - metadata.worldHeight})`
						: "";
				const bottomRightCornerQuery =
					x + renderBuffer > metadata.worldWidth - viewportWorldWidth / 2 &&
					y + renderBuffer > metadata.worldHeight - viewportWorldHeight / 2
						? ` OR (x < ${viewportWorldWidth / 2 + renderBuffer + Math.round(x) - metadata.worldWidth} AND y < ${viewportWorldHeight / 2 + renderBuffer + Math.round(y) - metadata.worldHeight})`
						: "";

				return `WHERE (${withinScreenQuery}${leftEdgeQuery}${rightEdgeQuery}${topEdgeQuery}${bottomEdgeQuery}${topLeftCornerQuery}${topRightCornerQuery}${bottomLeftCornerQuery}${bottomRightCornerQuery})`;
			}
			const bitQuery = "SELECT * FROM bit " + getBaseQuery(renderBuffer);
			const moonQuery = "SELECT * FROM moon " + getBaseQuery(renderBuffer);
			const userQuery =
				"SELECT * FROM user " +
				getBaseQuery(renderBuffer + extraUserRenderBuffer);

			const handle = conn
				.subscriptionBuilder()
				.subscribe([bitQuery, moonQuery, userQuery]);

			changingSubscriptions?.unsubscribe();
			setChangingSubscriptions(handle);
		}
		if (conn && self && metadata) {
			subscribeToNearbyObjs(conn, metadata, self.x, self.y);
		}

		return () => {
			// subscriptions?.unsubscribe();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [viewportWorldHeight, viewportWorldWidth, metadata, self]);

	if (
		!conn ||
		!connected ||
		!identity ||
		!metadata ||
		!self ||
		!viewportWorldHeight ||
		!viewportWorldWidth
	) {
		return (
			<>
				<h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mb-4">
					Connecting to server...
				</h2>
				<p className="text-lg text-muted-foreground mb-4">
					If this takes more than a couple seconds, the server is probably down.
				</p>
			</>
		);
	}

	return (
		<Context.Provider
			value={{
				conn,
				identity,
				self,
				users,
				bits,
				moons,
				leaderboardEntries,
				metadata,
				viewportWorldWidth,
				viewportWorldHeight,
				renderBuffer,
				settings,
			}}
		>
			{children}
		</Context.Provider>
	);
}
