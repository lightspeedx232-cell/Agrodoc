import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

export default function Layout() {
  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-brand-50/60 to-brand-100/40 dark:from-[#0f1410] dark:to-[#0c100d]">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-brand-100 bg-white/70 backdrop-blur-sm dark:border-brand-800/40 dark:bg-[#0c100d]/80">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-200">
              <img src="/favicon.svg" alt="" className="h-5 w-5" />
              AgroDoc — Your AI Farming Assistant
            </div>
            <div className="flex flex-col items-center sm:items-end gap-0.5">
              <p className="text-xs text-brand-500 dark:text-brand-400">
                Built for Indian farmers · Weather: Open-Meteo · Prices: AGMARKNET
              </p>
              <p className="text-xs font-semibold text-brand-600 dark:text-brand-300">
                Made by <span className="font-bold text-brand-700 dark:text-brand-200">Intech</span>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
