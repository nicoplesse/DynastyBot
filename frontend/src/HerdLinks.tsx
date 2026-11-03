import { isDiscordUrl, linkHref } from './herd';

// Discord links open straight in the desktop app (discord://); other links open in a new tab.
export function ExternalLink({ url, className, title, children }: { url: string; className?: string; title?: string; children: React.ReactNode }) {
  const discord = isDiscordUrl(url);
  return <a className={className} href={linkHref(url)} title={title || url} {...(discord ? {} : { target: '_blank', rel: 'noreferrer' })}>{children}</a>;
}

export function LinkedText({ text, className = 'herd-text-link' }: { text: string; className?: string }) {
  return <>{text.split(/(https?:\/\/\S+)/).map((part, index) => index % 2
    ? <ExternalLink key={index} url={part} className={className}>{isDiscordUrl(part) ? 'Open in Discord ↗' : part}</ExternalLink>
    : part)}</>;
}
