import type {Metadata} from 'next';import {Providers} from '@/components/providers';import './globals.css';
export const metadata:Metadata={title:'Wyrd | Underwrite uncertainty',description:'Onchain real-world risk markets, parametric protection, and collateralized underwriting. Educational Monad Testnet prototype.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><Providers>{children}</Providers></body></html>;}
