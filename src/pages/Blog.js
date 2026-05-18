import React, { useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { posts } from '../data/blogPosts';
import './Blog.css';

function LogoMark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect width="32" height="32" rx="7" fill="#1a5fb4"/>
      <rect x="7" y="9" width="18" height="16" rx="2" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5"/>
      <line x1="7" y1="14" x2="25" y2="14" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5"/>
      <line x1="12" y1="7" x2="12" y2="11" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="7" x2="20" y2="11" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="10" y="17" width="3" height="2.5" rx="0.5" fill="white"/>
      <rect x="14.5" y="17" width="3" height="2.5" rx="0.5" fill="white"/>
      <rect x="19" y="17" width="3" height="2.5" rx="0.5" fill="white"/>
      <rect x="10" y="21" width="3" height="2.5" rx="0.5" fill="white"/>
      <rect x="14.5" y="21" width="3" height="2.5" rx="0.5" fill="white"/>
    </svg>
  );
}

function BlogNav({ activeSlug }) {
  return (
    <nav className="blog-nav">
      <Link to="/" className="blog-logo"><LogoMark size={26} />ScheduForge</Link>
      <div className="blog-nav-links">
        <a href="/#features" className="blog-nav-link">Features</a>
        <a href="/#pricing" className="blog-nav-link">Pricing</a>
        <Link to="/blog" className={`blog-nav-link${!activeSlug ? ' active' : ''}`}>Blog</Link>
      </div>
      <div className="blog-nav-actions">
        <Link to="/login" className="blog-nav-signin">Sign in</Link>
        <Link to="/signup" className="blog-cta-btn">Get started free</Link>
      </div>
    </nav>
  );
}

function BlogFooter() {
  return (
    <footer className="blog-footer">
      <div className="blog-footer-logo"><LogoMark size={20} />ScheduForge</div>
      <div className="blog-footer-links">
        <Link to="/blog">Blog</Link>
        <Link to="/login">Sign in</Link>
        <Link to="/signup">Create account</Link>
        <a href="mailto:sales@scheduforge.com">Contact</a>
      </div>
      <div className="blog-footer-copy">© {new Date().getFullYear()} ScheduForge. All rights reserved.</div>
    </footer>
  );
}

function renderNode(node, i) {
  switch (node.t) {
    case 'h2': return <h2 key={i} className="bp-h2">{node.v}</h2>;
    case 'h3': return <h3 key={i} className="bp-h3">{node.v}</h3>;
    case 'p':  return <p  key={i} className="bp-p">{node.v}</p>;
    case 'ul': return (
      <ul key={i} className="bp-ul">
        {node.v.map((li, j) => <li key={j}>{li}</li>)}
      </ul>
    );
    case 'ol': return (
      <ol key={i} className="bp-ol">
        {node.v.map((li, j) => <li key={j}>{li}</li>)}
      </ol>
    );
    case 'cta': return (
      <div key={i} className="bp-cta-box">
        <p className="bp-cta-note">{node.note}</p>
        <Link to={node.href} className="bp-cta-link">{node.label}</Link>
      </div>
    );
    default: return null;
  }
}

export function BlogList() {
  return (
    <div className="blog-page">
      <BlogNav />
      <main className="blog-list-main">
        <div className="blog-list-header">
          <div className="blog-list-label">Blog</div>
          <h1 className="blog-list-h1">Scheduling tips &amp; small business advice</h1>
          <p className="blog-list-sub">Practical guides for managers who schedule hourly teams.</p>
        </div>
        <div className="blog-grid">
          {posts.map(post => (
            <Link key={post.slug} to={`/blog/${post.slug}`} className="blog-card">
              <div className="blog-card-meta">
                <span className="blog-card-cat">{post.category}</span>
                <span className="blog-card-read">{post.readTime}</span>
              </div>
              <div className="blog-card-title">{post.title}</div>
              <p className="blog-card-excerpt">{post.excerpt}</p>
              <div className="blog-card-footer">
                <span className="blog-card-date">{post.date}</span>
                <span className="blog-card-read-cta">Read more →</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <BlogFooter />
    </div>
  );
}

export function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const post = posts.find(p => p.slug === slug);

  useEffect(() => {
    if (!post) navigate('/blog', { replace: true });
  }, [post, navigate]);

  if (!post) return null;

  return (
    <div className="blog-page">
      <BlogNav activeSlug={slug} />
      <main className="bp-main">
        <div className="bp-back">
          <Link to="/blog" className="bp-back-link">← Back to blog</Link>
        </div>
        <article>
          <header className="bp-header">
            <div className="bp-header-meta">
              <span className="bp-cat">{post.category}</span>
              <span className="bp-dot">·</span>
              <span className="bp-read">{post.readTime}</span>
            </div>
            <h1 className="bp-h1">{post.title}</h1>
            <p className="bp-date">{post.date}</p>
          </header>
          <div className="bp-body">
            {post.content.map((node, i) => renderNode(node, i))}
          </div>
        </article>
      </main>
      <BlogFooter />
    </div>
  );
}
