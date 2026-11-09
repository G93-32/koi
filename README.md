# Koi

Two koi circling a dark pond, drawn live in the browser.

**Live:** https://g93-32.github.io/koi/

No images and no libraries. It is one HTML file, one stylesheet and one script using the Canvas 2D API.

## How it works

- **Movement.** Each koi is a chain of joints. The head steers around a shared centre and every other joint is dragged along behind the one in front, so the body bends naturally through turns. A sine wave that grows toward the tail is laid over the chain to make it swim.
- **Skin.** The chain is smoothed into a spine, given a width profile, and covered with about 380 overlapping circles per fish. Each circle is coloured once at start-up from a small set of noisy patches (red hood, black saddle, orange flank), then given a dark trailing rim so it reads as a scale.
- **Fins and tail.** Pectoral and pelvic fins are bezier paddles that flap with the swim cycle. The tail is a fan of rays hung off extra joints at the end of the chain, so it whips after the body.
- **Water.** Brushed teal arcs, thin rings, dashes and bubbles drift around the pair. A speckled overlay gives the whole frame a coarse printed look.

## Controls

- Move the pointer (or drag on a phone) and the pair follow it.
- Click or tap to drop a ripple. Nearby koi dart away, then settle.

## Run it locally

Open `index.html`, or serve the folder:

```bash
python -m http.server 8322
```

Inspired by the "Koi with Python" reel by buildmeri. This version is written from scratch in JavaScript.
