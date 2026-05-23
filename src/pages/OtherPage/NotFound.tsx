import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">404</p>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Page not found</h1>
      <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
        The route you opened does not exist in the robot control app.
      </p>
      <Link
        to="/"
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        Back to Overview
      </Link>
    </div>
  );
}
