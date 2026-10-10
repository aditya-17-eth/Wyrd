import { useId } from 'react';
import type { CategoryId } from '@/lib/categories';

/** Illustrative diagrams only. These assets never represent observed or forecast data. */
export function CategoryArt({category, className = ''}: {category: CategoryId; className?: string}) {
  const id = useId().replace(/:/g, '');
  return <svg className={`category-art art-${category} ${className}`} viewBox="0 0 600 300" fill="none" aria-hidden="true">
    <defs>
      <pattern id={`${id}-grid`} width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" stroke="currentColor" strokeOpacity=".1"/></pattern>
      <radialGradient id={`${id}-thermal`}><stop stopColor="#EDA56C"/><stop offset=".3" stopColor="#CA5C79"/><stop offset=".65" stopColor="#5B54A0"/><stop offset="1" stopColor="#173A5C" stopOpacity="0"/></radialGradient>
    </defs>
    <rect width="600" height="300" fill={`url(#${id}-grid)`}/>
    {category === 'weather' && <>
      <ellipse cx="320" cy="130" rx="280" ry="160" fill={`url(#${id}-thermal)`} opacity=".85" transform="rotate(-20 320 130)"/>
      {Array.from({length: 11}, (_, i) => <path key={i} d={`M ${-80+i*9} ${290-i*14} C ${100+i*12} ${330-i*17}, ${95+i*12} ${85-i*7}, ${270+i*14} ${120-i*9} S ${440+i*9} ${280-i*10}, ${690+i*8} ${-70+i*19}`} stroke={i > 6 ? '#9CB6D5' : '#EEB8A1'} strokeOpacity=".45" strokeWidth="1"/>)}
      <circle cx="316" cy="141" r="5" fill="#F5F5F2"/><circle cx="316" cy="141" r="20" stroke="#F5F5F2" strokeOpacity=".5"/>
      <path d="M316 115V94M316 168V189M290 141H267M343 141H366" stroke="#F5F5F2" strokeOpacity=".65"/>
    </>}
    {category === 'travel' && <>
      <path d="M-20 270Q280 -130 620 90M-20 230Q260 340 620 20M70 310Q410 70 540 -30" stroke="currentColor" strokeOpacity=".3" strokeDasharray="5 7"/>
      <path d="M86 244Q265 40 492 75" stroke="currentColor" strokeWidth="2"/>
      {[ [86,244], [492,75], [184,126], [443,230] ].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="5" fill="currentColor"/><circle cx={x} cy={y} r="17" stroke="currentColor" strokeOpacity=".4"/></g>)}
      <path d="m315 84 21 1 32-42 8 3-18 42 26 9 9-12 6 2-4 19-17 8-5-4 9-10-28-2-21 43-8-2 11-49-21-8Z" fill="currentColor" transform="rotate(14 340 95)"/>
      <path d="M70 35h170m-170 10h100M385 268h144m-80-10h80" stroke="currentColor" strokeOpacity=".4"/>
    </>}
    {category === 'agriculture' && <>
      {Array.from({length: 6},(_,i)=><g key={i} transform={`translate(${i*105-40} 0) rotate(-24)`}>{Array.from({length:5},(_,j)=><rect key={j} x="0" y={j*82-40} width="90" height="67" rx="3" fill="currentColor" fillOpacity={.07+((i+j)%4)*.06} stroke="currentColor" strokeOpacity=".3"/>)}</g>)}
      <path d="M-10 276Q170 197 226 143T390 93T610 15" stroke="#12251F" strokeWidth="15"/><path d="M-10 276Q170 197 226 143T390 93T610 15" stroke="currentColor" strokeOpacity=".6" strokeWidth="2"/>
      <circle cx="400" cy="174" r="67" stroke="currentColor" strokeOpacity=".5"/><circle cx="400" cy="174" r="46" stroke="currentColor" strokeDasharray="3 6" strokeOpacity=".4"/>
    </>}
    {category === 'logistics' && <>
      <path d="M0 58 52 79 89 52 122 65 169 52 181 81 165 125 204 137 229 179 266 186 294 155 309 177 349 153 364 98 404 78 449 94 475 57 541 75 600 34M0 208l48-16 36 15 29-16 32 37 50 13 48 52m134 7 15-42 58-7 23-39 68-11 38-33 62 21" stroke="currentColor" strokeOpacity=".35"/>
      <path d="M90 104Q260 15 455 130Q390 266 224 227Q156 198 90 104Z" stroke="currentColor" strokeWidth="1.6" strokeDasharray="5 6"/>
      {[[90,104],[455,130],[224,227]].map(([x,y],i)=><g key={i}><rect x={x-6} y={y-6} width="12" height="12" fill="currentColor"/><circle cx={x} cy={y} r="18" stroke="currentColor" strokeOpacity=".4"/></g>)}
      {Array.from({length:5},(_,i)=><rect key={i} x={355+i*31} y="235" width="25" height="14" stroke="currentColor" strokeOpacity=".5"/>)}
    </>}
    {category === 'events' && <>
      {[110,90,70].map((r,i)=><rect key={r} x={300-r*1.7} y={150-r} width={r*3.4} height={r*2} rx={r*.75} stroke="currentColor" strokeOpacity={.2+i*.15}/>)}
      <rect x="246" y="103" width="108" height="94" rx="6" fill="currentColor" fillOpacity=".1" stroke="currentColor"/>
      {Array.from({length:24},(_,i)=><path key={i} d="M300 18v20" stroke="currentColor" strokeOpacity=".5" transform={`rotate(${i*15} 300 150)`}/>)}
      <path d="M55 250h95m300-200h95M300 14v67m0 138v67M85 150h104m222 0h104" stroke="currentColor" strokeOpacity=".3"/>
    </>}
  </svg>;
}

