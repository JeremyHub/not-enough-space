import { Bit, Moon, Color, StaticMetadata, User } from "../../module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import { SettingsSchema } from "../Settings";
import z from "zod";
import { BIT_REMOVE_ANIMATION_DURATION } from "../DBContextProvider";

type DrawProps = {
	staticMetadata: StaticMetadata;
	canvasWidth: number;
	canvasHeight: number;
	renderBuffer: number;
	users: Map<string, User>;
	self: User;
	bits: Map<number, Bit>;
	moons: Map<number, Moon>;
	identity: Identity;
	settings: z.infer<typeof SettingsSchema>;
	removingBits?: Map<number, { bit: Bit; start: number }>;
};

export function lerp(a: number, b: number, t: number) {
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
	const bestFontSize = Math.floor(radius * 4) / text.length;
	ctx.font = `bold ${bestFontSize}px sans-serif`;
	ctx.fillStyle = color;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.shadowColor = "rgba(0,0,0,0.7)";
	ctx.shadowBlur = 4;
	ctx.fillText(text, x, y);
}

export function renderCircle(
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

function wrapCoords(
	self: User,
	x: number,
	y: number,
	staticMetadata: StaticMetadata,
	canvasWidth: number,
	canvasHeight: number,
	renderBuffer: number,
) {
	let new_x: number = x;
	let new_y: number = y;
	if (self.x < canvasWidth / 2) {
		if (x > canvasWidth + renderBuffer) {
			new_x = x - staticMetadata.worldWidth;
		}
	}
	if (self.x > staticMetadata.worldWidth - canvasWidth / 2) {
		if (x < -renderBuffer) {
			new_x = x + staticMetadata.worldWidth;
		}
	}
	if (self.y < canvasHeight / 2) {
		if (y > canvasHeight + renderBuffer) {
			new_y = y - staticMetadata.worldHeight;
		}
	}
	if (self.y > staticMetadata.worldHeight - canvasHeight / 2) {
		if (y < -renderBuffer) {
			new_y = y + staticMetadata.worldHeight;
		}
	}
	return { x: new_x, y: new_y };
}

function renderWithWrap(
	renderFn: (x: number, y: number) => void,
	staticMetadata: StaticMetadata,
	canvasWidth: number,
	canvasHeight: number,
	renderBuffer: number,
	self: User,
	x: number,
	y: number,
) {
	const { x: new_x, y: new_y } = wrapCoords(
		self,
		x,
		y,
		staticMetadata,
		canvasWidth,
		canvasHeight,
		renderBuffer,
	);
	renderFn(new_x, new_y);
}

type Position = { x: number; y: number };
export type LerpedPositions = {
	users: Map<string, Position>;
	bits: Map<number, Position>;
	moons: Map<number, Position>;
};

// --- Helper to get positions from objects ---
export function getPositionsFromObjects<K, T extends { x: number; y: number }>(
	map: Map<K, T>,
): Map<K, Position> {
	const result = new Map<K, Position>();
	map.forEach((obj, key) => {
		result.set(key, { x: obj.x, y: obj.y });
	});
	return result;
}

export function drawGrid(
	ctx: CanvasRenderingContext2D,
	cameraX: number,
	cameraY: number,
	canvasWidth: number,
	canvasHeight: number,
	alpha: number = 0.3,
) {
	const GRID_SIZE = 50;
	ctx.strokeStyle = `rgba(200,200,200,${alpha})`;
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
}

function drawWorldBoundaries(
	ctx: CanvasRenderingContext2D,
	staticMetadata: StaticMetadata,
	cameraX: number,
	cameraY: number,
	canvasWidth: number,
	canvasHeight: number,
) {
	ctx.save();
	ctx.strokeStyle = "rgba(255,0,0,0.7)";
	ctx.lineWidth = 2;

	const worldLeft = cameraX - canvasWidth / 2;
	const worldTop = cameraY - canvasHeight / 2;

	const leftBorderX = staticMetadata.worldWidth > 0 ? 0 - worldLeft : 0;
	const rightBorderX =
		staticMetadata.worldWidth > 0
			? staticMetadata.worldWidth - worldLeft
			: canvasWidth;
	const topBorderY = staticMetadata.worldHeight > 0 ? 0 - worldTop : 0;
	const bottomBorderY =
		staticMetadata.worldHeight > 0
			? staticMetadata.worldHeight - worldTop
			: canvasHeight;

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

export function drawBits(
	ctx: CanvasRenderingContext2D,
	bits: Map<number, Bit>,
	lerpedPositions: LerpedPositions | undefined,
	toScreen: (obj: { x: number; y: number }) => { x: number; y: number },
	staticMetadata: StaticMetadata,
	canvasWidth: number,
	canvasHeight: number,
	renderBuffer: number,
	self: User,
	cameraX: number,
	cameraY: number,
	removingBits?: Map<number, { bit: Bit; start: number }>,
) {
	// Draw normal bits
	bits.forEach((bit, key) => {
		const pos = lerpedPositions?.bits.get(key) || bit;
		const { x, y } = toScreen(pos);
		renderWithWrap(
			(px, py) => renderCircle(ctx, bit.size, px, py, bit.color, true),
			staticMetadata,
			canvasWidth,
			canvasHeight,
			renderBuffer,
			{ ...self, x: cameraX, y: cameraY },
			x,
			y,
		);
	});

	// Draw removing bits with shrinking animation
	if (removingBits) {
		const now = Date.now();
		removingBits.forEach(({ bit, start }, key) => {
			const t = Math.min((now - start) / BIT_REMOVE_ANIMATION_DURATION, 1);
			const shrinkSize = bit.size * (1 - t);
			const pos = lerpedPositions?.bits.get(key) || bit;
			const { x, y } = toScreen(pos);
			renderWithWrap(
				(px, py) => {
					if (shrinkSize > 0) {
						renderCircle(ctx, shrinkSize, px, py, bit.color, true);
					}
				},
				staticMetadata,
				canvasWidth,
				canvasHeight,
				renderBuffer,
				{ ...self, x: cameraX, y: cameraY },
				x,
				y,
			);
		});
	}
}

function drawGravityWell(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	layers: number,
	noiseStrength: number,
	seed: number,
) {
	ctx.save();
	const maxR = radius + layers;
	const gradient = ctx.createRadialGradient(x, y, radius, x, y, maxR);
	gradient.addColorStop(1, "rgba(0,0,0,1)");
	gradient.addColorStop(0, "rgba(0,0,0,0)");

	const rand = seededRandom(seed);

	for (let i = layers; i > 0; i--) {
		const r = radius + i;
		ctx.beginPath();
		for (let a = 0; a <= Math.PI * 2; a += Math.PI / 32) {
			const noise = (rand() - 0.5) * noiseStrength * (i / layers);
			const nx = x + Math.cos(a) * (r + noise);
			const ny = y + Math.sin(a) * (r + noise);
			ctx.lineTo(nx, ny);
		}
		ctx.closePath();
		ctx.fillStyle = gradient;
		ctx.fill();
	}
	ctx.restore();
}

// Simple seeded random number generator (mulberry32)
export function seededRandom(seed: number) {
	let t = seed + 0x6d2b79f5;
	return function () {
		t += 0x6d2b79f5;
		let r = Math.imul(t ^ (t >>> 15), 1 | t);
		r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
		return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
	};
}

// Helper to slightly vary a color
function varyColor(color: Color, rand: () => number, amount = 30): Color {
	return {
		r: Math.max(
			0,
			Math.min(255, color.r + Math.floor((rand() - 0.5) * amount)),
		),
		g: Math.max(
			0,
			Math.min(255, color.g + Math.floor((rand() - 0.5) * amount)),
		),
		b: Math.max(
			0,
			Math.min(255, color.b + Math.floor((rand() - 0.5) * amount)),
		),
	};
}

// Draw a patchwork of random shapes inside a circle
function drawPatchwork(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	baseColor: Color,
	seed: number,
) {
	const rand = seededRandom(seed);
	const numPatches = 50 + Math.floor(rand() * 5);

	ctx.save();
	// Clip to the main circle
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.clip();

	for (let i = 0; i < numPatches; i++) {
		// Random center within the circle
		const patchAngle = rand() * Math.PI * 2;
		const patchDist = rand() * (radius - 2); // keep inside edge
		const cx = Math.cos(patchAngle) * patchDist;
		const cy = Math.sin(patchAngle) * patchDist;

		const angle = rand() * Math.PI * 2;
		const patchRadius = radius * (0.4 + rand() * 0.5);
		const patchType = Math.floor(rand() * 3); // 0: arc, 1: polygon, 2: blob
		const patchColor = varyColor(baseColor, rand, 40);

		ctx.save();
		ctx.beginPath();
		ctx.translate(x + cx, y + cy);

		if (patchType === 0) {
			// Arc
			const start = rand() * Math.PI * 2;
			const end = start + rand() * Math.PI * 1.2;
			ctx.arc(0, 0, patchRadius, start, end);
			ctx.lineTo(0, 0);
		} else if (patchType === 1) {
			// Polygon
			const sides = 3 + Math.floor(rand() * 4);
			for (let j = 0; j < sides; j++) {
				const a = angle + (j / sides) * Math.PI * 2;
				const r = patchRadius * (0.8 + rand() * 0.4);
				const px = Math.cos(a) * r;
				const py = Math.sin(a) * r;
				if (j === 0) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
			}
			ctx.closePath();
		} else {
			// Blob (random points)
			const points = 6 + Math.floor(rand() * 4);
			for (let j = 0; j < points; j++) {
				const a = angle + (j / points) * Math.PI * 2;
				const r = patchRadius * (0.7 + rand() * 0.6);
				const px = Math.cos(a) * r;
				const py = Math.sin(a) * r;
				if (j === 0) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
			}
			ctx.closePath();
		}

		ctx.fillStyle = `rgba(${patchColor.r},${patchColor.g},${patchColor.b},1)`;
		ctx.fill();
		ctx.restore();
	}
	ctx.restore();
}

export function drawUser(
	ctx: CanvasRenderingContext2D,
	user: {
		size: number;
		color: Color;
		seed: bigint;
		username?: string;
		invincibilityTicksLeft: number;
	},
	px: number,
	py: number,
) {
	// Draw outer circle
	renderCircle(ctx, user.size, px, py, user.color);

	// Draw patchwork inside circle
	drawPatchwork(ctx, px, py, user.size, user.color, Number(user.seed));

	// Draw gravity well effect
	drawGravityWell(
		ctx,
		px,
		py,
		user.size,
		user.size / 20,
		user.size / 10,
		Number(user.seed),
	);

	if (user.invincibilityTicksLeft) {
		// Draw invincibility effect start animation while invincibilityTicksLeft > 0 that flashes the user white
		ctx.save();
		const invincibilitySpeed = 120;
		ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / invincibilitySpeed);
		renderCircle(ctx, user.size, px, py, { r: 255, g: 255, b: 255 });
		ctx.restore();
	}

	// Draw username
	if (user.username) {
		ctx.save();
		renderTextInCircle(ctx, user.username, px, py, user.size);
		ctx.restore();
	}
}

function drawUsers(
	ctx: CanvasRenderingContext2D,
	users: Map<string, User>,
	identity: Identity,
	lerpedPositions: LerpedPositions | undefined,
	toScreen: (obj: { x: number; y: number }) => { x: number; y: number },
	staticMetadata: StaticMetadata,
	canvasWidth: number,
	canvasHeight: number,
	renderBuffer: number,
	self: User,
	cameraX: number,
	cameraY: number,
) {
	// Sort users by identity before drawing
	const sortedUsers = Array.from(users.entries())
		.filter((entry) => entry[1].identity.data !== identity.data)
		.sort((a, b) => {
			const idA = a[1].identity.toHexString();
			const idB = b[1].identity.toHexString();
			return idA.localeCompare(idB);
		});
	sortedUsers.forEach(([key, user]) => {
		const pos = lerpedPositions?.users.get(key) || user;
		const { x, y } = toScreen(pos);
		renderWithWrap(
			(px, py) => {
				drawUser(ctx, user, px, py);
			},
			staticMetadata,
			canvasWidth,
			canvasHeight,
			renderBuffer,
			{ ...self, x: cameraX, y: cameraY },
			x,
			y,
		);
	});
}

function drawSelf(
	ctx: CanvasRenderingContext2D,
	self: User,
	canvasWidth: number,
	canvasHeight: number,
) {
	drawUser(ctx, self, canvasWidth / 2, canvasHeight / 2);
}

function drawMoonTrails(
	ctx: CanvasRenderingContext2D,
	moons: Map<number, Moon>,
	lerpedPositions: LerpedPositions | undefined,
	toScreen: (obj: { x: number; y: number }) => { x: number; y: number },
	users: Map<string, User>,
) {
	moons.forEach((moon, key) => {
		// Only draw trail if moon is orbiting a user
		if (!moon.orbiting) return;

		const user = users.get(moon.orbiting.toHexString());
		if (!user) return;
		const userPos =
			lerpedPositions?.users.get(moon.orbiting.toHexString()) || user;
		const moonPos = lerpedPositions?.moons.get(key) || moon;

		// Calculate orbit center and moon position in screen coords
		const centerScreen = toScreen(userPos);

		// Calculate orbit radius and angle dynamically
		const dx = moonPos.x - userPos.x;
		const dy = moonPos.y - userPos.y;
		const orbitRadius = Math.sqrt(dx * dx + dy * dy);
		const orbitAngle = Math.atan2(dy, dx);

		// Trail length in radians is now based on moon size
		const trailLength = moon.size * 0.05;

		let startAngle: number, endAngle: number, counterclockwise: boolean;

		if (typeof moon.orbitalVelocity === "number" && moon.orbitalVelocity < 0) {
			// Clockwise orbit: trail is behind, so arc goes forward in angle (increasing)
			startAngle = orbitAngle;
			endAngle = orbitAngle + trailLength;
			counterclockwise = false;
		} else {
			// Counterclockwise orbit: trail is behind, so arc goes backward in angle (decreasing)
			startAngle = orbitAngle;
			endAngle = orbitAngle - trailLength;
			counterclockwise = true;
		}

		ctx.save();
		ctx.beginPath();
		ctx.strokeStyle = `rgba(${moon.color.r},${moon.color.g},${moon.color.b},0.35)`;
		ctx.lineWidth = Math.max(2, moon.size * 0.5);

		// Draw arc in screen space, centered at user
		ctx.arc(
			centerScreen.x,
			centerScreen.y,
			orbitRadius,
			startAngle,
			endAngle,
			counterclockwise,
		);
		ctx.stroke();
		ctx.restore();
	});
}

function drawMoons(
	ctx: CanvasRenderingContext2D,
	moons: Map<number, Moon>,
	lerpedPositions: LerpedPositions | undefined,
	toScreen: (obj: { x: number; y: number }) => { x: number; y: number },
	staticMetadata: StaticMetadata,
	canvasWidth: number,
	canvasHeight: number,
	renderBuffer: number,
	self: User,
	cameraX: number,
	cameraY: number,
) {
	moons.forEach((moon, key) => {
		const pos = lerpedPositions?.moons.get(key) || moon;
		const { x, y } = toScreen(pos);
		renderWithWrap(
			(px, py) => renderCircle(ctx, moon.size, px, py, moon.color),
			staticMetadata,
			canvasWidth,
			canvasHeight,
			renderBuffer,
			{ ...self, x: cameraX, y: cameraY },
			x,
			y,
		);
	});
}

export const draw = (
	ctx: CanvasRenderingContext2D | null,
	props: DrawProps & {
		lerpedPositions?: LerpedPositions;
		lerpedCamera?: { x: number; y: number };
	},
) => {
	const {
		staticMetadata: metadata,
		canvasWidth,
		canvasHeight,
		renderBuffer,
		users,
		self,
		bits,
		moons,
		identity,
		lerpedPositions,
		lerpedCamera,
		settings,
		removingBits,
	} = props;
	if (!ctx) return;

	// Use lerpedCamera for camera position
	const cameraX = lerpedCamera?.x ?? self.x;
	const cameraY = lerpedCamera?.y ?? self.y;

	drawGrid(ctx, cameraX, cameraY, canvasWidth, canvasHeight);

	if (settings.show_world_boundaries) {
		drawWorldBoundaries(
			ctx,
			metadata,
			cameraX,
			cameraY,
			canvasWidth,
			canvasHeight,
		);
	}

	const toScreen = (obj: { x: number; y: number }) => ({
		x: obj.x - cameraX + canvasWidth / 2,
		y: obj.y - cameraY + canvasHeight / 2,
	});

	drawBits(
		ctx,
		bits,
		lerpedPositions,
		toScreen,
		metadata,
		canvasWidth,
		canvasHeight,
		renderBuffer,
		self,
		cameraX,
		cameraY,
		removingBits,
	);

	drawUsers(
		ctx,
		users,
		identity,
		lerpedPositions,
		toScreen,
		metadata,
		canvasWidth,
		canvasHeight,
		renderBuffer,
		self,
		cameraX,
		cameraY,
	);

	drawSelf(ctx, self, canvasWidth, canvasHeight);

	drawMoonTrails(
		ctx,
		moons,
		lerpedPositions,
		toScreen,
		users, // pass users map for orbit center lookup
	);

	drawMoons(
		ctx,
		moons,
		lerpedPositions,
		toScreen,
		metadata,
		canvasWidth,
		canvasHeight,
		renderBuffer,
		self,
		cameraX,
		cameraY,
	);
};
