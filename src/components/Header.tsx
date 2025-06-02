import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css'; 

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="container header-content"> {}
        <Link to="/" className="logo-link">
          ブログプレビュー用
        </Link>
        <nav className="navigation">
          <ul>
            <li>About</li>
            <li>Blogs</li>
            <li>Contact</li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;