export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const poofRes = await fetch("https://api.poof.bg/v1/remove", {
    method: "POST",
    headers: {
      "content-type": req.headers["content-type"],
      "x-api-key": process.env.POOF_API_KEY,
    },
    body,
  });

  if (!poofRes.ok) {
    const text = await poofRes.text();
    return res.status(poofRes.status).json({ error: text });
  }

  const buf = Buffer.from(await poofRes.arrayBuffer());
  res.setHeader("content-type", "image/png");
  res.send(buf);
}
