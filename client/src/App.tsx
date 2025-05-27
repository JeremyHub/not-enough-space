import { useEffect, useRef, useState } from 'react';
import './App.css';
import { Bit, Bot, Color, DbConnection, ErrorContext, EventContext, User } from './module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 1000;
const RENDER_BUFFER = 100;

const WORLD_WIDTH = 10000;
const WORLD_HEIGHT = 10000;

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

function useBots(conn: DbConnection | null): Array<Bot> {
  const [bots, setBots] = useState<Array<Bot>>([]);

  useEffect(() => {
    if (!conn) return;
    const onInsert = (_ctx: EventContext, bot: Bot) => {
      setBots(prev => [...prev, bot]);
    };
    conn.db.bot.onInsert(onInsert);

    const onUpdate = (_ctx: EventContext, oldBot: Bot, newBot: Bot) => {
      setBots(prev => prev.map(bot => bot.botId === oldBot.botId ? newBot : bot));
    };
    conn.db.bot.onUpdate(onUpdate);

    const onDelete = (_ctx: EventContext, bot: Bot) => {
      setBots(prev => prev.filter(b => b.botId !== bot.botId));
    };
    conn.db.bot.onDelete(onDelete);

    return () => {
      conn.db.bot.removeOnInsert(onInsert);
      conn.db.bot.removeOnUpdate(onUpdate);
      conn.db.bot.removeOnDelete(onDelete);
    };
  }, [conn]);
  return bots;
}

