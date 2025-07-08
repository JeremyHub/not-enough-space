import { useEffect } from "react";
import { DbConnection } from "../module_bindings";

export function useInputHandler(conn: DbConnection | undefined) {
	useEffect(() => {
		if (!conn) return;

		const pressed = new Set<string>();
		let lastDirVecX: number | undefined = undefined;
		let lastDirVecY: number | undefined = undefined;

		const getDirection = (): { dirVecX: number; dirVecY: number } => {
			const up = pressed.has("w") || pressed.has("ArrowUp");
			const down = pressed.has("s") || pressed.has("ArrowDown");
			const left = pressed.has("a") || pressed.has("ArrowLeft");
			const right = pressed.has("d") || pressed.has("ArrowRight");

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
			if (key === " " && !pressed.has(" ")) {
				conn.reducers.sacrificeHealthForMoonReducer();
			}
			pressed.add(key.toLowerCase());
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

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		window.addEventListener("blur", handleBlur);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
			window.removeEventListener("blur", handleBlur);
		};
	}, [conn]);
}
