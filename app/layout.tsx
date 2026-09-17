import "./globals.css";
import Link from "next/link";
export const metadata={title:"Job Search Agent",description:"Local-first job workspace"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><header><Link href="/">Job Search Agent</Link><span>Local-first · v0.6.1</span></header>{children}</body></html>}
