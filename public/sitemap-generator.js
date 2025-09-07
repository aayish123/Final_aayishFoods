// This script generates a dynamic sitemap for all food items
// Run this script to update sitemap.xml with current food items

const fs = require('fs');
const path = require('path');

// Sample food items - in production, this would fetch from your database
const foodItems = [
  'chicken-pickle',
  'mango-pickle', 
  'gongura-pickle',
  'tomato-pickle',
  'lemon-pickle',
  'pandu-mirchi-pickle',
  'bitter-gourd-pickle'
];

const baseUrl = 'https://www.aayishfoods.online';
const currentDate = new Date().toISOString().split('T')[0];

const generateSitemap = () => {
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/menu</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/auth</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${baseUrl}/dashboard</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/cart</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${baseUrl}/orders</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${baseUrl}/reset-password</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>`;

  // Add food item pages
  foodItems.forEach(item => {
    sitemap += `
  <url>
    <loc>${baseUrl}/food/${item}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  sitemap += `
</urlset>`;

  return sitemap;
};

// Write sitemap to file
const sitemapContent = generateSitemap();
fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemapContent);
console.log('Sitemap generated successfully!');
