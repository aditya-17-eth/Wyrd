import Image from 'next/image';
export function BrandLogo(){return <><Image className="brand-symbol" src="/brand/wyrd-shield.png" alt="" width={256} height={256} loading="eager"/><Image className="brand-wordmark" src="/brand/wyrd-wordmark.png" alt="" width={457} height={160} loading="eager"/></>;}
export function FooterWordmark(){return <Image className="footer-wordmark" src="/brand/wyrd-wordmark.png" alt="Wyrd" width={457} height={160}/>;}
