import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'CourseCompass AI — Your next chapter',description:'Explore degrees, universities, and the skills for your next chapter. A career companion for students in Pakistan.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
