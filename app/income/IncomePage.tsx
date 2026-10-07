import AuthenticatedPage from "@/components/AuthenticatedPage/AuthenticatedPage";

const IncomePage = () => (
  <AuthenticatedPage
    title="Income"
    subtitle="Everything coming in, month after month."
    placeholder="Your income will appear here."
  />
);

export default IncomePage;