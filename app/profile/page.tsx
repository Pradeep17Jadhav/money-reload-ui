import ProfilePage from "./ProfilePage";

const title = "Profile - MoneyReload";
const description = "Review your MoneyReload account details.";
const keywords = "moneyreload profile, account details";

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

export default ProfilePage;