import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Bit, Moon, Color, Metadata, User } from '.././module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { DBContext } from './DBContext';

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
  moonTrails?: Map<number, Array<{ relX: number; relY: number; parentId: string }>>;
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
  const { metadata, canvasWidth, canvasHeight, renderBuffer, users, self, bits, moons, identity, moonTrails } = props;
  if (!ctx) return;

  ctx.fillStyle = 'rgb(23, 23, 23)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const GRID_SIZE = 60

  ctx.strokeStyle = 'rgba(200,200,200,0.3)';
  ctx.lineWidth = 0.08;

  const worldLeft = self.x - canvasWidth / 2;
  const worldTop = self.y - canvasHeight / 2;

  const firstGridX = Math.floor(worldLeft / GRID_SIZE) * GRID_SIZE;
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

  const firstGridY = Math.floor(worldTop / GRID_SIZE) * GRID_SIZE;
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

  // Draw moon trails before drawing moons
  if (moonTrails) {
    moons.forEach(moon => {
      const trail = moonTrails.get(moon.moonId) || [];
      trail.forEach((trailPoint, idx) => {
        // Find the parent user for this trail point
        const parent = users.get(trailPoint.parentId);
        if (!parent) return;
        // Convert relative to absolute
        const absX = parent.x + trailPoint.relX;
        const absY = parent.y + trailPoint.relY;
        const { x, y } = toScreen({ x: absX, y: absY });
        renderWithWrap(
          (px, py) => {
            ctx.save();
            // Fade older trail segments more
            const alpha = 0.2 * (idx + 1) / trail.length;
            ctx.globalAlpha = alpha;
            renderCircle(ctx, moon.size, px, py, moon.color);
            ctx.globalAlpha = 1.0;
            ctx.restore();
          },
          metadata,
          canvasWidth,
          canvasHeight,
          renderBuffer,
          self,
          x,
          y,
        );
      });
    });
  }

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


export function Canvas() {

  const context = useContext(DBContext);
  if (!context) {
    throw new Error('DBContext is not available');
  }
  const {
    identity,
    self,
    users,
    bits,
    moons,
    metadata,
    canvasWidth,
    canvasHeight,
    renderBuffer,
  } = context;

  // Add moonTrails state: Map<moonId, Array<{ relX: number; relY: number; parentId: string }>>
  const [moonTrails, setMoonTrails] = useState<
    Map<number, Array<{ relX: number; relY: number; parentId: string }>>
  >(new Map());

  // Update moonTrails when moons move (relative to their parent user)
  useEffect(() => {
    setMoonTrails(prev => {
      const newTrails = new Map(prev);
      moons.forEach(moon => {
        // Use moon.orbiting (Identity | undefined) as the parent user
        const parentId = moon.orbiting?.toHexString?.() || null;
        if (!parentId || !users.has(parentId)) return;
        const parent = users.get(parentId);
        if (!parent) return;
        const relX = moon.x - parent.x;
        const relY = moon.y - parent.y;
        const prevTrail = newTrails.get(moon.moonId) || [];
        // Only add to trail if position changed
        if (
          prevTrail.length === 0 ||
          prevTrail[prevTrail.length - 1].relX !== relX ||
          prevTrail[prevTrail.length - 1].relY !== relY
        ) {
          // Limit trail length to, e.g., 20
          const updatedTrail = [...prevTrail, { relX, relY, parentId }].slice(-20);
          newTrails.set(moon.moonId, updatedTrail);
        }
      });
      // Remove trails for moons that no longer exist
      Array.from(newTrails.keys()).forEach(moonId => {
        if (!moons.has(moonId)) newTrails.delete(moonId);
      });
      return newTrails;
    });
  }, [moons, users]);

  const [animatedWidth, setAnimatedWidth] = useState<number | null>(null);
  const [animatedHeight, setAnimatedHeight] = useState<number | null>(null);

    useEffect(() => {
    let raf: number;
    const growSpeed = 0.5;

    
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
        } else if (prev > canvasWidth) {
          return Math.max(prev - growSpeed, canvasWidth);
        }
        return prev;
      });
      setAnimatedHeight(prev => {
        if (prev === null) return canvasHeight;
        if (prev < canvasHeight) {
          return Math.min(prev + growSpeed, canvasHeight);
        } else if (prev > canvasHeight) {
          return Math.max(prev - growSpeed, canvasHeight);
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
  }, [canvasWidth, canvasHeight, animatedWidth, animatedHeight]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawProps = useMemo(() => ({
    metadata,
    canvasWidth: animatedWidth ?? canvasWidth,
    canvasHeight: animatedHeight ?? canvasHeight,
    renderBuffer,
    users,
    self,
    bits,
    moons,
    identity,
    moonTrails,
  }), [metadata, animatedWidth, canvasWidth, animatedHeight, canvasHeight, renderBuffer, users, self, bits, moons, identity, moonTrails]);

  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current as HTMLCanvasElement | null;
    if (!canvas) return;
    const context = canvas.getContext('2d');

    const render = () => {
      draw(context, drawProps);
      animationFrameId = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [drawProps]);

  return (
    <canvas
      ref={canvasRef}
      width={animatedHeight || canvasHeight}
      height={animatedWidth || canvasWidth}
      className="nes-canvas"
    />
  );
};
