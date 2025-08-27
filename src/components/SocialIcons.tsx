import { Facebook, Instagram, Twitter, MessageCircle } from 'lucide-react';

const SocialIcons = () => {
  const socialLinks = [
    // Facebook link fixed: only one https://
    { 
      icon: Facebook, 
      href: 'https://www.facebook.com/profile.php?id=61578346221303&sk=map&viewas=100000686899395', 
      label: 'Facebook', 
      color: 'hover:text-blue-600' 
    },
    { 
      icon: Instagram, 
      href: 'https://www.instagram.com/aayishfoods?utm_source=ig_web_button_share_sheet&igsh=NDF4NWVpMzZveGtt', 
      label: 'Instagram', 
      color: 'hover:text-pink-600' 
    },
    // WhatsApp link dummy, change 1234567890 to your business number in international format, no "+".
    { 
      icon: MessageCircle, 
      href: 'https://wa.me/911234567890', 
      label: 'WhatsApp', 
      color: 'hover:text-green-600' 
    },
    // You can add Twitter below as needed:
    // { icon: Twitter, href: 'https://twitter.com/yourpage', label: 'Twitter', color: 'hover:text-blue-400' },
  ];

  return (
    <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-40 flex flex-col space-y-3">
      {socialLinks.map(({ icon: Icon, href, label, color }, index) => (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`bg-white shadow-lg rounded-full p-3 text-gray-600 transition-all duration-300 hover:scale-110 ${color} hover:shadow-xl`}
          aria-label={label}
        >
          <Icon className="h-5 w-5" />
        </a>
      ))}
    </div>
  );
};

export default SocialIcons;
