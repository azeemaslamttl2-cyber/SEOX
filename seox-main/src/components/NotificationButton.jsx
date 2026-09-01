import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useNotifications } from "../context/NotificationsContext.jsx";

function typeDot(type) {
  if (type === "success") return "bg-emerald-400";
  if (type === "warning") return "bg-amber-400";
  if (type === "error") return "bg-rose-400";
  return "bg-sky-400";
}

function relativeTime(iso) {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return "";
  const diff = Date.now() - time;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationButton() {
  const {
    clearNotifications,
    markAllRead,
    markRead,
    notifications,
    unreadCount,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[8px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-xl border border-white/10 bg-ink-800/95 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/45">
              Notifications
            </p>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[11px] font-semibold text-brand-300 hover:text-brand-200"
                >
                  Mark read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="text-[11px] font-semibold text-white/40 hover:text-white/70"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto p-1.5">
            {notifications.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-white/70">No notifications yet</p>
                <p className="mt-1 text-xs text-white/40">
                  Tool runs and project updates will appear here.
                </p>
              </div>
            )}

            {notifications.map((item) => {
              const content = (
                <div
                  className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition hover:bg-white/[0.04] ${
                    item.read ? "opacity-60" : ""
                  }`}
                >
                  <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${typeDot(item.type)}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">
                      {item.title}
                    </span>
                    {item.body && (
                      <span className="mt-0.5 block text-xs leading-relaxed text-white/45">
                        {item.body}
                      </span>
                    )}
                    <span className="mt-1 block text-[10px] uppercase tracking-wide text-white/25">
                      {relativeTime(item.createdAt)}
                    </span>
                  </span>
                </div>
              );

              return item.href ? (
                <Link
                  key={item.id}
                  to={item.href}
                  onClick={() => {
                    markRead(item.id);
                    setOpen(false);
                  }}
                >
                  {content}
                </Link>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markRead(item.id)}
                  className="block w-full"
                >
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
