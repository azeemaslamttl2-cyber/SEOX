function getInitials(name = "", email = "") {
  const source = (name || email || "").trim();
  if (!source) return "?";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function Avatar({ user, size = 32, className = "" }) {
  if (!user) return null;
  if (user.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName || user.email}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover ring-2 ring-brand-500/30 ${className}`}
      />
    );
  }
  const initials = getInitials(user.displayName, user.email);
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-bold text-white ring-2 ring-brand-500/30 ${className}`}
    >
      {initials}
    </div>
  );
}
