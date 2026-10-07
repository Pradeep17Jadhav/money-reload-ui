import LoansPage from "./LoansPage";

const title = "Loans - MoneyReload";
const description = "Track the loans you hold and what is left to repay.";
const keywords = "track loans, loan tracker, moneyreload loans";

export const metadata = {
  title,
  description,
  keywords,
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    description,
    keywords,
  },
};

export default LoansPage;