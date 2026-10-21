"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChartLine, Database, Ellipsis, FlaskConical, Handshake, House, Plus, Sprout, Users, WifiOff, X } from "lucide-react";
import { LANGS } from "@/lib/i18n";
import type { StringKey } from "@/lib/i18n";
import { useApp } from "@/lib/store/AppProvider";
import { cx } from "@/components/ui/primitives";

const NAV: { href: string; key: StringKey; icon: typeof House; match: (p: string) => boolean }[] = [
  { href: "/", key: "nav.home", icon: House, match: (p) => p === "/" },
  { href: "/farmer", key: "nav.farmer", icon: Sprout, match: (p) => p === "/farmer" || p.startsWith("/farmer/lots") },
  { href: "/farmer/new", key: "nav.newLot", icon: Plus, match: (p) => p === "/farmer/new" },
  { href: "/fpo", key: "nav.fpo", icon: Users, match: (p) => p.startsWith("/fpo") },
  { href: "/buyer", key: "nav.buyer", icon: Handshake, match: (p) => p.startsWith("/buyer") },
  { href: "/insights", key: "nav.insights", icon: ChartLine, match: (p) => p.startsWith("/insights") },
  { href: "/data", key: "nav.data", icon: Database, match: (p) => p.startsWith("/data") },
];

const MOBILE_NAV = ["/", "/farmer", "/farmer/new", "/insights"];

function Logo({ dark }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className={cx("grid size-9 place-items-center rounded-xl", dark ? "bg-emerald-500 text-forest-950" : "bg-forest-900 text-emerald-300")}>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 19h16" />
          <path d="M6 15l4-4 3 3 5-6" />
          <path d="M15 8h3v3" />
        </svg>
      </span>
      <span className={cx("font-display text-[22px] font-semibold tracking-tight", dark ? "text-white" : "text-ink")}>NetBhav</span>
    </Link>
  );
}

function LanguageSwitcher({ dark }: { dark?: boolean }) {
  const { lang, setLang, t } = useApp();
  return (
    <div
      role="radiogroup"
      aria-label={t("lang.label")}
      className={cx("inline-flex rounded-xl p-0.5", dark ? "bg-forest-950/60" : "border border-line bg-paper")}
    >
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={lang === l.id}
          lang={l.id}
          onClick={() => setLang(l.id)}
          className={cx(
            "min-h-9 rounded-[10px] px-2.5 text-[13px] font-bold transition-colors cursor-pointer",
            lang === l.id
              ? dark
                ? "bg-emerald-500 text-forest-950"
                : "bg-forest-900 text-white"
              : dark
                ? "text-sage-300 hover:text-white"
                : "text-muted hover:text-ink",
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useApp();
  const online = useOnline();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = NAV.some((n) => !MOBILE_NAV.includes(n.href) && n.match(pathname));

  return (
    <div className="min-h-dvh lg:pl-[264px]">
      {/* Desktop sidebar */}
      <aside className="panel-dark fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col rounded-none! px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo dark />
          <p className="mt-2 text-[13px] leading-snug text-sage-300">{t("app.tagline")}</p>
        </div>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
          {NAV.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors",
                  active ? "bg-paper text-forest-900" : "text-sage-200 hover:bg-forest-800 hover:text-white",
                )}
              >
                <n.icon className={cx("size-[18px]", active ? "text-emerald-600" : "text-sage-400 group-hover:text-emerald-300")} aria-hidden />
                {t(n.key)}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-4 px-2">
          <LanguageSwitcher dark />
          <div className="rounded-xl border border-forest-700 bg-forest-950/40 p-3 text-xs leading-relaxed text-sage-300">
            <div className="mb-1 flex items-center gap-1.5 font-bold text-amber-300">
              <FlaskConical className="size-3.5" aria-hidden /> {t("nav.pilot")}
            </div>
            {t("banner.demo")}
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-ivory/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Logo />
        <LanguageSwitcher />
      </header>

      <div className="border-b border-amber-300/50 bg-amber-50 px-4 py-2 text-center text-[13px] font-semibold text-amber-700 lg:hidden">
        <FlaskConical className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
        {t("banner.demo")}
      </div>
      {!online && (
        <div role="status" className="flex items-center justify-center gap-2 bg-forest-900 px-4 py-2 text-[13px] font-semibold text-emerald-100">
          <WifiOff className="size-4" aria-hidden /> {t("banner.offline")}
        </div>
      )}

      <main className="mx-auto w-full max-w-[1240px] px-4 pb-28 pt-6 md:px-8 md:pt-10 lg:pb-16">{children}</main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-paper/95 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur lg:hidden"
      >
        {NAV.filter((n) => MOBILE_NAV.includes(n.href)).map((n) => {
          const active = n.match(pathname);
          const isNew = n.href === "/farmer/new";
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold"
            >
              <span
                className={cx(
                  "grid place-items-center rounded-xl transition-colors",
                  isNew ? "size-10 bg-emerald-600 text-white shadow-lg" : "size-8",
                  !isNew && (active ? "bg-emerald-100 text-emerald-700" : "text-muted"),
                )}
              >
                <n.icon className="size-5" aria-hidden />
              </span>
              <span className={cx("max-w-full truncate px-0.5", active ? "text-ink" : "text-muted")}>{t(n.key)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className="flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold"
        >
          <span className={cx("grid size-8 place-items-center rounded-xl", moreActive ? "bg-emerald-100 text-emerald-700" : "text-muted")}>
            <Ellipsis className="size-5" aria-hidden />
          </span>
          <span className={moreActive ? "text-ink" : "text-muted"}>{t("nav.more")}</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t("nav.more")}>
          <button type="button" aria-label={t("common.close")} className="absolute inset-0 bg-forest-950/40 animate-fade" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-paper p-4 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl animate-rise">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="font-display text-lg font-semibold">{t("nav.more")}</span>
              <button type="button" onClick={() => setMoreOpen(false)} className="grid size-10 cursor-pointer place-items-center rounded-xl hover:bg-sand" aria-label={t("common.close")}>
                <X className="size-5" />
              </button>
            </div>
            {NAV.filter((n) => !MOBILE_NAV.includes(n.href)).map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMoreOpen(false)}
                className={cx("flex min-h-13 items-center gap-3 rounded-2xl px-3 text-base font-semibold", n.match(pathname) ? "bg-emerald-50 text-emerald-700" : "hover:bg-sand")}
              >
                <n.icon className="size-5 text-emerald-600" aria-hidden />
                {t(n.key)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
