import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Info, X, AlertTriangle } from "lucide-react";

const STORAGE_KEY = "seox.notifications";
const MAX_NOTIFICATIONS = 30;
const NotificationsContext = createContext(null);

function readStoredNotifications() {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistNotifications(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // Notifications are helpful, not critical.
  }
}

function typeIcon(type) {
  if (type === "success") return CheckCircle2;
  if (type === "warning" || type === "error") return AlertTriangle;
  return Info;
}

function typeClass(type) {
  if (type === "success") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  if (type === "warning") return "border-amber-500/25 bg-amber-500/10 text-amber-100";
  if (type === "error") return "border-rose-500/25 bg-rose-500/10 text-rose-100";
  return "border-sky-500/25 bg-sky-500/10 text-sky-100";
}

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState(readStoredNotifications);
  const [toasts, setToasts] = useState([]);

  const updateNotifications = useCallback((updater) => {
    setNotifications((current) => {
      const next = updater(current).slice(0, MAX_NOTIFICATIONS);
      persistNotifications(next);
      return next;
    });
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    ({ title, body = "", type = "info", href = "" }) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const item = {
        id,
        title,
        body,
        type,
        href,
        read: false,
        createdAt: new Date().toISOString(),
      };

      updateNotifications((current) => [item, ...current]);
      setToasts((current) => [item, ...current].slice(0, 3));
      window.setTimeout(() => dismissToast(id), 5500);
      return id;
    },
    [dismissToast, updateNotifications]
  );

  const markRead = useCallback(
    (id) => {
      updateNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, read: true } : item))
      );
    },
    [updateNotifications]
  );

  const markAllRead = useCallback(() => {
    updateNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }, [updateNotifications]);

  const clearNotifications = useCallback(() => {
    updateNotifications(() => []);
    setToasts([]);
  }, [updateNotifications]);

  const value = useMemo(
    () => ({
      clearNotifications,
      dismissToast,
      markAllRead,
      markRead,
      notifications,
      notify,
      toasts,
      unreadCount: notifications.filter((item) => !item.read).length,
    }),
    [
      clearNotifications,
      dismissToast,
      markAllRead,
      markRead,
      notifications,
      notify,
      toasts,
    ]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function NotificationViewport() {
  const { dismissToast, markRead, toasts } = useNotifications();
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((item) => {
        const Icon = typeIcon(item.type);
        const content = (
          <div className={`pointer-events-auto rounded-xl border px-3 py-3 shadow-2xl backdrop-blur-xl ${typeClass(item.type)}`}>
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.body && <p className="mt-0.5 text-xs opacity-75">{item.body}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                className="rounded-md p-1 opacity-60 transition hover:bg-white/10 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );

        return item.href ? (
          <Link
            key={item.id}
            to={item.href}
            onClick={() => {
              markRead(item.id);
              dismissToast(item.id);
            }}
          >
            {content}
          </Link>
        ) : (
          <div key={item.id}>{content}</div>
        );
      })}
    </div>
  );
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return value;
}
