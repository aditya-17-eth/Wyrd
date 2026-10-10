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
  return <svg className="risk-transfer-art" viewBox="0 0 680 500" fill="none" role="img" aria-label="Illustrated protection vault connecting a defined event, reserved capital and verified evidence">
    <defs><pattern id="vault-hatching" width="5" height="5" patternUnits="userSpaceOnUse"><path d="m0 5 5-5" stroke="#A9A59E" strokeWidth=".5"/></pattern></defs>
    <g stroke="#B8B4AC" strokeWidth="1" strokeDasharray="3 5">
      <path d="m92 290 251-145 246 142-246 143Z"/><path d="M343 145V50M92 290v78l251 144M589 287v78L343 508"/>
      <path d="m130 221 213-123 210 121M343 98v330"/>
    </g>
    <g stroke="#171713" strokeWidth="1.2">
      <path d="M234 348v38c0 30 48 55 108 55s109-25 109-55v-38" fill="#171713"/>
      <ellipse cx="342" cy="349" rx="109" ry="54" fill="#FDFCF9"/>
      <path d="M251 336v31c0 25 41 46 91 46s91-21 91-46v-31" fill="#FDFCF9"/>
      <ellipse cx="342" cy="336" rx="91" ry="45" fill="#171713"/>
      <ellipse cx="342" cy="331" rx="73" ry="35" fill="#FDFCF9"/>
      <path d="m237 157 105-61 106 61v161l-106 61-105-61Z" fill="#FDFCF9"/>
      <path d="m237 157 105 61 106-61-106-61Z" fill="#fff"/>
      <path d="m342 218 106-61v161l-106 61Z" fill="#F0EEE8"/>
      <path d="M342 218v161"/>
      <path d="m248 153 94 54 94-54M249 310l93 54 94-54" stroke="#B8B4AC" strokeDasharray="2 4"/>
      <path d="m237 160 105 61 106-61v12l-106 61-105-61Z" fill="#171713"/>
      <path d="m278 224 40 23v44c0 26-16 34-20 36-5-8-20-34-20-59Z" fill="#FFF9ED"/>
      <path d="m288 264 10 17 13-21" stroke="#DB1405" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="m356 265 76-44v54l-76 44Z" fill="url(#vault-hatching)" stroke="#A9A59E"/>
      <path d="m369 274 48-28m-48 41 48-28m-48 41 30-18" stroke="#171713" strokeWidth="2"/>
    </g>
    <g stroke="#171713" strokeWidth="1.1">
      <path d="m119 128 74-43 78 45v103l-74 43-78-45Z" fill="#FDFCF9"/>
      <path d="m119 128 78 45 74-43M197 173v103"/>
      <path d="m125 125 72 41 68-40" strokeWidth="6"/>
      <path d="m136 154 42 24m-42-12 32 18m-32-5 42 24" stroke="#8C877D"/>
      <path d="m142 204 30 17v18l-30-17Z" fill="#FFBA41"/>
      <path d="m447 82 60-35 78 45v97l-60 35-78-45Z" fill="#FDFCF9"/>
      <path d="m447 82 78 45 60-35M525 127v97"/>
      <path d="m452 80 73 42 54-32" strokeWidth="6"/>
      <path d="m462 112 42 24m-42-12 42 24m-42-12 24 14" stroke="#8C877D"/>
      <path d="m468 165 26 15v18l-26-15Z" fill="#DB1405"/>
    </g>
    <g stroke="#8C877D" strokeDasharray="3 4"><path d="M197 276v43l42 24M525 224v48l-73 42M342 441v26"/><ellipse cx="342" cy="464" rx="109" ry="28"/></g>
    <g fill="#171713" fontFamily="inherit" fontSize="12"><text x="74" y="72">Defined event</text><text x="474" y="33">Verified evidence</text><text x="470" y="386">Reserved capital</text></g>
    <path d="M470 373h-37M158 77v20M522 39v14" stroke="#8C877D"/>
    <g fill="#F57411"><circle cx="158" cy="97" r="3"/><circle cx="522" cy="53" r="3"/><circle cx="433" cy="373" r="3"/></g>
  </svg>;
}
