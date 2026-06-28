export type CoverOrientation = "portrait" | "landscape";

// One build can render the same cover on both the category page and the index,
// so cache the result per URL to avoid fetching twice.
const cache = new Map<string, CoverOrientation>();

/**
 * Decide whether a remote cover image is portrait (taller than wide) or
 * landscape by streaming just enough bytes to parse its PNG/JPEG header — we
 * cancel the download as soon as the dimensions are known.
 *
 * Any failure (network error, non-200, unreadable header) logs a warning and
 * falls back to "landscape" so a CDN hiccup can never break the build.
 */
export async function getCoverOrientation(
	url: string,
): Promise<CoverOrientation> {
	const cached = cache.get(url);
	if (cached !== undefined) return cached;

	const orientation = await detectOrientation(url);
	cache.set(url, orientation);
	return orientation;
}

async function detectOrientation(url: string): Promise<CoverOrientation> {
	try {
		const response = await fetch(url);
		if (!response.ok || !response.body) {
			console.warn(
				`[cover-orientation] ${url} responded ${response.status}; using landscape`,
			);
			return "landscape";
		}

		const reader = response.body.getReader();
		let buffer = new Uint8Array(0);
		// Most headers live in the first few hundred bytes, but some JPEGs stuff a
		// large EXIF block before the SOF segment — cap how far we'll scan.
		const maxBytes = 1_500_000;
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				if (!value) continue;

				const next = new Uint8Array(buffer.length + value.length);
				next.set(buffer, 0);
				next.set(value, buffer.length);
				buffer = next;

				const dims = parseDimensions(buffer);
				if (dims) return dims.height >= dims.width ? "portrait" : "landscape";
				if (buffer.length > maxBytes) break;
			}
		} finally {
			await reader.cancel();
		}

		console.warn(
			`[cover-orientation] could not read dimensions from ${url}; using landscape`,
		);
		return "landscape";
	} catch (error) {
		console.warn(
			`[cover-orientation] failed to fetch ${url}:`,
			error,
			"; using landscape",
		);
		return "landscape";
	}
}

function parseDimensions(
	buf: Uint8Array,
): { width: number; height: number } | null {
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

	// PNG: 8-byte signature then IHDR with big-endian u32 width (offset 16) and
	// height (offset 20).
	if (
		buf.length >= 24 &&
		buf[0] === 0x89 &&
		buf[1] === 0x50 &&
		buf[2] === 0x4e &&
		buf[3] === 0x47
	) {
		const width = view.getUint32(16);
		const height = view.getUint32(20);
		if (width > 0 && height > 0) return { width, height };
		return null;
	}

	// JPEG: walk the marker segments until a SOF segment, which stores height
	// then width as big-endian u16.
	if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
		let i = 2;
		while (i + 9 <= buf.length) {
			if (buf[i] !== 0xff) {
				i += 1;
				continue;
			}
			const marker = buf[i + 1];
			// SOI / EOI / RSTn are standalone markers with no length payload.
			if (
				marker === 0xd8 ||
				marker === 0xd9 ||
				(marker >= 0xd0 && marker <= 0xd7)
			) {
				i += 2;
				continue;
			}
			const segLen = view.getUint16(i + 2);
			if (segLen < 2) break;
			const isSof =
				(marker >= 0xc0 && marker <= 0xc3) ||
				(marker >= 0xc5 && marker <= 0xc7) ||
				(marker >= 0xc9 && marker <= 0xcb) ||
				(marker >= 0xcd && marker <= 0xcf);
			if (isSof) {
				const height = view.getUint16(i + 5);
				const width = view.getUint16(i + 7);
				if (width > 0 && height > 0) return { width, height };
				return null;
			}
			i += 2 + segLen;
		}
	}

	return null;
}
