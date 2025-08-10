import React from 'react';
import { AnimationState } from '../../types';
import { IS_TOUCH_DEVICE } from '../../constants';

interface FPVUIProps {
  state: AnimationState;
  onExport: () => void;
  onOpenLoreModal: () => void;
}

const FPVUI: React.FC<FPVUIProps> = ({ state, onExport, onOpenLoreModal }) => {
  const stateText = AnimationState[state].toUpperCase();
  const stateColor = 
    state === AnimationState.Charged ? 'text-green-400' :
    state === AnimationState.Charging ? 'text-yellow-400' :
    state === AnimationState.Discharging ? 'text-red-400' :
    'text-orange-400';

  return (
    <>
      <div className="absolute top-4 left-4 z-10 p-3 md:p-4 bg-black/50 rounded-xl shadow-xl backdrop-blur-sm pointer-events-none text-white max-w-xs md:max-w-sm">
        <h1 className="text-xl md:text-2xl font-bold text-orange-300 mb-2 tracking-wider drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">The Firagle</h1>
        
        {!IS_TOUCH_DEVICE && (
          <div className="hidden sm:block space-y-1 text-gray-300 text-sm">
            <p><span className="font-semibold text-gray-100">WASD:</span> Move</p>
            <p><span className="font-semibold text-gray-100">Mouse:</span> Look</p>
            <p><span className="font-semibold text-gray-100">Click & Hold:</span> Charge & Fire</p>
            <p><span className="font-semibold text-gray-100">I:</span> Inventory</p>
            <p><span className="font-semibold text-gray-100">T:</span> Ask the Oracle</p>
            <p><span className="font-semibold text-gray-100">Esc:</span> Pause / Release Mouse</p>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-3">
          <button onClick={onExport} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 pointer-events-auto shadow-lg">Export Staff (.glb)</button>
          <button onClick={onOpenLoreModal} className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-md hover:bg-purple-500 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75 pointer-events-auto shadow-lg">Ask the Oracle</button>
        </div>
        
        <p className={`mt-3 text-base md:text-lg font-mono tracking-widest ${stateColor} transition-colors duration-300`}>
          STATE: {stateText}
        </p>
      </div>
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-3xl pointer-events-none opacity-50 drop-shadow-[0_0_3px_#000]">
        +
      </div>
    </>
  );
};

export default FPVUI;
