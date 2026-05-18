import React, { useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { posts } from '../data/blogPosts';
import './Blog.css';

function BlogNav({ activeSlug }) {
  return (
    <nav className="blog-nav">
      <Link to="/" className="blog-logo">
        <img src="/schedulogo.png" alt="ScheduForge" className="blog-logo-img" />
        ScheduForge
      </Link>
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
      <div className="blog-footer-logo">
        <img src="/schedulogo.png" alt="ScheduForge" className="blog-logo-img blog-logo-img-sm" />
        ScheduForge
      </div>
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
    case 'table': return (
      <div key={i} className="bp-table-wrap">
        <table className="bp-table">
          <thead>
            <tr>{node.headers.map((h, j) => <th key={j}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {node.rows.map((row, j) => (
              <tr key={j}>{row.map((cell, k) => <td key={k}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    case 'callout': return (
      <div key={i} className="bp-callout">
        {node.title && <div className="bp-callout-title">{node.title}</div>}
        {node.items && (
          <ol className="bp-callout-list">
            {node.items.map((item, j) => <li key={j}>{item}</li>)}
          </ol>
        )}
        {node.v && <p className="bp-callout-text">{node.v}</p>}
      </div>
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
