/* The app is light-only. This hook used to hard-code `isDarkMode: true`,
   so every `isDarkMode ? dark : light` ternary in the semanticsx components
   took the DARK branch — Rank Grid Pro alone has 85 of them. The screens only
   looked light because stylesheet overrides forced them to, which left the
   places CSS could not reach (inline colours, dark map tiles, text that only
   a ternary set) still dark. Returning the theme the app actually uses lets
   those components pick their own light values. */
export function useTheme() {
  return {
    isDarkMode: false,
    darkMode: false,
    theme: "light",
    toggleTheme: () => {},
  };
}
