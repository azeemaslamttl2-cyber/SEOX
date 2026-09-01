export const TIERS = {
  free: { id: "free", label: "Free" },
  admin: { id: "admin", label: "Admin" },
  professional: { id: "professional", label: "Professional" },
  enterprise: { id: "enterprise", label: "Enterprise" },
};

export function normalizeTier(value) {
  const tier = String(value || "free").trim().toLowerCase();

  if (tier === "admin") return "admin";
  if (tier === "enterprise") return "enterprise";
  if (["professional", "proffesional", "pro", "premium"].includes(tier)) {
    return "professional";
  }

  return "free";
}

export function getTierLabel(value) {
  return TIERS[normalizeTier(value)].label;
}
