import AuthenticatedPage from "@/components/AuthenticatedPage/AuthenticatedPage";

const ProfilePage = () => (
  <AuthenticatedPage
    title="Profile"
    subtitle="Your MoneyReload account at a glance."
    placeholder="Your profile will appear here."
  />
);

export default ProfilePage;