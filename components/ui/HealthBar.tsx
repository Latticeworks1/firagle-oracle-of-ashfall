import React from 'react';

interface HealthBarProps {
  current: number;
  max: number;
  type?: 'health' | 'shield' | 'energy' | 'enemy';
  size?: 'small' | 'medium' | 'large' | 'compact';
  showText?: boolean;
  isCritical?: boolean;
  className?: string;
}

const HealthBar: React.FC<HealthBarProps> = ({
  current,
  max,
  type = 'health',
  size = 'medium',
  showText = true,
  isCritical = false,
  className = ''
}) => {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  const isLowHealth = percentage < 30;

  // Size variants for unified system
  const sizeClasses = {
    small: 'progress-bar--small',
    medium: '',
    large: 'progress-bar--large',
    compact: 'progress-bar--compact'
  };

  // Type variants using unified system
  const typeClasses = {
    health: 'progress-bar--health',
    shield: 'progress-bar--shield', 
    energy: 'progress-bar--energy',
    enemy: 'progress-bar--enemy'
  };

  const criticalClass = (isCritical || isLowHealth) ? 'progress-bar--critical' : '';

  return (
    <div className={`progress-bar ${typeClasses[type]} ${criticalClass} ${sizeClasses[size]} ${className}`}>
      <div 
        className="progress-bar__fill"
        style={{ width: `${percentage}%` }}
      />
      {showText && size !== 'compact' && (
        <div className="progress-bar__text">
          {size === 'small' ? `${Math.round(percentage)}%` : `${current} / ${max}`}
        </div>
      )}
    </div>
  );
};

export default HealthBar;