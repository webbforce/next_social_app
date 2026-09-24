export type ReelSlide = { url: string; ms: number };

const WIDTH = 720;
const HEIGHT = 1280;
const END_MS = 1600;

function pickMime() {
  const types = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return types.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) ?? "";
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load a photo for the reel."));
    img.src = url;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const scale = Math.max(WIDTH / img.naturalWidth, HEIGHT / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (WIDTH - dw) / 2, (HEIGHT - dh) / 2, dw, dh);
}

function drawEndCard(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  hostName: string,
  activity: string,
  link: string,
) {
  ctx.fillStyle = "#0c0a09";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (logo) {
    const size = 96;
    ctx.drawImage(logo, (WIDTH - size) / 2, HEIGHT / 2 - 220, size, size);
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#a8a29e";
  ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("MADE WITH UPFOR", WIDTH / 2, HEIGHT / 2 - 130);
  ctx.font = "500 24px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(link, WIDTH / 2, HEIGHT / 2 - 88);
  ctx.fillStyle = "#fafaf9";
  ctx.font = "700 42px ui-sans-serif, system-ui, sans-serif";
  const line = `${hostName} was up for ${activity}`;
  const words = line.split(" ");
  let row = "";
  let y = HEIGHT / 2 - 20;
  for (const word of words) {
    const next = row ? `${row} ${word}` : word;
    if (ctx.measureText(next).width > WIDTH - 96 && row) {
      ctx.fillText(row, WIDTH / 2, y);
      row = word;
      y += 52;
    } else {
      row = next;
    }
  }
  if (row) ctx.fillText(row, WIDTH / 2, y);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function reelFileName(mime: string) {
  return mime.includes("mp4") ? "upfor-reel.mp4" : "upfor-reel.webm";
}

export async function recordReelFile(
  slides: ReelSlide[],
  hostName: string,
  activity: string,
  link: string,
): Promise<{ blob: Blob; name: string }> {
  const mime = pickMime();
  if (!mime || !slides.length) throw new Error("This browser can't export a reel file.");

  const photos = await Promise.all(slides.map((slide) => loadImage(slide.url)));
  const logo = await loadImage("/logo.png").catch(() => null);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't draw the reel.");

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    recorder.onerror = () => reject(new Error("Couldn't record the reel."));
  });

  recorder.start();
  for (let i = 0; i < slides.length; i++) {
    drawCover(ctx, photos[i]);
    await wait(slides[i].ms);
  }
  drawEndCard(ctx, logo, hostName, activity, link);
  await wait(END_MS);
  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());

  return { blob: await finished, name: reelFileName(mime) };
}
