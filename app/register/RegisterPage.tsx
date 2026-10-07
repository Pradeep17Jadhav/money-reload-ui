import RegisterPanel from "@/components/RegisterPanel/RegisterPanel";
import RequireAnonymous from "@/components/RequireAnonymous/RequireAnonymous";

const RegisterPage = () => (
  <RequireAnonymous>
    <RegisterPanel />
  </RequireAnonymous>
);

export default RegisterPage;