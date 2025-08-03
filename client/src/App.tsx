import { DBContextProvider } from "./app/DBContextProvider";
import { Canvas } from "./app/GameCanvas";
import { useInputHandler } from "./app/InputHandler";
import { useContext, useEffect, useState } from "react";
import { Context } from "./app/Context";
import { ConnectionForm, ConnectionFormSchema } from "./app/ConnectionForm";
import z from "zod";
import { Leaderboard } from "./app/Leaderboard";
import { ResetCountdown } from "./app/ResetCountdown";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "./components/ui/resizable";
import { getDefaultSettings, Settings, SettingsSchema } from "./app/Settings";
import { BackgroundCanvas } from "./app/BackgroundCanvas";

function App() {
	const [connected, setConnected] = useState<boolean>(false);
	const [canvasOpen, setCanvasOpen] = useState<boolean>(false);
	const [connectionForm, setConnectionForm] = useState<
		z.infer<typeof ConnectionFormSchema> | undefined
	>(undefined);
	const [settings, setSettings] =
		useState<z.infer<typeof SettingsSchema>>(getDefaultSettings());

	const [windowSize, setWindowSize] = useState({
		width: window.innerWidth,
		height: window.innerHeight,
	});

	const [canvasAspectRatio, setCanvasAspectRatio] = useState<number>(1);

	useEffect(() => {
		function handleResize() {
			setWindowSize({ width: window.innerWidth, height: window.innerHeight });
		}
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	return (
		<div className="flex min-h-svh max-h-screen flex-col items-center justify-center bg-zinc-950 text-primary-foreground">
			{!connected && connectionForm && (
				<BackgroundCanvas
					connectionForm={connectionForm}
					canvasWidth={windowSize.width}
					canvasHeight={windowSize.height}
				/>
			)}
			{!canvasOpen && (
				<>
					<h2 className="z-1 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mb-4">
						Not Enough Space
					</h2>
					<p className="z-1 text-lg text-muted-foreground mb-16">
						A multiplayer web game built on SpacetimeDB
					</p>
					<ConnectionForm
						onSubmit={(data) => {
							setConnectionForm(data);
							setCanvasOpen(true);
						}}
						setConnectionForm={setConnectionForm}
					/>
				</>
			)}
			{canvasOpen && connectionForm && (
				<DBContextProvider
					connected={connected}
					setConnected={setConnected}
					connectionForm={connectionForm}
					settings={settings}
					setCanvasOpen={setCanvasOpen}
					canvasAspectRatio={canvasAspectRatio}
				>
					{connected && (
						<ResizablePanelGroup
							direction="horizontal"
							className="w-full h-full"
						>
							<ResizablePanel defaultSize={27} minSize={15}>
								<ResizablePanelGroup
									direction="vertical"
									className="w-full h-full"
								>
									<ResizablePanel defaultSize={50} minSize={15}>
										<div className="flex flex-col h-full">
											<Leaderboard />
										</div>
									</ResizablePanel>
									<ResizableHandle className="bg-zinc-900 border-none" />
									<ResizablePanel defaultSize={20} minSize={15}>
										<div className="flex flex-col h-full">
											<ResetCountdown />
										</div>
									</ResizablePanel>
									<ResizableHandle className="bg-zinc-900 border-none" />
									<ResizablePanel minSize={15}>
										<div className="flex flex-col h-full">
											<Settings setSettings={setSettings} />
										</div>
									</ResizablePanel>
								</ResizablePanelGroup>
							</ResizablePanel>
							<ResizableHandle className="bg-zinc-900 border-none" />
							<ResizablePanel minSize={40}>
								<div className="flex flex-col h-full items-center justify-center">
									<CanvasWithInputHandler
										setCanvasAspectRatio={setCanvasAspectRatio}
									/>
								</div>
							</ResizablePanel>
						</ResizablePanelGroup>
					)}
				</DBContextProvider>
			)}
		</div>
	);
}

function CanvasWithInputHandler({
	setCanvasAspectRatio,
}: {
	setCanvasAspectRatio: (ratio: number) => void;
}) {
	const context = useContext(Context);
	const conn = context?.conn;
	useInputHandler(conn);
	return <Canvas setCanvasAspectRatio={setCanvasAspectRatio} />;
}

export default App;
