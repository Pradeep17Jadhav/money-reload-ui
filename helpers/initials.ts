const firstCharacters = (value: string): string => value.trim().slice(0, 2).toUpperCase();

/**
 * Derives avatar initials from the name fields so the preview is never blank:
 * one initial per name part when both are present, otherwise the first two
 * characters of whichever part is.
 */
export const getInitials = (firstName: string, lastName: string): string => {
  const first = firstName.trim();
  const last = lastName.trim();

  if (first && last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }

  if (first) {
    return firstCharacters(first);
  }

  if (last) {
    return firstCharacters(last);
  }

  return "";
};