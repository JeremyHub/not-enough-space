import './App.css';
import { DBContextProvider } from './app/DBContextProvider';
import { Canvas } from './app/Canvas';
import { useInputHandler } from './app/InputHandler';
import { useContext, useState } from 'react';
import { DBContext } from './app/DBContext';
import { ConnectionForm, ConnectionFormSchema } from './app/ConnectionForm';
import z from 'zod';

function App() {

  const [connected, setConnected] = useState<boolean>(false);
  const [canvasOpen, setCanvasOpen] = useState<boolean>(false);
  const [connectionForm, setConnectionForm] = useState<z.infer<typeof ConnectionFormSchema> | undefined>(undefined);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-950 dark:bg-white text-white dark:text-black">
      {!canvasOpen &&
        <ConnectionForm onSubmit={(data) => {
          setConnectionForm(data);
          setConnected(true);
          setCanvasOpen(true);
        }} />
      }
      {canvasOpen && connectionForm && <DBContextProvider connected={connected} setConnected={setConnected} uri={connectionForm.uri}>
        <CanvasWithInputHandler />
      </DBContextProvider>}
    </div>
  );
}

function CanvasWithInputHandler() {
  const context = useContext(DBContext);
  const conn = context?.conn;
  useInputHandler(conn);
  return <Canvas />;
}

export default App;
