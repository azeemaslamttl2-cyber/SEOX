import { useCallback } from "react";
import { useAuth as useSeoAuth } from "../../context/AuthContext.jsx";

const READ_KEY = "seox_semanticsx_read_articles";

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage failures; read progress is a convenience only.
  }
}

export function useAuth() {
  const { user, claims, loading, isAdmin } = useSeoAuth();

  const markArticleRead = useCallback((type, articleId) => {
    if (!type || !articleId) return;
    const store = readStore();
    store[type] = Array.from(new Set([...(store[type] || []), articleId]));
    writeStore(store);
  }, []);

  const isArticleRead = useCallback((type, articleId) => {
    const store = readStore();
    return Boolean(store[type]?.includes(articleId));
  }, []);

  return {
    user: user ? { ...user, id: user.uid, isAdmin } : null,
    claims,
    loading,
    isLoading: loading,
    isAdmin,
    isAuthenticated: Boolean(user),
    markArticleRead,
    isArticleRead,
  };
}
