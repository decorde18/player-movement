import React from "react";

const Footer: React.FC = () => {
  return (
    <footer className='bg-surface border-t border-border text-muted py-2 px-6 text-center text-sm z-20'>
      <p className='text-sm'>
        © {new Date().getFullYear()} <span lang='en'>corderosoccer.com</span>
      </p>
      <div className='text-xs text-muted'>All rights reserved</div>
    </footer>
  );
};

export default Footer;
