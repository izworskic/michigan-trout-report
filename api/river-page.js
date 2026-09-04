import riverHandler from './river/[id].js';

const MEASUREMENT_ID = 'G-Y5D2V2W7HN';
const GA4_TAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${MEASUREMENT_ID}');
</script>`;

export default async function handler(req, res) {
  const riverId = req.query?.id;
  if (riverId) req.url = `/rivers/${encodeURIComponent(String(riverId))}`;

  const originalSend = res.send.bind(res);
  res.send = (body) => {
    let output = body;
    if (
      typeof output === 'string' &&
      /<\/head>/i.test(output) &&
      !output.includes(MEASUREMENT_ID)
    ) {
      output = output.replace(/<\/head>/i, `${GA4_TAG}\n</head>`);
    }
    return originalSend(output);
  };

  return riverHandler(req, res);
}
