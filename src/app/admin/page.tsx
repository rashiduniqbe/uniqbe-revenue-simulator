import { LogoutButton } from "../../components/admin/LogoutButton";
import { PricelistUploader } from "../../components/admin/PricelistUploader";

export default function AdminPage() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Price list upload</h1>
        <LogoutButton />
      </div>
      <PricelistUploader />
    </>
  );
}
