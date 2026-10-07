import AuthenticatedPage from "@/components/AuthenticatedPage/AuthenticatedPage";

const LoansPage = () => (
  <AuthenticatedPage
    title="Loans"
    subtitle="Every loan you are tracking, with what is left to pay."
    placeholder="Your loans will appear here."
  />
);

export default LoansPage;