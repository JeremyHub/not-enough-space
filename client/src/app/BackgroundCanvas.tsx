import { useEffect, useRef } from "react";
import { drawGrid, drawUser } from "./render/helpers";
import { ConnectionFormSchema } from "./ConnectionForm";
import z from "zod";

export function BackgroundCanvas({
	connectionForm,
	canvasWidth,
	canvasHeight,
}: {
	connectionForm: z.infer<typeof ConnectionFormSchema>;
	canvasWidth: number;
	canvasHeight: number;
}) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const requestRef = useRef<number | null>(null);
	const angleRef = useRef<number>(0);

	useEffect(() => {
		let running = true;
		function animate() {
			if (!running) return;
			const canvas = canvasRef.current;
			if (!canvas) return;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			ctx.fillStyle = "rgb(23, 23, 23)";
			ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

			drawGrid(ctx, 0, 0, canvasWidth, canvasHeight, 1);
			angleRef.current += 0.003;
			ctx.save();
			ctx.translate(canvasWidth / 2, canvasHeight / 2);
			ctx.rotate(angleRef.current);
			drawUser(
				ctx,
				{
					size: canvasWidth / 3,
					color: {
						r: parseInt(connectionForm.color.slice(1, 3), 16),
						g: parseInt(connectionForm.color.slice(3, 5), 16),
						b: parseInt(connectionForm.color.slice(5, 7), 16),
					},
					seed: connectionForm.seed,
					username: "",
				},
				0,
				0,
			);
			ctx.restore();
			requestRef.current = requestAnimationFrame(animate);
		}
		animate();
		return () => {
			running = false;
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
		};
	}, [canvasWidth, canvasHeight, connectionForm]);

	return (
		<canvas
			ref={canvasRef}
			width={canvasWidth}
			height={canvasHeight}
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100vw",
				height: "100vh",
				pointerEvents: "none",
				opacity: 0.3,
			}}
		/>
	);
}
