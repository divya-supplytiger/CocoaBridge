import React from 'react'

const Footer = () => {
  return (
    <footer className="footer footer-center p-4 bg-secondary text-secondary-content mt-auto">
        <p>© {new Date().getFullYear()} SupplyTiger. All rights reserved.</p>
    </footer>
  );
};

export default Footer;
