import AppLayout from "./(app)/layout";
import { NotFoundContent } from "@/components/ui/NotFoundContent";

export default function NotFound() {
  return (
    <AppLayout params={Promise.resolve({})}>
      <NotFoundContent />
    </AppLayout>
  );
}
