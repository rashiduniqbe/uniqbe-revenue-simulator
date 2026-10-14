import { LogoutButton } from "../../components/admin/LogoutButton";

export default function AdminPage() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Price list upload</h1>
        <LogoutButton />
      </div>
      <p>Signed in. The price list upload form arrives with the preview endpoint.</p>
    </>
  );
}
