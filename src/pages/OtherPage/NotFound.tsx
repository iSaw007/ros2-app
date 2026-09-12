import { Link } from "react-router";
import { Panel } from "../../components/ui/Panel";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md pt-10">
      <Panel>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="tnum text-[11px] font-semibold tracking-[0.18em] text-faint">404</p>
          <h1 className="text-base font-semibold">No such page</h1>
          <p className="max-w-sm text-xs leading-relaxed text-muted">
            This route is not part of the control station.
          </p>
          <Link
            to="/"
            className="mt-1 rounded-[5px] border border-transparent bg-accent px-3 py-2 text-[13px] font-medium text-accent-fg transition-colors hover:bg-accent-hover"
          >
            Back to overview
          </Link>
        </div>
      </Panel>
    </div>
  );
}
