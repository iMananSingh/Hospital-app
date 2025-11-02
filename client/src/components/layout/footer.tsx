
export default function Footer() {
  return (
    <footer className="bg-background border-t border-[#e6e6e6] py-2 px-6">
      <div className="text-center text-[13px] text-[#6c757d]" style={{ letterSpacing: '0.2px' }}>
        <p>
          © 2025 HMSync · Version 0.2.0 · Powered by HMSync Technologies · Support:{' '}
          <a 
            href="mailto:support@hmsync.in" 
            className="text-[#007bff] no-underline hover:underline transition-all"
          >
            support@hmsync.in
          </a>
        </p>
      </div>
    </footer>
  );
}
