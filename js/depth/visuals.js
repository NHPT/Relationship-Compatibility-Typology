(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const animals = {
    elephant: '<path d="M42 38C22 24 12 46 24 65l18 12M78 38c20-14 30 8 18 27L78 77M43 27q17-13 34 0l1 42q-1 12-8 15v15q0 14-14 11q-9-2-5-11M43 27v49q3 10 13 10"/><path d="M40 73q-10 12-7 20q10-4 15-13M81 73q8 9 5 18q-9-4-13-10"/><circle cx="49" cy="49" r="2"/><circle cx="71" cy="49" r="2"/>',
    dolphin: '<path d="M14 73q28-45 62-24l23 6-15 8q-3 22-33 31l6-12q-29 3-43-9ZM53 43l12-20 7 22M45 77l-1 19 13-12M94 55l12-12 2 19M19 99q18 8 33 0t35 0"/><circle cx="79" cy="54" r="2"/>',
    penguin: '<path d="M34 49q0-28 26-28t26 28l5 29-11-10M34 49l-5 29 11-10M40 51q20-16 40 0v30q0 21-20 21T40 81ZM46 101l-12 8h25M74 101l12 8H61"/><path d="m52 44 8 8 8-8Z"/><circle cx="48" cy="35" r="2"/><circle cx="72" cy="35" r="2"/>',
    leopard: '<path d="M29 36V19l19 11M91 36V19L72 30M31 38q29-20 58 0l-1 33q-6 26-28 31-22-5-28-31Z"/><path d="m41 50 12 4-9 5M79 50l-12 4 9 5m-25 13 9 5 9-5-9-5Zm9 5v11m-12-1q12 8 24 0M21 69l22 4M20 82l21-3m58-10-22 4m23 9-21-3"/><circle cx="46" cy="37" r="2"/><circle cx="74" cy="37" r="2"/><circle cx="37" cy="64" r="2"/><circle cx="83" cy="64" r="2"/>',
    tortoise: '<path d="M19 77q0-40 37-42 35-1 41 37l-9 12H30Zm0 0-12 6 10 8 16-9m56-11q21-4 22 7t-23 7M35 83l-6 13h14l5-12m27-1 4 13h14l-8-14"/><path d="m55 37-13 18 7 22h24l9-21-12-18M21 64l21-9m7 22-17 8m41-8 13 7M82 56l12 6"/><circle cx="103" cy="78" r="2"/>',
    fox: '<path d="M29 46 20 14l29 22q11-5 22 0l29-22-9 32-3 23-28 35-28-35Z"/><path d="m29 46 27 35m35-35L64 81m-12 0h16l-8 9Zm-16-28 11 6m26-6-11 6M28 27l6 18m58-18-6 18"/><circle cx="46" cy="58" r="2"/><circle cx="74" cy="58" r="2"/>',
    raven: '<path d="M25 84q-9-35 20-45 0-25 24-19l17 14 21 4-19 10q3 23-20 35l-23 7-27 14 9-20ZM46 41q24 10 28 24M40 50q8 17 26 19m-17 20-2 17 10 4m4-23 5 17 11 4M25 84l21-6"/><circle cx="73" cy="32" r="2"/>',
    beaver: '<path d="M31 37q-14-18-20 1t17 12M89 37q14-18 20 1T92 50M32 37q28-19 56 0v37q-1 25-28 28-27-3-28-28Z"/><path d="m51 62 9 6 9-6-9-6Zm9 6v13M48 81h24v15H48Zm12 1v14M19 62l25 8M17 80l25-4m59-14-25 8m27 10-25-4"/><circle cx="45" cy="47" r="2"/><circle cx="75" cy="47" r="2"/>',
    lion: '<path d="m60 13 15 8 16-1 7 15 13 11-4 18 2 17-16 8-9 17-17-2-16 7-12-12-18-5-1-18L8 63l10-15 1-18 18-4 9-12Z"/><path d="M34 42q26-14 52 0l-3 34q-8 20-23 23-15-3-23-23ZM40 49l11 5m29-5-11 5m-17 13 8 5 8-5-8-4Zm8 5v10m-14 3q14 8 28 0"/><circle cx="47" cy="55" r="2"/><circle cx="73" cy="55" r="2"/>',
    peacock: '<path d="M51 75C-2 66 15 23 41 43 20 7 57 2 60 40 63 2 100 7 79 43c26-20 43 23-10 32M60 40v26M42 47l13 23m23-23L65 70M28 63l24 13m40-13L68 76M60 65q-17 0-12 22l12 15q17-5 14-21L67 60q-7-11-7 5ZM58 102l-9 9m16-9 8 9"/><circle cx="62" cy="59" r="2"/><circle cx="34" cy="51" r="3"/><circle cx="47" cy="29" r="3"/><circle cx="74" cy="29" r="3"/><circle cx="87" cy="51" r="3"/>',
    wolf: '<path d="M28 45 25 15l24 20q11-5 22 0l24-20-3 30 10 19-17-4-10 24-15 21-15-21-10-24-17 4Z"/><path d="m38 50 15 7m29-7-15 7m-17 18 10-5 10 5-10 9Zm10 9v12M33 29l7 16m47-16-7 16"/><circle cx="47" cy="58" r="2"/><circle cx="73" cy="58" r="2"/>',
    octopus: '<path d="M35 63V44q0-28 25-28t25 28v19M35 63q-20 15-23 0m25 5q-29 33-20 36t23-18m4-13q-12 38 2 35t10-20m8-15q-4 32 10 35t2-35m7-5q13 39 28 32T85 64m0 0q21 10 24-5"/><path d="M50 58q10 8 20 0"/><circle cx="48" cy="45" r="3"/><circle cx="72" cy="45" r="3"/>',
    eagle: '<path d="M22 72q-3-36 23-46 18-17 35 2l24 14-25 8q-3 21-22 31L37 96l-17 7 8-17M45 27q11 16 34 19M32 48l21 2m-24 8 21 3m-23 7 22 3m10 7 18 17-28-7"/><path d="m82 37 11 7-12 5"/><circle cx="70" cy="33" r="2"/>',
    deer: '<path d="M35 48q25-17 50 0l-8 35-17 23-17-23ZM35 48 18 36l5 20 14 6m48-14 17-12-5 20-14 6M39 38 27 21l1-16m-1 16L13 15m17 11 11-14M81 38l12-17-1-16m1 16 14-6M90 26 79 12"/><path d="m40 58 13 6m27-6-13 6m-15 20 8 5 8-5-8-4Zm8 5v9"/><circle cx="48" cy="64" r="2"/><circle cx="72" cy="64" r="2"/>'
  };
  function animal(symbol, animalName) {
    const drawing = animals[symbol];
    if (!drawing) return pattern();
    return `<svg class="animal-symbol" viewBox="0 0 120 120" role="img" aria-label="${escape(animalName)}象征图案">
      <title>${escape(animalName)} · 视觉象征</title><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${drawing}</g></svg>`;
  }
  function pattern() {
    return '<svg class="animal-symbol constellation-symbol" viewBox="0 0 120 120" role="img" aria-label="行为画像象征图案"><title>行为画像 · 星图象征</title><g fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="60" cy="60" r="44"/><path d="m26 61 20-27 37 9 16 35-35 18-38-35 38 35-18-62 53 44-73-17 57-18-19 53"/></g><g fill="currentColor"><circle cx="26" cy="61" r="3"/><circle cx="46" cy="34" r="3"/><circle cx="83" cy="43" r="3"/><circle cx="99" cy="78" r="3"/><circle cx="64" cy="96" r="3"/></g></svg>';
  }
  function radar(axes) {
    const center = 180, radius = 108, labelRadius = 145;
    const point = (i, scale) => {
      const a = i * Math.PI * 2 / axes.length - Math.PI / 2;
      return [center + Math.cos(a) * radius * scale, center + Math.sin(a) * radius * scale];
    };
    const coords = p => p.map(n => n.toFixed(2)).join(',');
    let paths = '', run = [];
    const full = axes.every(a => a.value !== null);
    if (full) paths = `<polygon class="profile-radar-area" points="${axes.map((a, i) => coords(point(i, a.value / 100))).join(' ')}"/>`;
    else {
      const ordered = [...axes, axes[0]];
      ordered.forEach((a, i) => {
        if (a.value !== null) run.push(coords(point(i % axes.length, a.value / 100)));
        if ((a.value === null || i === ordered.length - 1) && run.length) {
          if (run.length > 1) paths += `<polyline class="profile-radar-partial" points="${run.join(' ')}"/>`;
          run = [];
        }
      });
    }
    return `<svg id="profile-radar" class="profile-radar" viewBox="-45 -10 450 380" role="img" aria-labelledby="profile-radar-title profile-radar-desc">
      <title id="profile-radar-title">行为维度雷达图</title><desc id="profile-radar-desc">${escape(axes.map(a => `${a.name}：${a.value === null ? '信息不足' : '采用比例 ' + a.value + '%'}`).join('；'))}。不是能力分数或忠诚概率。</desc>
      ${[0.25, 0.5, 0.75, 1].map(scale => `<polygon class="profile-radar-grid" points="${axes.map((a, i) => coords(point(i, scale))).join(' ')}"/>`).join('')}
      ${axes.map((a, i) => `<line class="profile-radar-spoke" x1="${center}" y1="${center}" x2="${point(i, 1)[0]}" y2="${point(i, 1)[1]}"/>`).join('')}
      ${paths}
      ${axes.map((axis, i) => {
        const a = i * Math.PI * 2 / axes.length - Math.PI / 2;
        const x = center + Math.cos(a) * labelRadius, y = center + Math.sin(a) * labelRadius;
        const anchor = Math.cos(a) > 0.2 ? 'start' : Math.cos(a) < -0.2 ? 'end' : 'middle';
        const p = point(i, axis.value === null ? 1 : axis.value / 100);
        return `<circle class="profile-radar-dot${axis.value === null ? ' unknown' : ''}" cx="${p[0]}" cy="${p[1]}" r="4"/>
          <g class="profile-radar-label" role="button" tabindex="0" data-focus-axis="${escape(axis.id)}" aria-label="查看${escape(axis.name)}解析">
            <text x="${x}" y="${y - 2}" text-anchor="${anchor}">${escape(axis.name)}</text>
            <text class="profile-radar-value" x="${x}" y="${y + 14}" text-anchor="${anchor}">${axis.value === null ? '待观察' : axis.value + '%'}</text>
          </g>`;
      }).join('')}</svg>`;
  }
  root.RCT_VISUALS = { animal, pattern, radar, animals };
  if (typeof module !== 'undefined') module.exports = root.RCT_VISUALS;
})(typeof window !== 'undefined' ? window : globalThis);
