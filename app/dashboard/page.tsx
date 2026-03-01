import { redirect } from "next/navigation";

// /dashboard is an alias for the root dashboard at /
export default function DashboardAlias() {
  redirect("/");
}
