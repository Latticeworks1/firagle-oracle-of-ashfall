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
      <div className="hud-panel hud-panel--top-left hud-panel--primary">
        <div className="hud-info">
          <h1 className="hud-info__title">The Firagle</h1>
        
          {!IS_TOUCH_DEVICE && (
            <div className="hud-info__controls">
              <div className="hud-control-group">
                <span className="hud-control__key">WASD</span>
                <span className="hud-control__action">Move</span>
              </div>
              <div className="hud-control-group">
                <span className="hud-control__key">Mouse</span>
                <span className="hud-control__action">Look</span>
              </div>
              <div className="hud-control-group">
                <span className="hud-control__key">Click & Hold</span>
                <span className="hud-control__action">Charge & Fire</span>
              </div>
              <div className="hud-control-group">
                <span className="hud-control__key">I</span>
                <span className="hud-control__action">Inventory</span>
              </div>
              <div className="hud-control-group">
                <span className="hud-control__key">T</span>
                <span className="hud-control__action">Ask the Oracle</span>
              </div>
              <div className="hud-control-group">
                <span className="hud-control__key">Tab</span>
                <span className="hud-control__action">Debug Info</span>
              </div>
              <div className="hud-control-group">
                <span className="hud-control__key">Esc</span>
                <span className="hud-control__action">Pause / Release Mouse</span>
              </div>
            </div>
          )}
        
          <div className="hud-info__actions">
            <button onClick={onExport} className="hud-button hud-button--export hud-button--small">Export Staff (.glb)</button>
            <button onClick={onOpenLoreModal} className="hud-button hud-button--oracle hud-button--small">Ask the Oracle</button>
          </div>
        
          <div className={`hud-status hud-status--${state === AnimationState.Charging ? 'charging' : state === AnimationState.Charged ? 'charged' : state === AnimationState.Discharging ? 'discharging' : 'idle'}`}>
            <span className="hud-status__label">Weapon State</span>
            <span className="hud-status__value">{stateText}</span>
          </div>
        </div>
      </div>
      
      <div className="hud-crosshair">
        <div className="hud-crosshair__reticle">+</div>
      </div>
    </>
  );
};

export default FPVUI;
