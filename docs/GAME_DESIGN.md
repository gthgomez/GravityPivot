# Gravity Pivot - Game Design Document

This document defines the core mechanics, math, physics, progression systems, and calibration properties for **Gravity Pivot**.

## 1. Core Loop
Pilot a spacecraft (referred to as the `spark`) through an infinite horizontal scrolling cave. The ship moves forward automatically and falls under linear momentum. The player can press Space or tap the screen to activate a gravity tether to the nearest anchor node within tether range.
While tethered, the ship orbits the node. Releasing the tether swings the ship back into linear flight with conservation of angular velocity.

The player's objectives are:
1. Avoid colliding with the cave walls (which damages shield energy).
2. Collect floating yellow energy cores to buy permanent upgrade models.
3. Maximize score by pulling off near-misses against walls to build combo multipliers.
4. Reach higher sectors by traveling forward.

---

## 2. Player Entity Model (Spark)
The player state is defined by the following fields:
- `x`, `y`: Position in world space.
- `vx`, `vy`: Velocity vector.
- `flightState`: Either `LINEAR` or `ORBITAL`.
- `orbitalNodeId`: The ID of the pivot node currently orbited.
- `orbitalRadius`: Distance from the active node center.
- `orbitalSigma`: Direction of orbital rotation (-1 for counter-clockwise, 1 for clockwise).
- `orbitalTheta`: Angle in radians relative to the node center.
- `angularSpeed`: Speed of rotation in radians/tick.
- `score`: Total points accumulated in the run.
- `combo`: Combo multiplier (ranges 1 to 5).
- `collectedInRun`: Number of cores collected during the active run.
- `activeNearMisses`: A set of spline indices where near-miss events have been initiated.
- `shield`: Current shield energy.
- `maxShield`: Maximum shield capacity based on upgrade level.
- `shieldInvulnFrames`: Ticks remaining of invulnerability after taking damage.

---

## 3. World Generation & Layout
The game map consists of three procedurally generated element pools:
- **Anchor Nodes**: Circular gravitational anchors placed every 250 to 350 world-X pixels. They have a physical radius (18px to 24px) and an active gravitational field of radius $R_{\max}$ (upgradeable, defaults to 180px).
- **Energy Cores**: Small yellow nodes placed procedurally around anchor nodes. Each node generates 2 to 5 cores distributed circularly at a radius of 60px to 120px.
- **Cave Walls**: Generated as a sequence of upper and lower control points (splines) sampled every 20px.
  - The splines track the player's progression.
  - Wall heights dynamically expand and contract based on sinusoidal noise waves:
    - Upper Wall: `closestNode.y - safetyEnvelope + sin(x * 0.015) * 20`
    - Lower Wall: `closestNode.y + safetyEnvelope + cos(x * 0.015) * 20`
  - The envelope width represents the navigable gap. In safety-splines mode, this gap is widened dynamically by 30px to guarantee the layout is navigable at all speeds.

---

## 4. Physics and Collision Model
The simulation uses a fixed-timestep accumulator (at 60Hz) with sub-stepping for tunneling prevention:
- **Sub-stepping**: The physics time step is divided into $N$ substeps (defaults to 4). In each substep, position updates are applied and collisions are checked to prevent tunneling through thin wall splines at high velocities.
- **Linear Flight**:
  $$x \leftarrow x + v_x \cdot dt \cdot 60$$
  $$y \leftarrow y + v_y \cdot dt \cdot 60$$
- **Orbital Flight**:
  $$\theta \leftarrow \theta + \omega \cdot dt \cdot 60$$
  $$x \leftarrow x_{\text{node}} + r \cdot \cos(\theta)$$
  $$y \leftarrow y_{\text{node}} + r \cdot \sin(\theta)$$
  The tangential velocity vector is recalculated:
  $$v_x \leftarrow -v \cdot \sigma \cdot \sin(\theta)$$
  $$v_y \leftarrow v \cdot \sigma \cdot \cos(\theta)$$
- **Collinear Fallback**: When establishing a tether, the sign of the cross product between the tether vector and the velocity vector determines the orbital rotation direction ($\sigma$). If they are exactly collinear (cross product $\approx 0$), a fallback sets $\sigma = 1$ to prevent a division-by-zero or rotation lock.
- **Wall Collisions**: Checked by comparing the ship's $y$-position against interpolated upper and lower wall boundaries at the ship's current $x$-coordinate. When a collision occurs:
  - Shield energy is decremented by 1.
  - Combo multiplier resets to 1.
  - Invulnerability frames are set to 60 (1 second).
  - If shield > 0, the ship is pushed back into the center of the safe zone and linear flight is restored.
  - If shield $\le$ 0, the ship crashes and game-over state is triggered.

---

## 5. Scoring and Combos
- **Core collection**: Awards `150 * combo` points.
- **Near-Misses**: A near-miss is triggered when the ship passes within the danger envelope (`hazardProximityBuffer`, default 30px) of either wall:
  - Entering the danger envelope registers the spline index in `activeNearMisses`.
  - Safely exiting the danger zone without crashing rewards a near-miss bonus: `200 * combo` points, increases the combo multiplier by 1 (max 5), and triggers visual feedback.
- **Sector Milestone**: Reaching a sector milestone awards `1000 * sectorIndex` points.

---

## 6. Progression & Upgrades
Cores are accumulated across runs in `localStorage` and can be spent on three permanent upgrades (max level 5):
1. **Reinforced Frame (Shield)**:
   - Increments max shield capacity (Lvl 1 = 1 shield, Lvl 5 = 5 shields).
   - Cost: `level * 10` cores.
2. **Gravity Magnet (Magnet)**:
   - Amplifies core collection reach. Pulls cores toward the ship when they enter the magnetic radius.
   - Magnetic radius: `40 + (level - 1) * 35` pixels.
   - Cost: `level * 15` cores.
3. **Tether Extender (Tether)**:
   - Extends tether reach ($R_{\max}$).
   - Tether radius: `180 + (level - 1) * 35` pixels.
   - Cost: `level * 20` cores.

---

## 7. Sector Leap System
- A sector is 10,000 pixels wide.
- Reaching a sector boundary triggers a sector leap:
  - Restores player shields to max capacity.
  - Triggers a 2-second cooldown on further sector leaps to prevent duplicate triggers.
  - Generates the next 30 segments of the map.
  - Cull maps behind the camera threshold ($x - 500$) to keep memory footprint minimal.

---

## 8. Calibration Sandbox Mode
Toggles and parameters in the calibration tab fine-tune mechanics:
- **Linear Propulsion Speed**: Standard forward velocity (defaults to 6px/frame).
- **Sub-stepping Divisions**: Number of physics subdivisions (1 to 10).
- **Near-Miss Envelope**: Distance to wall to qualify for near-miss (15px to 60px).
- **Sub-step toggle**: Enables/disables physics sub-stepping.
- **Safety Splines toggle**: Widens the cave clearance gap by 30px.
- **Collinear Fallback toggle**: Enables division-by-zero protection.
