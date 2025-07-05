import './App.css';
import { DBContextProvider } from './app/DBContextProvider';
import { Canvas } from './app/Canvas';
import { useInputHandler } from './app/InputHandler';
import { useContext } from 'react';
import { DBContext } from './app/DBContext';


function App() {
  return (
    <div className="App">
      <DBContextProvider>
        <CanvasWithInputHandler />
      </DBContextProvider>
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
