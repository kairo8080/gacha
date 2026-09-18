import type { Metadata } from "next";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import AdminDashboard from "@/components/admin-dashboard";
import { isProductImagePath } from "@/lib/ghost-stock";
import "./admin.css";
import "./ghost-stock.css";
import "./odds.css";

export const metadata: Metadata = {
  title: "Admin | Gacha Arcade",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // Only public product filenames are exposed. The list is rebuilt on deployment.
  const files = await readdir(join(process.cwd(), "public", "products"), {
    withFileTypes: true,
  });
  const productImages = files
    .filter((file) => file.isFile())
    .map((file) => `/products/${file.name}`)
    .filter(isProductImagePath);
  return <AdminDashboard productImages={productImages} />;
}
