import type { Metadata } from "next";
import AdminDashboard from "@/components/admin-dashboard";
import "./admin.css";
import "./ghost-stock.css";
import "./odds.css";

export const metadata: Metadata = {
  title: "Admin | Gacha Arcade",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
