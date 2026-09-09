import { useEffect, useState } from "react";
import App from "../App.jsx";
import "../index.css";

// This project uses one React Router application for all client navigation.
// Mount it here so Next does not replace it with isolated page components.
function ClientOnly({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? children : null;
}

export default function CrawlusApp() {
  return (
    <ClientOnly>
      <App />
    </ClientOnly>
  );
}
