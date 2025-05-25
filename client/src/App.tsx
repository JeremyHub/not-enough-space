import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import { DbConnection, Direction, ErrorContext, EventContext, User } from './module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { JSX } from 'react/jsx-runtime';

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

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 600;

// Draws a ball for each user at their x and y position
const draw = (ctx: CanvasRenderingContext2D | null, users: Map<string, User>) => {
  if (!ctx) return;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  users.forEach(user => {
    ctx.beginPath();
    ctx.arc(user.x, user.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'blue';
    ctx.fill();
    ctx.closePath();
  });
};

const useCanvas = (
  draw: (ctx: CanvasRenderingContext2D | null, users: Map<string, User>) => void,
  users: Map<string, User>
) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement | null;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    let animationFrameId: number;

    const render = () => {
      draw(context, users);
      animationFrameId = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [draw, users]);

  return canvasRef;
};

const Canvas = (props: { draw: typeof draw; users: Map<string, User> }) => {
  const { draw, users, ...rest } = props;
  const canvasRef = useCanvas(draw, users);

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

        subscribeToQueries(conn, ["SELECT * FROM user where online=true;"]);
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
          .withToken(localStorage.getItem('auth_token') || '')
          .onConnect(onConnect)
          .onDisconnect(onDisconnect)
          .onConnectError(onConnectError)
          .build()
      );
  }, []);

  useEffect(() => {
    if (!conn) return;

    // Track pressed keys
    const pressed = new Set<string>();

    // Map WASD to axis
    const getDirection = (): Direction | undefined => {
      const up = pressed.has('w');
      const down = pressed.has('s');
      const left = pressed.has('a');
      const right = pressed.has('d');
      const brake = pressed.has(' ');

      if (brake) return Direction.Brake as Direction;
      if (up && right) return Direction.NE as Direction;
      if (up && left) return Direction.NW as Direction;
      if (down && right) return Direction.SE as Direction;
      if (down && left) return Direction.SW as Direction;
      if (up) return Direction.N as Direction;
      if (down) return Direction.S as Direction;
      if (left) return Direction.W as Direction;
      if (right) return Direction.E as Direction;
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
      <Canvas draw={draw} users={users}/>
    </div>
  );
}

export default App;