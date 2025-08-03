import { useContext, useEffect, useState } from "react";
import { Context } from "./Context";
import { Card, CardContent } from "@/components/ui/card";

export function ResetCountdown() {
	const context = useContext(Context);
	if (!context) {
		throw new Error("DBContext is not available");
	}
	const { staticMetadata, dynamicMetadata } = context;

	const updatesPerSecond = staticMetadata.gameResetUpdatesPerSecond;
	const updatesUntilReset = dynamicMetadata.gameResetUpdatesUntilReset;

	const totalSeconds =
		updatesPerSecond > 0
			? Math.max(0, Math.floor(updatesUntilReset / updatesPerSecond))
			: 0;

	const [secondsLeft, setSecondsLeft] = useState(totalSeconds);

	useEffect(() => {
		setSecondsLeft(totalSeconds);
	}, [totalSeconds]);

	useEffect(() => {
		if (secondsLeft <= 0) return;
		const interval = setInterval(() => {
			setSecondsLeft((prev) => Math.max(0, prev - 1));
		}, 1000);
		return () => clearInterval(interval);
	}, [secondsLeft]);

	const minutes = Math.floor(secondsLeft / 60);
	const seconds = secondsLeft % 60;

	return (
		<Card className="border-4 border-zinc-800 bg-zinc-900 shadow-lg w-full h-full flex flex-col p-0 bg-zinc-950 overflow-hidden">
			<CardContent className="p-0 flex-1 flex flex-col justify-center items-center overflow-auto max-w-full">
				<div className="text-zinc-300 text-lg font-mono px-2 py-1 text-center">
					Next game reset in: {minutes}:{seconds.toString().padStart(2, "0")}
				</div>
				<div className="text-zinc-500 text-sm font-mono px-2 py-1 text-center">
					The game will fully reset, clearing all player & world data.
				</div>
			</CardContent>
		</Card>
	);
}
