import { permanentRedirect } from "next/navigation";

// /dashboard is a permanent alias for the root dashboard at /
export default function DashboardAlias() {
  permanentRedirect("/");
}
