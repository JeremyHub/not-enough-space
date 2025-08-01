import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Bit, Moon, User } from "../module_bindings";
import { Context } from "./Context";
import { Card, CardContent } from "@/components/ui/card";
import {
	draw,
	getPositionsFromObjects,
	lerp,
	LerpedPositions,
} from "./render/helpers";

export function Canvas({
	setCanvasAspectRatio,
}: {
	setCanvasAspectRatio: (ratio: number) => void;
}) {
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
		staticMetadata,
		viewportWorldWidth,
		viewportWorldHeight,
		renderBuffer,
		settings,
		removingBits,
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

	// --- ANIMATE CANVAS SIZE when user grows / shrinks in size---
	const [animatedViewportWidth, setAnimatedViewportWidth] = useState<
		number | null
	>(null);
	const [animatedViewportHeight, setAnimatedViewportHeight] = useState<
		number | null
	>(null);
	useEffect(() => {
		let raf: number;
		const growSpeed = 0.5;
		function animate() {
			setAnimatedViewportWidth((prev) => {
				const target = viewportWorldWidth;
				if (prev === null) return target;
				if (prev < target) return Math.min(prev + growSpeed, target);
				if (prev > target) return Math.max(prev - growSpeed, target);
				return prev;
			});
			setAnimatedViewportHeight((prev) => {
				const target = viewportWorldHeight;
				if (prev === null) return target;
				if (prev < target) return Math.min(prev + growSpeed, target);
				if (prev > target) return Math.max(prev - growSpeed, target);
				return prev;
			});
			raf = requestAnimationFrame(animate);
		}
		raf = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(raf);
	}, [viewportWorldWidth, viewportWorldHeight]);

	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	// --- Responsive canvas size ---
	const [canvasSize, setCanvasSize] = useState<{
		width: number;
		height: number;
	}>({ width: 100, height: 100 });
	const containerRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		const observer = new ResizeObserver(() => {
			if (containerRef.current) {
				setCanvasSize({
					width: containerRef.current.clientWidth,
					height: containerRef.current.clientHeight,
				});
				setCanvasAspectRatio(
					containerRef.current.clientWidth / containerRef.current.clientHeight,
				);
			}
		});
		if (containerRef.current) observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, [setCanvasAspectRatio]);

	// --- Compute scale and offset to fit virtual viewport into canvas ---
	const virtualWidth = animatedViewportWidth ?? viewportWorldWidth;
	const virtualHeight = animatedViewportHeight ?? viewportWorldHeight;
	const scale = Math.min(
		canvasSize.width / virtualWidth,
		canvasSize.height / virtualHeight,
	);
	const offsetX = (canvasSize.width - virtualWidth * scale) / 2;
	const offsetY = (canvasSize.height - virtualHeight * scale) / 2;

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
		let lastTime = performance.now();
		function animateLerp(now: number) {
			const dt = (now - lastTime) / 1000; // seconds
			lastTime = now;
			const duration = 1 / staticMetadata.ticksPerSecond;
			const lerpFactor = 1 - Math.exp(-dt / duration);
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
						lerpFactor,
						staticMetadata.worldWidth,
					);
					const newY = lerpWrapped(
						prevPos.y,
						user.y,
						lerpFactor,
						staticMetadata.worldHeight,
					);
					next.users.set(key, { x: newX, y: newY });
				});
				// Bits
				bits.forEach((bit, key) => {
					const prevPos = prev.bits.get(key) || { x: bit.x, y: bit.y };
					const newX = lerpWrapped(
						prevPos.x,
						bit.x,
						lerpFactor,
						staticMetadata.worldWidth,
					);
					const newY = lerpWrapped(
						prevPos.y,
						bit.y,
						lerpFactor,
						staticMetadata.worldHeight,
					);
					next.bits.set(key, { x: newX, y: newY });
				});
				// Moons
				moons.forEach((moon, key) => {
					const prevPos = prev.moons.get(key) || { x: moon.x, y: moon.y };
					// --- ARC LERP FOR ORBITING MOONS ---
					if (moon.orbiting && users.has(moon.orbiting.toHexString())) {
						const user = users.get(moon.orbiting.toHexString())!;
						const prevUserPos = prev.users.get(moon.orbiting.toHexString()) || {
							x: user.x,
							y: user.y,
						};
						const nextUserPos = { x: user.x, y: user.y };
						// Compute prev/next angles from user to moon
						// --- Compute wrapped dx/dy for prev and next ---
						const worldWidth = staticMetadata.worldWidth;
						const worldHeight = staticMetadata.worldHeight;
						function wrappedDelta(a: number, b: number, size: number) {
							let d = a - b;
							if (d > size / 2) d -= size;
							if (d < -size / 2) d += size;
							return d;
						}
						const prevDx = wrappedDelta(prevPos.x, prevUserPos.x, worldWidth);
						const prevDy = wrappedDelta(prevPos.y, prevUserPos.y, worldHeight);
						const nextDx = wrappedDelta(moon.x, nextUserPos.x, worldWidth);
						const nextDy = wrappedDelta(moon.y, nextUserPos.y, worldHeight);
						const prevAngle = Math.atan2(prevDy, prevDx);
						const nextAngle = Math.atan2(nextDy, nextDx);
						// Lerp angle, handling wrapping
						let deltaAngle = nextAngle - prevAngle;
						if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
						if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
						const lerpedAngle = prevAngle + deltaAngle * lerpFactor;
						// Lerp user position
						const lerpedUserX = lerpWrapped(
							prevUserPos.x,
							nextUserPos.x,
							lerpFactor,
							worldWidth,
						);
						const lerpedUserY = lerpWrapped(
							prevUserPos.y,
							nextUserPos.y,
							lerpFactor,
							worldHeight,
						);
						// --- Calculate radius as lerped distance between moon and user, with wrapping ---
						const prevR = Math.sqrt(prevDx * prevDx + prevDy * prevDy);
						const nextR = Math.sqrt(nextDx * nextDx + nextDy * nextDy);
						const r = lerp(prevR, nextR, lerpFactor);
						const newX = lerpedUserX + Math.cos(lerpedAngle) * r;
						const newY = lerpedUserY + Math.sin(lerpedAngle) * r;
						next.moons.set(key, { x: newX, y: newY });
					} else {
						// Default lerp
						const newX = lerpWrapped(
							prevPos.x,
							moon.x,
							lerpFactor,
							staticMetadata.worldWidth,
						);
						const newY = lerpWrapped(
							prevPos.y,
							moon.y,
							lerpFactor,
							staticMetadata.worldHeight,
						);
						next.moons.set(key, { x: newX, y: newY });
					}
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
		staticMetadata.ticksPerSecond,
		staticMetadata.worldWidth,
		staticMetadata.worldHeight,
	]);

	// Lerp camera position (time-based, determined by ticksPerSecond)
	useEffect(() => {
		let raf: number;
		let lastTime = performance.now();
		function animateCamera(now: number) {
			const dt = (now - lastTime) / 1000; // seconds
			lastTime = now;
			const duration = 1 / staticMetadata.ticksPerSecond;
			const lerpFactor = 1 - Math.exp(-dt / duration);
			setLerpedCamera((prev) => ({
				x: lerpWrapped(prev.x, self.x, lerpFactor, staticMetadata.worldWidth),
				y: lerpWrapped(prev.y, self.y, lerpFactor, staticMetadata.worldHeight),
			}));
			raf = requestAnimationFrame(animateCamera);
		}
		raf = requestAnimationFrame(animateCamera);
		return () => cancelAnimationFrame(raf);
	}, [
		self.x,
		self.y,
		staticMetadata.worldWidth,
		staticMetadata.worldHeight,
		staticMetadata.ticksPerSecond,
	]);

	// --- Draw Props ---
	const drawProps = useMemo(
		() => ({
			staticMetadata,
			canvasWidth: virtualWidth,
			canvasHeight: virtualHeight,
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
		}),
		[
			staticMetadata,
			virtualWidth,
			virtualHeight,
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
		],
	);

	useEffect(() => {
		let animationFrameId: number;
		const canvas = canvasRef.current as HTMLCanvasElement | null;
		if (!canvas) return;
		const context = canvas.getContext("2d");
		if (!context) return;

		const render = () => {
			// Reset transform, then apply scale and offset
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, canvas.width, canvas.height);
			context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
			draw(context, drawProps);
			animationFrameId = window.requestAnimationFrame(render);
		};
		render();

		return () => {
			window.cancelAnimationFrame(animationFrameId);
		};
	}, [drawProps, canvasSize.width, canvasSize.height, scale, offsetX, offsetY]);

	return (
		<Card className="border-4 border-zinc-800 bg-[rgb(23,23,23)] shadow-lg flex items-center justify-center w-full h-full p-0">
			<CardContent
				ref={containerRef}
				className="flex items-center justify-center p-0 w-full h-full overflow-hidden max-w-[100vw] max-h-[100vh]"
				style={{ width: "100%", height: "100%" }}
			>
				<canvas
					ref={canvasRef}
					width={canvasSize.width}
					height={canvasSize.height}
					className="w-full h-full"
				/>
			</CardContent>
		</Card>
	);
}
