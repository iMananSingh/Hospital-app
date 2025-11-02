
export default function Footer() {
  return (
    <footer className="bg-[#f9f9f9] border-t border-[#e0e0e0] py-4 px-6 mt-auto">
      <div className="text-center text-[13px] text-[#777]">
        <p>
          © 2025 HMSync · Version 0.2.0 · Powered by HMSync Technologies · Support:{' '}
          <a 
            href="mailto:support@hmsync.in" 
            className="text-[#007bff] hover:underline transition-all"
          >
            support@hmsync.in
          </a>
        </p>
      </div>
    </footer>
  );
}
