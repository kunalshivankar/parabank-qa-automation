function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches a ParaBank page URL such as .../parabank/register.htm, tolerating the
 * ";jsessionid=..." path parameter the server appends and any query string or fragment.
 */
export function parabankPagePattern(pageName: string): RegExp {
  return new RegExp(`/parabank/${escapeRegExp(pageName)}(;jsessionid=[^?#]*)?([?#].*)?$`);
}
