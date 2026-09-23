export function go(path: string) { window.location.hash = `#${path}`; }
export function ExplorerTopline({ section, count }: { section: string; count: string }) { return <div className="topline"><span>ARCHIVE / {section}</span><span>{count}</span></div>; }
export function PageLoading({ label }: { label: string }) { return <div className="page-state" role="status"><span /><strong>{label}</strong></div>; }
export function PageError({ message }: { message: string }) { return <div className="page-state error"><strong>Could not load this page</strong><p>{message}</p></div>; }
