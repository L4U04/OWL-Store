// src/hooks/useGamepad.ts
'use client';

import { useEffect, useRef, useState } from 'react';

interface GamepadHookOptions {
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onScroll?: (deltaY: number) => void;
  onConfirm?: () => void;
  onBack?: () => void;
  onFavorite?: () => void;
  onSearch?: () => void;
  onBumperLeft?: () => void;
  onBumperRight?: () => void;
  onTriggerLeft?: () => void;
  onTriggerRight?: () => void;
  onOptions?: () => void;
  enabled?: boolean;
}

export function useGamepad({
  onNavigate,
  onScroll,
  onConfirm,
  onBack,
  onFavorite,
  onSearch,
  onBumperLeft,
  onBumperRight,
  onTriggerLeft,
  onTriggerRight,
  onOptions,
  enabled = true,
}: GamepadHookOptions) {
  const lastMoveTimeRef = useRef<number>(0);
  const prevButtonsRef = useRef<boolean[]>([]);
  const [controllerConnected, setControllerConnected] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled) return;

    const onConnect = () => setControllerConnected(true);
    const onDisconnect = () => setControllerConnected(false);

    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);

    let animationFrameId: number;

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];

      if (gp) {
        if (!controllerConnected) setControllerConnected(true);

        const now = performance.now();
        const cooldown = 165; // Tempo ideal de resposta para menus de console
        const buttons = gp.buttons.map((b) => b.pressed);
        const axes = gp.axes;

        // Direcionais: D-Pad (12, 13, 14, 15) ou Analógico Esquerdo (axes 0 e 1)
        const isUp = buttons[12] || (axes[1] !== undefined && axes[1] < -0.55);
        const isDown = buttons[13] || (axes[1] !== undefined && axes[1] > 0.55);
        const isLeft = buttons[14] || (axes[0] !== undefined && axes[0] < -0.55);
        const isRight = buttons[15] || (axes[0] !== undefined && axes[0] > 0.55);

        if (now - lastMoveTimeRef.current > cooldown) {
          if (isLeft && onNavigate) {
            onNavigate('left');
            lastMoveTimeRef.current = now;
          } else if (isRight && onNavigate) {
            onNavigate('right');
            lastMoveTimeRef.current = now;
          } else if (isUp && onNavigate) {
            onNavigate('up');
            lastMoveTimeRef.current = now;
          } else if (isDown && onNavigate) {
            onNavigate('down');
            lastMoveTimeRef.current = now;
          }
        }

        // Analógico Direito (Eixo Y = axes[3]) para rolagem manual suave
        const rightStickY = axes[3];
        if (rightStickY !== undefined && Math.abs(rightStickY) > 0.25 && onScroll) {
          onScroll(rightStickY);
        }

        // Botões de ação (disparo único por clique - Rising Edge)
        const prev = prevButtonsRef.current;
        if (buttons[0] && !prev[0] && onConfirm) onConfirm();       // ✕ (Cross)
        if (buttons[1] && !prev[1] && onBack) onBack();             // ◯ (Circle)
        if (buttons[2] && !prev[2] && onFavorite) onFavorite();     // □ (Square)
        if (buttons[3] && !prev[3] && onSearch) onSearch();         // △ (Triangle)
        if (buttons[4] && !prev[4] && onBumperLeft) onBumperLeft(); // L1
        if (buttons[5] && !prev[5] && onBumperRight) onBumperRight();// R1
        if (buttons[6] && !prev[6] && onTriggerLeft) onTriggerLeft();// L2 (Página Anterior)
        if (buttons[7] && !prev[7] && onTriggerRight) onTriggerRight();// R2 (Próxima Página)
        if (buttons[9] && !prev[9] && onOptions) onOptions();       // OPTIONS

        prevButtonsRef.current = buttons;
      }

      animationFrameId = requestAnimationFrame(pollGamepad);
    };

    animationFrameId = requestAnimationFrame(pollGamepad);

    return () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    enabled,
    controllerConnected,
    onNavigate,
    onScroll,
    onConfirm,
    onBack,
    onFavorite,
    onSearch,
    onBumperLeft,
    onBumperRight,
    onTriggerLeft,
    onTriggerRight,
    onOptions,
  ]);

  return { controllerConnected };
}