import { useEffect, useRef, useState } from 'react';
import { Bit, Moon, DbConnection, ErrorContext, EventContext, Metadata, User } from '.././module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import React from 'react';
import { DBContext } from './DBContext';

function useMetadata(conn: DbConnection | null): Metadata | null {
  const [metadata, setMetadata] = useState<Metadata | null>(null);

  useEffect(() => {
    if (!conn) return;

    const onMetadataUpdate = (_ctx: EventContext, newMetadata: Metadata) => {
      setMetadata(newMetadata);
    };

    conn.db.metadata.onInsert(onMetadataUpdate);
    conn.db.metadata.onDelete(() => {
      setMetadata(null);
    });
  }, [conn]);

  return metadata;
}

function useUsers(conn: DbConnection | null): Map<string, User> {
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  useEffect(() => {
    if (!conn) return;
    const onInsert = (_ctx: EventContext, user: User) => {
      setUsers(prev => new Map(prev.set(user.identity.toHexString(), user)));
    };
    conn.db.user.onInsert(onInsert);

    const onUpdate = (_ctx: EventContext, oldUser: User, newUser: User) => {
      setUsers(prev => {
        prev.delete(oldUser.identity.toHexString());
        return new Map(prev.set(newUser.identity.toHexString(), newUser));
      });
    };
    conn.db.user.onUpdate(onUpdate);

    const onDelete = (_ctx: EventContext, user: User) => {
      setUsers(prev => {
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
  }, [conn]);

  return users;
}

function useMoons(conn: DbConnection | null): Map<number, Moon> {
  const [moons, setMoons] = useState<Map<number, Moon>>(new Map());

  useEffect(() => {
    if (!conn) return;
    const onInsert = (_ctx: EventContext, moon: Moon) => {
      setMoons(prev => new Map(prev.set(moon.moonId, moon)));
    };
    conn.db.moon.onInsert(onInsert);

    const onUpdate = (_ctx: EventContext, oldMoon: Moon, newMoon: Moon) => {
      setMoons(prev => {
        prev.delete(oldMoon.moonId);
        return new Map(prev.set(newMoon.moonId, newMoon));
      });
    };
    conn.db.moon.onUpdate(onUpdate);

    const onDelete = (_ctx: EventContext, moon: Moon) => {
      setMoons(prev => {
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
  return moons;
}

function useBits(conn: DbConnection | null): Map<number, Bit> {
  const [bits, setBits] = useState<Map<number, Bit>>(new Map());

  useEffect(() => {
    if (!conn) return;
    const onInsert = (_ctx: EventContext, bit: Bit) => {
      setBits(prev => new Map(prev.set(bit.bitId, bit)));
    };
    conn.db.bit.onInsert(onInsert);

    const onUpdate = (_ctx: EventContext, oldBit: Bit, newBit: Bit) => {
      setBits(prev => {
        prev.delete(oldBit.bitId);
        return new Map(prev.set(newBit.bitId, newBit));
      });
    };
    conn.db.bit.onUpdate(onUpdate);

    const onDelete = (_ctx: EventContext, bit: Bit) => {
      setBits(prev => {
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
  return bits;
}

export function DBContextProvider({
  connected,
  setConnected,
  uri,
  children,
}: {
  connected: boolean;
  setConnected: (connected: boolean) => void;
  uri: string;
  children: React.ReactNode;
}) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [conn, setConn] = useState<DbConnection | null>(null);
  const connectingRef = useRef(false);

  const users = useUsers(conn);
  const metadata = useMetadata(conn);
  const self = identity ? users.get(identity.toHexString()) : null;
  const bits = useBits(conn);
  const moons = useMoons(conn);

  const [queriedX, setQueriedX] = useState<number | null>(null);
  const [queriedY, setQueriedY] = useState<number | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [subscriptions, setSubscriptions] = useState<any | null>(null);
  const canvasWidth = self?.size ? Math.min(Math.max((self.size * 100)/5) + 200, 1500) : null;
  const canvasHeight = self?.size ? Math.min(Math.max((self.size * 100)/5) + 200, 1500) : null;
  const renderBuffer = 200;
  const extraUserRenderBuffer = 100;

    useEffect(() => {
      if (connectingRef.current) return;
      connectingRef.current = true;
        const subscribeToQueries = (conn: DbConnection, queries: string[]) => {
          conn
            ?.subscriptionBuilder()
            .onApplied(() => {
              console.log('SDK client cache initialized.');
            })
            .subscribe(queries);
        };
  
        const onConnect = (
          conn: DbConnection,
          identity: Identity,
          token: string
        ) => {
          setIdentity(identity);
          setConnected(true);
          localStorage.setItem('auth_token', token);
          console.log(
            'Connected to SpacetimeDB with identity:',
            identity.toHexString()
          );
  
          subscribeToQueries(conn, [`SELECT * FROM user WHERE identity = '${identity.toHexString()}';`, "SELECT * FROM metadata;"]);
        };
  
        const onDisconnect = () => {
          console.log('Disconnected from SpacetimeDB');
          setConnected(false);
        };
  
        const onConnectError = (_ctx: ErrorContext, err: Error) => {
          console.log('Error connecting to SpacetimeDB:', err);
        };
  
        setConn(
          DbConnection.builder()
            // .withUri('ws://localhost:3000')
            .withUri(uri)
            .withModuleName('nes')
            // .withToken(localStorage.getItem('auth_token') || '')
            .withToken('') // use the above line instead for persisting connection across refreshes
            .onConnect(onConnect)
            .onDisconnect(onDisconnect)
            .onConnectError(onConnectError)
            .build()
        );
    }, []);
  
    useEffect(() => {
      function subscribeToNearbyObjs(conn: DbConnection, metadata: Metadata, x: number, y: number) {
        if (!canvasHeight || !canvasWidth || (queriedX && queriedY && (Math.abs(queriedX-x) < renderBuffer && Math.abs(queriedY-y) < renderBuffer))) {
          return
        }
    
        setQueriedX(Math.round(x));
        setQueriedY(Math.round(y));
      
        function getBaseQuery (renderBuffer: number): string {
          if (!canvasHeight || !canvasWidth) {
            return ""
          }
          const withinScreenQuery = `x < ${Math.round(x) + renderBuffer + canvasWidth / 2} AND x > ${Math.round(x) - renderBuffer - canvasWidth / 2} AND y < ${Math.round(y) + renderBuffer + canvasHeight / 2} AND y > ${Math.round(y) - renderBuffer - canvasHeight / 2}`
          const leftEdgeQuery = (x-renderBuffer < canvasWidth/2) ? ` OR (x > ${metadata.worldWidth - ((canvasWidth/2)+renderBuffer-Math.round(x))} AND (y > ${Math.round(y) - ((canvasHeight/2)+renderBuffer)}) AND (y < ${Math.round(y) + ((canvasHeight/2)+renderBuffer)}))` : "";
          const rightEdgeQuery = (x+renderBuffer > metadata.worldWidth - (canvasWidth/2)) ? ` OR (x < ${((canvasWidth/2)+renderBuffer+Math.round(x)) - metadata.worldWidth} AND (y > ${Math.round(y) - ((canvasHeight/2)+renderBuffer)}) AND (y < ${Math.round(y) + ((canvasHeight/2)+renderBuffer)}))` : "";
          const topEdgeQuery = (y-renderBuffer < canvasHeight/2) ? ` OR (y > ${metadata.worldHeight - ((canvasHeight/2)+renderBuffer-Math.round(y))} AND (x > ${Math.round(x) - ((canvasWidth/2)+renderBuffer)}) AND (x < ${Math.round(x) + ((canvasWidth/2)+renderBuffer)}))` : "";
          const bottomEdgeQuery = (y+renderBuffer > metadata.worldHeight - (canvasHeight/2)) ? ` OR (y < ${((canvasHeight/2)+renderBuffer+Math.round(y)) - metadata.worldHeight} AND (x > ${Math.round(x) - ((canvasWidth/2)+renderBuffer)}) AND (x < ${Math.round(x) + ((canvasWidth/2)+renderBuffer)}))` : "";
          const topLeftCornerQuery = (x-renderBuffer < canvasWidth/2 && y-renderBuffer < canvasHeight/2) ? ` OR (x > ${metadata.worldWidth - ((canvasWidth/2)+renderBuffer-Math.round(x))} AND y > ${metadata.worldHeight - ((canvasHeight/2)+renderBuffer-Math.round(y))})` : "";
          const topRightCornerQuery = (x+renderBuffer > metadata.worldWidth - (canvasWidth/2) && y-renderBuffer < canvasHeight/2) ? ` OR (x < ${((canvasWidth/2)+renderBuffer+Math.round(x)) - metadata.worldWidth} AND y > ${metadata.worldHeight - ((canvasHeight/2)+renderBuffer-Math.round(y))})` : "";
          const bottomLeftCornerQuery = (x-renderBuffer < canvasWidth/2 && y+renderBuffer > metadata.worldHeight - (canvasHeight/2)) ? ` OR (x > ${metadata.worldWidth - ((canvasWidth/2)+renderBuffer-Math.round(x))} AND y < ${((canvasHeight/2)+renderBuffer+Math.round(y)) - metadata.worldHeight})` : "";
          const bottomRightCornerQuery = (x+renderBuffer > metadata.worldWidth - (canvasWidth/2) && y+renderBuffer > metadata.worldHeight - (canvasHeight/2)) ? ` OR (x < ${((canvasWidth/2)+renderBuffer+Math.round(x)) - metadata.worldWidth} AND y < ${((canvasHeight/2)+renderBuffer+Math.round(y)) - metadata.worldHeight})` : "";
      
          return `WHERE (${withinScreenQuery}${leftEdgeQuery}${rightEdgeQuery}${topEdgeQuery}${bottomEdgeQuery}${topLeftCornerQuery}${topRightCornerQuery}${bottomLeftCornerQuery}${bottomRightCornerQuery})`;
        }
        const bitQuery = "SELECT * FROM bit " + getBaseQuery(renderBuffer);
        const moonQuery = "SELECT * FROM moon " + getBaseQuery(renderBuffer);
        const userQuery = "SELECT * FROM user " + getBaseQuery(renderBuffer+extraUserRenderBuffer);
    
        const handle = conn
          .subscriptionBuilder()
          .subscribe([bitQuery, moonQuery, userQuery]);
    
        setSubscriptions(handle);
        subscriptions?.unsubscribe();
      }
      if (conn && self && metadata) {
        subscribeToNearbyObjs(conn, metadata, self.x, self.y);
      }
    }, [canvasHeight, canvasWidth, conn, metadata, queriedX, queriedY, self, subscriptions]);


  if (!conn || !connected || !identity || !metadata || !self || !canvasHeight || !canvasWidth) {
    return (
      <h1>Connecting...</h1>
    );
  }

  return (
    <DBContext.Provider
      value={{
        conn,
        identity,
        self,
        users,
        bits,
        moons,
        metadata,
        canvasWidth,
        canvasHeight,
        renderBuffer
      }}
    >
      {children}
    </DBContext.Provider>
  );
}
