import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Bit, Moon, User } from "../module_bindings";
import { Context } from "./Context";
import { Card, CardContent } from "@/components/ui/card";
import {
	draw,
	getPositionsFromObjects,
	lerp,
	LerpedPositions,
	MoonTrails,
} from "./render/helpers";
import {
	MAX_VIEWPORT_WIDTH,
	MIN_VIEWPORT_HEIGHT,
	MIN_VIEWPORT_WIDTH,
} from "./DBContextProvider";

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
		staticMetadata,
		viewportWorldWidth,
		viewportWorldHeight,
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
	const [moonTrails, setMoonTrails] = useState<MoonTrails>(new Map());

	useEffect(() => {
		setMoonTrails((prev) => {
			const newTrails = new Map(prev);
			moons.forEach((moon, moonId) => {
				const lerpedMoon = lerpedPositions.moons.get(moonId) || moon;
				const parentId = moon.orbiting?.toHexString?.() || null;
				let x;
				let y;
				if (!parentId) {
					x = lerpedMoon.x;
					y = lerpedMoon.y;
				} else {
					const parent = lerpedPositions.users.get(parentId);
					if (!parent) return;
					x = lerpedMoon.x - parent.x;
					y = lerpedMoon.y - parent.y;
				}
				const prevTrail = newTrails.get(moon.moonId) || [];
				const updatedTrail = [...prevTrail, { x, y, parentId }].slice(-20);
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

	// --- ANIMATE CANVAS SIZE when user grows / shrinks in size---
	useEffect(() => {
		let raf: number;
		const growSpeed = 0.5;

		function animate() {
			setAnimatedWidth((prev) => {
				const target = viewportWorldWidth;
				if (prev === null) return target;
				if (prev < target) return Math.min(prev + growSpeed, target);
				if (prev > target) return Math.max(prev - growSpeed, target);
				return prev;
			});
			setAnimatedHeight((prev) => {
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
	}, [viewportWorldHeight, viewportWorldWidth]);

	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	let upscaling_quality;

	// when zoomed in (ratio of (viewport-minviewport)/(maxviewport-minviewport) is small) then it should be the value of settings, otherwise gets closer to 1 as the ratio gets larger
	if (viewportWorldWidth > viewportWorldHeight) {
		upscaling_quality =
			(1 -
				(viewportWorldWidth - MIN_VIEWPORT_WIDTH) /
					(MAX_VIEWPORT_WIDTH - MIN_VIEWPORT_WIDTH)) *
				settings.upscaling_quality +
			1;
	} else {
		upscaling_quality =
			(1 -
				(viewportWorldHeight - MIN_VIEWPORT_HEIGHT) /
					(MAX_VIEWPORT_WIDTH - MIN_VIEWPORT_HEIGHT)) *
				settings.upscaling_quality +
			1;
	}

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
						staticMetadata.worldWidth,
					);
					const newY = lerpWrapped(
						prevPos.y,
						user.y,
						lerpSpeed,
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
						lerpSpeed,
						staticMetadata.worldWidth,
					);
					const newY = lerpWrapped(
						prevPos.y,
						bit.y,
						lerpSpeed,
						staticMetadata.worldHeight,
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
						staticMetadata.worldWidth,
					);
					const newY = lerpWrapped(
						prevPos.y,
						moon.y,
						lerpSpeed,
						staticMetadata.worldHeight,
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
		staticMetadata.worldWidth,
		staticMetadata.worldHeight,
	]);

	// Lerp camera position
	useEffect(() => {
		let raf: number;
		const lerpSpeed = settings.lerp_strength;
		function animateCamera() {
			setLerpedCamera((prev) => ({
				x: lerpWrapped(prev.x, self.x, lerpSpeed, staticMetadata.worldWidth),
				y: lerpWrapped(prev.y, self.y, lerpSpeed, staticMetadata.worldHeight),
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
		settings.lerp_strength,
	]);

	const drawProps = useMemo(
		() => ({
			staticMetadata,
			canvasWidth: animatedWidth ?? viewportWorldWidth,
			canvasHeight: animatedHeight ?? viewportWorldHeight,
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
			staticMetadata,
			animatedWidth,
			viewportWorldWidth,
			animatedHeight,
			viewportWorldHeight,
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
		if (!context) return;

		const render = () => {
			context.setTransform(upscaling_quality, 0, 0, upscaling_quality, 0, 0);
			draw(context, drawProps);
			animationFrameId = window.requestAnimationFrame(render);
		};
		render();

		return () => {
			window.cancelAnimationFrame(animationFrameId);
		};
	}, [drawProps, upscaling_quality, animatedHeight, animatedWidth]);

	return (
		<Card className="border-4 border-zinc-800 bg-zinc-900 shadow-lg flex items-center justify-center w-full h-full max-h-[100vh] min-w-[100vh] min-h-[100vh] p-0">
			<CardContent className="flex items-center justify-center p-0 min-w-[100vh] min-h-[100vh] max-w-[100vh]">
				<canvas
					ref={canvasRef}
					width={(animatedWidth || viewportWorldWidth) * upscaling_quality}
					height={(animatedHeight || viewportWorldHeight) * upscaling_quality}
					className="min-w-[100vh] min-h-[100vh] block"
				/>
			</CardContent>
		</Card>
	);
}
