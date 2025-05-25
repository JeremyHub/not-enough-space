import { useEffect, useRef, useState } from 'react';
import './App.css';
import { Bit, DbConnection, Direction, ErrorContext, EventContext, User } from './module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

export type PrettyMessage = {
  senderName: string;
  text: string;
};


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

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 600;

type DrawProps = {
  users: Map<string, User>;
  bits: Array<Bit>;
  identity: Identity;
};

function renderUser(ctx: CanvasRenderingContext2D, user: User, x: number, y: number) {
  ctx.beginPath();
  ctx.arc(x, y, user.size, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${user.color.r}, ${user.color.g}, ${user.color.b}, 1)`;
  ctx.fill();
  ctx.closePath();
}

const draw = (ctx: CanvasRenderingContext2D | null, props: DrawProps) => {
  const { users, bits, identity } = props;
  if (!ctx) return;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const self = users.get(identity.toHexString());
  if (!self) return;
  renderUser(ctx, self, CANVAS_WIDTH/2, CANVAS_HEIGHT/2);

  users.forEach(user => {
    if (user.identity.data !== identity.data) {
      renderUser(ctx, user, user.x-self.x+(CANVAS_WIDTH/2), user.y-self.y+(CANVAS_HEIGHT/2))
    }
  });

  bits.forEach(bit => {
    ctx.beginPath();
    ctx.arc(bit.x-self.x+(CANVAS_WIDTH/2), bit.y-self.y+(CANVAS_HEIGHT/2), bit.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${bit.color.r}, ${bit.color.g}, ${bit.color.b}, 1)`; 
    ctx.fill();
    ctx.closePath();
  })
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
  const bits = useBits(conn);

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

        subscribeToQueries(conn, ["SELECT * FROM user;", "SELECT * FROM bit"]);
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

    const getDirection = (): Direction | undefined => {
      const up = pressed.has('w');
      const down = pressed.has('s');
      const left = pressed.has('a');
      const right = pressed.has('d');
      const brake = pressed.has(' ');

      if (brake) return Direction.Brake as Direction;
      if (up && right && !left && !down) return Direction.NE as Direction;
      if (up && left && !right && !down) return Direction.NW as Direction;
      if (down && right && !up && !left) return Direction.SE as Direction;
      if (down && left && !up && !right) return Direction.SW as Direction;
      if (left && !right) return Direction.W as Direction;
      if (right && !left) return Direction.E as Direction;
      if (up && !down) return Direction.N as Direction;
      if (down && !up) return Direction.S as Direction;
      return undefined;
    };

    let lastDirection: Direction | undefined = undefined;

    const updateDirection = () => {
      const direction = getDirection();
      if (direction !== lastDirection) {
        conn.reducers.setDirection(direction);
        lastDirection = direction;
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

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
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
      <Canvas draw={draw} draw_props={{ users, bits, identity }} />
    </div>
  );
}

export default App;