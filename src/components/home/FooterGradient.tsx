export function FooterGradient() {
  return (
    <footer className="relative min-h-48 overflow-hidden rounded-[20px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(129,191,233,0.28),transparent_26rem),linear-gradient(180deg,rgba(255,255,255,0.18),rgba(244,248,254,0.86))]" />
      <div className="relative mx-auto flex min-h-48 max-w-7xl items-center justify-center px-6 text-center">
        <p className="text-sm font-light tracking-[0.18em] text-[#667694]">ColorSense · 色彩慢慢淡出，灵感继续延展</p>
      </div>
    </footer>
  );
}
