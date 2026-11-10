import type { ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { ChevronLeft, Fuel, History, House, Settings, type LucideIcon } from "lucide-react";

import { KmMark } from "./km-mark";
import { cn } from "../lib/format";
import { ROUTES } from "../lib/routes";

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: ROUTES.home, label: "Inicio", icon: House },
  { to: ROUTES.trips, label: "Viajes", icon: History },
  { to: ROUTES.fuel, label: "Combustible", icon: Fuel },
  { to: ROUTES.settings, label: "Ajustes", icon: Settings },
];

// Forms take the whole screen with their own sticky button at the bottom, so
// the tab bar is hidden there.
const FULLSCREEN = [/^\/lend$/, /^\/trips\/[^/]+\/return$/];

/**
 * Mobile first: the tab bar sits at the bottom, within thumb reach. From `md`
 * up the same sections move into the header and the content gets a bit wider.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const fullscreen = FULLSCREEN.some((re) => re.test(pathname));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-zinc-100/85 pt-[env(safe-area-inset-top)] backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/85">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-3 px-4 md:max-w-2xl">
          <Link to={ROUTES.home} className="flex min-w-0 items-center gap-2.5">
            <KmMark size={30} />
            <span className="min-w-0">
              <span className="block truncate text-sm leading-tight font-bold">KM</span>
              <span className="block text-[11px] leading-tight text-zinc-500">Préstamo del auto</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === ROUTES.home}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition",
                    isActive
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100",
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto w-full max-w-lg flex-1 px-4 pt-5 md:max-w-2xl",
          fullscreen ? "pb-32" : "pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10",
        )}
      >
        <Outlet />
      </main>

      {!fullscreen && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200/70 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden dark:border-zinc-800 dark:bg-zinc-950/90">
          <ul className="mx-auto grid max-w-lg grid-cols-4">
            {NAV.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === ROUTES.home}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-semibold transition",
                      isActive ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={cn("grid h-7 w-12 place-items-center rounded-full transition", isActive && "bg-teal/15")}>
                        <Icon className="size-5" strokeWidth={isActive ? 2.4 : 1.8} />
                      </span>
                      {label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

/** Sticky bottom action bar for forms, within thumb reach. */
export function StickyAction({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200/70 bg-zinc-100/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto max-w-lg md:max-w-2xl">{children}</div>
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-2">
      {back && (
        <Link
          to={back}
          aria-label="Volver"
          className="-ml-2 grid size-10 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
        >
          <ChevronLeft className="size-6" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
