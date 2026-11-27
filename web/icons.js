const paths={
 exchange:'<path d="M3 8h17m-4-4 4 4-4 4M21 16H4m4-4-4 4 4 4"/>',
 tower:'<path d="M5 21h14M7 20V9L12 3l5 6v11M5 9h14m-8 11v-5h2v5M12 11h.01"/>',
 box:'<path d="m12 2 8.7 5v10L12 22l-8.7-5V7L12 2Zm0 10 8.7-5M12 12 3.3 7M12 12v10"/>',
 pan:'<path d="M12 3v18m-9-9h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/>',
 zoomIn:'<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5m-12-9.5h5m-2.5-2.5v5"/>',
 zoomOut:'<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5m-12-9.5h5"/>',
 camera:'<path d="M4 7h4l2-3h4l2 3h4a1 1 0 0 1 1 1v11H3V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3"/>',
 guard:'<path d="m12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5zM8.5 12l2.3 2.4 4.8-5.1"/>',
 aim:'<circle cx="12" cy="12" r="6.6"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
 battle:'<path d="m3 3 3 .6 13 13-2.4 2.4-13-13zM14.5 19l5-5m-1.4 4.1 3 3M21 3l-3 .6-4.5 4.5 2.4 2.4 4.5-4.5zM8 14.5l-3 3 1.5 1.5 3-3M4 15l5 5m-3.8-2.1-3 3"/>',
 volume:'<path d="M3 9h4l5-4v14l-5-4H3zM16 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/>',
 muted:'<path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/>',
 pack:'<path d="m5 3 2 1 2-1 3 1 3-1 2 1 2-1v18l-2-1-2 1-3-1-3 1-2-1-2 1zM6 7h12m-6 2 3 3-3 3-3-3z"/>',
 mine:'<path d="m4 20 10-11m-7-5c5-1 10 2 13 8l-7-4-5-1z"/>',
 board:'<path d="M4 12h4v8H4zM10 4h4v16h-4zM16 8h4v12h-4z"/>',
 flame:'<path d="M13 3c1 5-4 6-2 10 2-1 3-3 4-5 3 3 5 6 4 9-1 4-4 5-7 5-5 0-8-4-7-8 0-3 2-6 5-8-1 4 1 5 1 5 1-3 1-6 2-8z"/>',
 bookmark:'<path d="M6 4h12v17l-6-4-6 4z"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
 spark:'<path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>',
 inspect:'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/><path d="M8 12h8m-4-4v8"/>',
 left:'<path d="m14.5 5-7 7 7 7"/>',right:'<path d="m9.5 5 7 7-7 7"/>',down:'<path d="m5 9 7 7 7-7"/>',
 crown:'<path d="m3 7 5 4 4-7 4 7 5-4-2 11H5zM6 21h12"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.5M3 12h.5M3 18h.5"/>',
 database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v13c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
 search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5.5 5.5"/>',filter:'<path d="M3 6h18M6 12h12M10 18h4"/>',sort:'<path d="M3 6h11M3 11h8M3 16h5m9-12v16m-4-4 4 4 4-4"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 downloads:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 likes:'<path d="M3 10h4v11H3zM8 11l5-8c2 0 3 1 2 4l-.6 3h5c1.6 0 2 1 1.7 2l-1.4 7c-.2 1.3-1 2-2.3 2H8z"/>',
 x:'<path d="m5 5 14 14m0-14L5 19"/>',copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M5 16H3V3h13v2"/>',external:'<path d="M14 4h6v6m0-6-10 10M9 5H4v15h15v-6"/>',check:'<path d="m4 12 5 5L20 6"/>'
};
export function ratingIcon(platformer=false){
 return '<img class="gd-rating-icon" src="/assets/gd-'+(platformer?'moon':'star')+'.png" alt="" aria-hidden="true">';
}
export function ratingLabel(value,platformer=false){
 const count=Number(value);
 if(value==null||value===''||!Number.isFinite(count))return '—';
 const label=count+' '+(platformer?'moon':'star')+(count===1?'':'s');
 return '<span class="gd-rating" aria-label="'+label+'" title="'+label+'">'+count+' '+ratingIcon(platformer)+'</span>';
}
export function ico(k){if(k==='star')return ratingIcon();if(k==='demonKey')return '<img class="demon-key-icon" src="/assets/ui/demon-key.svg" alt="" aria-hidden="true">';return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(paths[k]||'')+'</svg>'}
