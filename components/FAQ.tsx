import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FAQ = () => {
  const [openItems, setOpenItems] = useState<number[]>([]);

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) 
        ? prev.filter(item => item !== index)
        : [...prev, index]
    );
  };

  const faqs = [
    {
      question: "What types of Indian pickles do you offer?",
      answer: "We offer a wide variety of authentic Indian pickles including chicken pickle, mango pickle, gongura pickle, tomato pickle, lemon pickle, pandu mirchi pickle, and bitter gourd pickle. Each pickle is made using traditional recipes and premium ingredients."
    },
    {
      question: "How long does delivery take?",
      answer: "We provide fast delivery across India within 2-3 business days. For local deliveries, we offer same-day or next-day delivery options. You can track your order in real-time from our website."
    },
    {
      question: "Are your pickles made with traditional recipes?",
      answer: "Yes, all our pickles are made using authentic traditional recipes passed down through generations. We use premium quality ingredients and traditional cooking methods to ensure the best taste and quality."
    },
    {
      question: "Do you deliver to hostels and working professionals?",
      answer: "Absolutely! We specialize in delivering to hostel students and working professionals. Our food is perfect for those who miss home-cooked meals and want authentic Indian taste delivered to their doorstep."
    },
    {
      question: "What makes AAYISH Foods different from other food delivery services?",
      answer: "AAYISH Foods focuses specifically on authentic Indian pickles and traditional delicacies. We use traditional recipes, premium ingredients, and offer fast delivery across India. Our food is perfect for those who want authentic Indian taste."
    },
    {
      question: "Can I order individual pickles or do I need to order in bulk?",
      answer: "You can order individual pickles or in any quantity you prefer. We offer flexible ordering options to suit your needs, whether you want to try one pickle or order multiple varieties."
    },
    {
      question: "Are your pickles suitable for vegetarians?",
      answer: "Most of our pickles are vegetarian-friendly. We clearly label each product, and you can check the ingredients list for any specific dietary requirements. Our mango pickle, gongura pickle, tomato pickle, lemon pickle, and other vegetable-based pickles are completely vegetarian."
    },
    {
      question: "How do I track my order?",
      answer: "You can track your order in real-time using our order tracking system. Simply log into your account and go to the 'Track Order' section to see the status of your delivery."
    }
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Frequently Asked Questions - Indian Food Delivery
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="border border-gray-200 rounded-lg">
              <button
                className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
                onClick={() => toggleItem(index)}
              >
                <span className="font-semibold text-gray-900">{faq.question}</span>
                {openItems.includes(index) ? (
                  <ChevronUp className="h-5 w-5 text-orange-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-orange-600" />
                )}
              </button>
              {openItems.includes(index) && (
                <div className="px-6 pb-4 text-gray-700">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
