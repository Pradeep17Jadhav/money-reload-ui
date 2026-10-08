import classnames from "classnames";
import { Avatar } from "@mui/material";

import styles from "./AvatarInitials.module.css";

type Props = {
  initials: string;
  size?: number;
  className?: string;
};

/**
 * Live preview of the initials derived from the name fields. Decorative: the
 * names themselves are right beside it, so it is hidden from assistive tech.
 */
const AvatarInitials = ({ initials, size = 88, className }: Props) => (
  <div
    className={classnames(styles.wrapper, className)}
    data-testid="avatar-initials"
    aria-hidden="true"
  >
    <Avatar
      className={styles.avatar}
      sx={{ width: size, height: size, fontSize: size / 2.6 }}
    >
      {initials}
    </Avatar>
  </div>
);

export default AvatarInitials;