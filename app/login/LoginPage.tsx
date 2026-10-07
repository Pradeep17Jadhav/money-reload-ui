import LoginPanel from "@/components/LoginPanel/LoginPanel";
import RequireAnonymous from "@/components/RequireAnonymous/RequireAnonymous";

const LoginPage = () => (
  <RequireAnonymous>
    <LoginPanel />
  </RequireAnonymous>
);

export default LoginPage;