import { Link } from "react-router";

const quickLinks = [
  { title: "Teleop", to: "/teleop", description: "Drive the robot and watch the camera stream." },
  { title: "Navigation", to: "/navigation", description: "Click the map and send a waypoint." },
  { title: "Docking", to: "/docking", description: "Trigger the autonomous docking action." },
];

export default function Overview() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
          Robot Control Station
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
          Teleop, navigation, and docking in one place.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
          This app is now focused on live robot workflows. Use Teleop for manual driving,
          Navigation for map clicks and waypoint goals, and Docking for the visual docking mission.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{link.title}</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{link.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