export function RiskTransferArt() {
  return <svg className="risk-transfer-art" viewBox="0 0 650 440" fill="none" role="img" aria-label="Conceptual diagram linking risk, reserved capital, and settlement">
    <defs><pattern id="risk-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#9297A5" opacity=".22"/></pattern></defs>
    <rect width="650" height="440" fill="url(#risk-dots)"/>
    <g stroke="#836EF9" strokeOpacity=".38">
      {Array.from({length:15},(_,i)=><path key={i} d={`M-20 ${60+i*22} C ${165+i*4} ${40+i*23}, ${180+i*5} ${300-i*7}, 315 ${225+i*2} S 450 ${35+i*21}, 680 ${90+i*19}`}/>)}
    </g>
    <path d="m312 67 117 66v135l-117 68-117-68V133Z" fill="#13151E" stroke="#535363"/>
    <path d="m312 67 117 66-117 67-117-67Z" fill="#1B1B2A" stroke="#686478"/>
    <path d="m312 200 117-67v135l-117 68Z" fill="#232037" stroke="#686478"/>
    <path d="M312 201v135M195 133l117 67" stroke="#686478"/>
    <path d="m312 102 57 32-57 33-57-33Z" stroke="#B8AAF8" strokeWidth="2"/>
    <path d="m312 118 29 16-29 17-29-17Z" fill="#836EF9"/>
    <path d="M313 34v-18h148M448 237h126v-65M183 268h-92v54" stroke="#9297A5" strokeOpacity=".6"/>
    <circle cx="313" cy="34" r="3" fill="#F5F5F2"/><circle cx="448" cy="237" r="3" fill="#F5F5F2"/><circle cx="183" cy="268" r="3" fill="#F5F5F2"/>
    <g fill="#BDC1CC" fontFamily="inherit" fontSize="12"><text x="475" y="20">Defined risk</text><text x="483" y="160">Reserved capital</text><text x="45" y="346">Onchain settlement</text></g>
    <g fill="#5E6271" fontFamily="inherit" fontSize="10"><text x="475" y="39">Immutable event terms</text><text x="483" y="180">Full claim coverage</text><text x="45" y="365">Inspectable outcomes</text></g>
  </svg>;
}
