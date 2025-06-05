// CSS for newspaper-style newsletter layout
export const newsletterStyles = `
  .newsletter-content {
    font-family: 'Charter', 'Georgia', 'Cambria', 'Times New Roman', Times, serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  /* Single column on mobile and tablet */
  @media (max-width: 1023px) {
    .newsletter-content {
      column-count: 1;
    }
    
    .newsletter-content p {
      font-size: 1.125rem;
      line-height: 1.9;
    }
    
    .newsletter-content h2 {
      font-size: 1.875rem;
    }
    
    .newsletter-content h3 {
      font-size: 1.5rem;
    }
  }
  
  /* Two columns on desktop */
  @media (min-width: 1024px) {
    .newsletter-content {
      column-count: 2;
      column-gap: 3rem;
      column-rule: 1px solid rgb(51 65 85 / 0.5);
    }
    
    .newsletter-content p {
      font-size: 1.125rem;
      line-height: 1.85;
    }
  }
  
  /* Three columns on very wide screens */
  @media (min-width: 1536px) {
    .newsletter-content {
      column-count: 2;
      column-gap: 4rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .newsletter-content p {
      font-size: 1.1875rem;
      line-height: 1.85;
    }
  }
  
  /* Ultra-wide screens - still cap at 2 columns for readability */
  @media (min-width: 1920px) {
    .newsletter-content {
      column-count: 2;
      column-gap: 5rem;
      max-width: 1400px;
    }
  }
  
  /* Prevent column breaks in certain elements */
  .newsletter-content h1,
  .newsletter-content h2,
  .newsletter-content h3,
  .newsletter-content blockquote {
    break-inside: avoid;
    column-span: all;
  }
  
  .newsletter-content p {
    break-inside: avoid;
    orphans: 3;
    widows: 3;
  }
  
  /* Executive Summary styling - handles both direct p and p inside blockquote */
  .newsletter-content > p:first-child,
  .newsletter-content > h2:first-child + p,
  .newsletter-content > p:first-of-type {
    font-size: 1.25rem;
    line-height: 1.8;
    font-weight: 500;
    color: rgb(226 232 240);
    column-span: all;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid rgb(51 65 85 / 0.5);
  }
  
  /* Drop cap for first letter after Executive Summary heading */
  .newsletter-content h2:first-of-type + p:first-letter {
    float: left;
    font-size: 4.5rem;
    line-height: 3.5rem;
    padding-right: 0.5rem;
    margin-top: 0.25rem;
    font-weight: bold;
    color: rgb(244 114 182);
  }
  
  /* List styling improvements */
  .newsletter-content ul,
  .newsletter-content ol {
    break-inside: avoid;
  }
  
  /* Image responsiveness if any */
  .newsletter-content img {
    max-width: 100%;
    height: auto;
    margin: 1.5rem 0;
    border-radius: 0.5rem;
    column-span: all;
  }
  
  /* Better spacing for section breaks */
  .newsletter-content hr {
    margin: 2rem 0;
    border-color: rgb(51 65 85 / 0.5);
    column-span: all;
  }
`;
