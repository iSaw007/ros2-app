# Yahboom Control

A web control station for a ROS 2 robot: manual driving, map-based navigation,
and an autonomous marker-guided docking mission, all from a browser on the same
network as the robot.

It is the operator-facing half of a two-part project. The robot side — drivers,
localisation, Nav2 configuration, the ArUco detector and the docking state
machine — lives in the companion repository
[`yahboom-ros2`](https://github.com/iSaw007/yahboom-ros2).

The hardware is a Yahboom MicroROS-Car-Pi5: a Raspberry Pi 5 running ROS 2
Humble, an ESP32-S3 co-processor driving four encoder motors and the LiDAR, and
a camera on a pan-tilt mount.

## What it does

| Page | Purpose |
| --- | --- |
| **Overview** | Bridge health, link uptime, and the robot's estimated pose. |
| **Teleop** | Live camera feed, virtual joystick and keyboard driving, latching emergency stop. |
| **Navigation** | Pan-and-zoom occupancy grid; double-click to send a Nav2 goal and watch it progress. |
| **Docking** | Starts the docking mission and tracks its state machine, range to dock, and log. |

The camera is also available from every page as a small dock in the corner,
toggled from the header. It requests a reduced stream sized to how it is
actually displayed, and hides itself on the teleop page, where the feed already
has the screen to itself.

## Running it

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

The robot's address is read from `VITE_ROS_BRIDGE_IP`. Create a `.env` file:

```
VITE_ROS_BRIDGE_IP=192.168.1.42
```

Two services must be running on the robot at that address — both are started by
`unified_bringup.launch.py` in the robot repository:

- **rosbridge** on port `9090`, which carries every topic and action.
- **web_video_server** on port `8080`, which serves the camera feed.

The dev server binds to all interfaces, so the dashboard can also be opened from
a phone or tablet on the same network.

```bash
npm run build    # type-check and produce a production build in dist/
npm run lint
```

## How it is put together

React 19 and Vite, with Tailwind CSS v4 for styling and
[roslibjs](https://github.com/RobotWebTools/roslibjs) for the ROS connection.
The starting point was the [TailAdmin](https://tailadmin.com) dashboard
template; none of its pages or components remain.

```
src/
  services/     the entire ROS-facing layer — one module per capability
  components/   MapRenderer (canvas occupancy grid) and the UI primitives
  pages/        one per mode
  context/      theme, sidebar, and ROS connection status
  layout/       application shell
```

Everything that talks to ROS goes through `services/`, and every subscription is
created by `sharedTopic()` in `services/rosConnection.js`. That indirection
earns its place: roslibjs tears a subscription down globally when
`Topic.unsubscribe()` is called without a callback, so two components sharing a
topic will otherwise disconnect each other. `sharedTopic()` reference-counts
subscribers and keeps the ROS-level subscription alive for exactly as long as
something needs it.

The occupancy grid is cached rather than re-fetched. It is by far the largest
message the app receives and it is published rarely, so it is read once, held,
and replayed instantly to any component that mounts later — switching pages
costs neither bandwidth nor a wait.

Both ROS 2 actions (`/navigate_to_pose` and `/dock`) retain the goal id returned
by `sendGoal`, because roslibjs's `Action` has no `cancel()` — cancelling
requires `cancelGoal(id)`. They also pass a failure callback, without which any
outcome other than success is swallowed and the interface waits forever on a
mission that has already ended.

The docking page does not read the mission's progress from those callbacks,
though, because they only exist for a goal this browser tab sent: reload the
page mid-mission and the robot is still driving while the tab has forgotten
everything. Instead it follows the action's own hidden topics —
`/dock/_action/feedback` and `/dock/_action/status` — which makes the robot the
source of truth. A page that has just loaded picks up a mission already running,
as does a second device opening the dashboard alongside the first. Cancelling
likewise goes through `/dock/_action/cancel_goal` rather than roslibjs, so it
works on a mission this tab did not start.

Three things are worth knowing if you extend that.

roslibjs v2 removed the `ServiceRequest` constructor that v1 exported. Request
payloads are plain objects now, and `new ROSLIB.ServiceRequest(...)` throws a
TypeError which, from inside an event handler, vanishes without any visible
effect.

Service calls go through `callServiceTyped()` in `rosConnection.js`, which
exists to impose a timeout. On Humble, rosbridge defaults
`default_call_service_timeout` to 0.0 and `call_services_in_new_thread` to
false, so a service that does not answer promptly blocks rosbridge's main thread
and never returns — no response, no error, for any connected client. **Setting
`call_services_in_new_thread:=true` and a non-zero
`default_call_service_timeout` on the robot's rosbridge is worth doing**; until
then the client-side timer is all that stops a cancel button from silently doing
nothing.

The camera's topic must not be percent-encoded in the stream URL —
web_video_server does not decode `%2F` and simply closes the connection.

## Licence

MIT. See [LICENSE.md](LICENSE.md).
