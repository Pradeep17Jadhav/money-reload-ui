import AuthenticatedPage from "@/components/AuthenticatedPage/AuthenticatedPage";

const ExpensesPage = () => (
  <AuthenticatedPage
    title="Expenses"
    subtitle="Everything going out, month after month."
    placeholder="Your expenses will appear here."
  />
);

export default ExpensesPage;