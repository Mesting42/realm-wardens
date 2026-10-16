let uid=0;
const art={
  shield:'<path fill="url(#G)" d="M13 5h38v25c-1 13-12 22-19 26-7-4-18-13-19-26z"/><path fill="#f6e9b5" d="M28 14h8v26h-8zm-7 8h22v7H21z"/><path fill="#334c49" d="M32 48c9-6 14-13 14-20V10h-4v18c0 8-4 13-10 18z"/>',
  heart:'<path fill="#bd6d60" d="M32 54S5 38 5 21C5 6 24 5 32 18 40 5 59 6 59 21c0 17-27 33-27 33"/><path fill="#ebbd9e" d="M12 21c0-7 9-10 13-6-7-1-9 3-9 9z"/>',
  coin:'<circle fill="#90703e" cx="32" cy="34" r="23"/><circle fill="#e5be70" cx="32" cy="30" r="23"/><circle fill="#bd9450" cx="32" cy="30" r="17"/><path fill="#f5d892" d="m32 16 11 14-11 14-11-14z"/>',
  arrow:'<path fill="#9a754c" d="m11 13 7-6 38 41-7 6z"/><path fill="#dce6df" d="m37 41 20-2 1 19-18-3z"/><path fill="#76a576" d="m8 13 14 2-2 13-14-3zm6-9 13 3 2 13-13-2z"/>',
  ballista:'<path fill="#79593c" d="M8 36q24-36 48 0l-5 5Q32 15 13 41z"/><path fill="none" stroke="#dbc896" stroke-width="2" d="m11 36 21 18 21-18"/><path fill="#bb9661" d="M28 19h8v36h-8z"/><path fill="#d7e2df" d="m32 3 10 17H22z"/>',
  cannon:'<path fill="#8b693f" d="m15 41 32-3 9 12H7z"/><path fill="#52717c" d="m12 31 37-16 7 13-37 18z"/><ellipse fill="#243d45" cx="52" cy="21" rx="6" ry="9" transform="rotate(-26 52 21)"/><circle fill="#9b794a" cx="18" cy="48" r="11"/><circle fill="#e3c681" cx="18" cy="48" r="5"/><path fill="#efd98e" d="m48 8 5-7 2 10 8-3-7 8z"/>',
  arcane:'<path fill="#aab8b2" d="M15 48h34v9H15zm5-12h24v14H20z"/><path fill="#d6b97c" d="m16 39 16 5 16-5v5l-16 6-16-6z"/><path fill="#aa93d7" d="M32 3 47 23 32 42 17 23z"/><path fill="#e0c7ed" d="m32 3 3 20-18 0z"/><path fill="#796899" d="m35 23 12 0-15 19z"/>',
  frost:'<path fill="#86c0d4" d="m30 2 10 22-8 27-11-27zM10 18l12 8 6 28L9 36zm44-4-5 24-14 16 5-27z"/><path fill="#d7f3f2" d="m30 2 3 26-12-4zm24 12-14 13 4 7z"/><path fill="#8ba7ae" d="M14 52h36v7H14z"/>',
  thunder:'<path fill="#668188" d="M14 44h36v13H14zM18 14h5v30h-5zm23 0h5v30h-5z"/><circle fill="#e2c977" cx="20" cy="12" r="8"/><circle fill="#e2c977" cx="44" cy="12" r="8"/><path fill="#f3e4a1" d="m36 17-17 20h12l-4 16 18-24H32z"/>',
  nature:'<path fill="#817053" d="m29 56 2-30-9-14 6-4 8 16 1 32z"/><path fill="#70a16d" d="M31 30C8 29 8 6 9 5c20 0 27 9 22 25"/><path fill="#a5c77e" d="M34 35c-2-21 12-27 25-26 1 15-9 27-25 26"/><path fill="#d6dd9d" d="m35 31 19-18-14 20z"/>',
  leaf:'<path fill="#70a16d" d="M11 47C3 17 38 8 55 6c2 32-22 55-44 41"/><path fill="#cee0a0" d="m8 57 35-38-8 24-22 12z"/>',
  barracks:'<path fill="#c7c6b3" d="M10 28h43v29H10z"/><path fill="#7798ac" d="m5 29 27-22 27 22z"/><path fill="#d5ba75" d="M13 28h37v5H13z"/><path fill="#405a5a" d="M24 57V39q8-7 16 0v18z"/><path fill="#b5c891" d="M50 4h12v13H50z"/><path fill="#b5a579" d="M48 3h3v29h-3z"/>',
  tree:'<path fill="#827054" d="M27 59V32h11v27z"/><path fill="#63936a" d="M11 38 18 7h29l9 31z"/><path fill="#96b976" d="m17 18 11-16 20 8-12 16z"/><path fill="#d6df9a" d="M22 29h5v4h-5zm17 0h5v4h-5z"/>',
  star:'<path fill="#e0c077" d="m32 4 9 17 19 4-14 14 2 21-16-10-17 10 3-21L4 25l19-4z"/><path fill="#f2d998" d="m32 4 1 28L4 25l19-4z"/>',
  sun:'<circle fill="#e4bf70" cx="32" cy="32" r="15"/><path fill="#edcf87" d="M29 2h6v11h-6zm0 49h6v11h-6zM2 29h11v6H2zm49 0h11v6H51zM9 13l4-4 9 9-4 4zm33 33 4-4 9 9-4 4zm0-28 9-9 4 4-9 9zM9 51l9-9 4 4-9 9z"/>',
  play:'<path fill="#e9d191" d="m22 12 30 20-30 20z"/>',
  pause:'<path fill="#e9d191" d="M17 13h10v38H17zm20 0h10v38H37z"/>',
  map:'<path fill="#abc59e" d="m7 14 17-6 16 6 17-6v42l-17 6-16-6-17 6z"/><path fill="#355d48" d="M24 8v42l16 6V14z"/><path fill="none" stroke="#f1d89d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="m14 36 12-9 12 9 12-10"/>',
  grid:'<path fill="none" stroke="#e3d5a8" stroke-width="4" stroke-linejoin="round" d="M10 10h44v44H10zm15 0v44m14-44v44M10 25h44M10 39h44"/>',
  expand:'<path fill="none" stroke="#e3d5a8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M23 10H10v13m31-13h13v13M10 41v13h13m31-13v13H41"/>',
  wave:'<path fill="none" stroke="#9fb9ab" stroke-width="7" stroke-linecap="round" d="M7 23q12-16 25 0t25 0M7 43q12-16 25 0t25 0"/>',
  settings:'<path fill="#98ada8" d="m25 4 14 0 3 9 9 4 9 8v14l-9 3-4 9-8 9H25l-3-9-9-4-9-8V25l9-3 4-9z"/><circle fill="#263f3e" cx="32" cy="32" r="12"/><circle fill="#d1bc86" cx="32" cy="32" r="6"/>',
  book:'<path fill="#b59f74" d="M8 10q14-4 24 2 10-6 24-2v43q-14-3-24 3-10-6-24-3z"/><path fill="#e6dcc1" d="M12 14q12-3 18 2v34q-8-4-18-2zm22 2q10-6 18-2v34q-10-2-18 2z"/><path fill="#679378" d="M39 18h6v18l-3-3-3 3z"/>',
  trophy:'<path fill="#ac874b" d="M9 12h46v9c0 16-11 23-23 23S9 37 9 21zm7 7c0 14 6 17 16 17s16-3 16-17z"/><path fill="#e3c276" d="M19 6h26v21c0 11-8 17-13 17s-13-6-13-17zM28 41h8v10h-8zm-9 10h26v7H19z"/>',
  flag:'<path fill="#c2a976" d="M14 5h5v55h-5z"/><path fill="#a1bb84" d="M19 8h36l-8 13 8 13H19z"/><path fill="#e1cd8d" d="m29 16 7 5-7 5z"/>',
  endless:'<path fill="none" stroke="#d3b978" stroke-width="8" d="M32 32C19 11 5 18 5 32s14 21 27 0 27-14 27 0-14 21-27 0z"/>',
  close:'<path fill="none" stroke="#b4c1b4" stroke-width="5" stroke-linecap="round" d="m16 16 32 32M48 16 16 48"/>',
  chevron:'<path fill="none" stroke="#dac48f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="m24 14 18 18-18 18"/>',
  return:'<path fill="none" stroke="#b1c3b5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="m27 15-16 16 16 16M11 31h32q12 0 12 15"/>',
  knight:'<path fill="#ceaf6e" d="M9 61v-9q0-17 23-17t23 17v9z"/><path fill="#89a2a5" d="M15 24Q15 6 32 6t17 18v21H15z"/><path fill="#344e56" d="M19 23h26v9H19z"/><path fill="#ecdbab" d="M29 8h6v32h-6z"/><path fill="#9b7352" d="m32 2 9 8-18 0z"/><path fill="#e8cd8c" d="m7 44 14 4-7 16H3zm50 0-14 4 7 16h11z"/>',
  ranger:'<path fill="#5a8866" d="M7 63V49q7-13 25-13t25 13v14z"/><path fill="#a9bf82" d="M10 35Q10 4 32 4t22 31l-8 9H18z"/><path fill="#deba8f" d="M21 18h22v13q0 13-11 13T21 31z"/><path fill="#547b59" d="m15 22 17-16 16 16-16-5z"/><path fill="#314b43" d="M25 26h4v3h-4zm11 0h4v3h-4z"/>',
  mage:'<path fill="#8a79b2" d="M8 63V50q4-12 24-12t24 12v13z"/><path fill="#d9b793" d="M21 22h22v10q0 12-11 12T21 32z"/><path fill="#a38ace" d="m7 27 18-26 22 24z"/><path fill="#d8c899" d="M12 26h41v6H12z"/><path fill="#e8ddba" d="m30 10 3 4 5 0-4 4 1 4-5-2-4 2 1-5-4-3 5 0z"/>',
  druid:'<path fill="#80a581" d="M6 63V52q5-13 26-13t26 13v11z"/><path fill="#dfbf9c" d="M20 21h24v11q0 13-12 13T20 32z"/><path fill="#658a6b" d="M16 35V17Q16 1 32 1t16 16v18l-6-12-10-9-9 9z"/><path fill="#b8cd8d" d="m12 16 11-11 11 12 12-10 9 12-12-1-11 7-12-5z"/><path fill="#d8dc9f" d="M29 47h6v13h-6z"/>'
};
export function icon(name,size=28){
  const id=`paint${uid++}`;return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}" x2=".7" y2="1"><stop stop-color="#9ab4af"/><stop offset="1" stop-color="#567b77"/></linearGradient></defs>${(art[name]||art.shield).replaceAll('#G',`#${id}`)}</svg>`;
}
export function miniMap(map){
  return `<div class="map-preview region-${map.region}"><img class="mini-map" data-model-map="${map.id}" alt="${map.name}三维战场预览"><span class="preview-label">${map.routes.length>1?'多路战场':'守城战场'} · 3D</span></div>`;
}
