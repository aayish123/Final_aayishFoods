import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  structuredData?: object;
}

const SEOHead = ({
  title = "AAYISH Foods - Authentic Indian Pickles & Traditional Delicacies",
  description = "Order authentic Indian food online! Fresh chicken curry, mango pickle, gongura pickle, tomato pickle, and traditional Indian delicacies. Fast delivery across India.",
  keywords = "Indian food delivery, chicken curry online, mango pickle, gongura pickle, tomato pickle, Indian pickles, traditional Indian food, authentic Indian cuisine, food delivery, online food ordering, Indian delicacies, homemade pickles, chicken pickle, lemon pickle, pandu mirchi pickle, bitter gourd pickle",
  image = "https://www.aayishfoods.online/og-image.jpg",
  url = "https://www.aayishfoods.online",
  type = "website",
  structuredData
}: SEOHeadProps) => {
  const fullTitle = title.includes("AAYISH") ? title : `${title} | AAYISH Foods`;
  
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content="index, follow" />
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="AAYISH Foods" />
      <meta property="og:locale" content="en_IN" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEOHead;
