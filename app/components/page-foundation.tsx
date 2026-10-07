import Link from "next/link";

export default function PageFoundation({ title, description }: { title: string; description: string }) {
  return <main id="main-content" tabIndex={-1} className="foundation-page"><div><p className="eyebrow">WORKSPACE</p><h2>{title}</h2><p>{description}</p><Link href="/">Back to Overview</Link></div></main>;
}
