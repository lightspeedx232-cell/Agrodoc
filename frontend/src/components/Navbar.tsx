import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n, type Lang } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import Dropdown, { DropdownLink } from "./Dropdown";

// Primary links shown inline (most-used).
const primaryLinks = [
  { to: "/dashboard",   key: "nav.dashboard",   icon: "📊" },
  { to: "/farms",       key: "nav.farms",        icon: "🚜" },
  { to: "/marketplace", key: "nav.marketplace", icon: "🛒" },
];

// Secondary links grouped under "More ▾".
const moreLinks = [
  { to: "/crop-doctor/scanner", key: "nav.scanner",   icon: "🌿" },
  { to: "/weather",              key: "nav.weather",    icon: "🌦️" },
  { to: "/calendar",            key: "nav.calendar",   icon: "📅" },
  { to: "/expenses",            key: "nav.expenses",   icon: "💰" },
  { to: "/assistant",           key: "nav.assistant",  icon: "🤖" },
  { to: "/scam-report",        key: "nav.scamReport", icon: "🛡️" },
];

// Public resource links grouped under "Resources ▾".
const resourceLinks = [
  { to: "/schemes", key: "nav.schemes", icon: "🏛️" },
  { to: "/stores",  key: "nav.stores",  icon: "🏪" },
  { to: "/mandi",   key: "nav.mandi",   icon: "📈" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-brand-600 text-white shadow-sm"
        : "text-brand-800 hover:bg-brand-100 dark:text-brand-100 dark:hover:bg-brand-800/40"
    }`;

  const mobileLinkClass = linkClass;

  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/80 backdrop-blur-md shadow-sm dark:border-brand-800/40 dark:bg-[#0f1410]/85">
      <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 font-extrabold text-brand-700 shrink-0 dark:text-brand-300">
          <img src="/favicon.svg" alt="" className="h-8 w-8 drop-shadow-sm" />
          <span className="text-lg tracking-tight">AgroDoc</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-0.5 md:flex ml-2">
          {user &&
            primaryLinks.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkClass}>
                <span className="text-base leading-none">{l.icon}</span>
                {t(l.key)}
              </NavLink>
            ))}

          {/* More dropdown (authed) */}
          {user && (
            <Dropdown label={t("nav.more")}>
              {moreLinks.map((l) => (
                <DropdownLink key={l.to} to={l.to}>
                  <span className="mr-2">{l.icon}</span>
                  {t(l.key)}
                </DropdownLink>
              ))}
            </Dropdown>
          )}

          {/* Resources dropdown (public) */}
          <Dropdown label={t("nav.resources")}>
            {resourceLinks.map((l) => (
              <DropdownLink key={l.to} to={l.to}>
                <span className="mr-2">{l.icon}</span>
                {t(l.key)}
              </DropdownLink>
            ))}
          </Dropdown>
        </div>

        {/* Right side */}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-200 text-brand-700 transition hover:bg-brand-100 dark:border-brand-700/50 dark:text-brand-200 dark:hover:bg-brand-800/40"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {/* Compact language switcher (not a form input) */}
          <div className="relative">
            <select
              aria-label={t("common.language")}
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="cursor-pointer appearance-none rounded-full border border-brand-200 bg-white py-1.5 pl-3 pr-7 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-brand-700/50 dark:bg-[#1c2620] dark:text-brand-100 dark:hover:bg-[#243029]"
            >
              <option value="en">EN</option>
              <option value="ml">മലയാളം</option>
              <option value="hi">हिन्दी</option>
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-brand-400" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {user ? (
            <>
              <NavLink to="/settings" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-sm transition hover:bg-brand-200" title={t("nav.settings")}>
                {user.full_name.charAt(0).toUpperCase()}
              </NavLink>
              <button onClick={handleLogout} className="btn-secondary py-1.5 text-sm">
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-secondary py-1.5 text-sm">{t("nav.login")}</Link>
              <Link to="/register" className="btn-primary py-1.5 text-sm">{t("nav.register")}</Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="ml-auto rounded-lg p-2 text-brand-700 transition hover:bg-brand-100 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-brand-100 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-0.5">
            {user &&
              [...primaryLinks, ...moreLinks].map((l) => (
                <NavLink key={l.to} to={l.to} className={mobileLinkClass} onClick={() => setOpen(false)}>
                  <span className="text-base">{l.icon}</span>
                  {t(l.key)}
                </NavLink>
              ))}
            <div className="my-1 border-t border-brand-100" />
            {resourceLinks.map((l) => (
              <NavLink key={l.to} to={l.to} className={mobileLinkClass} onClick={() => setOpen(false)}>
                <span className="text-base">{l.icon}</span>
                {t(l.key)}
              </NavLink>
            ))}
            {user && (
              <NavLink to="/settings" className={mobileLinkClass} onClick={() => setOpen(false)}>
                <span className="text-base">⚙️</span>
                {t("nav.settings")}
              </NavLink>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-brand-100 pt-3">
            {/* Theme toggle (mobile) */}
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-200 text-brand-700 dark:border-brand-700/50 dark:text-brand-200"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <select
              aria-label={t("common.language")}
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="cursor-pointer rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700"
            >
              <option value="en">English</option>
              <option value="ml">മലയാളം</option>
              <option value="hi">हिन्दी</option>
            </select>
            {user ? (
              <button onClick={() => { handleLogout(); setOpen(false); }} className="btn-secondary flex-1 text-sm">
                {t("nav.logout")}
              </button>
            ) : (
              <>
                <Link to="/login" className="btn-secondary flex-1 text-center text-sm" onClick={() => setOpen(false)}>{t("nav.login")}</Link>
                <Link to="/register" className="btn-primary flex-1 text-center text-sm" onClick={() => setOpen(false)}>{t("nav.register")}</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
