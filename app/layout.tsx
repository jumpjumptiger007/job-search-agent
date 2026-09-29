import "./globals.css";
import Link from "next/link";
import TrackpadNavigation from "./trackpad-navigation";
export const metadata={title:"Job Search Agent",description:"Local-first job workspace"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><TrackpadNavigation /><header><Link href="/">Job Search Agent</Link><span>Local workspace</span></header>{children}</body></html>}
