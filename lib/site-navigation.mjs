const tools=[['/compare','Compare pools'],['/simulator','Mining simulator'],['/miner-checker','Who builds my block?'],['/trends','Trends & changes'],['/mining-map','Mining map'],['/endpoint-checks','Endpoint observations']];
export function siteNavigation(html,path){
 const active=href=>href===path?' aria-current="page"':'';
 const link=(href,label)=>`<a href="${href}"${active(href)}>${label}</a>`;
 const header=html.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0];if(!header)return html;
 const controls=header.match(/<div class="header-right">[\s\S]*?<\/div>/)?.[0]||'';
 const nav=`<header class="topbar site-header"><a class="brand" href="/" aria-label="XBT Pulse home"><img src="/favicon.svg" width="34" height="34" alt=""><span>XBT<span class="brand-light">PULSE</span></span></a><nav class="site-navigation" aria-label="Site navigation"><button class="quiet-button site-menu-toggle" aria-expanded="false" aria-controls="site-nav-links">Menu ☰</button><div id="site-nav-links" class="site-nav-links">${link('/','Dashboard')}${link('/pools','Pools')}<details class="site-tools"><summary${tools.some(([url])=>url===path)?' class="current-tool"':''}>Tools</summary><div class="site-tool-links">${tools.map(([url,label])=>link(url,label)).join('')}</div></details>${link('/watchlist','My watchlist')}${link('/contribute','Contribute')}${link('/about','Our mission')}</div></nav>${controls}</header>`;
 return html.replace(header,nav).replace('</head>','<script type="module" src="/site-navigation.js"></script></head>');
}
