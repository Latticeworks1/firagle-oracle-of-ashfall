import React from 'react';
import type { WeaponSchema, PlayerState, AnimationState } from '../../../types';

// Factory pattern for creating reusable HUD components
export interface HUDComponentProps {
  className?: string;
  style?: React.CSSProperties;
}

export interface BarProps extends HUDComponentProps {
  value: number;
  maxValue: number;
  label?: string;
  showText?: boolean;
  color: 'health' | 'shield' | 'energy' | 'charge';
}

export interface StatusDisplayProps extends HUDComponentProps {
  state: AnimationState;
  label?: string;
}

export interface WeaponDisplayProps extends HUDComponentProps {
  weapon: WeaponSchema;
  showStats?: boolean;
}

export interface PlayerVitalsProps extends HUDComponentProps {
  playerState: PlayerState;
}

export interface ActionButtonProps extends HUDComponentProps {
  label: string;
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'danger' | 'export' | 'oracle';
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// Factory functions for creating styled components
export const createHUDBar = ({ 
  value, 
  maxValue, 
  label, 
  showText = true, 
  color, 
  className = '', 
  style 
}: BarProps): React.ReactElement => {
  const percentage = Math.max(0, Math.min(100, (value / maxValue) * 100));
  
  return React.createElement('div', {
    className: `hud-bar hud-bar--${color} ${className}`,
    style,
    'data-label': label
  }, [
    React.createElement('div', {
      key: 'bar-fill',
      className: 'hud-bar__fill',
      style: { width: `${percentage}%` }
    }),
    showText && React.createElement('div', {
      key: 'bar-text',
      className: 'hud-bar__text'
    }, `${value} / ${maxValue}`)
  ]);
};

export const createStatusDisplay = ({ 
  state, 
  label = 'STATE', 
  className = '', 
  style 
}: StatusDisplayProps): React.ReactElement => {
  const stateText = AnimationState[state]?.toUpperCase() || 'UNKNOWN';
  
  return React.createElement('div', {
    className: `hud-status hud-status--${state.toLowerCase()} ${className}`,
    style,
    'data-state': state
  }, [
    React.createElement('span', {
      key: 'status-label',
      className: 'hud-status__label'
    }, `${label}: `),
    React.createElement('span', {
      key: 'status-value',
      className: 'hud-status__value'
    }, stateText)
  ]);
};

export const createWeaponDisplay = ({ 
  weapon, 
  showStats = true, 
  className = '', 
  style 
}: WeaponDisplayProps): React.ReactElement => {
  return React.createElement('div', {
    className: `hud-weapon ${className}`,
    style,
    'data-weapon-type': weapon.type
  }, [
    React.createElement('div', {
      key: 'weapon-name',
      className: 'hud-weapon__name'
    }, weapon.name),
    showStats && React.createElement('div', {
      key: 'weapon-stats',
      className: 'hud-weapon__stats'
    }, `DMG: ${weapon.stats.damage}`)
  ]);
};

export const createActionButton = ({ 
  label, 
  onClick, 
  variant, 
  disabled = false, 
  size = 'medium', 
  className = '', 
  style 
}: ActionButtonProps): React.ReactElement => {
  return React.createElement('button', {
    className: `hud-button hud-button--${variant} hud-button--${size} ${className}`,
    style,
    onClick: disabled ? undefined : onClick,
    disabled,
    'data-variant': variant
  }, label);
};

export const createPlayerVitals = ({ 
  playerState, 
  className = '', 
  style 
}: PlayerVitalsProps): React.ReactElement => {
  return React.createElement('div', {
    className: `hud-vitals ${className}`,
    style
  }, [
    React.createElement('div', {
      key: 'health-section',
      className: 'hud-vitals__section'
    }, [
      React.createElement('div', {
        key: 'health-label',
        className: 'hud-vitals__label'
      }, 'VITALITY'),
      createHUDBar({
        value: playerState.health,
        maxValue: playerState.maxHealth,
        color: 'health',
        className: 'hud-vitals__bar'
      })
    ]),
    (playerState.shield > 0 || playerState.maxShield > 0) && React.createElement('div', {
      key: 'shield-section',
      className: 'hud-vitals__section'
    }, [
      createHUDBar({
        value: playerState.shield,
        maxValue: playerState.maxShield,
        color: 'shield',
        className: 'hud-vitals__bar hud-vitals__bar--shield'
      })
    ]),
    React.createElement('div', {
      key: 'score-section',
      className: 'hud-vitals__score'
    }, [
      React.createElement('div', {
        key: 'score-label',
        className: 'hud-vitals__label'
      }, 'SCORE'),
      React.createElement('div', {
        key: 'score-value',
        className: 'hud-vitals__score-value'
      }, playerState.score.toString().padStart(8, '0'))
    ])
  ].filter(Boolean));
};

// Utility for creating consistent HUD panels
export const createHUDPanel = (
  content: React.ReactElement | React.ReactElement[],
  options: {
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    variant?: 'primary' | 'secondary' | 'overlay';
    className?: string;
    style?: React.CSSProperties;
  }
): React.ReactElement => {
  const { position, variant = 'primary', className = '', style } = options;
  
  return React.createElement('div', {
    className: `hud-panel hud-panel--${position} hud-panel--${variant} ${className}`,
    style
  }, Array.isArray(content) ? content : [content]);
};