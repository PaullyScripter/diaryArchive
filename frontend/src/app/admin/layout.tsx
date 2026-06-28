import { AdminLayout } from "@/components/layout/admin-layout";
import { ProtectedRoute } from "@/components/shared/protected-route";

export default function AdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute adminOnly>
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  );
}