function useBits(conn: DbConnection | null): Array<Bit> {
  const [bits, setBits] = useState<Array<Bit>>([]);

  useEffect(() => {
    if (!conn) return;
    const onInsert = (_ctx: EventContext, bit: Bit) => {
      setBits(prev => [...prev, bit]);
    };
    conn.db.bit.onInsert(onInsert);

    const onUpdate = (_ctx: EventContext, oldBit: Bit, newBit: Bit) => {
      setBits(prev => prev.map(bit => bit.bitId === oldBit.bitId ? newBit : bit));
    };
    conn.db.bit.onUpdate(onUpdate);

    const onDelete = (_ctx: EventContext, bit: Bit) => {
      setBits(prev => prev.filter(b => b.bitId !== bit.bitId));
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
  users: Map<string, User>;
  bits: Array<Bit>;
  bots: Array<Bot>;
  identity: Identity;
};

function renderCircle(ctx: CanvasRenderingContext2D, size: number, x: number, y: number, color: Color) {
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 1)`;
  ctx.fill();
  ctx.closePath();
}

function renderWithWrap(
  renderFn: (x: number, y: number) => void,
  self: User,
  x: number,
  y: number,
) {
  let new_x: number = x;
  let new_y: number = y;
  // Check if you are near left edge
  if (self.x < CANVAS_WIDTH/2) {
    // check if thing we are rendering is past left edge
    if (x > CANVAS_WIDTH+RENDER_BUFFER) {
      new_x = x-WORLD_WIDTH;
    }
  }
  // Check if you are near right edge
  if (self.x > WORLD_WIDTH - CANVAS_WIDTH / 2) {
    // check if thing we are rendering is past right edge
    if (x < -RENDER_BUFFER) {
      new_x = x + WORLD_WIDTH;
    }
  }
  // Check if you are near top edge
  if (self.y < CANVAS_HEIGHT / 2) {
    // check if thing we are rendering is past top edge
    if (y > CANVAS_HEIGHT + RENDER_BUFFER) {
      new_y = y - WORLD_HEIGHT;
    }
  }
  // Check if you are near bottom edge
  if (self.y > WORLD_HEIGHT - CANVAS_HEIGHT / 2) {
    // check if thing we are rendering is past bottom edge
    if (y < -RENDER_BUFFER) {
      new_y = y + WORLD_HEIGHT;
    }
  }

  // Render the object at the new coordinates
  renderFn(new_x, new_y);
}

const draw = (ctx: CanvasRenderingContext2D | null, props: DrawProps) => {
  const { users, bits, bots, identity } = props;
  if (!ctx) return;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const self = users.get(identity.toHexString());
  if (!self) return;

  const GRID_SIZE = 60

  ctx.strokeStyle = 'rgba(200,200,200,0.3)';
  ctx.lineWidth = 0.08;

  const worldLeft = self.x - CANVAS_WIDTH / 2;
  const worldTop = self.y - CANVAS_HEIGHT / 2;

  let firstGridX = Math.floor(worldLeft / GRID_SIZE) * GRID_SIZE;
  for (
    let x = firstGridX;
    x < worldLeft + CANVAS_WIDTH;
    x += GRID_SIZE
  ) {
    const screenX = x - worldLeft;
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, CANVAS_HEIGHT);
    ctx.stroke();
  }

  let firstGridY = Math.floor(worldTop / GRID_SIZE) * GRID_SIZE;
  for (
    let y = firstGridY;
    y < worldTop + CANVAS_HEIGHT;
    y += GRID_SIZE
  ) {
    const screenY = y - worldTop;
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(CANVAS_WIDTH, screenY);
    ctx.stroke();
  }

  renderCircle(ctx, self.size, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, self.color);

  const toScreen = (obj: { x: number; y: number }) => ({
    x: obj.x - self.x + CANVAS_WIDTH / 2,
    y: obj.y - self.y + CANVAS_HEIGHT / 2,
  });

  users.forEach(user => {
    if (user.identity.data !== identity.data) {
      const { x, y } = toScreen(user);
      renderWithWrap(
        (px, py) => renderCircle(ctx, user.size, px, py, user.color),
        self,
        x,
        y,
      );
    }
  });

  bots.forEach(bot => {
    const { x, y } = toScreen(bot);
    renderWithWrap(
      (px, py) => renderCircle(ctx, bot.size, px, py, bot.color),
      self,
      x,
      y,
    );
  });

  bits.forEach(bit => {
    const { x, y } = toScreen(bit);
    renderWithWrap(
      (px, py) => renderCircle(ctx, bit.size, px, py, bit.color),
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
    const canvas = canvasRef.current as HTMLCanvasElement | null;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    let animationFrameId: number;

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
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
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
  const self = identity ? users.get(identity.toHexString()) : null;
  const bits = useBits(conn);
  const bots = useBots(conn);
  const [quriedX, setQuriedX] = useState<number | null>(null);
  const [quriedY, setQuriedY] = useState<number | null>(null);

  const [bitSubscription, setBitSubscription] = useState<any | null>(null);

  function subscribeToNearbyObjs(conn: DbConnection, x: number, y: number) {

    if (quriedX && quriedY && (Math.abs(quriedX-x) < RENDER_BUFFER && Math.abs(quriedY-y) < RENDER_BUFFER)) {
      return
    }

    setQuriedX(Math.round(x));
    setQuriedY(Math.round(y));
  
    const withinScreenQuery = `x < ${Math.round(x) + RENDER_BUFFER + CANVAS_WIDTH / 2} AND x > ${Math.round(x) - RENDER_BUFFER - CANVAS_WIDTH / 2} AND y < ${Math.round(y) + RENDER_BUFFER + CANVAS_HEIGHT / 2} AND y > ${Math.round(y) - RENDER_BUFFER - CANVAS_HEIGHT / 2}`
    
    const leftEdgeQuery = (x-RENDER_BUFFER < CANVAS_WIDTH/2) ? ` OR (x > ${WORLD_WIDTH - ((CANVAS_WIDTH/2)+RENDER_BUFFER-Math.round(x))} AND (y > ${Math.round(y) - ((CANVAS_HEIGHT/2)+RENDER_BUFFER)}) AND (y < ${Math.round(y) + ((CANVAS_HEIGHT/2)+RENDER_BUFFER)}))` : "";
    const rightEdgeQuery = (x+RENDER_BUFFER > WORLD_WIDTH - (CANVAS_WIDTH/2)) ? ` OR (x < ${((CANVAS_WIDTH/2)+RENDER_BUFFER+Math.round(x)) - WORLD_WIDTH} AND (y > ${Math.round(y) - ((CANVAS_HEIGHT/2)+RENDER_BUFFER)}) AND (y < ${Math.round(y) + ((CANVAS_HEIGHT/2)+RENDER_BUFFER)}))` : "";
    const topEdgeQuery = (y-RENDER_BUFFER < CANVAS_HEIGHT/2) ? ` OR (y > ${WORLD_HEIGHT - ((CANVAS_HEIGHT/2)+RENDER_BUFFER-Math.round(y))} AND (x > ${Math.round(x) - ((CANVAS_WIDTH/2)+RENDER_BUFFER)}) AND (x < ${Math.round(x) + ((CANVAS_WIDTH/2)+RENDER_BUFFER)}))` : "";
    const bottomEdgeQuery = (y+RENDER_BUFFER > WORLD_HEIGHT - (CANVAS_HEIGHT/2)) ? ` OR (y < ${((CANVAS_HEIGHT/2)+RENDER_BUFFER+Math.round(y)) - WORLD_HEIGHT} AND (x > ${Math.round(x) - ((CANVAS_WIDTH/2)+RENDER_BUFFER)}) AND (x < ${Math.round(x) + ((CANVAS_WIDTH/2)+RENDER_BUFFER)}))` : "";
    const topLeftCornerQuery = (x-RENDER_BUFFER < CANVAS_WIDTH/2 && y-RENDER_BUFFER < CANVAS_HEIGHT/2) ? ` OR (x > ${WORLD_WIDTH - ((CANVAS_WIDTH/2)+RENDER_BUFFER-Math.round(x))} AND y > ${WORLD_HEIGHT - ((CANVAS_HEIGHT/2)+RENDER_BUFFER-Math.round(y))})` : "";
    const topRightCornerQuery = (x+RENDER_BUFFER > WORLD_WIDTH - (CANVAS_WIDTH/2) && y-RENDER_BUFFER < CANVAS_HEIGHT/2) ? ` OR (x < ${((CANVAS_WIDTH/2)+RENDER_BUFFER+Math.round(x)) - WORLD_WIDTH} AND y > ${WORLD_HEIGHT - ((CANVAS_HEIGHT/2)+RENDER_BUFFER-Math.round(y))})` : "";
    const bottomLeftCornerQuery = (x-RENDER_BUFFER < CANVAS_WIDTH/2 && y+RENDER_BUFFER > WORLD_HEIGHT - (CANVAS_HEIGHT/2)) ? ` OR (x > ${WORLD_WIDTH - ((CANVAS_WIDTH/2)+RENDER_BUFFER-Math.round(x))} AND y < ${((CANVAS_HEIGHT/2)+RENDER_BUFFER+Math.round(y)) - WORLD_HEIGHT})` : "";
    const bottomRightCornerQuery = (x+RENDER_BUFFER > WORLD_WIDTH - (CANVAS_WIDTH/2) && y+RENDER_BUFFER > WORLD_HEIGHT - (CANVAS_HEIGHT/2)) ? ` OR (x < ${((CANVAS_WIDTH/2)+RENDER_BUFFER+Math.round(x)) - WORLD_WIDTH} AND y < ${((CANVAS_HEIGHT/2)+RENDER_BUFFER+Math.round(y)) - WORLD_HEIGHT})` : "";

    const baseQuery = `WHERE (${withinScreenQuery}${leftEdgeQuery}${rightEdgeQuery}${topEdgeQuery}${bottomEdgeQuery}${topLeftCornerQuery}${topRightCornerQuery}${bottomLeftCornerQuery}${bottomRightCornerQuery})`;
    const bitQuery = "SELECT * FROM bit " + baseQuery;
    const botQuery = "SELECT * FROM bot " + baseQuery;
    const userQuery = "SELECT * FROM user " + baseQuery;

    const handle = conn
      .subscriptionBuilder()
      .subscribe([bitQuery, botQuery, userQuery]);

    setBitSubscription(handle);
    bitSubscription?.unsubscribe();
  }
  useEffect(() => {
    if (conn && self) {
      subscribeToNearbyObjs(conn, self.x, self.y);
    }
  }, [conn, self?.x, self?.y]);

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

        subscribeToQueries(conn, [`SELECT * FROM user WHERE identity = '${identity.toHexString()}';`]);
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
          .withUri('ws://localhost:3000')
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
    if (!conn) return;

    const pressed = new Set<string>();
    let mouseDown = false;
    let mouseX = 0;
    let mouseY = 0;

    let lastDirVecX: number | undefined = undefined;
    let lastDirVecY: number | undefined = undefined;

    const getDirection = (): { dirVecX: number, dirVecY: number } => {
      if (mouseDown) {
        const centerX = CANVAS_WIDTH / 2;
        const centerY = CANVAS_HEIGHT / 2;
        const dx = mouseX - centerX;
        const dy = mouseY - centerY;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          return { dirVecX:dx / len, dirVecY:dy / len };
        }
        return { dirVecX: 0, dirVecY: 0 };
      }

      const up = pressed.has('w');
      const down = pressed.has('s');
      const left = pressed.has('a');
      const right = pressed.has('d');

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
      const key = e.key.toLowerCase();
      pressed.add(key);
      updateDirection();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressed.delete(key);
      updateDirection();
    };
    
    // TODO: mouse events cause lag because the direction changes too often

    // const handleMouseDown = (e: MouseEvent) => {
    //   mouseDown = true;
    //   const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    //   mouseX = e.clientX - rect.left;
    //   mouseY = e.clientY - rect.top;
    //   updateDirection();
    // };

    // const handleMouseUp = () => {
    //   mouseDown = false;
    //   updateDirection();
    // };

    // const handleMouseMove = (e: MouseEvent) => {
    //   if (!mouseDown) return;
    //   const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    //   mouseX = e.clientX - rect.left;
    //   mouseY = e.clientY - rect.top;
    //   updateDirection();
    // };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // window.addEventListener('mousedown', (e) => handleMouseDown(e as MouseEvent));
    // window.addEventListener('mouseup', handleMouseUp);
    // window.addEventListener('mouseleave', handleMouseUp);
    // window.addEventListener('mousemove', (e) => handleMouseMove(e as MouseEvent));

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      // window.removeEventListener('mousedown', (e) => handleMouseDown(e as MouseEvent));
      // window.removeEventListener('mouseup', handleMouseUp);
      // window.removeEventListener('mouseleave', handleMouseUp);
      // window.removeEventListener('mousemove', (e) => handleMouseMove(e as MouseEvent));
    };
  }, [conn]);

  if (!conn || !connected || !identity) {
    return (
      <div className="App">
        <h1>Connecting...</h1>
      </div>
    );
  }

  return (
    <div className="App">
      <Canvas draw={draw} draw_props={{ users, bits, bots, identity }} />
    </div>
  );
}

export default App;