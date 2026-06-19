const PAYLOAD = `
<style>
body {
  font-family: system-ui;
  max-width: 40rem;
  margin: 2rem auto;
}
</style>

<h1>Website in a Favicon</h1>

<p>
  Everything you're reading right now
  was decoded from favicon pixels.
</p>
`;

const FAVICON_PATH = "./favicon-site.png";
const CHANNELS_PER_PIXEL = 3;

const generateButton = document.querySelector<HTMLButtonElement>("#generate");
const decodeButton = document.querySelector<HTMLButtonElement>("#decode");
const renderButton = document.querySelector<HTMLButtonElement>("#render");

const outputEl = document.querySelector<HTMLElement>("#output");
const previewEl = document.querySelector<HTMLImageElement>("#favicon-preview");

const statPayloadEl = document.querySelector<HTMLElement>("#stat-payload");
const statSizeEl = document.querySelector<HTMLElement>("#stat-size");
const statCapacityEl = document.querySelector<HTMLElement>("#stat-capacity");

function setText(element: HTMLElement | null, value: string): void {
  if (element) {
    element.textContent = value;
  }
}

function encodePayload(payload: string): Uint8Array {
  const contentBytes = new TextEncoder().encode(payload);

  const bytes = new Uint8Array(4 + contentBytes.length);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, contentBytes.length, false);
  bytes.set(contentBytes, 4);

  return bytes;
}

function bytesToCanvas(bytes: Uint8Array): HTMLCanvasElement {
  const pixelsNeeded = Math.ceil(bytes.length / CHANNELS_PER_PIXEL);
  const size = Math.ceil(Math.sqrt(pixelsNeeded));

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create canvas context");
  }

  const imageData = ctx.createImageData(size, size);

  for (let i = 0; i < bytes.length; i++) {
    const pixelIndex = Math.floor(i / CHANNELS_PER_PIXEL) * 4;
    const channel = i % CHANNELS_PER_PIXEL;

    imageData.data[pixelIndex + channel] = bytes[i];
    imageData.data[pixelIndex + 3] = 255;
  }

  for (let i = 0; i < imageData.data.length; i += 4) {
    if (imageData.data[i + 3] === 0) {
      imageData.data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

function updateStats(
  payloadBytes: number,
  width: number,
  height: number,
): void {
  const capacity = width * height * CHANNELS_PER_PIXEL - 4;

  setText(statPayloadEl, `${payloadBytes} bytes`);
  setText(statSizeEl, `${width} × ${height}px`);
  setText(statCapacityEl, `${capacity} bytes`);
}

function downloadCanvas(canvas: HTMLCanvasElement): void {
  const link = document.createElement("a");
  link.download = "favicon-site.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${src}`));

    image.src = `${src}?t=${Date.now()}`;
  });
}

function imageToBytes(image: HTMLImageElement): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create canvas context");
  }

  ctx.drawImage(image, 0, 0);

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bytes: number[] = [];

  for (let i = 0; i < data.length; i += 4) {
    bytes.push(data[i], data[i + 1], data[i + 2]);
  }

  return new Uint8Array(bytes);
}

function decodePayload(bytes: Uint8Array): string {
  if (bytes.length < 4) {
    throw new Error("Image does not contain a valid payload header");
  }

  const view = new DataView(bytes.buffer);
  const length = view.getUint32(0, false);

  if (length > bytes.length - 4) {
    throw new Error("Payload length is larger than image capacity");
  }

  const payloadBytes = bytes.slice(4, 4 + length);

  return new TextDecoder().decode(payloadBytes);
}

async function decodeFavicon(): Promise<string> {
  const image = await loadImage(FAVICON_PATH);
  const bytes = imageToBytes(image);
  const html = decodePayload(bytes);

  updateStats(
    new TextEncoder().encode(html).length,
    image.naturalWidth,
    image.naturalHeight,
  );

  return html;
}

generateButton?.addEventListener("click", () => {
  const bytes = encodePayload(PAYLOAD);
  const canvas = bytesToCanvas(bytes);

  updateStats(bytes.length - 4, canvas.width, canvas.height);
  downloadCanvas(canvas);

  if (previewEl) {
    previewEl.src = canvas.toDataURL("image/png");
  }

  setText(outputEl, PAYLOAD.trim());
});

decodeButton?.addEventListener("click", async () => {
  try {
    const html = await decodeFavicon();
    setText(outputEl, html.trim());
  } catch (error) {
    setText(outputEl, String(error));
  }
});

renderButton?.addEventListener("click", async () => {
  try {
    const html = await decodeFavicon();
    document.body.innerHTML = html;
  } catch (error) {
    setText(outputEl, String(error));
  }
});
