import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Bit, Moon, Color, Metadata, User } from ".././module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import { Context } from "./Context";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsSchema } from "./Settings";
import z from "zod";

type DrawProps = {
	metadata: Metadata;
	canvasWidth: number;
	canvasHeight: number;
	renderBuffer: number;
	users: Map<string, User>;
	self: User;
	bits: Map<number, Bit>;
	moons: Map<number, Moon>;
	identity: Identity;
	moonTrails?: Map<
		number,
		Array<{ relX: number; relY: number; parentId: string }>
	>;
	settings: z.infer<typeof SettingsSchema>;
};

// Utility lerp function
function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

function renderTextInCircle(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	radius: number,
	color = "#fff",
) {
	const dpr = window.devicePixelRatio || 1;
	const bestFontSize = Math.floor(radius * 0.8 * dpr) / text.length;
	ctx.font = `bold ${bestFontSize}px sans-serif`;
	ctx.fillStyle = color;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.shadowColor = "rgba(0,0,0,0.7)";
	ctx.shadowBlur = 4 * dpr;
	ctx.fillText(text, x, y);
}

function renderCircle(
	ctx: CanvasRenderingContext2D,
	size: number,
	x: number,
	y: number,
	color: Color,
	filled: boolean = true,
) {
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
	if (self.x < canvasWidth / 2) {
		if (x > canvasWidth + renderBuffer) {
			new_x = x - metadata.worldWidth;
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

// --- Types for lerped positions ---
type Position = { x: number; y: number };
type LerpedPositions = {
	users: Map<string, Position>;
	bits: Map<number, Position>;
	moons: Map<number, Position>;
};

// --- Helper to get positions from objects ---
function getPositionsFromObjects<K, T extends { x: number; y: number }>(
	map: Map<K, T>,
): Map<K, Position> {
	const result = new Map<K, Position>();
	map.forEach((obj, key) => {
		result.set(key, { x: obj.x, y: obj.y });
	});
	return result;
}

const draw = (
	ctx: CanvasRenderingContext2D | null,
	props: DrawProps & {
		lerpedPositions?: LerpedPositions;
		lerpedCamera?: { x: number; y: number };
	},
) => {
	const {
		metadata,
		canvasWidth,
		canvasHeight,
		renderBuffer,
		users,
		self,
		bits,
		moons,
		identity,
		moonTrails,
		lerpedPositions,
		lerpedCamera,
		settings,
	} = props;
	if (!ctx) return;

	// Use lerpedCamera for camera position
	const cameraX = lerpedCamera?.x ?? self.x;
	const cameraY = lerpedCamera?.y ?? self.y;

	ctx.fillStyle = "rgb(23, 23, 23)";
	ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

	const GRID_SIZE = 60;

	ctx.strokeStyle = "rgba(200,200,200,0.3)";
	ctx.lineWidth = 0.08;

	const worldLeft = cameraX - canvasWidth / 2;
	const worldTop = cameraY - canvasHeight / 2;

	const firstGridX = Math.floor(worldLeft / GRID_SIZE) * GRID_SIZE;
	for (let x = firstGridX; x < worldLeft + canvasWidth; x += GRID_SIZE) {
		const screenX = x - worldLeft;
		ctx.beginPath();
		ctx.moveTo(screenX, 0);
		ctx.lineTo(screenX, canvasHeight);
		ctx.stroke();
	}

	const firstGridY = Math.floor(worldTop / GRID_SIZE) * GRID_SIZE;
	for (let y = firstGridY; y < worldTop + canvasHeight; y += GRID_SIZE) {
		const screenY = y - worldTop;
		ctx.beginPath();
		ctx.moveTo(0, screenY);
		ctx.lineTo(canvasWidth, screenY);
		ctx.stroke();
	}

	if (settings.show_world_boundaries) {
		ctx.save();
		ctx.strokeStyle = "rgba(255,0,0,0.7)";
		ctx.lineWidth = 2;

		const leftBorderX = metadata.worldWidth > 0 ? 0 - worldLeft : 0;
		const rightBorderX =
			metadata.worldWidth > 0 ? metadata.worldWidth - worldLeft : canvasWidth;
		const topBorderY = metadata.worldHeight > 0 ? 0 - worldTop : 0;
		const bottomBorderY =
			metadata.worldHeight > 0 ? metadata.worldHeight - worldTop : canvasHeight;

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
	}

	const toScreen = (obj: { x: number; y: number }) => ({
		x: obj.x - cameraX + canvasWidth / 2,
		y: obj.y - cameraY + canvasHeight / 2,
	});

	// --- Draw bits with lerped positions ---
	bits.forEach((bit, key) => {
		const pos = lerpedPositions?.bits.get(key) || bit;
		const { x, y } = toScreen(pos);
		renderWithWrap(
			(px, py) => renderCircle(ctx, bit.size, px, py, bit.color, false),
			metadata,
			canvasWidth,
			canvasHeight,
			renderBuffer,
			// Use a fake self with camera position for wrapping logic
			{ ...self, x: cameraX, y: cameraY },
			x,
			y,
		);
	});

	// --- Draw users with lerped positions ---
	users.forEach((user, key) => {
		if (user.identity.data !== identity.data) {
			const pos = lerpedPositions?.users.get(key) || user;
			const { x, y } = toScreen(pos);
			renderWithWrap(
				(px, py) => {
					renderCircle(ctx, user.size, px, py, user.color);
					if (user.username) {
						ctx.save();
						renderTextInCircle(
							ctx,
							user.username,
							px,
							py,
							user.size * (window.devicePixelRatio || 1),
						);
						ctx.restore();
					}
				},
				metadata,
				canvasWidth,
				canvasHeight,
				renderBuffer,
				{ ...self, x: cameraX, y: cameraY },
				x,
				y,
			);
		}
	});

	// --- Draw self at center ---
	renderCircle(ctx, self.size, canvasWidth / 2, canvasHeight / 2, self.color);
	if (self.username) {
		ctx.save();
		renderTextInCircle(
			ctx,
			self.username,
			canvasWidth / 2,
			canvasHeight / 2,
			self.size * (window.devicePixelRatio || 1),
		);
		ctx.restore();
	}

	// --- Draw moon trails (no lerp needed, as they're historical positions) ---
	if (moonTrails) {
		moons.forEach((moon) => {
			const trail = moonTrails.get(moon.moonId) || [];
			trail.forEach((trailPoint, idx) => {
				const parent = lerpedPositions?.users.get(trailPoint.parentId);
				if (!parent) return;
				const absX = parent.x + trailPoint.relX;
				const absY = parent.y + trailPoint.relY;
				const { x, y } = toScreen({ x: absX, y: absY });
				renderWithWrap(
					(px, py) => {
						ctx.save();
						const alpha = (0.2 * (idx + 1)) / trail.length;
						ctx.globalAlpha = alpha;
						renderCircle(ctx, moon.size, px, py, moon.color);
						ctx.globalAlpha = 1.0;
						ctx.restore();
					},
					metadata,
					canvasWidth,
					canvasHeight,
					renderBuffer,
					{ ...self, x: cameraX, y: cameraY },
					x,
					y,
				);
			});
		});
	}

	// --- Draw moons with lerped positions ---
	moons.forEach((moon, key) => {
		const pos = lerpedPositions?.moons.get(key) || moon;
		const { x, y } = toScreen(pos);
		renderWithWrap(
			(px, py) => renderCircle(ctx, moon.size, px, py, moon.color),
			metadata,
			canvasWidth,
			canvasHeight,
			renderBuffer,
			{ ...self, x: cameraX, y: cameraY },
			x,
			y,
		);
	});
};

export function Canvas() {
	const context = useContext(Context);
	if (!context) {
		throw new Error("DBContext is not available");
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
		settings,
	} = context;

	// --- LERPED POSITIONS STATE ---
	const [lerpedPositions, setLerpedPositions] = useState<LerpedPositions>(
		() => ({
			users: getPositionsFromObjects<string, User>(users),
			bits: getPositionsFromObjects<number, Bit>(bits),
			moons: getPositionsFromObjects<number, Moon>(moons),
		}),
	);

	// --- LERPED CAMERA STATE ---
	const [lerpedCamera, setLerpedCamera] = useState<{ x: number; y: number }>({
		x: self.x,
		y: self.y,
	});

	// --- MOON TRAILS BASED ON LERPED POSITIONS ---
	const [moonTrails, setMoonTrails] = useState<
		Map<number, Array<{ relX: number; relY: number; parentId: string }>>
	>(new Map());

	useEffect(() => {
		setMoonTrails((prev) => {
			const newTrails = new Map(prev);
			moons.forEach((moon, moonId) => {
				const lerpedMoon = lerpedPositions.moons.get(moonId) || moon;
				const parentId = moon.orbiting?.toHexString?.() || null;
				if (!parentId || !lerpedPositions.users.has(parentId)) return;
				const parent = lerpedPositions.users.get(parentId);
				if (!parent) return;
				const relX = lerpedMoon.x - parent.x;
				const relY = lerpedMoon.y - parent.y;
				const prevTrail = newTrails.get(moon.moonId) || [];
				// Always add the current lerped position to the trail
				const updatedTrail = [...prevTrail, { relX, relY, parentId }].slice(
					-20,
				);
				newTrails.set(moon.moonId, updatedTrail);
			});
			// Remove trails for moons that no longer exist
			Array.from(newTrails.keys()).forEach((moonId) => {
				if (!moons.has(moonId)) newTrails.delete(moonId);
			});
			return newTrails;
		});
		// Depend on lerpedPositions, moons, users
	}, [moons, users, lerpedPositions]);

	const [animatedWidth, setAnimatedWidth] = useState<number | null>(null);
	const [animatedHeight, setAnimatedHeight] = useState<number | null>(null);

	useEffect(() => {
		let raf: number;
		const growSpeed = 0.5;

		function animate() {
			setAnimatedWidth((prev) => {
				const target = canvasWidth;
				if (prev === null) return target;
				if (prev < target) return Math.min(prev + growSpeed, target);
				if (prev > target) return Math.max(prev - growSpeed, target);
				return prev;
			});
			setAnimatedHeight((prev) => {
				const target = canvasHeight;
				if (prev === null) return target;
				if (prev < target) return Math.min(prev + growSpeed, target);
				if (prev > target) return Math.max(prev - growSpeed, target);
				return prev;
			});
			raf = requestAnimationFrame(animate);
		}
		raf = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(raf);
	}, [canvasHeight, canvasWidth]);

	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	// --- UPDATE TARGET POSITIONS WHEN OBJECTS CHANGE ---
	useEffect(() => {
		setLerpedPositions((prev) => {
			const next: LerpedPositions = {
				users: new Map(prev.users),
				bits: new Map(prev.bits),
				moons: new Map(prev.moons),
			};
			// Users
			users.forEach((user, key) => {
				const prevPos = prev.users.get(key) || { x: user.x, y: user.y };
				next.users.set(key, prevPos);
			});
			// Remove users that no longer exist
			Array.from(next.users.keys()).forEach((key) => {
				if (!users.has(key)) next.users.delete(key);
			});
			// Bits
			bits.forEach((bit, key) => {
				const prevPos = prev.bits.get(key) || { x: bit.x, y: bit.y };
				next.bits.set(key, prevPos);
			});
			Array.from(next.bits.keys()).forEach((key) => {
				if (!bits.has(key)) next.bits.delete(key);
			});
			// Moons
			moons.forEach((moon, key) => {
				const prevPos = prev.moons.get(key) || { x: moon.x, y: moon.y };
				next.moons.set(key, prevPos);
			});
			Array.from(next.moons.keys()).forEach((key) => {
				if (!moons.has(key)) next.moons.delete(key);
			});
			return next;
		});
	}, [users, bits, moons]);

	// --- Helper for wrapped lerp ---
	function lerpWrapped(
		prev: number,
		next: number,
		t: number,
		worldSize: number,
	) {
		let delta = next - prev;
		if (Math.abs(delta) > worldSize / 2) {
			// Wrap around
			if (delta > 0) {
				prev += worldSize;
			} else {
				prev -= worldSize;
			}
			// Recompute delta
			delta = next - prev;
		}
		let lerped = lerp(prev, next, t);
		// Clamp to world bounds
		if (lerped < 0) lerped += worldSize;
		if (lerped >= worldSize) lerped -= worldSize;
		return lerped;
	}

	// --- LERP ANIMATION LOOP ---
	useEffect(() => {
		let raf: number;
		const lerpSpeed = settings.lerp_strength; // 0..1, higher is snappier

		function animateLerp() {
			setLerpedPositions((prev) => {
				const next: LerpedPositions = {
					users: new Map(),
					bits: new Map(),
					moons: new Map(),
				};
				// Users
				users.forEach((user, key) => {
					const prevPos = prev.users.get(key) || { x: user.x, y: user.y };
					const newX = lerpWrapped(
						prevPos.x,
						user.x,
						lerpSpeed,
						metadata.worldWidth,
					);
					const newY = lerpWrapped(
						prevPos.y,
						user.y,
						lerpSpeed,
						metadata.worldHeight,
					);
					next.users.set(key, { x: newX, y: newY });
				});
				// Bits
				bits.forEach((bit, key) => {
					const prevPos = prev.bits.get(key) || { x: bit.x, y: bit.y };
					const newX = lerpWrapped(
						prevPos.x,
						bit.x,
						lerpSpeed,
						metadata.worldWidth,
					);
					const newY = lerpWrapped(
						prevPos.y,
						bit.y,
						lerpSpeed,
						metadata.worldHeight,
					);
					next.bits.set(key, { x: newX, y: newY });
				});
				// Moons
				moons.forEach((moon, key) => {
					const prevPos = prev.moons.get(key) || { x: moon.x, y: moon.y };
					const newX = lerpWrapped(
						prevPos.x,
						moon.x,
						lerpSpeed,
						metadata.worldWidth,
					);
					const newY = lerpWrapped(
						prevPos.y,
						moon.y,
						lerpSpeed,
						metadata.worldHeight,
					);
					next.moons.set(key, { x: newX, y: newY });
				});
				return next;
			});
			raf = requestAnimationFrame(animateLerp);
		}
		raf = requestAnimationFrame(animateLerp);
		return () => cancelAnimationFrame(raf);
	}, [
		users,
		bits,
		moons,
		settings.lerp_strength,
		metadata.worldWidth,
		metadata.worldHeight,
	]);

	// Lerp camera position
	useEffect(() => {
		let raf: number;
		const lerpSpeed = settings.lerp_strength;
		function animateCamera() {
			setLerpedCamera((prev) => ({
				x: lerpWrapped(prev.x, self.x, lerpSpeed, metadata.worldWidth),
				y: lerpWrapped(prev.y, self.y, lerpSpeed, metadata.worldHeight),
			}));
			raf = requestAnimationFrame(animateCamera);
		}
		raf = requestAnimationFrame(animateCamera);
		return () => cancelAnimationFrame(raf);
	}, [
		self.x,
		self.y,
		metadata.worldWidth,
		metadata.worldHeight,
		settings.lerp_strength,
	]);

	const drawProps = useMemo(
		() => ({
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
			lerpedPositions,
			lerpedCamera,
			settings,
		}),
		[
			metadata,
			animatedWidth,
			canvasWidth,
			animatedHeight,
			canvasHeight,
			renderBuffer,
			users,
			self,
			bits,
			moons,
			identity,
			moonTrails,
			lerpedPositions,
			lerpedCamera,
			settings,
		],
	);

	useEffect(() => {
		let animationFrameId: number;
		const canvas = canvasRef.current as HTMLCanvasElement | null;
		if (!canvas) return;
		const context = canvas.getContext("2d");

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
		<Card className="border-4 border-zinc-800 bg-zinc-900 shadow-lg flex items-center justify-center w-full h-full max-h-[100vh] min-w-[100vh] min-h-[100vh] p-0">
			<CardContent className="flex items-center justify-center p-0 w-full h-full max-w-[100vh]">
				<canvas
					ref={canvasRef}
					width={animatedWidth || canvasWidth}
					height={animatedHeight || canvasHeight}
					className="w-full h-full block"
				/>
			</CardContent>
		</Card>
	);
}
