import IncomePage from "./IncomePage";

const title = "Income - MoneyReload";
const description = "Track the income you receive each month.";
const keywords = "track income, income tracker, moneyreload income";

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

export default IncomePage;