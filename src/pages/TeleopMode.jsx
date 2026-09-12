import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Joystick } from 'react-joystick-component';
import { drive, stop } from '../services/teleopService';
import { useRosStatus } from '../context/RosStatusContext';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { Readout, Meter, Badge } from '../components/ui/Indicators';
import { StopIcon, PlayIcon } from '../components/ui/Icons';
import { CameraStream } from '../components/CameraStream';

const MAX_LINEAR = 0.5;   // m/s
const MAX_ANGULAR = 1.0;  // rad/s
const PUBLISH_HZ = 10;

// Key -> [forward, turn] as fractions of the maximum.
const KEY_MAP = {
  w: [1, 0], ArrowUp: [1, 0],
  s: [-1, 0], ArrowDown: [-1, 0],
  a: [0, 1], ArrowLeft: [0, 1],
  d: [0, -1], ArrowRight: [0, -1],
};

const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

export default function TeleopMode() {
  const { isConnected } = useRosStatus();

  const [velocity, setVelocity] = useState({ linear: 0, angular: 0 });
  const [isEstopped, setIsEstopped] = useState(false);

  const pressedKeys = useRef(new Set());
  const estoppedRef = useRef(false);
  // Whether the KEYBOARD is currently driving. This belongs to the keyboard
  // loop alone and must not be a general "something is moving" flag: the loop
  // ticks ten times a second regardless of which control is in use, so a shared
  // flag makes it interleave a stop between every joystick update — the robot
  // stutters and the readout flickers to zero at 10 Hz.
  const keyboardDriving = useRef(false);

  useEffect(() => {
    estoppedRef.current = isEstopped;
  }, [isEstopped]);

  // Held keys republish the same velocity ten times a second. Returning the
  // previous state object unchanged lets React skip those renders entirely,
  // so the readout only repaints when the number actually differs.
  const showVelocity = useCallback((linear, angular) => {
    setVelocity((previous) =>
      previous.linear === linear && previous.angular === angular
        ? previous
        : { linear, angular },
    );
  }, []);

  const publish = useCallback((linear, angular) => {
    drive(linear, angular);
    showVelocity(linear, angular);
  }, [showVelocity]);

  const halt = useCallback(() => {
    stop();
    showVelocity(0, 0);
  }, [showVelocity]);

  // Keyboard driving. Held keys are republished at a steady rate so the
  // controller's command timeout never expires mid-manoeuvre.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!KEY_MAP[event.key]) return;
      event.preventDefault();
      pressedKeys.current.add(event.key);
    };
    const onKeyUp = (event) => pressedKeys.current.delete(event.key);
    const onBlur = () => pressedKeys.current.clear();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    // Without this, a key held while the window loses focus never gets its
    // keyup and the robot keeps driving.
    window.addEventListener('blur', onBlur);

    const interval = setInterval(() => {
      if (estoppedRef.current) return;

      if (pressedKeys.current.size === 0) {
        // Only the keyboard's own motion is stopped here. A joystick drag
        // leaves this false, so the loop stays out of its way.
        if (keyboardDriving.current) {
          keyboardDriving.current = false;
          halt();
        }
        return;
      }
      keyboardDriving.current = true;

      let forward = 0;
      let turn = 0;
      pressedKeys.current.forEach((key) => {
        const [f, t] = KEY_MAP[key] ?? [0, 0];
        forward += f;
        turn += t;
      });
      publish(clamp(forward, 1) * MAX_LINEAR, clamp(turn, 1) * MAX_ANGULAR);
    }, 1000 / PUBLISH_HZ);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      clearInterval(interval);
    };
  }, [publish, halt]);

  // Leaving this page must not leave the robot driving.
  useEffect(() => () => { stop(); }, []);

  const handleJoystickMove = (event) => {
    if (estoppedRef.current) return;
    // The library types x and y as nullable; treat a missing axis as centred.
    publish((event.y ?? 0) * MAX_LINEAR, -(event.x ?? 0) * MAX_ANGULAR);
  };

  const handleJoystickRelease = () => {
    if (estoppedRef.current) return;
    halt();
  };

  const engageEstop = () => {
    setIsEstopped(true);
    estoppedRef.current = true;
    pressedKeys.current.clear();
    keyboardDriving.current = false;
    halt();
  };

  const releaseEstop = () => {
    setIsEstopped(false);
    estoppedRef.current = false;
  };


  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 lg:grid-cols-[1fr_300px]">
      {/* Camera */}
      {/* The camera is the subject of this page, so it gets the full feed at
          native resolution — unlike the corner dock, which trades quality for
          bandwidth. The dock hides itself here to avoid a second stream. */}
      <Panel title="Camera" flush>
        <div className="flex min-h-[280px] items-center justify-center bg-[var(--map-void)]">
          <CameraStream className="max-h-[62vh] w-full object-contain" />
        </div>
      </Panel>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        {/* The stop control is the largest, highest-contrast element on the
            page, and it is never disabled — including while the link is down,
            where pressing it at least latches the UI against further commands. */}
        <Button
          variant={isEstopped ? 'default' : 'danger'}
          size="lg"
          block
          onClick={isEstopped ? releaseEstop : engageEstop}
          className="h-14 text-[15px] font-semibold tracking-wide"
        >
          {isEstopped ? <PlayIcon size={20} /> : <StopIcon size={20} />}
          {isEstopped ? 'Release stop' : 'Emergency stop'}
        </Button>

        {isEstopped && (
          <Badge tone="danger" className="justify-center py-1.5">
            Stop engaged — commands blocked
          </Badge>
        )}
        {!isConnected && !isEstopped && (
          <Badge tone="warn" className="justify-center py-1.5">
            No link — commands will not reach the robot
          </Badge>
        )}

        <Panel title="Joystick">
          <div className="flex flex-col items-center gap-4">
            <div className={isEstopped ? 'pointer-events-none opacity-40' : ''}>
              <Joystick
                size={124}
                sticky={false}
                baseColor="var(--app-surface-sunken)"
                stickColor={isEstopped ? 'var(--app-danger)' : 'var(--app-accent)'}
                move={handleJoystickMove}
                stop={handleJoystickRelease}
              />
            </div>

            <div className="grid w-full grid-cols-2 gap-3 border-t border-edge pt-3">
              <div className="flex flex-col gap-1.5">
                <Readout
                  label="Linear"
                  value={velocity.linear.toFixed(2)}
                  unit="m/s"
                  tone={velocity.linear !== 0 ? 'accent' : 'neutral'}
                />
                <Meter fraction={Math.abs(velocity.linear) / MAX_LINEAR} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Readout
                  label="Angular"
                  value={velocity.angular.toFixed(2)}
                  unit="rad/s"
                  tone={velocity.angular !== 0 ? 'accent' : 'neutral'}
                />
                <Meter fraction={Math.abs(velocity.angular) / MAX_ANGULAR} />
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Keyboard">
          <dl className="grid grid-cols-2 gap-y-2 text-xs text-muted">
            {[
              ['W  ↑', 'Forward'],
              ['S  ↓', 'Reverse'],
              ['A  ←', 'Turn left'],
              ['D  →', 'Turn right'],
            ].map(([keys, action]) => (
              <React.Fragment key={action}>
                <dt className="tnum text-[11px] text-faint">{keys}</dt>
                <dd>{action}</dd>
              </React.Fragment>
            ))}
          </dl>
          <p className="mt-3 border-t border-edge pt-2 text-[11px] leading-relaxed text-faint">
            Commands publish at {PUBLISH_HZ} Hz while a key is held, and a zero
            command is sent the moment the last key is released.
          </p>
        </Panel>
      </div>
    </div>
  );
}
