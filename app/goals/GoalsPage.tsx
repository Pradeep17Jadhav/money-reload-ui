import AuthenticatedPage from "@/components/AuthenticatedPage/AuthenticatedPage";

const GoalsPage = () => (
  <AuthenticatedPage
    title="Goals"
    subtitle="What you are saving towards, and how far along you are."
    placeholder="Your goals will appear here."
  />
);

export default GoalsPage;