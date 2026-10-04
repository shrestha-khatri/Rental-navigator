import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ ok: false }, { status: 400 });

    // Use AbortController for a fast timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    // Accept 2xx and 3xx as okay. Even a 403 on some gov sites means the site is alive but blocks headless.
    return NextResponse.json({ ok: response.status < 500 });
  } catch (err) {
    // Timeout or network error
    return NextResponse.json({ ok: false });
  }
}
