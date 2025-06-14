import { useEffect, useRef, useState } from 'react';
import './App.css';
import { Bit, Moon, Color, DbConnection, ErrorContext, EventContext, Metadata, User } from './module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

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

type DrawProps = {
  metadata: Metadata,
  canvasWidth: number,
  canvasHeight: number,
  renderBuffer: number,
  users: Map<string, User>;
  self: User;
  bits: Map<number, Bit>;
  moons: Map<number, Moon>;
  identity: Identity;
};

function renderCircle(ctx: CanvasRenderingContext2D, size: number, x: number, y: number, color: Color, filled: boolean = true) {
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  if (filled) {
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 1)`;
    ctx.fill();
  } else {
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 1)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.closePath();
}

function renderWithWrap(
  renderFn: (x: number, y: number) => void,
  metadata: Metadata,
  canvasWidth: number,
  canvasHeight: number,
  renderBuffer: number,
  self: User,
  x: number,
  y: number,
) {
  let new_x: number = x;
  let new_y: number = y;
  if (self.x < canvasWidth/2) {
    if (x > canvasWidth+renderBuffer) {
      new_x = x-metadata.worldWidth;
    }
  }
  if (self.x > metadata.worldWidth - canvasWidth / 2) {
    if (x < -renderBuffer) {
      new_x = x + metadata.worldWidth;
    }
  }
  if (self.y < canvasHeight / 2) {
    if (y > canvasHeight + renderBuffer) {
      new_y = y - metadata.worldHeight;
    }
  }
  if (self.y > metadata.worldHeight - canvasHeight / 2) {
    if (y < -renderBuffer) {
      new_y = y + metadata.worldHeight;
    }
  }

  renderFn(new_x, new_y);
}

const draw = (ctx: CanvasRenderingContext2D | null, props: DrawProps) => {
  const { metadata, canvasWidth, canvasHeight, renderBuffer, users, self, bits, moons, identity } = props;
  if (!ctx) return;

  ctx.fillStyle = 'rgb(23, 23, 23)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const GRID_SIZE = 60

  ctx.strokeStyle = 'rgba(200,200,200,0.3)';
  ctx.lineWidth = 0.08;

  const worldLeft = self.x - canvasWidth / 2;
  const worldTop = self.y - canvasHeight / 2;

  let firstGridX = Math.floor(worldLeft / GRID_SIZE) * GRID_SIZE;
  for (
    let x = firstGridX;
    x < worldLeft + canvasWidth;
    x += GRID_SIZE
  ) {
    const screenX = x - worldLeft;
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, canvasHeight);
    ctx.stroke();
  }

  let firstGridY = Math.floor(worldTop / GRID_SIZE) * GRID_SIZE;
  for (
    let y = firstGridY;
    y < worldTop + canvasHeight;
    y += GRID_SIZE
  ) {
    const screenY = y - worldTop;
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(canvasWidth, screenY);
    ctx.stroke();
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(255,0,0,0.7)';
  ctx.lineWidth = 2;

  const leftBorderX = metadata.worldWidth > 0 ? 0 - worldLeft : 0;
  const rightBorderX = metadata.worldWidth > 0 ? metadata.worldWidth - worldLeft : canvasWidth;
  const topBorderY = metadata.worldHeight > 0 ? 0 - worldTop : 0;
  const bottomBorderY = metadata.worldHeight > 0 ? metadata.worldHeight - worldTop : canvasHeight;

  ctx.beginPath();
  ctx.moveTo(leftBorderX, 0);
  ctx.lineTo(leftBorderX, canvasHeight);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(rightBorderX, 0);
  ctx.lineTo(rightBorderX, canvasHeight);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, topBorderY);
  ctx.lineTo(canvasWidth, topBorderY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, bottomBorderY);
  ctx.lineTo(canvasWidth, bottomBorderY);
  ctx.stroke();

  ctx.restore();

  const toScreen = (obj: { x: number; y: number }) => ({
    x: obj.x - self.x + canvasWidth / 2,
    y: obj.y - self.y + canvasHeight / 2,
  });

  bits.forEach(bit => {
      const { x, y } = toScreen(bit);
      renderWithWrap(
        (px, py) => renderCircle(ctx, bit.size, px, py, bit.color, false), // not filled for bits
        metadata,
        canvasWidth,
        canvasHeight,
        renderBuffer,
        self,
        x,
        y,
      );
    });

  users.forEach(user => {
    if (user.identity.data !== identity.data) {
      const { x, y } = toScreen(user);
      renderWithWrap(
        (px, py) => renderCircle(ctx, user.size, px, py, user.color),
        metadata,
        canvasWidth,
        canvasHeight,
        renderBuffer,
        self,
        x,
        y,
      );
    }
  });

  renderCircle(ctx, self.size, canvasWidth / 2, canvasHeight / 2, self.color);

  moons.forEach(moon => {
    const { x, y } = toScreen(moon);
    renderWithWrap(
      (px, py) => renderCircle(ctx, moon.size, px, py, moon.color),
      metadata,
      canvasWidth,
      canvasHeight,
      renderBuffer,
      self,
      x,
      y,
    );
  });
};

const useCanvas = (
  draw: (ctx: CanvasRenderingContext2D | null, props: DrawProps) => void,
  props: DrawProps,
) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current as HTMLCanvasElement | null;
    if (!canvas) return;
    const context = canvas.getContext('2d');

    const render = () => {
      draw(context, props);
      animationFrameId = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [draw, props]);

  return canvasRef;
};

const Canvas = (props: { draw: typeof draw; draw_props: DrawProps }) => {
  const { draw, draw_props, ...rest } = props;
  const canvasRef = useCanvas(draw, draw_props);

  return (
    <canvas
      ref={canvasRef}
      width={draw_props.canvasWidth}
      height={draw_props.canvasHeight}
      {...rest}
      className="nes-canvas"
    />
  );
};

function App() {
  const [connected, setConnected] = useState<boolean>(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [conn, setConn] = useState<DbConnection | null>(null);
  const connectingRef = useRef(false);
  const users = useUsers(conn);
  const metadata = useMetadata(conn);
  const self = identity ? users.get(identity.toHexString()) : null;
  const bits = useBits(conn);
  const moons = useMoons(conn);
  const [quriedX, setQuriedX] = useState<number | null>(null);
  const [quriedY, setQuriedY] = useState<number | null>(null);
  const [bitSubscription, setBitSubscription] = useState<any | null>(null);
  const canvasWidth = self?.size ? Math.min(Math.round(((self.size) * 100) / 2) * 2, 1500) : null;
  const canvasHeight = self?.size ? Math.min(Math.round(((self.size) * 100) / 2) * 2, 1500) : null;
  const renderBuffer = 200;
  const extraUserRenderBuffer = 100;

  const [animatedWidth, setAnimatedWidth] = useState<number | null>(null);
  const [animatedHeight, setAnimatedHeight] = useState<number | null>(null);

    useEffect(() => {
    let raf: number;
    const growSpeed = 0.1;

    
    function animate() {
      if (!canvasWidth || !canvasHeight) {
        raf = requestAnimationFrame(animate);
        return;
      }
      if ((animatedWidth === null || animatedHeight === null)) {
        setAnimatedWidth(canvasWidth);
        setAnimatedHeight(canvasHeight);
        return;
      }
      setAnimatedWidth(prev => {
        if (prev === null) return canvasWidth;
        if (prev < canvasWidth) {
          return Math.min(prev + growSpeed, canvasWidth);
        }
        return prev;
      });
      setAnimatedHeight(prev => {
        if (prev === null) return canvasHeight;
        if (prev < canvasHeight) {
          return Math.min(prev + growSpeed, canvasHeight);
        }
        return prev;
      });
      if (animatedWidth < canvasWidth || animatedHeight < canvasHeight) {
        raf = requestAnimationFrame(animate);
      }
    }

    setAnimatedWidth(animatedWidth);
    setAnimatedHeight(animatedHeight);
    raf = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(raf);
  }, [canvasWidth, canvasHeight]);

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

      const uri = window.prompt('Enter SpacetimeDB URI:', 'ws://localhost:3000') || 'ws://localhost:3000';

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

  function subscribeToNearbyObjs(conn: DbConnection, metadata: Metadata, x: number, y: number) {

    if (!canvasHeight || !canvasWidth || (quriedX && quriedY && (Math.abs(quriedX-x) < renderBuffer && Math.abs(quriedY-y) < renderBuffer))) {
      return
    }

    setQuriedX(Math.round(x));
    setQuriedY(Math.round(y));
  
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

    setBitSubscription(handle);
    bitSubscription?.unsubscribe();
  }

  useEffect(() => {
    if (conn && self && metadata) {
      subscribeToNearbyObjs(conn, metadata, self.x, self.y);
    }
  }, [conn, metadata, self?.x, self?.y]);

  useEffect(() => {
    if (!conn) return;

    const pressed = new Set<string>();

    let lastDirVecX: number | undefined = undefined;
    let lastDirVecY: number | undefined = undefined;

    const getDirection = (): { dirVecX: number, dirVecY: number } => {

      const up = pressed.has('w') || pressed.has('ArrowUp');
      const down = pressed.has('s') || pressed.has('ArrowDown');
      const left = pressed.has('a') || pressed.has('ArrowLeft');
      const right = pressed.has('d') || pressed.has('ArrowRight');

      if (up && right && !left && !down) return { dirVecX: 1, dirVecY: -1 };
      if (up && left && !right && !down) return { dirVecX: -1, dirVecY: -1 };
      if (down && right && !up && !left) return { dirVecX: 1, dirVecY: 1 };
      if (down && left && !up && !right) return { dirVecX: -1, dirVecY: 1 };
      if (left && !right) return { dirVecX: -1, dirVecY: 0 };
      if (right && !left) return { dirVecX: 1, dirVecY: 0 };
      if (up && !down) return { dirVecX: 0, dirVecY: -1 };
      if (down && !up) return { dirVecX: 0, dirVecY: 1 };
      return { dirVecX: 0, dirVecY: 0 };
    };

    const updateDirection = () => {
      const { dirVecX, dirVecY } = getDirection();
      if (dirVecX !== lastDirVecX || dirVecY !== lastDirVecY) {
        conn.reducers.setDirVec(dirVecX, dirVecY);
        lastDirVecX = dirVecX;
        lastDirVecY = dirVecY;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      // Only trigger on first press (not repeat)
      if (key === ' ' && !pressed.has(' ')) {
        console.log(key)
        conn.reducers.sacrificeHealthForMoonReducer();
      }
      pressed.add(key);
      updateDirection();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key;
      pressed.delete(key);
      updateDirection();
    };
    
  const handleBlur = () => {
    pressed.clear();
    updateDirection();
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleBlur);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('blur', handleBlur);
  };
  }, [conn]);

  if (!conn || !connected || !identity || !metadata || !self || !canvasHeight || !canvasWidth) {
    return (
      <div className="App">
        <h1>Connecting...</h1>
      </div>
    );
  }

  return (
    <div className="App">
      <Canvas
        key={`${canvasWidth}x${canvasHeight}`}
        draw={draw}
        draw_props={{
          metadata,
          canvasWidth: animatedWidth ?? canvasWidth,
          canvasHeight: animatedHeight ?? canvasHeight,
          renderBuffer,
          users,
          self,
          bits,
          moons,
          identity
        }}
      />
    </div>
  );
}

export default App;