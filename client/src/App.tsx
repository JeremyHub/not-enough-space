import { DBContextProvider } from "./app/DBContextProvider";
import { Canvas } from "./app/Canvas";
import { useInputHandler } from "./app/InputHandler";
import { useContext, useState } from "react";
import { Context } from "./app/Context";
import { ConnectionForm, ConnectionFormSchema } from "./app/ConnectionForm";
import z from "zod";
import { Leaderboard } from "./app/Leaderboard";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "./components/ui/resizable";
import { getDefaultSettings, Settings, SettingsSchema } from "./app/Settings";

function App() {
	const [connected, setConnected] = useState<boolean>(false);
	const [canvasOpen, setCanvasOpen] = useState<boolean>(false);
	const [connectionForm, setConnectionForm] = useState<
		z.infer<typeof ConnectionFormSchema> | undefined
	>(undefined);
	const [settings, setSettings] =
		useState<z.infer<typeof SettingsSchema>>(getDefaultSettings());

	return (
		<div className="flex min-h-svh flex-col items-center justify-center bg-zinc-950 text-primary-foreground">
			{!canvasOpen && (
				<>
					<h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mb-4">
						Not Enough Space
					</h2>
					<p className="text-lg text-muted-foreground mb-16">
						A multiplayer web game built on SpacetimeDB
					</p>
					<ConnectionForm
						onSubmit={(data) => {
							setConnectionForm(data);
							setCanvasOpen(true);
						}}
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
									<CanvasWithInputHandler />
								</div>
							</ResizablePanel>
						</ResizablePanelGroup>
					)}
				</DBContextProvider>
			)}
		</div>
	);
}

function CanvasWithInputHandler() {
	const context = useContext(Context);
	const conn = context?.conn;
	useInputHandler(conn);
	return <Canvas />;
}

export default App;
