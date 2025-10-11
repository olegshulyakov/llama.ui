/**
 * Renders a link that opens in a new tab with proper security and accessibility attributes.
 *
 * @param href - URL to visit in new tab
 * @param children - Visible link text
 */
export const OpenInNewTab = ({
  href,
  children,
}: {
  href: string;
  children: string;
}) => (
  <a
    className="underline"
    href={href}
    target="_blank"
    rel="noopener noreferrer"
  >
    {children}
  </a>
);
