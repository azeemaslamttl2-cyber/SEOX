import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ChevronLeft, Copy, Check, Loader2, Sparkles, Building2, List,
    Navigation, HelpCircle, FileText, ShoppingBag, User, Building,
    MapPin, Code, ExternalLink, Plus, Trash2, Globe, Link2, Phone, Info, LayoutList, UserCircle2,
    Calendar, Briefcase, FileCode, Award, Clock, Layers, Download, Wand2
} from 'lucide-react';

// Schema type definitions with their icons and colors
const SCHEMA_TYPES = [
    { id: 'entity', name: 'Entity Schema', icon: Sparkles, gradient: 'from-purple-500 to-indigo-500', description: 'AI extracts entities from article and links to Knowledge Graph' },
    { id: 'localBusiness', name: 'Local Business', icon: Building2, gradient: 'from-blue-500 to-cyan-500', description: 'AI selects correct business categories and generates complete schema' },
    { id: 'breadcrumb', name: 'Breadcrumb', icon: List, gradient: 'from-green-500 to-emerald-500', description: 'Generate BreadcrumbList for navigation path' },
    { id: 'navigation', name: 'Navigation', icon: Navigation, gradient: 'from-amber-500 to-orange-500', description: 'SiteNavigationElement for main navigation' },
    { id: 'faq', name: 'FAQ', icon: HelpCircle, gradient: 'from-pink-500 to-rose-500', description: 'FAQPage schema for question/answer content' },
    { id: 'article', name: 'Article', icon: FileText, gradient: 'from-indigo-500 to-purple-500', description: 'Article/BlogPosting structured data' },
    { id: 'product', name: 'Product', icon: ShoppingBag, gradient: 'from-teal-500 to-cyan-500', description: 'Product schema with price, availability' },
    { id: 'organization', name: 'Organization', icon: Building, gradient: 'from-slate-500 to-gray-600', description: 'Organization details and contact info' },
    { id: 'person', name: 'Person', icon: User, gradient: 'from-violet-500 to-purple-500', description: 'Person/Author markup for EEAT' },
    { id: 'itemList', name: 'List View', icon: LayoutList, gradient: 'from-sky-500 to-blue-500', description: 'ItemList schema for listicles and rankings' },
    { id: 'aboutPage', name: 'About Us', icon: Info, gradient: 'from-emerald-500 to-teal-500', description: 'AboutPage schema for company about pages' },
    { id: 'contactPage', name: 'Contact Us', icon: Phone, gradient: 'from-red-500 to-pink-500', description: 'ContactPage schema with contact details' },
    { id: 'authorPage', name: 'Author Page', icon: UserCircle2, gradient: 'from-amber-500 to-yellow-500', description: 'ProfilePage + Person schema for author pages (EEAT)' },
    // Advanced Schema Types
    { id: 'event', name: 'Event', icon: Calendar, gradient: 'from-rose-500 to-red-500', description: 'Event schema for concerts, conferences, webinars' },
    { id: 'advancedOrg', name: 'Advanced Organization', icon: Layers, gradient: 'from-brand-500 to-amber-600', description: 'Full organization with services, areas served, and social profiles' },
    { id: 'advancedLocalBusiness', name: 'Advanced Local Business', icon: Award, gradient: 'from-brand-500 to-amber-600', description: 'Complete local business with services, hours, and awards' },
    { id: 'advancedService', name: 'Advanced Service', icon: Briefcase, gradient: 'from-brand-500 to-amber-600', description: 'Service schema with offer catalog' },
    { id: 'advancedWebPage', name: 'Advanced WebPage', icon: FileCode, gradient: 'from-brand-500 to-amber-600', description: 'WebPage with about/mentions entities' },
    { id: 'softwareApplication', name: 'Software', icon: Code, gradient: 'from-emerald-600 to-green-600', description: 'SoftwareApplication schema for desktop software' },
    { id: 'mobileApplication', name: 'Mobile App', icon: Globe, gradient: 'from-fuchsia-500 to-pink-500', description: 'MobileApplication schema for iOS/Android apps' }
];

const SchemaGenerator = () => {
    const navigate = useNavigate();
    const { schemaType } = useParams();
    const [activeSchema, setActiveSchema] = useState(null);
    const [generatedSchema, setGeneratedSchema] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    // Sync activeSchema with URL parameter
    useEffect(() => {
        if (schemaType) {
            const validType = SCHEMA_TYPES.find(t => t.id === schemaType);
            if (validType) {
                setActiveSchema(schemaType);
            }
        } else {
            setActiveSchema(null);
        }
    }, [schemaType]);

    // Entity Schema State
    const [entityArticle, setEntityArticle] = useState('');
    const [entityLogoUrl, setEntityLogoUrl] = useState('');
    const [entityAuthorUrl, setEntityAuthorUrl] = useState('');
    const [entityDatePublished, setEntityDatePublished] = useState('');
    const [entityDateModified, setEntityDateModified] = useState('');
    // Advanced EEAT fields
    const [entityAuthorName, setEntityAuthorName] = useState('');
    const [entityAuthorJobTitle, setEntityAuthorJobTitle] = useState('');
    const [entitySocialLinks, setEntitySocialLinks] = useState(''); // Comma-separated

    // Local Business State
    const [businessName, setBusinessName] = useState('');
    const [businessAddress, setBusinessAddress] = useState('');
    const [businessPhone, setBusinessPhone] = useState('');
    const [businessWebsite, setBusinessWebsite] = useState('');
    const [businessDescription, setBusinessDescription] = useState('');

    // Breadcrumb State
    const [breadcrumbItems, setBreadcrumbItems] = useState([
        { name: 'Home', url: '' }
    ]);

    // Navigation State
    const [navItems, setNavItems] = useState([
        { name: '', url: '' }
    ]);

    // FAQ State
    const [faqItems, setFaqItems] = useState([
        { question: '', answer: '' }
    ]);

    // Article State
    const [articleTitle, setArticleTitle] = useState('');
    const [articleAuthor, setArticleAuthor] = useState('');
    const [articleDatePublished, setArticleDatePublished] = useState('');
    const [articleDateModified, setArticleDateModified] = useState('');
    const [articleImage, setArticleImage] = useState('');
    const [articleDescription, setArticleDescription] = useState('');
    const [articleUrl, setArticleUrl] = useState('');

    // Product State
    const [productName, setProductName] = useState('');
    const [productDescription, setProductDescription] = useState('');
    const [productImage, setProductImage] = useState('');
    const [productPrice, setProductPrice] = useState('');
    const [productCurrency, setProductCurrency] = useState('USD');
    const [productAvailability, setProductAvailability] = useState('InStock');
    const [productBrand, setProductBrand] = useState('');

    // Organization State
    const [orgName, setOrgName] = useState('');
    const [orgUrl, setOrgUrl] = useState('');
    const [orgLogo, setOrgLogo] = useState('');
    const [orgDescription, setOrgDescription] = useState('');
    const [orgSameAs, setOrgSameAs] = useState(['']);

    // Person State
    const [personName, setPersonName] = useState('');
    const [personJobTitle, setPersonJobTitle] = useState('');
    const [personUrl, setPersonUrl] = useState('');
    const [personImage, setPersonImage] = useState('');
    const [personSameAs, setPersonSameAs] = useState(['']);

    // ItemList (List View) State
    const [listItems, setListItems] = useState([
        { name: '', url: '', position: 1 }
    ]);
    const [listName, setListName] = useState('');

    // AboutPage State
    const [aboutOrgName, setAboutOrgName] = useState('');
    const [aboutDescription, setAboutDescription] = useState('');
    const [aboutUrl, setAboutUrl] = useState('');
    const [aboutImage, setAboutImage] = useState('');
    const [aboutFoundingDate, setAboutFoundingDate] = useState('');
    const [aboutFounders, setAboutFounders] = useState(['']);

    // ContactPage State
    const [contactOrgName, setContactOrgName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactAddress, setContactAddress] = useState('');
    const [contactUrl, setContactUrl] = useState('');
    const [contactHoursStart, setContactHoursStart] = useState('09:00');
    const [contactHoursEnd, setContactHoursEnd] = useState('17:00');

    // Author Page State
    const [authorProfileUrl, setAuthorProfileUrl] = useState('');
    const [authorName, setAuthorName] = useState('');
    const [authorJobTitle, setAuthorJobTitle] = useState('');
    const [authorEmail, setAuthorEmail] = useState('');
    const [authorDescription, setAuthorDescription] = useState('');
    const [authorImage, setAuthorImage] = useState('');
    const [authorOrgName, setAuthorOrgName] = useState('');
    const [authorOrgUrl, setAuthorOrgUrl] = useState('');
    const [authorOrgLogo, setAuthorOrgLogo] = useState('');
    const [authorAlumniOf, setAuthorAlumniOf] = useState('');
    const [authorCredential, setAuthorCredential] = useState('');
    const [authorAward, setAuthorAward] = useState('');
    const [authorSkills, setAuthorSkills] = useState(['']);
    const [authorKnowsAbout, setAuthorKnowsAbout] = useState(['']);
    const [authorSameAs, setAuthorSameAs] = useState(['']);
    const [authorStreet, setAuthorStreet] = useState('');
    const [authorCity, setAuthorCity] = useState('');
    const [authorRegion, setAuthorRegion] = useState('');
    const [authorPostalCode, setAuthorPostalCode] = useState('');
    const [authorCountry, setAuthorCountry] = useState('');

    // Event Schema State
    const [eventName, setEventName] = useState('');
    const [eventType, setEventType] = useState('Event');
    const [eventStartDate, setEventStartDate] = useState('');
    const [eventEndDate, setEventEndDate] = useState('');
    const [eventLocationName, setEventLocationName] = useState('');
    const [eventLocationAddress, setEventLocationAddress] = useState('');
    const [eventDescription, setEventDescription] = useState('');
    const [eventUrl, setEventUrl] = useState('');
    const [eventImage, setEventImage] = useState('');
    const [eventOrganizer, setEventOrganizer] = useState('');
    const [eventPerformers, setEventPerformers] = useState(['']);
    const [eventTicketPrice, setEventTicketPrice] = useState('');
    const [eventTicketCurrency, setEventTicketCurrency] = useState('USD');
    const [eventTicketUrl, setEventTicketUrl] = useState('');

    // Advanced Organization Schema State
    const [advOrgName, setAdvOrgName] = useState('');
    const [advOrgLegalName, setAdvOrgLegalName] = useState('');
    const [advOrgAlternateName, setAdvOrgAlternateName] = useState('');
    const [advOrgType, setAdvOrgType] = useState('Organization');
    const [advOrgAdditionalTypes, setAdvOrgAdditionalTypes] = useState(['']);
    const [advOrgDescription, setAdvOrgDescription] = useState('');
    const [advOrgDisambiguating, setAdvOrgDisambiguating] = useState('');
    const [advOrgSlogan, setAdvOrgSlogan] = useState('');
    const [advOrgUrl, setAdvOrgUrl] = useState('');
    const [advOrgLogo, setAdvOrgLogo] = useState('');
    const [advOrgImage, setAdvOrgImage] = useState('');
    const [advOrgPhone, setAdvOrgPhone] = useState('');
    const [advOrgEmail, setAdvOrgEmail] = useState('');
    const [advOrgStreet, setAdvOrgStreet] = useState('');
    const [advOrgCity, setAdvOrgCity] = useState('');
    const [advOrgRegion, setAdvOrgRegion] = useState('');
    const [advOrgPostalCode, setAdvOrgPostalCode] = useState('');
    const [advOrgCountry, setAdvOrgCountry] = useState('US');
    const [advOrgFoundingDate, setAdvOrgFoundingDate] = useState('');
    const [advOrgFoundingLocation, setAdvOrgFoundingLocation] = useState('');
    const [advOrgKnowsAbout, setAdvOrgKnowsAbout] = useState(['']);
    const [advOrgSameAs, setAdvOrgSameAs] = useState(['']);
    const [advOrgAreasServed, setAdvOrgAreasServed] = useState([{ city: '', postalCodes: '', googleMapsUrl: '', wikiUrl: '' }]);
    const [advOrgServices, setAdvOrgServices] = useState([{ name: '', url: '', description: '', audience: '' }]);

    // Advanced Local Business Schema State (extends Advanced Org)
    const [advLbName, setAdvLbName] = useState('');
    const [advLbLegalName, setAdvLbLegalName] = useState('');
    const [advLbType, setAdvLbType] = useState('LocalBusiness');
    const [advLbAdditionalTypes, setAdvLbAdditionalTypes] = useState(['']);
    const [advLbDescription, setAdvLbDescription] = useState('');
    const [advLbDisambiguating, setAdvLbDisambiguating] = useState('');
    const [advLbSlogan, setAdvLbSlogan] = useState('');
    const [advLbUrl, setAdvLbUrl] = useState('');
    const [advLbLogo, setAdvLbLogo] = useState('');
    const [advLbImage, setAdvLbImage] = useState('');
    const [advLbPhone, setAdvLbPhone] = useState('');
    const [advLbEmail, setAdvLbEmail] = useState('');
    const [advLbStreet, setAdvLbStreet] = useState('');
    const [advLbCity, setAdvLbCity] = useState('');
    const [advLbRegion, setAdvLbRegion] = useState('');
    const [advLbPostalCode, setAdvLbPostalCode] = useState('');
    const [advLbCountry, setAdvLbCountry] = useState('US');
    const [advLbPriceRange, setAdvLbPriceRange] = useState('$$');
    const [advLbPaymentAccepted, setAdvLbPaymentAccepted] = useState('');
    const [advLbOpeningHours, setAdvLbOpeningHours] = useState([{ days: 'Mo-Fr', opens: '09:00', closes: '17:00' }]);
    const [advLbAwards, setAdvLbAwards] = useState(['']);
    const [advLbGoogleMapsUrl, setAdvLbGoogleMapsUrl] = useState('');
    const [advLbKnowsAbout, setAdvLbKnowsAbout] = useState(['']);
    const [advLbSameAs, setAdvLbSameAs] = useState(['']);
    const [advLbAreasServed, setAdvLbAreasServed] = useState([{ city: '', postalCodes: '', googleMapsUrl: '', wikiUrl: '' }]);
    const [advLbServices, setAdvLbServices] = useState([{ name: '', url: '', description: '', audience: '' }]);
    const [advLbParentOrg, setAdvLbParentOrg] = useState('');

    // Advanced Service Schema State
    const [advSvcName, setAdvSvcName] = useState('');
    const [advSvcDescription, setAdvSvcDescription] = useState('');
    const [advSvcUrl, setAdvSvcUrl] = useState('');
    const [advSvcProvider, setAdvSvcProvider] = useState('');
    const [advSvcBrand, setAdvSvcBrand] = useState('');
    const [advSvcAudience, setAdvSvcAudience] = useState('');
    const [advSvcType, setAdvSvcType] = useState('');
    const [advSvcAreaServedRef, setAdvSvcAreaServedRef] = useState('');
    const [advSvcSubServices, setAdvSvcSubServices] = useState([{ name: '', url: '', description: '', audience: '' }]);

    // Advanced WebPage Schema State
    const [advWpUrl, setAdvWpUrl] = useState('');
    const [advWpName, setAdvWpName] = useState('');
    const [advWpDescription, setAdvWpDescription] = useState('');
    const [advWpPublisher, setAdvWpPublisher] = useState('');
    const [advWpAboutEntities, setAdvWpAboutEntities] = useState([{ name: '', wikiUrl: '', kgUrl: '' }]);
    const [advWpMentionsEntities, setAdvWpMentionsEntities] = useState([{ name: '', wikiUrl: '', kgUrl: '' }]);

    // SoftwareApplication Schema State
    const [softwareName, setSoftwareName] = useState('');
    const [softwareType, setSoftwareType] = useState('SoftwareApplication');
    const [softwareDescription, setSoftwareDescription] = useState('');
    const [softwareUrl, setSoftwareUrl] = useState('');
    const [softwareImage, setSoftwareImage] = useState('');
    const [softwareVersion, setSoftwareVersion] = useState('');
    const [softwareOS, setSoftwareOS] = useState('');
    const [softwareCategory, setSoftwareCategory] = useState('');
    const [softwarePrice, setSoftwarePrice] = useState('0');
    const [softwareCurrency, setSoftwareCurrency] = useState('USD');
    const [softwareRating, setSoftwareRating] = useState('');
    const [softwareRatingCount, setSoftwareRatingCount] = useState('');
    const [softwareDownloadUrl, setSoftwareDownloadUrl] = useState('');
    const [softwareFeatures, setSoftwareFeatures] = useState(['']);
    const [softwareScreenshots, setSoftwareScreenshots] = useState(['']);
    const [softwareAuthor, setSoftwareAuthor] = useState('');

    // MobileApplication Schema State
    const [mobileAppName, setMobileAppName] = useState('');
    const [mobileAppDescription, setMobileAppDescription] = useState('');
    const [mobileAppUrl, setMobileAppUrl] = useState('');
    const [mobileAppImage, setMobileAppImage] = useState('');
    const [mobileAppVersion, setMobileAppVersion] = useState('');
    const [mobileAppOS, setMobileAppOS] = useState('iOS, Android');
    const [mobileAppCategory, setMobileAppCategory] = useState('');
    const [mobileAppPrice, setMobileAppPrice] = useState('0');
    const [mobileAppCurrency, setMobileAppCurrency] = useState('USD');
    const [mobileAppRating, setMobileAppRating] = useState('');
    const [mobileAppRatingCount, setMobileAppRatingCount] = useState('');
    const [mobileAppStoreUrl, setMobileAppStoreUrl] = useState('');
    const [mobilePlayStoreUrl, setMobilePlayStoreUrl] = useState('');
    const [mobileAppFeatures, setMobileAppFeatures] = useState(['']);
    const [mobileAppScreenshots, setMobileAppScreenshots] = useState(['']);
    const [mobileAppAuthor, setMobileAppAuthor] = useState('');

    // Import Feature State
    const [importUrl, setImportUrl] = useState('');
    const [importText, setImportText] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [quickFillTab, setQuickFillTab] = useState('url'); // 'url' or 'text'

    // Example Data for all schema types
    const EXAMPLE_DATA = {
        entity: {
            entityArticle: `Dubai Alcohol Laws: Complete Guide for Tourists 2024

Dubai has specific alcohol laws that visitors should understand. The legal drinking age in Dubai is 21 years old. Tourists can purchase alcohol at licensed venues including hotels, restaurants, and clubs.

Key points about Dubai's alcohol regulations:
- Drinking in public is strictly prohibited
- You must be 21 or older to purchase alcohol
- Licensed venues include most hotels and tourist areas
- The Dubai Police enforce these regulations strictly`,
            articleUrl: 'https://example.com/dubai-alcohol-laws',
            articleDescription: 'Complete guide to Dubai alcohol laws and regulations for tourists',
            entityLogoUrl: 'https://example.com/logo.png',
            entityAuthorUrl: 'https://example.com/about',
            entityDatePublished: new Date().toISOString().split('T')[0],
            entityDateModified: new Date().toISOString().split('T')[0],
            entityAuthorName: 'Travel Expert',
            entityAuthorJobTitle: 'Senior Travel Writer'
        },
        localBusiness: {
            businessName: 'Valley Tech Solutions',
            businessAddress: '123 Innovation Drive, San Francisco, CA 94105, USA',
            businessPhone: '+1 (555) 234-5678',
            businessWebsite: 'https://valleytech.example.com',
            businessDescription: 'Full-service IT consulting and managed services provider specializing in cloud solutions and cybersecurity.'
        },
        breadcrumb: {
            breadcrumbItems: [
                { name: 'Home', url: 'https://example.com/' },
                { name: 'Products', url: 'https://example.com/products' },
                { name: 'Electronics', url: 'https://example.com/products/electronics' },
                { name: 'Laptops', url: 'https://example.com/products/electronics/laptops' }
            ]
        },
        navigation: {
            navItems: [
                { name: 'Home', url: 'https://example.com/' },
                { name: 'About Us', url: 'https://example.com/about' },
                { name: 'Services', url: 'https://example.com/services' },
                { name: 'Blog', url: 'https://example.com/blog' },
                { name: 'Contact', url: 'https://example.com/contact' }
            ]
        },
        faq: {
            faqItems: [
                { question: 'What are your business hours?', answer: 'We are open Monday through Friday, 9 AM to 6 PM EST. We are closed on weekends and major holidays.' },
                { question: 'Do you offer free shipping?', answer: 'Yes, we offer free standard shipping on all orders over $50. Express shipping is available for an additional fee.' },
                { question: 'What is your return policy?', answer: 'We accept returns within 30 days of purchase. Items must be in original condition with tags attached.' }
            ]
        },
        article: {
            articleTitle: 'The Ultimate Guide to Modern Web Development in 2024',
            articleAuthor: 'Sarah Johnson',
            articleDatePublished: new Date().toISOString().split('T')[0],
            articleDateModified: new Date().toISOString().split('T')[0],
            articleImage: 'https://example.com/images/web-development-guide.jpg',
            articleDescription: 'Comprehensive guide covering React, Next.js, and modern web development best practices for building scalable applications.',
            articleUrl: 'https://example.com/blog/web-development-guide-2024'
        },
        product: {
            productName: 'Premium Wireless Noise-Canceling Headphones',
            productDescription: 'Experience crystal-clear audio with our flagship wireless headphones featuring active noise cancellation, 40-hour battery life, and premium comfort for all-day wear.',
            productImage: 'https://example.com/images/headphones-pro.jpg',
            productPrice: '299.99',
            productCurrency: 'USD',
            productAvailability: 'InStock',
            productBrand: 'AudioTech Pro'
        },
        organization: {
            orgName: 'TechVenture Inc.',
            orgUrl: 'https://techventure.example.com',
            orgLogo: 'https://techventure.example.com/logo.png',
            orgDescription: 'Leading technology company specializing in AI-powered solutions for enterprise businesses.',
            orgSameAs: ['https://twitter.com/techventure', 'https://linkedin.com/company/techventure', 'https://facebook.com/techventure']
        },
        person: {
            personName: 'Dr. Emily Chen',
            personJobTitle: 'Chief Technology Officer',
            personUrl: 'https://example.com/team/emily-chen',
            personImage: 'https://example.com/images/emily-chen.jpg',
            personSameAs: ['https://linkedin.com/in/emilychen', 'https://twitter.com/emilychen']
        },
        itemList: {
            listName: 'Top 10 Best Laptops for Programming in 2024',
            listItems: [
                { name: 'MacBook Pro 16"', url: 'https://example.com/laptops/macbook-pro-16', position: 1 },
                { name: 'Dell XPS 15', url: 'https://example.com/laptops/dell-xps-15', position: 2 },
                { name: 'ThinkPad X1 Carbon', url: 'https://example.com/laptops/thinkpad-x1', position: 3 }
            ]
        },
        aboutPage: {
            aboutOrgName: 'Innovation Labs Inc.',
            aboutDescription: 'Founded in 2015, Innovation Labs is a leading software development company dedicated to creating cutting-edge solutions that transform businesses.',
            aboutUrl: 'https://innovationlabs.example.com/about',
            aboutImage: 'https://innovationlabs.example.com/team-photo.jpg',
            aboutFoundingDate: '2015-03-15',
            aboutFounders: ['John Smith', 'Jane Doe']
        },
        contactPage: {
            contactOrgName: 'Customer Success Team',
            contactEmail: 'support@example.com',
            contactPhone: '+1 (800) 555-0199',
            contactAddress: '500 Market Street, Suite 300, San Francisco, CA 94105',
            contactUrl: 'https://example.com/contact',
            contactHoursStart: '09:00',
            contactHoursEnd: '18:00'
        },
        authorPage: {
            authorProfileUrl: 'https://example.com/authors/john-developer',
            authorName: 'John Developer',
            authorJobTitle: 'Senior Software Engineer',
            authorEmail: 'john@example.com',
            authorDescription: 'Full-stack developer with 10+ years of experience in web technologies. Passionate about clean code and developer experience.',
            authorImage: 'https://example.com/images/john-developer.jpg',
            authorOrgName: 'TechBlog Inc.',
            authorOrgUrl: 'https://techblog.example.com',
            authorAlumniOf: 'MIT',
            authorCredential: 'AWS Solutions Architect',
            authorAward: 'Developer of the Year 2023',
            authorSkills: ['JavaScript', 'React', 'Node.js', 'Python'],
            authorKnowsAbout: ['Web Development', 'Cloud Architecture', 'DevOps'],
            authorSameAs: ['https://github.com/johndeveloper', 'https://linkedin.com/in/johndeveloper']
        },
        event: {
            eventName: 'Tech Innovation Summit 2024',
            eventType: 'BusinessEvent',
            eventStartDate: '2024-06-15T09:00',
            eventEndDate: '2024-06-17T18:00',
            eventLocationName: 'San Francisco Convention Center',
            eventLocationAddress: '747 Howard Street, San Francisco, CA 94103',
            eventDescription: 'Annual technology conference featuring keynotes from industry leaders, workshops, and networking opportunities.',
            eventUrl: 'https://example.com/events/tech-summit-2024',
            eventImage: 'https://example.com/images/tech-summit.jpg',
            eventOrganizer: 'TechEvents Inc.',
            eventPerformers: ['Elon Musk', 'Sundar Pichai'],
            eventTicketPrice: '499',
            eventTicketCurrency: 'USD',
            eventTicketUrl: 'https://example.com/tickets/tech-summit-2024'
        },
        advancedOrg: {
            advOrgName: 'Global Solutions Corp',
            advOrgLegalName: 'Global Solutions Corporation',
            advOrgAlternateName: 'GSC',
            advOrgType: 'Corporation',
            advOrgDescription: 'Enterprise technology solutions provider with presence in 50+ countries.',
            advOrgSlogan: 'Innovating for Tomorrow',
            advOrgUrl: 'https://globalsolutions.example.com',
            advOrgLogo: 'https://globalsolutions.example.com/logo.png',
            advOrgPhone: '+1 (888) 555-0100',
            advOrgEmail: 'info@globalsolutions.example.com',
            advOrgStreet: '1000 Enterprise Way',
            advOrgCity: 'New York',
            advOrgRegion: 'NY',
            advOrgPostalCode: '10001',
            advOrgCountry: 'US',
            advOrgFoundingDate: '2005-01-15',
            advOrgServices: [{ name: 'Cloud Consulting', url: 'https://globalsolutions.example.com/cloud', description: 'Enterprise cloud migration services', audience: 'Businesses' }],
            advOrgSameAs: ['https://linkedin.com/company/globalsolutions']
        },
        advancedLocalBusiness: {
            advLbName: 'Downtown Dental Care',
            advLbLegalName: 'Downtown Dental Care LLC',
            advLbType: 'Dentist',
            advLbDescription: 'Family-friendly dental practice offering comprehensive dental services including cleanings, fillings, and cosmetic dentistry.',
            advLbSlogan: 'Your Smile, Our Priority',
            advLbUrl: 'https://downtowndental.example.com',
            advLbLogo: 'https://downtowndental.example.com/logo.png',
            advLbPhone: '+1 (555) 123-4567',
            advLbEmail: 'appointments@downtowndental.example.com',
            advLbStreet: '456 Main Street',
            advLbCity: 'Boston',
            advLbRegion: 'MA',
            advLbPostalCode: '02101',
            advLbCountry: 'US',
            advLbPriceRange: '$$',
            advLbOpeningHours: [{ days: 'Mo-Fr', opens: '08:00', closes: '18:00' }],
            advLbServices: [{ name: 'Teeth Cleaning', url: 'https://downtowndental.example.com/cleaning', description: 'Professional dental cleaning', audience: 'All ages' }]
        },
        advancedService: {
            advSvcName: 'Enterprise Cloud Migration',
            advSvcDescription: 'End-to-end cloud migration services including assessment, planning, migration, and optimization for enterprise workloads.',
            advSvcUrl: 'https://example.com/services/cloud-migration',
            advSvcProvider: 'CloudExperts Inc.',
            advSvcBrand: 'CloudMigrate Pro',
            advSvcAudience: 'Enterprise IT Teams',
            advSvcType: 'ProfessionalService',
            advSvcSubServices: [{ name: 'Cloud Assessment', url: 'https://example.com/services/assessment', description: 'Comprehensive cloud readiness assessment', audience: 'IT Managers' }]
        },
        advancedWebPage: {
            advWpUrl: 'https://example.com/guide/cloud-computing',
            advWpName: 'Complete Guide to Cloud Computing',
            advWpDescription: 'Comprehensive guide covering cloud computing fundamentals, providers, and best practices.',
            advWpPublisher: 'TechGuide Publications',
            advWpAboutEntities: [{ name: 'Cloud Computing', wikiUrl: 'https://en.wikipedia.org/wiki/Cloud_computing', kgUrl: '' }],
            advWpMentionsEntities: [{ name: 'Amazon Web Services', wikiUrl: 'https://en.wikipedia.org/wiki/Amazon_Web_Services', kgUrl: '' }]
        },
        softwareApplication: {
            softwareName: 'ProEdit Photo Editor',
            softwareType: 'SoftwareApplication',
            softwareDescription: 'Professional photo editing software with AI-powered tools, layer support, and advanced filters for photographers and designers.',
            softwareUrl: 'https://proedit.example.com',
            softwareImage: 'https://proedit.example.com/screenshot.png',
            softwareVersion: '5.2.0',
            softwareOS: 'Windows, macOS, Linux',
            softwareCategory: 'DesignApplication',
            softwarePrice: '99.99',
            softwareCurrency: 'USD',
            softwareRating: '4.8',
            softwareRatingCount: '15420',
            softwareDownloadUrl: 'https://proedit.example.com/download',
            softwareFeatures: ['AI Photo Enhancement', 'Layer Support', 'RAW File Editing', 'Batch Processing'],
            softwareScreenshots: ['https://proedit.example.com/screen1.png', 'https://proedit.example.com/screen2.png'],
            softwareAuthor: 'ProEdit Software Inc.'
        },
        mobileApplication: {
            mobileAppName: 'FitTrack Pro',
            mobileAppDescription: 'Comprehensive fitness tracking app with workout plans, nutrition logging, and progress analytics to help you achieve your health goals.',
            mobileAppUrl: 'https://fittrackpro.example.com',
            mobileAppImage: 'https://fittrackpro.example.com/icon.png',
            mobileAppVersion: '3.1.0',
            mobileAppOS: 'iOS, Android',
            mobileAppCategory: 'HealthApplication',
            mobileAppPrice: '0',
            mobileAppCurrency: 'USD',
            mobileAppRating: '4.7',
            mobileAppRatingCount: '89000',
            mobileAppStoreUrl: 'https://apps.apple.com/app/fittrack-pro/id123456789',
            mobilePlayStoreUrl: 'https://play.google.com/store/apps/details?id=com.fittrackpro',
            mobileAppFeatures: ['Workout Tracking', 'Nutrition Logging', 'Progress Analytics', 'Social Challenges'],
            mobileAppScreenshots: ['https://fittrackpro.example.com/screen1.png', 'https://fittrackpro.example.com/screen2.png'],
            mobileAppAuthor: 'FitTech Labs'
        }
    };

    // Helper function to fetch page content from URL
    const fetchPageContent = async (url) => {
        const cacheBuster = `_cb=${Date.now()}`;
        const urlWithCacheBust = url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;

        const proxies = [
            (u) => `/api/proxy?url=${encodeURIComponent(u)}`,
            (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`
        ];

        for (const proxyFn of proxies) {
            try {
                const proxyUrl = proxyFn(urlWithCacheBust);
                const response = await fetch(
                    proxyUrl,
                    proxyUrl.startsWith('/api/proxy')
                        ? {
                            headers: {
                                'Accept': 'text/html',
                                'Cache-Control': 'no-cache, no-store, must-revalidate',
                                'Pragma': 'no-cache'
                            }
                        }
                        : {
                            headers: {
                                'Accept': 'text/html'
                            }
                        }
                );
                if (!response.ok) continue;
                const html = await response.text();
                if (html && html.length > 500 && !html.includes('/@vite/client')) {
                    // Extract text content from HTML
                    const textContent = html
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    return { html, textContent, success: true };
                }
            } catch (e) {
                continue;
            }
        }
        return { html: '', textContent: '', success: false };
    };

    // Fill example data based on schema type
    const fillExampleData = (schemaType) => {
        const data = EXAMPLE_DATA[schemaType];
        if (!data) return;

        switch (schemaType) {
            case 'entity':
                setEntityArticle(data.entityArticle);
                setArticleUrl(data.articleUrl);
                setArticleDescription(data.articleDescription);
                setEntityLogoUrl(data.entityLogoUrl);
                setEntityAuthorUrl(data.entityAuthorUrl);
                setEntityDatePublished(data.entityDatePublished);
                setEntityDateModified(data.entityDateModified);
                setEntityAuthorName(data.entityAuthorName);
                setEntityAuthorJobTitle(data.entityAuthorJobTitle);
                break;
            case 'localBusiness':
                setBusinessName(data.businessName);
                setBusinessAddress(data.businessAddress);
                setBusinessPhone(data.businessPhone);
                setBusinessWebsite(data.businessWebsite);
                setBusinessDescription(data.businessDescription);
                break;
            case 'breadcrumb':
                setBreadcrumbItems(data.breadcrumbItems);
                break;
            case 'navigation':
                setNavItems(data.navItems);
                break;
            case 'faq':
                setFaqItems(data.faqItems);
                break;
            case 'article':
                setArticleTitle(data.articleTitle);
                setArticleAuthor(data.articleAuthor);
                setArticleDatePublished(data.articleDatePublished);
                setArticleDateModified(data.articleDateModified);
                setArticleImage(data.articleImage);
                setArticleDescription(data.articleDescription);
                setArticleUrl(data.articleUrl);
                break;
            case 'product':
                setProductName(data.productName);
                setProductDescription(data.productDescription);
                setProductImage(data.productImage);
                setProductPrice(data.productPrice);
                setProductCurrency(data.productCurrency);
                setProductAvailability(data.productAvailability);
                setProductBrand(data.productBrand);
                break;
            case 'organization':
                setOrgName(data.orgName);
                setOrgUrl(data.orgUrl);
                setOrgLogo(data.orgLogo);
                setOrgDescription(data.orgDescription);
                setOrgSameAs(data.orgSameAs);
                break;
            case 'person':
                setPersonName(data.personName);
                setPersonJobTitle(data.personJobTitle);
                setPersonUrl(data.personUrl);
                setPersonImage(data.personImage);
                setPersonSameAs(data.personSameAs);
                break;
            case 'itemList':
                setListName(data.listName);
                setListItems(data.listItems);
                break;
            case 'aboutPage':
                setAboutOrgName(data.aboutOrgName);
                setAboutDescription(data.aboutDescription);
                setAboutUrl(data.aboutUrl);
                setAboutImage(data.aboutImage);
                setAboutFoundingDate(data.aboutFoundingDate);
                setAboutFounders(data.aboutFounders);
                break;
            case 'contactPage':
                setContactOrgName(data.contactOrgName);
                setContactEmail(data.contactEmail);
                setContactPhone(data.contactPhone);
                setContactAddress(data.contactAddress);
                setContactUrl(data.contactUrl);
                setContactHoursStart(data.contactHoursStart);
                setContactHoursEnd(data.contactHoursEnd);
                break;
            case 'authorPage':
                setAuthorProfileUrl(data.authorProfileUrl);
                setAuthorName(data.authorName);
                setAuthorJobTitle(data.authorJobTitle);
                setAuthorEmail(data.authorEmail);
                setAuthorDescription(data.authorDescription);
                setAuthorImage(data.authorImage);
                setAuthorOrgName(data.authorOrgName);
                setAuthorOrgUrl(data.authorOrgUrl);
                setAuthorAlumniOf(data.authorAlumniOf);
                setAuthorCredential(data.authorCredential);
                setAuthorAward(data.authorAward);
                setAuthorSkills(data.authorSkills);
                setAuthorKnowsAbout(data.authorKnowsAbout);
                setAuthorSameAs(data.authorSameAs);
                break;
            case 'event':
                setEventName(data.eventName);
                setEventType(data.eventType);
                setEventStartDate(data.eventStartDate);
                setEventEndDate(data.eventEndDate);
                setEventLocationName(data.eventLocationName);
                setEventLocationAddress(data.eventLocationAddress);
                setEventDescription(data.eventDescription);
                setEventUrl(data.eventUrl);
                setEventImage(data.eventImage);
                setEventOrganizer(data.eventOrganizer);
                setEventPerformers(data.eventPerformers);
                setEventTicketPrice(data.eventTicketPrice);
                setEventTicketCurrency(data.eventTicketCurrency);
                setEventTicketUrl(data.eventTicketUrl);
                break;
            case 'advancedOrg':
                setAdvOrgName(data.advOrgName);
                setAdvOrgLegalName(data.advOrgLegalName);
                setAdvOrgAlternateName(data.advOrgAlternateName);
                setAdvOrgType(data.advOrgType);
                setAdvOrgDescription(data.advOrgDescription);
                setAdvOrgSlogan(data.advOrgSlogan);
                setAdvOrgUrl(data.advOrgUrl);
                setAdvOrgLogo(data.advOrgLogo);
                setAdvOrgPhone(data.advOrgPhone);
                setAdvOrgEmail(data.advOrgEmail);
                setAdvOrgStreet(data.advOrgStreet);
                setAdvOrgCity(data.advOrgCity);
                setAdvOrgRegion(data.advOrgRegion);
                setAdvOrgPostalCode(data.advOrgPostalCode);
                setAdvOrgCountry(data.advOrgCountry);
                setAdvOrgFoundingDate(data.advOrgFoundingDate);
                setAdvOrgServices(data.advOrgServices);
                setAdvOrgSameAs(data.advOrgSameAs);
                break;
            case 'advancedLocalBusiness':
                setAdvLbName(data.advLbName);
                setAdvLbLegalName(data.advLbLegalName);
                setAdvLbType(data.advLbType);
                setAdvLbDescription(data.advLbDescription);
                setAdvLbSlogan(data.advLbSlogan);
                setAdvLbUrl(data.advLbUrl);
                setAdvLbLogo(data.advLbLogo);
                setAdvLbPhone(data.advLbPhone);
                setAdvLbEmail(data.advLbEmail);
                setAdvLbStreet(data.advLbStreet);
                setAdvLbCity(data.advLbCity);
                setAdvLbRegion(data.advLbRegion);
                setAdvLbPostalCode(data.advLbPostalCode);
                setAdvLbCountry(data.advLbCountry);
                setAdvLbPriceRange(data.advLbPriceRange);
                setAdvLbOpeningHours(data.advLbOpeningHours);
                setAdvLbServices(data.advLbServices);
                break;
            case 'advancedService':
                setAdvSvcName(data.advSvcName);
                setAdvSvcDescription(data.advSvcDescription);
                setAdvSvcUrl(data.advSvcUrl);
                setAdvSvcProvider(data.advSvcProvider);
                setAdvSvcBrand(data.advSvcBrand);
                setAdvSvcAudience(data.advSvcAudience);
                setAdvSvcType(data.advSvcType);
                setAdvSvcSubServices(data.advSvcSubServices);
                break;
            case 'advancedWebPage':
                setAdvWpUrl(data.advWpUrl);
                setAdvWpName(data.advWpName);
                setAdvWpDescription(data.advWpDescription);
                setAdvWpPublisher(data.advWpPublisher);
                setAdvWpAboutEntities(data.advWpAboutEntities);
                setAdvWpMentionsEntities(data.advWpMentionsEntities);
                break;
            case 'softwareApplication':
                setSoftwareName(data.softwareName);
                setSoftwareType(data.softwareType);
                setSoftwareDescription(data.softwareDescription);
                setSoftwareUrl(data.softwareUrl);
                setSoftwareImage(data.softwareImage);
                setSoftwareVersion(data.softwareVersion);
                setSoftwareOS(data.softwareOS);
                setSoftwareCategory(data.softwareCategory);
                setSoftwarePrice(data.softwarePrice);
                setSoftwareCurrency(data.softwareCurrency);
                setSoftwareRating(data.softwareRating);
                setSoftwareRatingCount(data.softwareRatingCount);
                setSoftwareDownloadUrl(data.softwareDownloadUrl);
                setSoftwareFeatures(data.softwareFeatures);
                setSoftwareScreenshots(data.softwareScreenshots);
                setSoftwareAuthor(data.softwareAuthor);
                break;
            case 'mobileApplication':
                setMobileAppName(data.mobileAppName);
                setMobileAppDescription(data.mobileAppDescription);
                setMobileAppUrl(data.mobileAppUrl);
                setMobileAppImage(data.mobileAppImage);
                setMobileAppVersion(data.mobileAppVersion);
                setMobileAppOS(data.mobileAppOS);
                setMobileAppCategory(data.mobileAppCategory);
                setMobileAppPrice(data.mobileAppPrice);
                setMobileAppCurrency(data.mobileAppCurrency);
                setMobileAppRating(data.mobileAppRating);
                setMobileAppRatingCount(data.mobileAppRatingCount);
                setMobileAppStoreUrl(data.mobileAppStoreUrl);
                setMobilePlayStoreUrl(data.mobilePlayStoreUrl);
                setMobileAppFeatures(data.mobileAppFeatures);
                setMobileAppScreenshots(data.mobileAppScreenshots);
                setMobileAppAuthor(data.mobileAppAuthor);
                break;
        }
    };

    // Import from URL using AI extraction
    const importFromUrl = async (schemaType) => {
        if (!importUrl.trim()) return;
        setIsImporting(true);

        try {
            const { textContent, success } = await fetchPageContent(importUrl);
            if (!success) {
                alert('Failed to fetch page content. Please try pasting the text manually.');
                setIsImporting(false);
                return;
            }
            await extractAndFillFields(schemaType, textContent, importUrl);
        } catch (e) {
            console.error('Import error:', e);
            alert('Import failed. Please try again or paste content manually.');
        } finally {
            setIsImporting(false);
            setImportUrl('');
        }
    };

    // Import from pasted text using AI extraction
    const importFromText = async (schemaType) => {
        if (!importText.trim()) return;
        setIsImporting(true);

        try {
            await extractAndFillFields(schemaType, importText, '');
        } catch (e) {
            console.error('Import error:', e);
            alert('Import failed. Please try again.');
        } finally {
            setIsImporting(false);
            setImportText('');
        }
    };

    // AI-powered field extraction
    const extractAndFillFields = async (schemaType, content, sourceUrl) => {
        const prompts = {
            localBusiness: `Extract business information from this content. Return JSON with: businessName, businessAddress, businessPhone, businessWebsite, businessDescription`,
            article: `Extract article metadata from this content. Return JSON with: articleTitle, articleAuthor, articleDescription, articleImage (URL if found)`,
            product: `Extract product information from this content. Return JSON with: productName, productDescription, productPrice, productBrand, productImage`,
            organization: `Extract organization information from this content. Return JSON with: orgName, orgDescription, orgUrl, orgLogo`,
            person: `Extract person information from this content. Return JSON with: personName, personJobTitle, personDescription, personImage`,
            faq: `Extract FAQ questions and answers from this content. Return JSON with: faqItems (array of {question, answer})`,
            event: `Extract event information from this content. Return JSON with: eventName, eventDescription, eventLocationName, eventLocationAddress, eventStartDate, eventEndDate`,
        };

        const prompt = prompts[schemaType] || `Extract relevant information for a ${schemaType} schema from this content. Return JSON with appropriate fields.`;

        try {
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `${prompt}\n\nContent:\n${content.substring(0, 8000)}`,
                    responseMimeType: 'application/json',
                    temperature: 0.3
                })
            });

            const data = await response.json();
            const extracted = JSON.parse(data.text.replace(/```json\n?|```\n?/g, '').trim());

            // Apply extracted data based on schema type
            switch (schemaType) {
                case 'localBusiness':
                    if (extracted.businessName) setBusinessName(extracted.businessName);
                    if (extracted.businessAddress) setBusinessAddress(extracted.businessAddress);
                    if (extracted.businessPhone) setBusinessPhone(extracted.businessPhone);
                    if (extracted.businessWebsite) setBusinessWebsite(extracted.businessWebsite || sourceUrl);
                    if (extracted.businessDescription) setBusinessDescription(extracted.businessDescription);
                    break;
                case 'article':
                    if (extracted.articleTitle) setArticleTitle(extracted.articleTitle);
                    if (extracted.articleAuthor) setArticleAuthor(extracted.articleAuthor);
                    if (extracted.articleDescription) setArticleDescription(extracted.articleDescription);
                    if (extracted.articleImage) setArticleImage(extracted.articleImage);
                    if (sourceUrl) setArticleUrl(sourceUrl);
                    break;
                case 'product':
                    if (extracted.productName) setProductName(extracted.productName);
                    if (extracted.productDescription) setProductDescription(extracted.productDescription);
                    if (extracted.productPrice) setProductPrice(extracted.productPrice);
                    if (extracted.productBrand) setProductBrand(extracted.productBrand);
                    if (extracted.productImage) setProductImage(extracted.productImage);
                    break;
                case 'organization':
                    if (extracted.orgName) setOrgName(extracted.orgName);
                    if (extracted.orgDescription) setOrgDescription(extracted.orgDescription);
                    if (extracted.orgUrl) setOrgUrl(extracted.orgUrl || sourceUrl);
                    if (extracted.orgLogo) setOrgLogo(extracted.orgLogo);
                    break;
                case 'person':
                    if (extracted.personName) setPersonName(extracted.personName);
                    if (extracted.personJobTitle) setPersonJobTitle(extracted.personJobTitle);
                    if (extracted.personImage) setPersonImage(extracted.personImage);
                    if (sourceUrl) setPersonUrl(sourceUrl);
                    break;
                case 'faq':
                    if (extracted.faqItems && Array.isArray(extracted.faqItems)) {
                        setFaqItems(extracted.faqItems);
                    }
                    break;
                case 'event':
                    if (extracted.eventName) setEventName(extracted.eventName);
                    if (extracted.eventDescription) setEventDescription(extracted.eventDescription);
                    if (extracted.eventLocationName) setEventLocationName(extracted.eventLocationName);
                    if (extracted.eventLocationAddress) setEventLocationAddress(extracted.eventLocationAddress);
                    if (extracted.eventStartDate) setEventStartDate(extracted.eventStartDate);
                    if (extracted.eventEndDate) setEventEndDate(extracted.eventEndDate);
                    if (sourceUrl) setEventUrl(sourceUrl);
                    break;
            }
        } catch (e) {
            console.error('AI extraction failed:', e);
            throw e;
        }
    };

    // Reusable Quick Fill Section component - Enhanced Design
    const renderQuickFillSection = (schemaType) => (
        <div className="schema-quickfill mb-6">
            {/* Gradient Header with Tabs */}
            <div className="schema-quickfill-head">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setQuickFillTab('url')}
                        className={`ui-button ctool-seg-btn ${quickFillTab === 'url' ? 'active' : ''}`}
                    >
                        <Globe className="w-4 h-4" />
                        URL
                    </button>
                    <button
                        onClick={() => setQuickFillTab('text')}
                        className={`ui-button ctool-seg-btn ${quickFillTab === 'text' ? 'active' : ''}`}
                    >
                        <FileText className="w-4 h-4" />
                        Text
                    </button>
                    <div className="flex-1"></div>
                    <button
                        onClick={() => fillExampleData(schemaType)}
                        className="ui-button ctool-tool-btn"
                    >
                        <Wand2 className="w-4 h-4" />
                        Fill Example
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="schema-quickfill-body">
                {quickFillTab === 'url' ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="schema-card-title flex items-center gap-2">
                                <Globe className="w-4 h-4 ctool-accent" />
                                Source URL
                            </h3>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sres-search-icon" />
                                <input
                                    type="url"
                                    value={importUrl}
                                    onChange={(e) => setImportUrl(e.target.value)}
                                    placeholder="https://example.com/article"
                                    className="schema-input schema-input-lg pl-11"
                                />
                            </div>
                            <button
                                onClick={() => importFromUrl(schemaType)}
                                disabled={!importUrl.trim() || isImporting}
                                className="ui-button ui-button-primary"
                            >
                                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                Extract
                            </button>
                        </div>
                        <p className="schema-hint">
                            AI will automatically extract relevant information from the URL and fill the form fields.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h3 className="schema-card-title flex items-center gap-2">
                            <FileText className="w-4 h-4 ctool-accent" />
                            Paste Content
                        </h3>
                        <textarea
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            placeholder="Paste your article content here to extract entities..."
                            className="schema-input h-40 resize-none"
                        />
                        <button
                            onClick={() => importFromText(schemaType)}
                            disabled={!importText.trim() || isImporting}
                            className="ui-button ui-button-primary w-full"
                        >
                            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Extract Entities
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const copyToClipboard = () => {
        if (generatedSchema) {
            navigator.clipboard.writeText(JSON.stringify(generatedSchema, null, 2));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // ===== ENTITY SCHEMA RULES (Single Source of Truth) =====
    const ENTITY_RULES = {
        ALLOWED_TYPES: ["Thing", "DefinedTerm", "City", "Country", "Legislation", "Organization", "PeopleAudience", "Person", "Airport", "GovernmentOrganization", "TouristAttraction", "Place", "LandmarksOrHistoricalBuildings"],
        REQUIRED_PROPS: ["name"],
        // Smart type detection based on keywords
        TYPE_KEYWORDS: {
            // Tourist Attractions (must be before generic place keywords)
            "island": "TouristAttraction",
            "beach": "TouristAttraction",
            "park": "TouristAttraction",
            "museum": "TouristAttraction",
            "attraction": "TouristAttraction",
            "resort": "TouristAttraction",
            "waterpark": "TouristAttraction",
            "theme park": "TouristAttraction",
            "zoo": "TouristAttraction",
            "aquarium": "TouristAttraction",
            // Places
            "tower": "Place",
            "mall": "Place",
            "landmark": "LandmarksOrHistoricalBuildings",
            "monument": "LandmarksOrHistoricalBuildings",
            "fort": "LandmarksOrHistoricalBuildings",
            "palace": "LandmarksOrHistoricalBuildings",
            // People/Audience
            "tourist": "PeopleAudience",
            "traveler": "PeopleAudience",
            "visitor": "PeopleAudience",
            "muslim": "PeopleAudience",
            "resident": "PeopleAudience",
            // Transportation
            "airport": "Airport",
            // Legal
            "law": "Legislation",
            "regulation": "Legislation",
            "rule": "Legislation",
            // Defined Terms (concepts, not places)
            "fine": "DefinedTerm",
            "penalty": "DefinedTerm",
            "punishment": "DefinedTerm",
            "age": "DefinedTerm",
            "limit": "DefinedTerm",
            "allowance": "DefinedTerm",
            "timing": "DefinedTerm",
            "price": "DefinedTerm",
            "ticket": "DefinedTerm",
            // Organizations
            "government": "GovernmentOrganization",
            "authority": "GovernmentOrganization",
            "customs": "GovernmentOrganization",
            "police": "GovernmentOrganization",
            // Locations
            "dubai": "City",
            "abu dhabi": "City",
            "uae": "Country",
            "emirates": "Country"
        }
    };

    // Sanitize slug - extract path from full URL or clean slug
    const sanitizeSlug = (input = "article") => {
        try {
            if (input.startsWith("http")) {
                const u = new URL(input);
                return u.pathname.replace(/^\/+|\/+$/g, "");
            }
        } catch { }
        return input.replace(/^\/+|\/+$/g, "");
    };

    // Build entity with validation, smart type detection, and hierarchy (Rule 7)
    const buildEntity = ({ id, type, name, description, sameAs }, baseUrl, mainEntityId = null) => {
        if (!name) return null; // Required prop

        // Fix undefined ID - use slugified name
        const safeId = id && id !== 'undefined'
            ? id
            : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Smart type detection if type is Thing or missing
        if (!type || type === 'Thing') {
            const nameLower = name.toLowerCase();
            for (const [keyword, detectedType] of Object.entries(ENTITY_RULES.TYPE_KEYWORDS)) {
                if (nameLower.includes(keyword)) {
                    type = detectedType;
                    break;
                }
            }
            if (!type) type = 'DefinedTerm'; // Default to DefinedTerm, not Thing
        }

        // Validate type is allowed
        if (!ENTITY_RULES.ALLOWED_TYPES.includes(type)) {
            type = "DefinedTerm";
        }

        // Build entity (no sameAs for DefinedTerm to avoid identity confusion)
        const entity = {
            "@type": type,
            "@id": `${baseUrl}#${safeId}`,
            "name": name,
            ...(description && { "description": description }),
            // Only add sameAs for non-DefinedTerm types (DefinedTerm ≠ Wikipedia article)
            ...(type !== "DefinedTerm" && Array.isArray(sameAs) && sameAs.length > 0 && { "sameAs": sameAs })
        };

        // Add inDefinedTermSet for DefinedTerm entities (NOT isPartOf - that's invalid)
        if (type === "DefinedTerm" && mainEntityId) {
            entity.inDefinedTermSet = { "@id": mainEntityId };
        }

        return entity;
    };

    // Normalize main entity - DOMAIN-ROOT @id for site-wide reuse (Rule 11)
    const normalizeMainEntity = (entity, baseUrl, cleanDomain) => {
        if (!entity || !entity.name) return null;

        // Fix undefined ID - create meaningful slug
        const safeId = entity.id && entity.id !== 'undefined'
            ? entity.id
            : entity.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Smart type detection for main entity
        let type = 'Thing'; // Core topic should be Thing (most generic, safest)
        const nameLower = entity.name.toLowerCase();
        for (const [keyword, detectedType] of Object.entries(ENTITY_RULES.TYPE_KEYWORDS)) {
            if (nameLower.includes(keyword)) {
                type = detectedType;
                break;
            }
        }

        // Use DOMAIN-ROOT @id for site-wide reuse (Rule 11)
        return {
            "@type": type,
            "@id": `${cleanDomain}/#${safeId}`, // Domain root, NOT page URL
            "name": entity.name,
            ...(entity.description && { "description": entity.description }),
            ...(entity.sameAs?.length > 0 && { "sameAs": entity.sameAs })
        };
    };

    // Safe relationship builder - no broken graphs
    const applyRelationships = (entityMap, entities, baseUrl) => {
        entities?.forEach(entity => {
            entity.relationships?.forEach(rel => {
                const source = entityMap[entity.id];
                const target = entityMap[rel.targetId];

                if (!source || !target || !rel.property) return;

                const ref = { "@id": `${baseUrl}#${rel.targetId}` };

                if (source[rel.property]) {
                    source[rel.property] = Array.isArray(source[rel.property])
                        ? [...source[rel.property], ref]
                        : [source[rel.property], ref];
                } else {
                    source[rel.property] = ref;
                }
            });
        });
    };

    // Auto-link entities based on types (semantic relationships)
    const autoLinkEntities = (entityMap, baseUrl) => {
        const entities = Object.values(entityMap);

        // Find key entity types
        const countries = entities.filter(e => e["@type"] === "Country");
        const cities = entities.filter(e => e["@type"] === "City");
        const airports = entities.filter(e => e["@type"] === "Airport");
        const legislation = entities.filter(e => e["@type"] === "Legislation");
        const audiences = entities.filter(e => e["@type"] === "PeopleAudience");
        const govOrgs = entities.filter(e => e["@type"] === "GovernmentOrganization");
        const definedTerms = entities.filter(e => e["@type"] === "DefinedTerm");

        // City → containedInPlace → Country (first country found)
        if (countries.length > 0) {
            const countryRef = { "@id": countries[0]["@id"] };
            cities.forEach(city => {
                if (!city.containedInPlace) {
                    city.containedInPlace = countryRef;
                }
            });

            // Legislation → legislationJurisdiction → Country
            legislation.forEach(law => {
                if (!law.legislationJurisdiction) {
                    law.legislationJurisdiction = countryRef;
                }
            });
        }

        // Airport → containedInPlace → City (first city found)
        if (cities.length > 0) {
            const cityRef = { "@id": cities[0]["@id"] };
            airports.forEach(airport => {
                if (!airport.containedInPlace) {
                    airport.containedInPlace = cityRef;
                }
            });
        }

        // Legislation → audience → all PeopleAudience entities (valid via CreativeWork)
        if (audiences.length > 0 && legislation.length > 0) {
            const audienceRefs = audiences.map(a => ({ "@id": a["@id"] }));
            legislation.forEach(law => {
                if (!law.audience) {
                    law.audience = audienceRefs.length === 1 ? audienceRefs[0] : audienceRefs;
                }
            });
        }

        // Link Legislation → mentions → secondary entities (only valid for CreativeWork types)
        // DO NOT add mentions to DefinedTerm - it's not a valid property
        if (legislation.length > 0) {
            const mainLaw = legislation[0];
            const mentionRefs = entities
                .filter(e => e["@id"] !== mainLaw["@id"])
                .slice(0, 5) // Limit to top 5
                .map(e => ({ "@id": e["@id"] }));
            if (!mainLaw.mentions && mentionRefs.length > 0) {
                mainLaw.mentions = mentionRefs;
            }
        }
    };

    // AI-powered Entity Schema Generator
    const generateEntitySchema = async () => {
        if (!entityArticle.trim()) return;
        setIsGenerating(true);
        setGeneratedSchema(null);

        try {
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate Schema.org entities for this article.

TYPE RULES (use specific types, NOT Thing or DefinedTerm for places):
- Islands/Beaches/Parks/Museums/Zoos/Resorts = TouristAttraction
- Towers/Malls/Landmarks = Place
- Tourists/Visitors/Travelers = PeopleAudience
- Muslims/Religious groups = PeopleAudience  
- Laws/Regulations = Legislation
- Government/Authority/Customs = GovernmentOrganization
- Ages/Limits/Fines/Penalties/Prices/Timings = DefinedTerm
- Cities = City
- Countries = Country
- Airports = Airport

EVERY entity MUST have: id, type, name, description
IDs must be meaningful slugs (e.g., "legal-drinking-age", NOT "undefined")
pageUrl = slug only (no domain)

Article:
${entityArticle}

Return JSON:
{
  "mainEntity": { "id": "main-topic-slug", "name": "Main Topic", "description": "..." },
  "relatedEntities": [
    { "id": "entity-slug", "type": "SpecificType", "name": "Name", "description": "...", "sameAs": ["https://en.wikipedia.org/wiki/..."] }
  ],
  "pageUrl": "article-slug"
}`
                })
            });

            const data = await response.json();
            let parsed = null;

            try {
                const cleanResponse = data.text.replace(/```json\n?|```\n?/g, '').trim();
                parsed = JSON.parse(cleanResponse);
            } catch (e) {
                console.error('Failed to parse AI response:', e);
                alert('Failed to parse entity data. Please try again.');
                setIsGenerating(false);
                return;
            }

            // Build schema with validation - extract domain from articleUrl
            let cleanDomain = 'https://example.com';
            try {
                if (articleUrl.trim()) {
                    const urlObj = new URL(articleUrl.trim());
                    cleanDomain = urlObj.origin;
                }
            } catch {
                // Use default if URL parsing fails
            }
            const slug = sanitizeSlug(parsed.pageUrl);
            const baseUrl = articleUrl.trim() || `${cleanDomain}/${slug}`;

            const entityMap = {};

            // Build main entity with domain-root @id (Rule 1 & 11)
            const mainEntity = normalizeMainEntity(parsed.mainEntity, baseUrl, cleanDomain);
            if (mainEntity) {
                entityMap[parsed.mainEntity.id] = mainEntity;
            }

            // Build related entities with inDefinedTermSet linking to glossary
            const glossaryId = `${cleanDomain}/#glossary`;
            parsed.relatedEntities?.forEach(entity => {
                const built = buildEntity(entity, baseUrl, glossaryId);
                if (built) {
                    entityMap[entity.id] = built;
                }
            });

            // Apply relationships safely
            applyRelationships(entityMap, parsed.relatedEntities, baseUrl);

            // Auto-link entities based on types (City→Country, Airport→City, etc.)
            autoLinkEntities(entityMap, baseUrl);

            // Build mentions array (all entities)
            const mentionsArray = Object.values(entityMap)
                .filter(e => e && e["@id"])
                .map(e => ({ "@id": e["@id"] }));

            // Extract organization name from domain for author/publisher
            const orgName = cleanDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0];
            const formattedOrgName = orgName.charAt(0).toUpperCase() + orgName.slice(1).replace(/-/g, ' ');

            // Use canonical URL from input or construct from domain
            const canonicalUrl = articleUrl.trim() || baseUrl;

            // Limit mentions to avoid overstuffing (max 5)
            const limitedMentions = mentionsArray.slice(0, 5);

            // Build WebPage node - mainEntity points to CORE TOPIC (Rule 3)
            const webPageNode = {
                "@type": "WebPage",
                "@id": canonicalUrl,
                "url": canonicalUrl,
                "name": mainEntity?.name || "Article",
                ...(mainEntity && { "mainEntity": { "@id": mainEntity["@id"] } })
            };

            // Parse social links for Organization sameAs
            const socialLinksArray = entitySocialLinks.trim()
                ? entitySocialLinks.split(',').map(s => s.trim()).filter(s => s.startsWith('http'))
                : [];

            // Build UNIQUE knowsAbout (deduplicated)
            const knowsAboutSet = new Set();
            if (mainEntity) knowsAboutSet.add(mainEntity["@id"]);
            limitedMentions.slice(0, 3).forEach(m => {
                if (m["@id"] && m["@id"] !== mainEntity?.["@id"]) {
                    knowsAboutSet.add(m["@id"]);
                }
            });
            const uniqueKnowsAbout = Array.from(knowsAboutSet).map(id => ({ "@id": id }));

            // Build Organization node with EEAT (Rule 4)
            const organizationNode = {
                "@type": "Organization",
                "@id": `${cleanDomain}#organization`,
                "name": formattedOrgName,
                "url": cleanDomain,
                "logo": {
                    "@type": "ImageObject",
                    "url": entityLogoUrl.trim() || `${cleanDomain}/logo.png`
                },
                // knowsAbout links to UNIQUE entities for topical authority
                ...(uniqueKnowsAbout.length > 0 && { "knowsAbout": uniqueKnowsAbout }),
                // sameAs for social proof
                ...(socialLinksArray.length > 0 && { "sameAs": socialLinksArray }),
                // areaServed for local authority (if geography exists)
                ...(Object.values(entityMap).some(e => e?.["@type"] === "Country") && {
                    "areaServed": { "@id": Object.values(entityMap).find(e => e?.["@type"] === "Country")?.["@id"] }
                })
            };

            // Build Person author node (if author name provided - better EEAT)
            // Get unique entity names for knowsAbout (not IDs, but actual topic names)
            const entityNames = [...new Set(Object.values(entityMap)
                .filter(e => e?.name)
                .map(e => e.name)
            )].slice(0, 4);

            const personAuthorNode = entityAuthorName.trim() ? {
                "@type": "Person",
                "@id": `${cleanDomain}#author`,
                "name": entityAuthorName.trim(),
                ...(entityAuthorJobTitle.trim() && { "jobTitle": entityAuthorJobTitle.trim() }),
                "worksFor": { "@id": `${cleanDomain}#organization` },
                ...(entityNames.length > 0 && { "knowsAbout": entityNames })
            } : null;

            // Build DefinedTermSet grouping all DefinedTerm entities
            const definedTermEntities = Object.values(entityMap).filter(e => e?.["@type"] === "DefinedTerm");
            const definedTermSetNode = definedTermEntities.length > 0 ? {
                "@type": "DefinedTermSet",
                "@id": `${cleanDomain}/#glossary`,
                "name": `${mainEntity?.name || "Topic"} Glossary`,
                "hasDefinedTerm": definedTermEntities.map(t => ({ "@id": t["@id"] }))
            } : null;

            // Note: about is NOT valid for Thing type, only for CreativeWork
            // The DefinedTermSet is already linked via DefinedTerm.inDefinedTermSet

            // Build Article node - about points to CORE TOPIC (Rule 2)
            const articleNode = {
                "@type": "Article",
                "@id": `${canonicalUrl}#article`,
                "url": canonicalUrl,
                "headline": mainEntity?.name || "Article",
                "name": mainEntity?.name || "Article",
                "inLanguage": "en",
                "articleSection": "Guide",
                ...(articleDescription.trim() && { "description": articleDescription.trim() }),
                ...(articleImage.trim() && {
                    "image": {
                        "@type": "ImageObject",
                        "url": articleImage.trim()
                    }
                }),
                ...(entityDatePublished.trim() && { "datePublished": entityDatePublished.trim() }),
                ...(entityDateModified.trim() && { "dateModified": entityDateModified.trim() }),
                // Use Person author if available, otherwise Organization
                "author": { "@id": personAuthorNode ? `${cleanDomain}#author` : `${cleanDomain}#organization` },
                "publisher": { "@id": `${cleanDomain}#organization` },
                "mainEntityOfPage": { "@id": canonicalUrl },
                ...(mainEntity && { "about": { "@id": mainEntity["@id"] } }),
                ...(limitedMentions.length > 0 && { "mentions": limitedMentions })
            };

            // Assemble final schema with everything inside @graph (Rule 1)
            const schema = {
                "@context": "https://schema.org",
                "@graph": [
                    webPageNode,
                    organizationNode,
                    personAuthorNode,
                    definedTermSetNode,
                    articleNode,
                    mainEntity,
                    // Filter out mainEntity and any Organization entities (to prevent duplicates)
                    ...Object.values(entityMap).filter(e =>
                        e &&
                        e["@id"] !== mainEntity?.["@id"] &&
                        e["@type"] !== "Organization" &&
                        e["@type"] !== "GovernmentOrganization"
                    )
                ].filter(Boolean)
            };

            setGeneratedSchema(schema);
        } catch (error) {
            console.error('Entity extraction failed:', error);
            alert('Failed to extract entities. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    // AI-powered Local Business Schema Generator
    const generateLocalBusinessSchema = async () => {
        if (!businessName.trim()) return;
        setIsGenerating(true);
        setGeneratedSchema(null);

        try {
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Based on this business information, determine the most appropriate Schema.org LocalBusiness subtype and generate a complete LocalBusiness schema.

Business Name: ${businessName}
Address: ${businessAddress}
Phone: ${businessPhone}
Website: ${businessWebsite}
Description: ${businessDescription}

Choose the most specific business type from Schema.org (e.g., Restaurant, Dentist, LegalService, Plumber, RealEstateAgent, Store, etc.)

Return a complete JSON-LD schema in this format:
{
  "@context": "https://schema.org",
  "@type": "SpecificBusinessType",
  "name": "...",
  "description": "...",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "...",
    "addressLocality": "...",
    "addressRegion": "...",
    "postalCode": "...",
    "addressCountry": "..."
  },
  "telephone": "...",
  "url": "...",
  "priceRange": "$$",
  "openingHoursSpecification": []
}

Parse the address intelligently. Only return valid JSON, no markdown.`
                })
            });

            const data = await response.json();

            try {
                const cleanResponse = data.text.replace(/```json\n?|```\n?/g, '').trim();
                const schema = JSON.parse(cleanResponse);
                setGeneratedSchema(schema);
            } catch (e) {
                console.error('Failed to parse AI response:', e);
                alert('Failed to generate schema. Please try again.');
            }
        } catch (error) {
            console.error('Local business schema generation failed:', error);
            alert('Failed to generate schema. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    // Manual schema generators
    const generateBreadcrumbSchema = () => {
        const validItems = breadcrumbItems.filter(item => item.name.trim());
        if (validItems.length === 0) return;

        const schema = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": validItems.map((item, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "name": item.name,
                ...(item.url && { "item": item.url })
            }))
        };
        setGeneratedSchema(schema);
    };

    const generateNavigationSchema = () => {
        const validItems = navItems.filter(item => item.name.trim() && item.url.trim());
        if (validItems.length === 0) return;

        const schema = {
            "@context": "https://schema.org",
            "@graph": validItems.map(item => ({
                "@type": "SiteNavigationElement",
                "name": item.name,
                "url": item.url
            }))
        };
        setGeneratedSchema(schema);
    };

    const generateFAQSchema = () => {
        const validItems = faqItems.filter(item => item.question.trim() && item.answer.trim());
        if (validItems.length === 0) return;

        const schema = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": validItems.map(item => ({
                "@type": "Question",
                "name": item.question,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": item.answer
                }
            }))
        };
        setGeneratedSchema(schema);
    };

    const generateArticleSchema = () => {
        if (!articleTitle.trim()) return;

        const schema = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": articleTitle,
            ...(articleDescription && { "description": articleDescription }),
            ...(articleImage && { "image": articleImage }),
            ...(articleUrl && { "url": articleUrl }),
            ...(articleDatePublished && { "datePublished": articleDatePublished }),
            ...(articleDateModified && { "dateModified": articleDateModified }),
            ...(articleAuthor && {
                "author": {
                    "@type": "Person",
                    "name": articleAuthor
                }
            })
        };
        setGeneratedSchema(schema);
    };

    const generateProductSchema = () => {
        if (!productName.trim()) return;

        const schema = {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": productName,
            ...(productDescription && { "description": productDescription }),
            ...(productImage && { "image": productImage }),
            ...(productBrand && {
                "brand": {
                    "@type": "Brand",
                    "name": productBrand
                }
            }),
            "offers": {
                "@type": "Offer",
                "price": productPrice || "0",
                "priceCurrency": productCurrency,
                "availability": `https://schema.org/${productAvailability}`
            }
        };
        setGeneratedSchema(schema);
    };

    const generateOrganizationSchema = () => {
        if (!orgName.trim()) return;

        const validSameAs = orgSameAs.filter(s => s.trim());
        const schema = {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": orgName,
            ...(orgUrl && { "url": orgUrl }),
            ...(orgLogo && { "logo": orgLogo }),
            ...(orgDescription && { "description": orgDescription }),
            ...(validSameAs.length > 0 && { "sameAs": validSameAs })
        };
        setGeneratedSchema(schema);
    };

    const generatePersonSchema = () => {
        if (!personName.trim()) return;

        const validSameAs = personSameAs.filter(s => s.trim());
        const schema = {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": personName,
            ...(personJobTitle && { "jobTitle": personJobTitle }),
            ...(personUrl && { "url": personUrl }),
            ...(personImage && { "image": personImage }),
            ...(validSameAs.length > 0 && { "sameAs": validSameAs })
        };
        setGeneratedSchema(schema);
    };

    // ItemList (List View) Schema Generator
    const generateItemListSchema = () => {
        const validItems = listItems.filter(item => item.name.trim());
        if (validItems.length === 0) return;

        const schema = {
            "@context": "https://schema.org",
            "@type": "ItemList",
            ...(listName && { "name": listName }),
            "numberOfItems": validItems.length,
            "itemListElement": validItems.map((item, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "name": item.name,
                ...(item.url && { "url": item.url })
            }))
        };
        setGeneratedSchema(schema);
    };

    // AboutPage Schema Generator
    const generateAboutPageSchema = () => {
        if (!aboutOrgName.trim()) return;

        const validFounders = aboutFounders.filter(f => f.trim());
        const schema = {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            "name": `About ${aboutOrgName}`,
            ...(aboutUrl && { "url": aboutUrl }),
            ...(aboutDescription && { "description": aboutDescription }),
            ...(aboutImage && { "image": aboutImage }),
            "mainEntity": {
                "@type": "Organization",
                "name": aboutOrgName,
                ...(aboutDescription && { "description": aboutDescription }),
                ...(aboutFoundingDate && { "foundingDate": aboutFoundingDate }),
                ...(validFounders.length > 0 && {
                    "founder": validFounders.map(name => ({
                        "@type": "Person",
                        "name": name
                    }))
                })
            }
        };
        setGeneratedSchema(schema);
    };

    // ContactPage Schema Generator
    const generateContactPageSchema = () => {
        if (!contactOrgName.trim()) return;

        const schema = {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            "name": `Contact ${contactOrgName}`,
            ...(contactUrl && { "url": contactUrl }),
            "mainEntity": {
                "@type": "Organization",
                "name": contactOrgName,
                ...(contactEmail && { "email": contactEmail }),
                ...(contactPhone && { "telephone": contactPhone }),
                ...(contactAddress && {
                    "address": {
                        "@type": "PostalAddress",
                        "streetAddress": contactAddress
                    }
                }),
                "contactPoint": {
                    "@type": "ContactPoint",
                    "contactType": "customer service",
                    ...(contactPhone && { "telephone": contactPhone }),
                    ...(contactEmail && { "email": contactEmail }),
                    "hoursAvailable": {
                        "@type": "OpeningHoursSpecification",
                        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                        "opens": contactHoursStart,
                        "closes": contactHoursEnd
                    }
                }
            }
        };
        setGeneratedSchema(schema);
    };

    // Author Page Schema Generator (ProfilePage + Person)
    const generateAuthorPageSchema = () => {
        if (!authorName.trim() || !authorProfileUrl.trim()) return;

        const baseUrl = authorProfileUrl.replace(/\/$/, '');
        const orgUrl = authorOrgUrl.trim() || baseUrl.split('/author/')[0] || baseUrl;

        const schema = {
            "@context": "https://schema.org",
            "@graph": [
                // ProfilePage
                {
                    "@type": "ProfilePage",
                    "@id": `${baseUrl}/`,
                    "url": `${baseUrl}/`,
                    "name": `${authorName} | ${authorJobTitle || 'Author'}`,
                    "isPartOf": {
                        "@id": `${orgUrl}/#website`
                    },
                    ...(authorImage && {
                        "primaryImageOfPage": { "@id": `${baseUrl}/#primaryimage` },
                        "image": { "@id": `${baseUrl}/#primaryimage` }
                    }),
                    ...(authorDescription && { "description": authorDescription }),
                    "breadcrumb": { "@id": `${baseUrl}/#breadcrumb` },
                    "inLanguage": "en-US",
                    "potentialAction": [{
                        "@type": "ReadAction",
                        "target": [`${baseUrl}/`]
                    }],
                    "mainEntity": { "@id": `${baseUrl}/#person` }
                },
                // Primary Image
                ...(authorImage ? [{
                    "@type": "ImageObject",
                    "inLanguage": "en-US",
                    "@id": `${baseUrl}/#primaryimage`,
                    "url": authorImage,
                    "contentUrl": authorImage,
                    "caption": authorName
                }] : []),
                // Breadcrumb
                {
                    "@type": "BreadcrumbList",
                    "@id": `${baseUrl}/#breadcrumb`,
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": 1,
                            "name": "Home",
                            "item": orgUrl + "/"
                        },
                        {
                            "@type": "ListItem",
                            "position": 2,
                            "name": `Archives for ${authorName}`
                        }
                    ]
                },
                // WebSite
                {
                    "@type": "WebSite",
                    "@id": `${orgUrl}/#website`,
                    "url": orgUrl + "/",
                    "name": authorOrgName || orgUrl,
                    "publisher": { "@id": `${orgUrl}/#organization` },
                    "potentialAction": [{
                        "@type": "SearchAction",
                        "target": {
                            "@type": "EntryPoint",
                            "urlTemplate": `${orgUrl}/?s={search_term_string}`
                        },
                        "query-input": "required name=search_term_string"
                    }],
                    "inLanguage": "en-US"
                },
                // Organization
                {
                    "@type": "Organization",
                    "@id": `${orgUrl}/#organization`,
                    "name": authorOrgName || orgUrl,
                    "url": orgUrl + "/",
                    ...(authorOrgLogo && {
                        "logo": {
                            "@type": "ImageObject",
                            "inLanguage": "en-US",
                            "@id": `${orgUrl}/#/schema/logo/image/`,
                            "url": authorOrgLogo,
                            "contentUrl": authorOrgLogo,
                            "caption": authorOrgName
                        },
                        "image": { "@id": `${orgUrl}/#/schema/logo/image/` }
                    })
                },
                // Person
                {
                    "@type": "Person",
                    "@id": `${baseUrl}/#person`,
                    "name": authorName,
                    ...(authorJobTitle && { "jobTitle": authorJobTitle }),
                    ...(authorEmail && { "email": authorEmail }),
                    ...(authorDescription && { "description": authorDescription }),
                    "affiliation": {
                        "@type": "Organization",
                        "name": authorOrgName || "Organization"
                    },
                    "worksFor": {
                        "@type": "Organization",
                        "name": authorOrgName || "Organization"
                    },
                    ...(authorAlumniOf && {
                        "alumniOf": {
                            "@type": "EducationalOrganization",
                            "name": authorAlumniOf
                        }
                    }),
                    ...(authorAward && { "award": authorAward }),
                    ...(authorCredential && {
                        "hasCredential": {
                            "@type": "EducationalOccupationalCredential",
                            "name": authorCredential,
                            "credentialCategory": "Degree"
                        }
                    }),
                    ...(authorSkills.filter(s => s.trim()).length > 0 && {
                        "hasOccupation": {
                            "@type": "Occupation",
                            "name": authorJobTitle || "Professional",
                            "skills": authorSkills.filter(s => s.trim())
                        }
                    }),
                    ...(authorKnowsAbout.filter(k => k.trim()).length > 0 && {
                        "knowsAbout": authorKnowsAbout.filter(k => k.trim())
                    }),
                    "knowsLanguage": ["English"],
                    ...((authorStreet || authorCity) && {
                        "workLocation": {
                            "@type": "Place",
                            "address": {
                                "@type": "PostalAddress",
                                ...(authorStreet && { "streetAddress": authorStreet }),
                                ...(authorCity && { "addressLocality": authorCity }),
                                ...(authorRegion && { "addressRegion": authorRegion }),
                                ...(authorPostalCode && { "postalCode": authorPostalCode }),
                                ...(authorCountry && {
                                    "addressCountry": {
                                        "@type": "Country",
                                        "name": authorCountry
                                    }
                                })
                            }
                        }
                    }),
                    ...(authorSameAs.filter(s => s.trim()).length > 0 && {
                        "sameAs": authorSameAs.filter(s => s.trim())
                    }),
                    ...(authorImage && {
                        "image": {
                            "@type": "ImageObject",
                            "inLanguage": "en-US",
                            "@id": `${baseUrl}/#/schema/person/image/`,
                            "url": authorImage,
                            "contentUrl": authorImage,
                            "caption": authorName
                        }
                    }),
                    "mainEntityOfPage": { "@id": `${baseUrl}/` }
                }
            ]
        };
        setGeneratedSchema(schema);
    };

    // Event Schema Generator
    const generateEventSchema = () => {
        if (!eventName.trim()) return;

        const schema = {
            "@context": "https://schema.org",
            "@type": eventType,
            "name": eventName,
            ...(eventDescription && { "description": eventDescription }),
            ...(eventUrl && { "url": eventUrl }),
            ...(eventImage && { "image": eventImage }),
            ...(eventStartDate && { "startDate": eventStartDate }),
            ...(eventEndDate && { "endDate": eventEndDate }),
            ...(eventLocationName && {
                "location": {
                    "@type": "Place",
                    "name": eventLocationName,
                    ...(eventLocationAddress && {
                        "address": {
                            "@type": "PostalAddress",
                            "streetAddress": eventLocationAddress
                        }
                    })
                }
            }),
            ...(eventOrganizer && {
                "organizer": {
                    "@type": "Organization",
                    "name": eventOrganizer
                }
            }),
            ...(eventPerformers.filter(p => p.trim()).length > 0 && {
                "performer": eventPerformers.filter(p => p.trim()).map(p => ({
                    "@type": "Person",
                    "name": p
                }))
            }),
            ...(eventTicketPrice && {
                "offers": {
                    "@type": "Offer",
                    "price": eventTicketPrice,
                    "priceCurrency": eventTicketCurrency,
                    ...(eventTicketUrl && { "url": eventTicketUrl }),
                    "availability": "https://schema.org/InStock"
                }
            })
        };
        setGeneratedSchema(schema);
    };

    // Advanced Organization Schema Generator (AI-powered)
    const generateAdvancedOrganizationSchema = async () => {
        if (!advOrgName.trim()) return;
        setIsGenerating(true);
        setGeneratedSchema(null);

        try {
            const servicesJson = JSON.stringify(advOrgServices.filter(s => s.name.trim()));
            const areasJson = JSON.stringify(advOrgAreasServed.filter(a => a.city.trim()));
            const knowsAboutList = advOrgKnowsAbout.filter(k => k.trim()).join(', ');
            const sameAsList = advOrgSameAs.filter(s => s.trim());
            const additionalTypesList = advOrgAdditionalTypes.filter(t => t.trim());

            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate a comprehensive Schema.org Organization JSON-LD schema with these details:

Business Name: ${advOrgName}
Legal Name: ${advOrgLegalName || advOrgName}
Alternate Name: ${advOrgAlternateName}
Organization Type: ${advOrgType}
Additional Types (include Wikipedia/Wikidata links): ${additionalTypesList.join(', ')}
Description: ${advOrgDescription}
Disambiguating Description: ${advOrgDisambiguating}
Slogan: ${advOrgSlogan}
URL: ${advOrgUrl}
Logo URL: ${advOrgLogo}
Image URL: ${advOrgImage}
Phone: ${advOrgPhone}
Email: ${advOrgEmail}
Address: ${advOrgStreet}, ${advOrgCity}, ${advOrgRegion} ${advOrgPostalCode}, ${advOrgCountry}
Founding Date: ${advOrgFoundingDate}
Founding Location: ${advOrgFoundingLocation}

KnowsAbout Topics (add Wikipedia/Wikidata URLs for each): ${knowsAboutList}
SameAs Social Profiles: ${sameAsList.join(', ')}
Areas Served (cities with postal codes): ${areasJson}
Services Offered: ${servicesJson}

Requirements:
1. Use @id references for linking entities
2. Generate additionalType array with Schema.org types AND Wikipedia/Wikidata URLs
3. Generate knowsAbout array mixing text terms with Wikipedia/Wikidata URLs
4. Structure areaServed with AdministrativeArea, GeoShape, and containsPlace for cities
5. Create hasOfferCatalog with OfferCatalog containing Offer items (each Offer has itemOffered pointing to Service)
6. Include complete PostalAddress structure
7. Add ImageObject for logo and image with @id
8. Add ContactPoint for customer service
9. IMPORTANT: Do NOT use availableFor or eligibleCustomerType on Offer (these cause validation errors). Put audience information on the Service using serviceAudience or audience property instead.

Return ONLY valid JSON-LD, no markdown or explanation.`
                })
            });

            const data = await response.json();
            try {
                const cleanResponse = data.text.replace(/```json\n?|```\n?/g, '').trim();
                const schema = JSON.parse(cleanResponse);
                setGeneratedSchema(schema);
            } catch (e) {
                console.error('Failed to parse AI response:', e);
                alert('Failed to generate schema. Please try again.');
            }
        } catch (error) {
            console.error('Advanced organization schema generation failed:', error);
            alert('Failed to generate schema. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    // Advanced Local Business Schema Generator (AI-powered)
    const generateAdvancedLocalBusinessSchema = async () => {
        if (!advLbName.trim()) return;
        setIsGenerating(true);
        setGeneratedSchema(null);

        try {
            const servicesJson = JSON.stringify(advLbServices.filter(s => s.name.trim()));
            const areasJson = JSON.stringify(advLbAreasServed.filter(a => a.city.trim()));
            const hoursJson = JSON.stringify(advLbOpeningHours);
            const awardsJson = JSON.stringify(advLbAwards.filter(a => a.trim()));
            const knowsAboutList = advLbKnowsAbout.filter(k => k.trim()).join(', ');
            const sameAsList = advLbSameAs.filter(s => s.trim());
            const additionalTypesList = advLbAdditionalTypes.filter(t => t.trim());

            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate a comprehensive Schema.org LocalBusiness JSON-LD schema with these details:

Business Name: ${advLbName}
Legal Name: ${advLbLegalName || advLbName}
Business Type: ${advLbType}
Additional Types (include Wikipedia/Wikidata links): ${additionalTypesList.join(', ')}
Description: ${advLbDescription}
Disambiguating Description: ${advLbDisambiguating}
Slogan: ${advLbSlogan}
URL: ${advLbUrl}
Logo URL: ${advLbLogo}
Image URL: ${advLbImage}
Phone: ${advLbPhone}
Email: ${advLbEmail}
Address: ${advLbStreet}, ${advLbCity}, ${advLbRegion} ${advLbPostalCode}, ${advLbCountry}
Price Range: ${advLbPriceRange}
Payment Accepted: ${advLbPaymentAccepted}
Google Maps URL: ${advLbGoogleMapsUrl}
Parent Organization @id: ${advLbParentOrg}

Opening Hours: ${hoursJson}
Awards: ${awardsJson}
KnowsAbout Topics (add Wikipedia/Wikidata URLs): ${knowsAboutList}
SameAs Social Profiles: ${sameAsList.join(', ')}
Areas Served (cities with postal codes): ${areasJson}
Services Offered: ${servicesJson}

Requirements:
1. Use @id for organization reference at ${advLbUrl}#localbusiness
2. Generate additionalType array with Schema.org types AND Wikipedia/Wikidata URLs
3. Generate knowsAbout array mixing text terms with Wikipedia/Wikidata URLs
4. Structure areaServed with AdministrativeArea, geo GeoShape with postalcode array, and containsPlace for cities
5. Create hasOfferCatalog with OfferCatalog containing Offer items (each Offer has itemOffered pointing to Service with brand, provider, serviceType, areaServed references)
6. Include complete PostalAddress structure
7. Add openingHoursSpecification array
8. Add award array
9. Add hasMap with Google Maps URL
10. Add parentOrganization reference if provided
11. Include priceRange and paymentAccepted
12. IMPORTANT: Do NOT use availableFor or eligibleCustomerType on Offer (these cause validation errors). Put audience information on the Service using serviceAudience or audience property instead.

Return ONLY valid JSON-LD, no markdown or explanation.`
                })
            });

            const data = await response.json();
            try {
                const cleanResponse = data.text.replace(/```json\n?|```\n?/g, '').trim();
                const schema = JSON.parse(cleanResponse);
                setGeneratedSchema(schema);
            } catch (e) {
                console.error('Failed to parse AI response:', e);
                alert('Failed to generate schema. Please try again.');
            }
        } catch (error) {
            console.error('Advanced local business schema generation failed:', error);
            alert('Failed to generate schema. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    // Advanced Service Schema Generator (AI-powered)
    const generateAdvancedServiceSchema = async () => {
        if (!advSvcName.trim()) return;
        setIsGenerating(true);
        setGeneratedSchema(null);

        try {
            const subServicesJson = JSON.stringify(advSvcSubServices.filter(s => s.name.trim()));

            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate a comprehensive Schema.org Service JSON-LD schema with these details:

Service Name: ${advSvcName}
Description: ${advSvcDescription}
Service URL: ${advSvcUrl}
Provider @id: ${advSvcProvider}
Brand @id: ${advSvcBrand}
Target Audience: ${advSvcAudience}
Service Type: ${advSvcType}
Area Served @id: ${advSvcAreaServedRef}

Sub-Services (for hasOfferCatalog): ${subServicesJson}

Requirements:
1. Use @id for the service at ${advSvcUrl}
2. Reference provider and brand using @id format
3. Create hasOfferCatalog with OfferCatalog containing itemListElement
4. Each sub-service should be an Offer with itemOffered Service
5. Include audience, serviceType, areaServed for each service
6. Use @id references for areaServed

Return ONLY valid JSON-LD, no markdown or explanation.`
                })
            });

            const data = await response.json();
            try {
                const cleanResponse = data.text.replace(/```json\n?|```\n?/g, '').trim();
                const schema = JSON.parse(cleanResponse);
                setGeneratedSchema(schema);
            } catch (e) {
                console.error('Failed to parse AI response:', e);
                alert('Failed to generate schema. Please try again.');
            }
        } catch (error) {
            console.error('Advanced service schema generation failed:', error);
            alert('Failed to generate schema. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    // Advanced WebPage Schema Generator (AI-powered)
    const generateAdvancedWebPageSchema = async () => {
        if (!advWpUrl.trim()) return;
        setIsGenerating(true);
        setGeneratedSchema(null);

        try {
            const aboutJson = JSON.stringify(advWpAboutEntities.filter(e => e.name.trim()));
            const mentionsJson = JSON.stringify(advWpMentionsEntities.filter(e => e.name.trim()));

            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate a comprehensive Schema.org WebPage JSON-LD schema with these details:

Page URL (@id): ${advWpUrl}
Page Name: ${advWpName}
Description: ${advWpDescription}
Publisher @id: ${advWpPublisher}

About Entities (generate Wikipedia and Knowledge Graph URLs): ${aboutJson}
Mentions Entities (generate Wikipedia and Knowledge Graph URLs): ${mentionsJson}

Requirements:
1. Use @id for the page at ${advWpUrl}
2. Reference publisher using @id format
3. Generate "about" array with Thing entities, each having:
   - @type: Thing
   - name: entity name
   - sameAs: array with Wikipedia URL and Google Knowledge Graph URL (/search?q=name&kgmid=/m/xxxx)
4. Generate "mentions" array with same structure as about
5. For each entity, generate appropriate Wikipedia URL (https://en.wikipedia.org/wiki/Entity_Name)
6. For each entity, generate Knowledge Graph search URL

Return ONLY valid JSON-LD, no markdown or explanation.`
                })
            });

            const data = await response.json();
            try {
                const cleanResponse = data.text.replace(/```json\n?|```\n?/g, '').trim();
                const schema = JSON.parse(cleanResponse);
                setGeneratedSchema(schema);
            } catch (e) {
                console.error('Failed to parse AI response:', e);
                alert('Failed to generate schema. Please try again.');
            }
        } catch (error) {
            console.error('Advanced webpage schema generation failed:', error);
            alert('Failed to generate schema. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    // SoftwareApplication Schema Generator
    const generateSoftwareApplicationSchema = () => {
        const schema = {
            "@context": "https://schema.org",
            "@type": softwareType || "SoftwareApplication",
            "name": softwareName,
            "description": softwareDescription,
            "applicationCategory": softwareCategory || "Application",
            "operatingSystem": softwareOS,
            "softwareVersion": softwareVersion,
            "url": softwareUrl,
            "image": softwareImage,
            "downloadUrl": softwareDownloadUrl,
            "featureList": softwareFeatures.filter(f => f.trim()),
            "screenshot": softwareScreenshots.filter(s => s.trim()),
            "offers": {
                "@type": "Offer",
                "price": softwarePrice || "0",
                "priceCurrency": softwareCurrency
            }
        };

        if (softwareRating && softwareRatingCount) {
            schema.aggregateRating = {
                "@type": "AggregateRating",
                "ratingValue": softwareRating,
                "ratingCount": softwareRatingCount,
                "bestRating": "5",
                "worstRating": "1"
            };
        }

        if (softwareAuthor) {
            schema.author = {
                "@type": "Organization",
                "name": softwareAuthor
            };
        }

        // Clean up empty values
        Object.keys(schema).forEach(key => {
            if (schema[key] === '' || (Array.isArray(schema[key]) && schema[key].length === 0)) {
                delete schema[key];
            }
        });

        setGeneratedSchema(schema);
    };

    // MobileApplication Schema Generator
    const generateMobileApplicationSchema = () => {
        const schema = {
            "@context": "https://schema.org",
            "@type": "MobileApplication",
            "name": mobileAppName,
            "description": mobileAppDescription,
            "applicationCategory": mobileAppCategory || "Application",
            "operatingSystem": mobileAppOS,
            "softwareVersion": mobileAppVersion,
            "url": mobileAppUrl,
            "image": mobileAppImage,
            "featureList": mobileAppFeatures.filter(f => f.trim()),
            "screenshot": mobileAppScreenshots.filter(s => s.trim()),
            "offers": {
                "@type": "Offer",
                "price": mobileAppPrice || "0",
                "priceCurrency": mobileAppCurrency
            }
        };

        // Add install URLs
        const installUrls = [];
        if (mobileAppStoreUrl) installUrls.push(mobileAppStoreUrl);
        if (mobilePlayStoreUrl) installUrls.push(mobilePlayStoreUrl);
        if (installUrls.length > 0) {
            schema.installUrl = installUrls;
        }

        if (mobileAppRating && mobileAppRatingCount) {
            schema.aggregateRating = {
                "@type": "AggregateRating",
                "ratingValue": mobileAppRating,
                "ratingCount": mobileAppRatingCount,
                "bestRating": "5",
                "worstRating": "1"
            };
        }

        if (mobileAppAuthor) {
            schema.author = {
                "@type": "Organization",
                "name": mobileAppAuthor
            };
        }

        // Clean up empty values
        Object.keys(schema).forEach(key => {
            if (schema[key] === '' || (Array.isArray(schema[key]) && schema[key].length === 0)) {
                delete schema[key];
            }
        });

        setGeneratedSchema(schema);
    };

    const renderEntityForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('entity', 'from-brand-500/[0.04] to-transparent', 'border-white/[0.08]')}
            <div>
                <label className="schema-label">
                    Article URL (Canonical) *
                </label>
                <input
                    type="url"
                    value={articleUrl}
                    onChange={(e) => setArticleUrl(e.target.value)}
                    placeholder="https://example.com/your-article"
                    className="schema-input schema-input-lg"
                />
                <p className="schema-hint">The canonical URL of your article (domain is extracted automatically)</p>
            </div>
            <div>
                <label className="schema-label">
                    Article Description
                </label>
                <input
                    type="text"
                    value={articleDescription}
                    onChange={(e) => setArticleDescription(e.target.value)}
                    placeholder="Brief description of your article for rich results"
                    className="schema-input schema-input-lg"
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">
                        Featured Image URL
                    </label>
                    <input
                        type="url"
                        value={articleImage}
                        onChange={(e) => setArticleImage(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">
                        Logo URL
                    </label>
                    <input
                        type="url"
                        value={entityLogoUrl}
                        onChange={(e) => setEntityLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="schema-label">
                        Author Page URL
                    </label>
                    <input
                        type="url"
                        value={entityAuthorUrl}
                        onChange={(e) => setEntityAuthorUrl(e.target.value)}
                        placeholder="https://example.com/about"
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">
                        Date Published
                    </label>
                    <input
                        type="date"
                        value={entityDatePublished}
                        onChange={(e) => setEntityDatePublished(e.target.value)}
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">
                        Date Modified
                    </label>
                    <input
                        type="date"
                        value={entityDateModified}
                        onChange={(e) => setEntityDateModified(e.target.value)}
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>
            {/* Advanced EEAT Section */}
            <div className="border-t border-white/[0.08] pt-4 mt-4">
                <p className="text-xs font-semibold text-brand-300 mb-3">⭐ Advanced EEAT (Optional)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="schema-label">
                            Author Name
                        </label>
                        <input
                            type="text"
                            value={entityAuthorName}
                            onChange={(e) => setEntityAuthorName(e.target.value)}
                            placeholder="John Smith"
                            className="schema-input schema-input-lg"
                        />
                        <p className="schema-hint">Creates Person author (stronger EEAT)</p>
                    </div>
                    <div>
                        <label className="schema-label">
                            Author Job Title
                        </label>
                        <input
                            type="text"
                            value={entityAuthorJobTitle}
                            onChange={(e) => setEntityAuthorJobTitle(e.target.value)}
                            placeholder="Senior Construction Engineer"
                            className="schema-input schema-input-lg"
                        />
                    </div>
                </div>
                <div className="mt-4">
                    <label className="schema-label">
                        Social Links (comma-separated)
                    </label>
                    <input
                        type="text"
                        value={entitySocialLinks}
                        onChange={(e) => setEntitySocialLinks(e.target.value)}
                        placeholder="https://linkedin.com/company/yourco, https://facebook.com/yourpage"
                        className="schema-input schema-input-lg"
                    />
                    <p className="schema-hint">Added to Organization sameAs for social proof</p>
                </div>
            </div>
            <div>
                <label className="schema-label">
                    Paste Article Content
                </label>
                <textarea
                    value={entityArticle}
                    onChange={(e) => setEntityArticle(e.target.value)}
                    placeholder="Paste your article content here. AI will extract entities (people, organizations, places, concepts) and link them to authoritative sources like Wikipedia and Wikidata..."
                    className="schema-input h-48"
                />
            </div>
            {/* Warning Banner */}
            <div className="schema-note flex items-start gap-2">
                <span className="schema-note-text">⚠️</span>
                <p className="schema-note-text">
                    <strong>Important:</strong> Always test the generated schema in{' '}
                    <a
                        href="https://validator.schema.org/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="schema-note-link"
                    >
                        validator.schema.org
                    </a>
                    {' '}before using on your website.
                </p>
            </div>
            <button
                onClick={generateEntitySchema}
                disabled={!entityArticle.trim() || isGenerating}
                className="ui-button ui-button-primary w-full"
            >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {isGenerating ? 'Generating Entity Schema...' : 'Generate Entity Schema'}
            </button>
        </div>
    );

    const renderLocalBusinessForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('localBusiness', 'from-brand-500/[0.04] to-transparent', 'border-white/[0.08]')}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Business Name *</label>
                    <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g., Joe's Pizza"
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">Phone</label>
                    <input
                        type="tel"
                        value={businessPhone}
                        onChange={(e) => setBusinessPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>
            <div>
                <label className="schema-label">Full Address</label>
                <input
                    type="text"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    placeholder="123 Main St, New York, NY 10001, USA"
                    className="schema-input schema-input-lg"
                />
            </div>
            <div>
                <label className="schema-label">Website URL</label>
                <input
                    type="url"
                    value={businessWebsite}
                    onChange={(e) => setBusinessWebsite(e.target.value)}
                    placeholder="https://www.example.com"
                    className="schema-input schema-input-lg"
                />
            </div>
            <div>
                <label className="schema-label">Business Description</label>
                <textarea
                    value={businessDescription}
                    onChange={(e) => setBusinessDescription(e.target.value)}
                    placeholder="Describe what your business does..."
                    className="schema-input h-24"
                />
            </div>
            <button
                onClick={generateLocalBusinessSchema}
                disabled={!businessName.trim() || isGenerating}
                className="ui-button ui-button-primary w-full"
            >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Building2 className="w-5 h-5" />}
                {isGenerating ? 'Generating Schema...' : 'Generate with AI'}
            </button>
        </div>
    );

    const renderBreadcrumbForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('breadcrumb', 'from-brand-500/[0.04] to-transparent', 'border-white/[0.08]')}
            <div className="space-y-3">
                {breadcrumbItems.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                        <span className="schema-index">{idx + 1}</span>
                        <input
                            type="text"
                            value={item.name}
                            onChange={(e) => {
                                const newItems = [...breadcrumbItems];
                                newItems[idx].name = e.target.value;
                                setBreadcrumbItems(newItems);
                            }}
                            placeholder="Page Name"
                            className="schema-input flex-1"
                        />
                        <input
                            type="url"
                            value={item.url}
                            onChange={(e) => {
                                const newItems = [...breadcrumbItems];
                                newItems[idx].url = e.target.value;
                                setBreadcrumbItems(newItems);
                            }}
                            placeholder="URL (optional for last item)"
                            className="schema-input flex-1"
                        />
                        {breadcrumbItems.length > 1 && (
                            <button
                                onClick={() => setBreadcrumbItems(breadcrumbItems.filter((_, i) => i !== idx))}
                                className="ui-button schema-remove"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
            <button
                onClick={() => setBreadcrumbItems([...breadcrumbItems, { name: '', url: '' }])}
                className="schema-addlink"
            >
                <Plus className="w-4 h-4" /> Add Breadcrumb Item
            </button>
            <button
                onClick={generateBreadcrumbSchema}
                className="ui-button ui-button-primary w-full"
            >
                <List className="w-5 h-5" />
                Generate Breadcrumb Schema
            </button>
        </div>
    );

    const renderNavigationForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('navigation', 'from-brand-500/[0.04] to-transparent', 'border-white/[0.08]')}
            <div className="space-y-3">
                {navItems.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                        <input
                            type="text"
                            value={item.name}
                            onChange={(e) => {
                                const newItems = [...navItems];
                                newItems[idx].name = e.target.value;
                                setNavItems(newItems);
                            }}
                            placeholder="Menu Item Name"
                            className="schema-input flex-1"
                        />
                        <input
                            type="url"
                            value={item.url}
                            onChange={(e) => {
                                const newItems = [...navItems];
                                newItems[idx].url = e.target.value;
                                setNavItems(newItems);
                            }}
                            placeholder="URL"
                            className="schema-input flex-1"
                        />
                        {navItems.length > 1 && (
                            <button
                                onClick={() => setNavItems(navItems.filter((_, i) => i !== idx))}
                                className="ui-button schema-remove"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
            <button
                onClick={() => setNavItems([...navItems, { name: '', url: '' }])}
                className="schema-note-title flex items-center gap-2"
            >
                <Plus className="w-4 h-4" /> Add Navigation Item
            </button>
            <button
                onClick={generateNavigationSchema}
                className="ui-button ui-button-primary w-full"
            >
                <Navigation className="w-5 h-5" />
                Generate Navigation Schema
            </button>
        </div>
    );

    const renderFAQForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('faq', 'from-brand-500/[0.04] to-transparent', 'border-white/[0.08]')}
            <div className="space-y-4">
                {faqItems.map((item, idx) => (
                    <div key={idx} className="p-4 bg-pink-50 rounded-xl border border-white/[0.08]">
                        <div className="flex justify-between items-start mb-3">
                            <span className="schema-index-label">Q{idx + 1}</span>
                            {faqItems.length > 1 && (
                                <button
                                    onClick={() => setFaqItems(faqItems.filter((_, i) => i !== idx))}
                                    className="ui-button schema-remove"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <input
                            type="text"
                            value={item.question}
                            onChange={(e) => {
                                const newItems = [...faqItems];
                                newItems[idx].question = e.target.value;
                                setFaqItems(newItems);
                            }}
                            placeholder="Question"
                            className="w-full px-4 py-2.5 border border-white/[0.08] rounded-lg mb-2 bg-white"
                        />
                        <textarea
                            value={item.answer}
                            onChange={(e) => {
                                const newItems = [...faqItems];
                                newItems[idx].answer = e.target.value;
                                setFaqItems(newItems);
                            }}
                            placeholder="Answer"
                            className="w-full h-20 p-3 border border-white/[0.08] rounded-lg bg-white"
                        />
                    </div>
                ))}
            </div>
            <button
                onClick={() => setFaqItems([...faqItems, { question: '', answer: '' }])}
                className="schema-addlink"
            >
                <Plus className="w-4 h-4" /> Add FAQ Item
            </button>
            <button
                onClick={generateFAQSchema}
                className="ui-button ui-button-primary w-full"
            >
                <HelpCircle className="w-5 h-5" />
                Generate FAQ Schema
            </button>
        </div>
    );

    const renderArticleForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('article', 'from-brand-500/[0.04] to-transparent', 'border-white/[0.08]')}
            <div>
                <label className="schema-label">Article Title *</label>
                <input
                    type="text"
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                    placeholder="The Complete Guide to SEO"
                    className="schema-input schema-input-lg"
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Author Name</label>
                    <input
                        type="text"
                        value={articleAuthor}
                        onChange={(e) => setArticleAuthor(e.target.value)}
                        placeholder="John Doe"
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">Article URL</label>
                    <input
                        type="url"
                        value={articleUrl}
                        onChange={(e) => setArticleUrl(e.target.value)}
                        placeholder="https://example.com/article"
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Date Published</label>
                    <input
                        type="date"
                        value={articleDatePublished}
                        onChange={(e) => setArticleDatePublished(e.target.value)}
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">Date Modified</label>
                    <input
                        type="date"
                        value={articleDateModified}
                        onChange={(e) => setArticleDateModified(e.target.value)}
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>
            <div>
                <label className="schema-label">Featured Image URL</label>
                <input
                    type="url"
                    value={articleImage}
                    onChange={(e) => setArticleImage(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="schema-input schema-input-lg"
                />
            </div>
            <div>
                <label className="schema-label">Description</label>
                <textarea
                    value={articleDescription}
                    onChange={(e) => setArticleDescription(e.target.value)}
                    placeholder="Brief description of the article..."
                    className="schema-input h-20"
                />
            </div>
            <button
                onClick={generateArticleSchema}
                disabled={!articleTitle.trim()}
                className="ui-button ui-button-primary w-full"
            >
                <FileText className="w-5 h-5" />
                Generate Article Schema
            </button>
        </div>
    );

    const renderProductForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('product', 'from-brand-500/[0.04] to-transparent', 'border-white/[0.08]')}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Product Name *</label>
                    <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="iPhone 15 Pro"
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">Brand</label>
                    <input
                        type="text"
                        value={productBrand}
                        onChange={(e) => setProductBrand(e.target.value)}
                        placeholder="Apple"
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="schema-label">Price</label>
                    <input
                        type="number"
                        value={productPrice}
                        onChange={(e) => setProductPrice(e.target.value)}
                        placeholder="999.00"
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">Currency</label>
                    <select
                        value={productCurrency}
                        onChange={(e) => setProductCurrency(e.target.value)}
                        className="schema-input schema-input-lg bg-white"
                    >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="PKR">PKR</option>
                    </select>
                </div>
                <div>
                    <label className="schema-label">Availability</label>
                    <select
                        value={productAvailability}
                        onChange={(e) => setProductAvailability(e.target.value)}
                        className="schema-input schema-input-lg bg-white"
                    >
                        <option value="InStock">In Stock</option>
                        <option value="OutOfStock">Out of Stock</option>
                        <option value="PreOrder">Pre-Order</option>
                        <option value="LimitedAvailability">Limited</option>
                    </select>
                </div>
            </div>
            <div>
                <label className="schema-label">Product Image URL</label>
                <input
                    type="url"
                    value={productImage}
                    onChange={(e) => setProductImage(e.target.value)}
                    placeholder="https://example.com/product.jpg"
                    className="schema-input schema-input-lg"
                />
            </div>
            <div>
                <label className="schema-label">Description</label>
                <textarea
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    placeholder="Product description..."
                    className="schema-input h-20"
                />
            </div>
            <button
                onClick={generateProductSchema}
                disabled={!productName.trim()}
                className="ui-button ui-button-primary w-full"
            >
                <ShoppingBag className="w-5 h-5" />
                Generate Product Schema
            </button>
        </div>
    );

    const renderOrganizationForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('organization', 'from-slate-50 to-gray-100', 'border-white/[0.08]')}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Organization Name *</label>
                    <input
                        type="text"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Acme Corporation"
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">Website URL</label>
                    <input
                        type="url"
                        value={orgUrl}
                        onChange={(e) => setOrgUrl(e.target.value)}
                        placeholder="https://acme.com"
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>
            <div>
                <label className="schema-label">Logo URL</label>
                <input
                    type="url"
                    value={orgLogo}
                    onChange={(e) => setOrgLogo(e.target.value)}
                    placeholder="https://acme.com/logo.png"
                    className="schema-input schema-input-lg"
                />
            </div>
            <div>
                <label className="schema-label">Description</label>
                <textarea
                    value={orgDescription}
                    onChange={(e) => setOrgDescription(e.target.value)}
                    placeholder="Organization description..."
                    className="schema-input h-20"
                />
            </div>
            <div>
                <label className="schema-label">Social Profiles (sameAs)</label>
                {orgSameAs.map((url, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => {
                                const newUrls = [...orgSameAs];
                                newUrls[idx] = e.target.value;
                                setOrgSameAs(newUrls);
                            }}
                            placeholder="https://linkedin.com/company/..."
                            className="schema-input flex-1"
                        />
                        {orgSameAs.length > 1 && (
                            <button
                                onClick={() => setOrgSameAs(orgSameAs.filter((_, i) => i !== idx))}
                                className="ui-button schema-remove"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
                <button
                    onClick={() => setOrgSameAs([...orgSameAs, ''])}
                    className="schema-addlink"
                >
                    <Plus className="w-4 h-4" /> Add Social Profile
                </button>
            </div>
            <button
                onClick={generateOrganizationSchema}
                disabled={!orgName.trim()}
                className="ui-button ui-button-primary w-full"
            >
                <Building className="w-5 h-5" />
                Generate Organization Schema
            </button>
        </div>
    );

    const renderPersonForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('person', 'from-brand-500/[0.04] to-transparent', 'border-white/[0.08]')}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Full Name *</label>
                    <input
                        type="text"
                        value={personName}
                        onChange={(e) => setPersonName(e.target.value)}
                        placeholder="John Doe"
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">Job Title</label>
                    <input
                        type="text"
                        value={personJobTitle}
                        onChange={(e) => setPersonJobTitle(e.target.value)}
                        placeholder="SEO Specialist"
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Profile URL</label>
                    <input
                        type="url"
                        value={personUrl}
                        onChange={(e) => setPersonUrl(e.target.value)}
                        placeholder="https://example.com/about"
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">Photo URL</label>
                    <input
                        type="url"
                        value={personImage}
                        onChange={(e) => setPersonImage(e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>
            <div>
                <label className="schema-label">Social Profiles (sameAs)</label>
                {personSameAs.map((url, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => {
                                const newUrls = [...personSameAs];
                                newUrls[idx] = e.target.value;
                                setPersonSameAs(newUrls);
                            }}
                            placeholder="https://linkedin.com/in/..."
                            className="schema-input flex-1"
                        />
                        {personSameAs.length > 1 && (
                            <button
                                onClick={() => setPersonSameAs(personSameAs.filter((_, i) => i !== idx))}
                                className="ui-button schema-remove"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
                <button
                    onClick={() => setPersonSameAs([...personSameAs, ''])}
                    className="schema-addlink"
                >
                    <Plus className="w-4 h-4" /> Add Social Profile
                </button>
            </div>
            <button
                onClick={generatePersonSchema}
                disabled={!personName.trim()}
                className="ui-button ui-button-primary w-full"
            >
                <User className="w-5 h-5" />
                Generate Person Schema
            </button>
        </div>
    );

    // ItemList (List View) Form
    const renderItemListForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('itemList', 'from-brand-500/[0.04] to-transparent', 'border-white/[0.08]')}
            <div>
                <label className="schema-label">List Title (Optional)</label>
                <input
                    type="text"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    placeholder="e.g., Top 10 SEO Tools"
                    className="schema-input schema-input-lg"
                />
            </div>
            <div className="space-y-3">
                {listItems.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                        <span className="schema-index">{idx + 1}</span>
                        <input
                            type="text"
                            value={item.name}
                            onChange={(e) => {
                                const newItems = [...listItems];
                                newItems[idx].name = e.target.value;
                                setListItems(newItems);
                            }}
                            placeholder="Item Name"
                            className="schema-input flex-1"
                        />
                        <input
                            type="url"
                            value={item.url}
                            onChange={(e) => {
                                const newItems = [...listItems];
                                newItems[idx].url = e.target.value;
                                setListItems(newItems);
                            }}
                            placeholder="URL (optional)"
                            className="schema-input flex-1"
                        />
                        {listItems.length > 1 && (
                            <button
                                onClick={() => setListItems(listItems.filter((_, i) => i !== idx))}
                                className="ui-button schema-remove"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
            <button
                onClick={() => setListItems([...listItems, { name: '', url: '', position: listItems.length + 1 }])}
                className="schema-addlink"
            >
                <Plus className="w-4 h-4" /> Add List Item
            </button>
            <button
                onClick={generateItemListSchema}
                className="ui-button ui-button-primary w-full"
            >
                <LayoutList className="w-5 h-5" />
                Generate List Schema
            </button>
        </div>
    );

    // AboutPage Form
    const renderAboutPageForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('aboutPage', 'from-brand-500/[0.04] to-transparent', 'border-white/[0.08]')}
            <div>
                <label className="schema-label">Organization Name *</label>
                <input
                    type="text"
                    value={aboutOrgName}
                    onChange={(e) => setAboutOrgName(e.target.value)}
                    placeholder="Your Company Name"
                    className="schema-input schema-input-lg"
                />
            </div>
            <div>
                <label className="schema-label">About Page URL</label>
                <input
                    type="url"
                    value={aboutUrl}
                    onChange={(e) => setAboutUrl(e.target.value)}
                    placeholder="https://example.com/about"
                    className="schema-input schema-input-lg"
                />
            </div>
            <div>
                <label className="schema-label">Description</label>
                <textarea
                    value={aboutDescription}
                    onChange={(e) => setAboutDescription(e.target.value)}
                    placeholder="About your company..."
                    className="w-full h-24 p-4 border border-white/[0.08] rounded-xl"
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Founding Date</label>
                    <input
                        type="date"
                        value={aboutFoundingDate}
                        onChange={(e) => setAboutFoundingDate(e.target.value)}
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">Image URL</label>
                    <input
                        type="url"
                        value={aboutImage}
                        onChange={(e) => setAboutImage(e.target.value)}
                        placeholder="https://example.com/team.jpg"
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>
            <div>
                <label className="schema-label">Founders</label>
                {aboutFounders.map((founder, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={founder}
                            onChange={(e) => {
                                const newFounders = [...aboutFounders];
                                newFounders[idx] = e.target.value;
                                setAboutFounders(newFounders);
                            }}
                            placeholder="Founder Name"
                            className="schema-input flex-1"
                        />
                        {aboutFounders.length > 1 && (
                            <button
                                onClick={() => setAboutFounders(aboutFounders.filter((_, i) => i !== idx))}
                                className="ui-button schema-remove"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
                <button
                    onClick={() => setAboutFounders([...aboutFounders, ''])}
                    className="schema-note-link"
                >
                    <Plus className="w-4 h-4" /> Add Founder
                </button>
            </div>
            <button
                onClick={generateAboutPageSchema}
                disabled={!aboutOrgName.trim()}
                className="ui-button ui-button-primary w-full"
            >
                <Info className="w-5 h-5" />
                Generate About Us Schema
            </button>
        </div>
    );

    // ContactPage Form
    const renderContactPageForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('contactPage', 'from-brand-500/[0.04] to-transparent', 'border-white/[0.08]')}
            <div>
                <label className="schema-label">Organization Name *</label>
                <input
                    type="text"
                    value={contactOrgName}
                    onChange={(e) => setContactOrgName(e.target.value)}
                    placeholder="Your Company Name"
                    className="schema-input schema-input-lg"
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Email</label>
                    <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="contact@example.com"
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">Phone</label>
                    <input
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>
            <div>
                <label className="schema-label">Address</label>
                <input
                    type="text"
                    value={contactAddress}
                    onChange={(e) => setContactAddress(e.target.value)}
                    placeholder="123 Main St, New York, NY 10001"
                    className="schema-input schema-input-lg"
                />
            </div>
            <div>
                <label className="schema-label">Contact Page URL</label>
                <input
                    type="url"
                    value={contactUrl}
                    onChange={(e) => setContactUrl(e.target.value)}
                    placeholder="https://example.com/contact"
                    className="schema-input schema-input-lg"
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Business Hours Start</label>
                    <input
                        type="time"
                        value={contactHoursStart}
                        onChange={(e) => setContactHoursStart(e.target.value)}
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">Business Hours End</label>
                    <input
                        type="time"
                        value={contactHoursEnd}
                        onChange={(e) => setContactHoursEnd(e.target.value)}
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>
            <button
                onClick={generateContactPageSchema}
                disabled={!contactOrgName.trim()}
                className="ui-button ui-button-primary w-full"
            >
                <Phone className="w-5 h-5" />
                Generate Contact Us Schema
            </button>
        </div>
    );

    const renderAuthorPageForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('authorPage', 'from-amber-50 to-yellow-50', 'border-white/[0.08]')}
            {/* Required Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Author Page URL *</label>
                    <input
                        type="url"
                        value={authorProfileUrl}
                        onChange={(e) => setAuthorProfileUrl(e.target.value)}
                        placeholder="https://example.com/author/john-doe"
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">Author Name *</label>
                    <input
                        type="text"
                        value={authorName}
                        onChange={(e) => setAuthorName(e.target.value)}
                        placeholder="John Doe"
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Job Title</label>
                    <input
                        type="text"
                        value={authorJobTitle}
                        onChange={(e) => setAuthorJobTitle(e.target.value)}
                        placeholder="Senior Writer"
                        className="schema-input schema-input-lg"
                    />
                </div>
                <div>
                    <label className="schema-label">Email</label>
                    <input
                        type="email"
                        value={authorEmail}
                        onChange={(e) => setAuthorEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>

            <div>
                <label className="schema-label">Author Bio/Description</label>
                <textarea
                    value={authorDescription}
                    onChange={(e) => setAuthorDescription(e.target.value)}
                    placeholder="Brief description of the author's background and expertise..."
                    className="schema-input h-20"
                />
            </div>

            <div>
                <label className="schema-label">Author Photo URL</label>
                <input
                    type="url"
                    value={authorImage}
                    onChange={(e) => setAuthorImage(e.target.value)}
                    placeholder="https://example.com/images/author.jpg"
                    className="schema-input schema-input-lg"
                />
            </div>

            {/* Organization */}
            <div className="border-t border-line pt-4 mt-4">
                <h4 className="schema-note-title">Organization Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="schema-label">Organization Name</label>
                        <input
                            type="text"
                            value={authorOrgName}
                            onChange={(e) => setAuthorOrgName(e.target.value)}
                            placeholder="Example Company"
                            className="schema-input schema-input-lg"
                        />
                    </div>
                    <div>
                        <label className="schema-label">Organization URL</label>
                        <input
                            type="url"
                            value={authorOrgUrl}
                            onChange={(e) => setAuthorOrgUrl(e.target.value)}
                            placeholder="https://example.com"
                            className="schema-input schema-input-lg"
                        />
                    </div>
                </div>
                <div className="mt-3">
                    <label className="schema-label">Organization Logo URL</label>
                    <input
                        type="url"
                        value={authorOrgLogo}
                        onChange={(e) => setAuthorOrgLogo(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>

            {/* Credentials */}
            <div className="border-t border-line pt-4 mt-4">
                <h4 className="schema-note-title">Credentials & Education</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="schema-label">Alumni Of (School)</label>
                        <input
                            type="text"
                            value={authorAlumniOf}
                            onChange={(e) => setAuthorAlumniOf(e.target.value)}
                            placeholder="Stanford University"
                            className="schema-input schema-input-lg"
                        />
                    </div>
                    <div>
                        <label className="schema-label">Credential/Degree</label>
                        <input
                            type="text"
                            value={authorCredential}
                            onChange={(e) => setAuthorCredential(e.target.value)}
                            placeholder="BS in Computer Science"
                            className="schema-input schema-input-lg"
                        />
                    </div>
                </div>
                <div className="mt-3">
                    <label className="schema-label">Award/Certification</label>
                    <input
                        type="text"
                        value={authorAward}
                        onChange={(e) => setAuthorAward(e.target.value)}
                        placeholder="Google Certified IT Expert"
                        className="schema-input schema-input-lg"
                    />
                </div>
            </div>

            {/* Skills */}
            <div className="border-t border-line pt-4 mt-4">
                <h4 className="schema-note-title">Skills</h4>
                {authorSkills.map((skill, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={skill}
                            onChange={(e) => {
                                const newSkills = [...authorSkills];
                                newSkills[idx] = e.target.value;
                                setAuthorSkills(newSkills);
                            }}
                            placeholder="Article Writing"
                            className="schema-input flex-1"
                        />
                        {authorSkills.length > 1 && (
                            <button
                                onClick={() => setAuthorSkills(authorSkills.filter((_, i) => i !== idx))}
                                className="ui-button schema-remove"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
                <button
                    onClick={() => setAuthorSkills([...authorSkills, ''])}
                    className="schema-note-link"
                >
                    <Plus className="w-4 h-4" /> Add Skill
                </button>
            </div>

            {/* Knows About */}
            <div className="border-t border-line pt-4 mt-4">
                <h4 className="schema-note-title">Expertise Topics (knowsAbout)</h4>
                {authorKnowsAbout.map((topic, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => {
                                const newTopics = [...authorKnowsAbout];
                                newTopics[idx] = e.target.value;
                                setAuthorKnowsAbout(newTopics);
                            }}
                            placeholder="SEO, Computer Hardware"
                            className="schema-input flex-1"
                        />
                        {authorKnowsAbout.length > 1 && (
                            <button
                                onClick={() => setAuthorKnowsAbout(authorKnowsAbout.filter((_, i) => i !== idx))}
                                className="ui-button schema-remove"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
                <button
                    onClick={() => setAuthorKnowsAbout([...authorKnowsAbout, ''])}
                    className="schema-note-link"
                >
                    <Plus className="w-4 h-4" /> Add Topic
                </button>
            </div>

            {/* Social Links */}
            <div className="border-t border-line pt-4 mt-4">
                <h4 className="schema-note-title">Social Links (sameAs)</h4>
                {authorSameAs.map((link, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                        <input
                            type="url"
                            value={link}
                            onChange={(e) => {
                                const newLinks = [...authorSameAs];
                                newLinks[idx] = e.target.value;
                                setAuthorSameAs(newLinks);
                            }}
                            placeholder="https://twitter.com/username"
                            className="schema-input flex-1"
                        />
                        {authorSameAs.length > 1 && (
                            <button
                                onClick={() => setAuthorSameAs(authorSameAs.filter((_, i) => i !== idx))}
                                className="ui-button schema-remove"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
                <button
                    onClick={() => setAuthorSameAs([...authorSameAs, ''])}
                    className="schema-note-link"
                >
                    <Plus className="w-4 h-4" /> Add Social Link
                </button>
            </div>

            {/* Work Location */}
            <div className="border-t border-line pt-4 mt-4">
                <h4 className="schema-note-title">Work Location (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="schema-label">Street Address</label>
                        <input
                            type="text"
                            value={authorStreet}
                            onChange={(e) => setAuthorStreet(e.target.value)}
                            placeholder="123 Main St"
                            className="schema-input schema-input-lg"
                        />
                    </div>
                    <div>
                        <label className="schema-label">City</label>
                        <input
                            type="text"
                            value={authorCity}
                            onChange={(e) => setAuthorCity(e.target.value)}
                            placeholder="New York"
                            className="schema-input schema-input-lg"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                    <div>
                        <label className="schema-label">Region/State</label>
                        <input
                            type="text"
                            value={authorRegion}
                            onChange={(e) => setAuthorRegion(e.target.value)}
                            placeholder="NY"
                            className="schema-input schema-input-lg"
                        />
                    </div>
                    <div>
                        <label className="schema-label">Postal Code</label>
                        <input
                            type="text"
                            value={authorPostalCode}
                            onChange={(e) => setAuthorPostalCode(e.target.value)}
                            placeholder="10001"
                            className="schema-input schema-input-lg"
                        />
                    </div>
                    <div>
                        <label className="schema-label">Country</label>
                        <input
                            type="text"
                            value={authorCountry}
                            onChange={(e) => setAuthorCountry(e.target.value)}
                            placeholder="United States"
                            className="schema-input schema-input-lg"
                        />
                    </div>
                </div>
            </div>

            <button
                onClick={generateAuthorPageSchema}
                disabled={!authorName.trim() || !authorProfileUrl.trim()}
                className="ui-button ui-button-primary w-full"
            >
                <UserCircle2 className="w-5 h-5" />
                Generate Author Page Schema
            </button>
        </div>
    );

    // Event Schema Form
    const renderEventForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('event', 'from-brand-500/[0.04] to-transparent', 'border-white/[0.08]')}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Event Name *</label>
                    <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Summer Music Festival" className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Event Type</label>
                    <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="schema-input">
                        <option value="Event">Event</option>
                        <option value="BusinessEvent">Business Event</option>
                        <option value="MusicEvent">Music Event</option>
                        <option value="Festival">Festival</option>
                        <option value="SportsEvent">Sports Event</option>
                        <option value="TheaterEvent">Theater Event</option>
                        <option value="EducationEvent">Education Event</option>
                        <option value="ExhibitionEvent">Exhibition Event</option>
                        <option value="Hackathon">Hackathon</option>
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Start Date/Time *</label>
                    <input type="datetime-local" value={eventStartDate} onChange={(e) => setEventStartDate(e.target.value)} className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">End Date/Time</label>
                    <input type="datetime-local" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} className="schema-input" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Location Name *</label>
                    <input type="text" value={eventLocationName} onChange={(e) => setEventLocationName(e.target.value)} placeholder="Convention Center" className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Location Address</label>
                    <input type="text" value={eventLocationAddress} onChange={(e) => setEventLocationAddress(e.target.value)} placeholder="123 Main St, City, State" className="schema-input" />
                </div>
            </div>
            <div>
                <label className="schema-label">Description</label>
                <textarea value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} placeholder="Event description..." className="schema-input h-24" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Event URL</label>
                    <input type="url" value={eventUrl} onChange={(e) => setEventUrl(e.target.value)} placeholder="https://..." className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Event Image URL</label>
                    <input type="url" value={eventImage} onChange={(e) => setEventImage(e.target.value)} placeholder="https://..." className="schema-input" />
                </div>
            </div>
            <div>
                <label className="schema-label">Organizer Name</label>
                <input type="text" value={eventOrganizer} onChange={(e) => setEventOrganizer(e.target.value)} placeholder="Acme Events LLC" className="schema-input" />
            </div>
            <div>
                <label className="schema-label">Performers</label>
                {eventPerformers.map((performer, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                        <input type="text" value={performer} onChange={(e) => { const n = [...eventPerformers]; n[i] = e.target.value; setEventPerformers(n); }} placeholder="Performer name" className="schema-input flex-1" />
                        {eventPerformers.length > 1 && <button onClick={() => setEventPerformers(eventPerformers.filter((_, idx) => idx !== i))} className="ui-button schema-remove"><Trash2 className="w-5 h-5" /></button>}
                    </div>
                ))}
                <button onClick={() => setEventPerformers([...eventPerformers, ''])} className="schema-addlink"><Plus className="w-4 h-4" /> Add Performer</button>
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="schema-label">Ticket Price</label>
                    <input type="number" value={eventTicketPrice} onChange={(e) => setEventTicketPrice(e.target.value)} placeholder="50" className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Currency</label>
                    <select value={eventTicketCurrency} onChange={(e) => setEventTicketCurrency(e.target.value)} className="schema-input">
                        <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="CAD">CAD</option><option value="AUD">AUD</option>
                    </select>
                </div>
                <div>
                    <label className="schema-label">Ticket URL</label>
                    <input type="url" value={eventTicketUrl} onChange={(e) => setEventTicketUrl(e.target.value)} placeholder="https://..." className="schema-input" />
                </div>
            </div>
            <button onClick={generateEventSchema} disabled={!eventName.trim()} className="ui-button ui-button-primary w-full">
                <Calendar className="w-5 h-5" /> Generate Event Schema
            </button>
        </div>
    );

    // Advanced Organization Schema Form
    const renderAdvancedOrganizationForm = () => (
        <div className="space-y-6">
            {renderQuickFillSection('advancedOrg', 'from-blue-500/10 to-indigo-500/10', 'border-white/[0.08]')}
            {/* Basic Info */}
            <div className="schema-note">
                <h4 className="schema-note-title">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="schema-label">Organization Name *</label><input type="text" value={advOrgName} onChange={(e) => setAdvOrgName(e.target.value)} placeholder="Acme Corporation" className="schema-input" /></div>
                    <div><label className="schema-label">Legal Name</label><input type="text" value={advOrgLegalName} onChange={(e) => setAdvOrgLegalName(e.target.value)} placeholder="Acme Corp LLC" className="schema-input" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                    <div><label className="schema-label">Alternate Name</label><input type="text" value={advOrgAlternateName} onChange={(e) => setAdvOrgAlternateName(e.target.value)} className="schema-input" /></div>
                    <div><label className="schema-label">Website URL *</label><input type="url" value={advOrgUrl} onChange={(e) => setAdvOrgUrl(e.target.value)} placeholder="https://example.com" className="schema-input" /></div>
                </div>
                <div className="mt-3"><label className="schema-label">Description</label><textarea value={advOrgDescription} onChange={(e) => setAdvOrgDescription(e.target.value)} className="schema-input h-20" /></div>
                <div className="mt-3"><label className="schema-label">Disambiguating Description</label><textarea value={advOrgDisambiguating} onChange={(e) => setAdvOrgDisambiguating(e.target.value)} placeholder="Detailed description for disambiguation..." className="schema-input h-20" /></div>
                <div className="mt-3"><label className="schema-label">Slogan</label><input type="text" value={advOrgSlogan} onChange={(e) => setAdvOrgSlogan(e.target.value)} className="schema-input" /></div>
            </div>
            {/* Contact */}
            <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                <h4 className="schema-note-title">Contact & Address</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="schema-label">Phone</label><input type="tel" value={advOrgPhone} onChange={(e) => setAdvOrgPhone(e.target.value)} className="schema-input" /></div>
                    <div><label className="schema-label">Email</label><input type="email" value={advOrgEmail} onChange={(e) => setAdvOrgEmail(e.target.value)} className="schema-input" /></div>
                </div>
                <div className="mt-3"><label className="schema-label">Street Address</label><input type="text" value={advOrgStreet} onChange={(e) => setAdvOrgStreet(e.target.value)} className="schema-input" /></div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                    <div><label className="schema-label">City</label><input type="text" value={advOrgCity} onChange={(e) => setAdvOrgCity(e.target.value)} className="schema-input" /></div>
                    <div><label className="schema-label">Region/State</label><input type="text" value={advOrgRegion} onChange={(e) => setAdvOrgRegion(e.target.value)} className="schema-input" /></div>
                    <div><label className="schema-label">Postal Code</label><input type="text" value={advOrgPostalCode} onChange={(e) => setAdvOrgPostalCode(e.target.value)} className="schema-input" /></div>
                </div>
            </div>
            {/* Media */}
            <div className="schema-note">
                <h4 className="schema-note-title">Media</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="schema-label">Logo URL</label><input type="url" value={advOrgLogo} onChange={(e) => setAdvOrgLogo(e.target.value)} className="schema-input" /></div>
                    <div><label className="schema-label">Image URL</label><input type="url" value={advOrgImage} onChange={(e) => setAdvOrgImage(e.target.value)} className="schema-input" /></div>
                </div>
            </div>
            {/* KnowsAbout */}
            <div className="schema-note">
                <h4 className="schema-note-title">Expertise (knowsAbout)</h4>
                <p className="schema-note-text mb-2">AI will auto-generate Wikipedia/Wikidata links for these topics</p>
                {advOrgKnowsAbout.map((item, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                        <input type="text" value={item} onChange={(e) => { const n = [...advOrgKnowsAbout]; n[i] = e.target.value; setAdvOrgKnowsAbout(n); }} placeholder="Topic or Wikipedia URL" className="schema-input flex-1" />
                        {advOrgKnowsAbout.length > 1 && <button onClick={() => setAdvOrgKnowsAbout(advOrgKnowsAbout.filter((_, idx) => idx !== i))} className="ui-button schema-remove"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                ))}
                <button onClick={() => setAdvOrgKnowsAbout([...advOrgKnowsAbout, ''])} className="schema-note-link"><Plus className="w-4 h-4" /> Add Topic</button>
            </div>
            {/* Social Links */}
            <div className="p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                <h4 className="schema-note-title">Social Profiles (sameAs)</h4>
                {advOrgSameAs.map((url, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                        <input type="url" value={url} onChange={(e) => { const n = [...advOrgSameAs]; n[i] = e.target.value; setAdvOrgSameAs(n); }} placeholder="https://twitter.com/..." className="schema-input flex-1" />
                        {advOrgSameAs.length > 1 && <button onClick={() => setAdvOrgSameAs(advOrgSameAs.filter((_, idx) => idx !== i))} className="ui-button schema-remove"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                ))}
                <button onClick={() => setAdvOrgSameAs([...advOrgSameAs, ''])} className="schema-addlink"><Plus className="w-4 h-4" /> Add Social Link</button>
            </div>
            {/* Services */}
            <div className="schema-note">
                <h4 className="schema-note-title">Services Offered</h4>
                {advOrgServices.map((svc, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                        <input type="text" value={svc.name} onChange={(e) => { const n = [...advOrgServices]; n[i].name = e.target.value; setAdvOrgServices(n); }} placeholder="Service name" className="schema-input" />
                        <input type="url" value={svc.url} onChange={(e) => { const n = [...advOrgServices]; n[i].url = e.target.value; setAdvOrgServices(n); }} placeholder="Service URL" className="schema-input" />
                        <input type="text" value={svc.audience} onChange={(e) => { const n = [...advOrgServices]; n[i].audience = e.target.value; setAdvOrgServices(n); }} placeholder="Target audience" className="schema-input" />
                        <button onClick={() => setAdvOrgServices(advOrgServices.filter((_, idx) => idx !== i))} className="ui-button schema-remove"><Trash2 className="w-4 h-4" /></button>
                    </div>
                ))}
                <button onClick={() => setAdvOrgServices([...advOrgServices, { name: '', url: '', description: '', audience: '' }])} className="schema-note-link"><Plus className="w-4 h-4" /> Add Service</button>
            </div>
            <button onClick={generateAdvancedOrganizationSchema} disabled={!advOrgName.trim() || isGenerating} className="ui-button ui-button-primary w-full">
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Layers className="w-5 h-5" />}
                {isGenerating ? 'Generating with AI...' : 'Generate Advanced Organization Schema'}
            </button>
        </div>
    );

    // Advanced Local Business Schema Form
    const renderAdvancedLocalBusinessForm = () => (
        <div className="space-y-6">
            {renderQuickFillSection('advancedLocalBusiness', 'from-green-500/10 to-teal-500/10', 'border-white/[0.08]')}
            {/* Basic Info */}
            <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                <h4 className="schema-note-title">Business Information</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="schema-label">Business Name *</label><input type="text" value={advLbName} onChange={(e) => setAdvLbName(e.target.value)} placeholder="Acme Plumbing" className="schema-input" /></div>
                    <div><label className="schema-label">Business Type</label>
                        <select value={advLbType} onChange={(e) => setAdvLbType(e.target.value)} className="schema-input">
                            <option value="LocalBusiness">LocalBusiness</option><option value="Restaurant">Restaurant</option><option value="Store">Store</option><option value="MedicalBusiness">MedicalBusiness</option>
                            <option value="LegalService">LegalService</option><option value="FinancialService">FinancialService</option><option value="HomeAndConstructionBusiness">HomeAndConstructionBusiness</option>
                            <option value="ProfessionalService">ProfessionalService</option><option value="AutomotiveBusiness">AutomotiveBusiness</option><option value="RealEstateAgent">RealEstateAgent</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                    <div><label className="schema-label">Website URL *</label><input type="url" value={advLbUrl} onChange={(e) => setAdvLbUrl(e.target.value)} className="schema-input" /></div>
                    <div><label className="schema-label">Google Maps URL</label><input type="url" value={advLbGoogleMapsUrl} onChange={(e) => setAdvLbGoogleMapsUrl(e.target.value)} placeholder="https://www.google.com/maps?cid=..." className="schema-input" /></div>
                </div>
                <div className="mt-3"><label className="schema-label">Description</label><textarea value={advLbDescription} onChange={(e) => setAdvLbDescription(e.target.value)} className="schema-input h-20" /></div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                    <div><label className="schema-label">Price Range</label>
                        <select value={advLbPriceRange} onChange={(e) => setAdvLbPriceRange(e.target.value)} className="schema-input">
                            <option value="$">$ (Budget)</option><option value="$$">$$ (Moderate)</option><option value="$$$">$$$ (Expensive)</option><option value="$$$$">$$$$ (Very Expensive)</option>
                        </select>
                    </div>
                    <div><label className="schema-label">Payment Accepted</label><input type="text" value={advLbPaymentAccepted} onChange={(e) => setAdvLbPaymentAccepted(e.target.value)} placeholder="Visa, Mastercard, Cash" className="schema-input" /></div>
                </div>
            </div>
            {/* Contact & Address */}
            <div className="schema-note">
                <h4 className="schema-note-title">Contact & Address</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="schema-label">Phone</label><input type="tel" value={advLbPhone} onChange={(e) => setAdvLbPhone(e.target.value)} className="schema-input" /></div>
                    <div><label className="schema-label">Email</label><input type="email" value={advLbEmail} onChange={(e) => setAdvLbEmail(e.target.value)} className="schema-input" /></div>
                </div>
                <div className="mt-3"><label className="schema-label">Street Address</label><input type="text" value={advLbStreet} onChange={(e) => setAdvLbStreet(e.target.value)} className="schema-input" /></div>
                <div className="grid grid-cols-4 gap-4 mt-3">
                    <div><label className="schema-label">City</label><input type="text" value={advLbCity} onChange={(e) => setAdvLbCity(e.target.value)} className="schema-input" /></div>
                    <div><label className="schema-label">State</label><input type="text" value={advLbRegion} onChange={(e) => setAdvLbRegion(e.target.value)} className="schema-input" /></div>
                    <div><label className="schema-label">Postal Code</label><input type="text" value={advLbPostalCode} onChange={(e) => setAdvLbPostalCode(e.target.value)} className="schema-input" /></div>
                    <div><label className="schema-label">Country</label><input type="text" value={advLbCountry} onChange={(e) => setAdvLbCountry(e.target.value)} className="schema-input" /></div>
                </div>
            </div>
            {/* Opening Hours */}
            <div className="schema-note">
                <h4 className="schema-note-title">Opening Hours</h4>
                {advLbOpeningHours.map((hours, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                        <input type="text" value={hours.days} onChange={(e) => { const n = [...advLbOpeningHours]; n[i].days = e.target.value; setAdvLbOpeningHours(n); }} placeholder="Mo-Fr" className="schema-input" />
                        <input type="time" value={hours.opens} onChange={(e) => { const n = [...advLbOpeningHours]; n[i].opens = e.target.value; setAdvLbOpeningHours(n); }} className="schema-input" />
                        <input type="time" value={hours.closes} onChange={(e) => { const n = [...advLbOpeningHours]; n[i].closes = e.target.value; setAdvLbOpeningHours(n); }} className="schema-input" />
                        <button onClick={() => setAdvLbOpeningHours(advLbOpeningHours.filter((_, idx) => idx !== i))} className="ui-button schema-remove"><Trash2 className="w-4 h-4" /></button>
                    </div>
                ))}
                <button onClick={() => setAdvLbOpeningHours([...advLbOpeningHours, { days: '', opens: '09:00', closes: '17:00' }])} className="schema-note-link"><Plus className="w-4 h-4" /> Add Hours</button>
            </div>
            {/* Awards */}
            <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                <h4 className="schema-note-title">Awards & Recognition</h4>
                {advLbAwards.map((award, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                        <input type="text" value={award} onChange={(e) => { const n = [...advLbAwards]; n[i] = e.target.value; setAdvLbAwards(n); }} placeholder="Best Business 2024" className="schema-input flex-1" />
                        {advLbAwards.length > 1 && <button onClick={() => setAdvLbAwards(advLbAwards.filter((_, idx) => idx !== i))} className="ui-button schema-remove"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                ))}
                <button onClick={() => setAdvLbAwards([...advLbAwards, ''])} className="schema-addlink"><Plus className="w-4 h-4" /> Add Award</button>
            </div>
            {/* Services */}
            <div className="schema-note">
                <h4 className="schema-note-title">Services Offered</h4>
                {advLbServices.map((svc, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                        <input type="text" value={svc.name} onChange={(e) => { const n = [...advLbServices]; n[i].name = e.target.value; setAdvLbServices(n); }} placeholder="Service name" className="schema-input" />
                        <input type="url" value={svc.url} onChange={(e) => { const n = [...advLbServices]; n[i].url = e.target.value; setAdvLbServices(n); }} placeholder="URL" className="schema-input" />
                        <input type="text" value={svc.audience} onChange={(e) => { const n = [...advLbServices]; n[i].audience = e.target.value; setAdvLbServices(n); }} placeholder="Audience" className="schema-input" />
                        <button onClick={() => setAdvLbServices(advLbServices.filter((_, idx) => idx !== i))} className="ui-button schema-remove"><Trash2 className="w-4 h-4" /></button>
                    </div>
                ))}
                <button onClick={() => setAdvLbServices([...advLbServices, { name: '', url: '', description: '', audience: '' }])} className="schema-note-link"><Plus className="w-4 h-4" /> Add Service</button>
            </div>
            {/* KnowsAbout & SameAs */}
            <div className="schema-note">
                <h4 className="schema-note-title">Expertise & Social Links</h4>
                <label className="schema-label">KnowsAbout Topics</label>
                {advLbKnowsAbout.map((item, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                        <input type="text" value={item} onChange={(e) => { const n = [...advLbKnowsAbout]; n[i] = e.target.value; setAdvLbKnowsAbout(n); }} placeholder="Topic" className="schema-input flex-1" />
                    </div>
                ))}
                <button onClick={() => setAdvLbKnowsAbout([...advLbKnowsAbout, ''])} className="schema-addlink"><Plus className="w-4 h-4" /> Add Topic</button>
                <label className="schema-label mt-3">Social Profiles (sameAs)</label>
                {advLbSameAs.map((url, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                        <input type="url" value={url} onChange={(e) => { const n = [...advLbSameAs]; n[i] = e.target.value; setAdvLbSameAs(n); }} placeholder="https://..." className="schema-input flex-1" />
                    </div>
                ))}
                <button onClick={() => setAdvLbSameAs([...advLbSameAs, ''])} className="schema-addlink"><Plus className="w-4 h-4" /> Add Link</button>
            </div>
            <button onClick={generateAdvancedLocalBusinessSchema} disabled={!advLbName.trim() || isGenerating} className="ui-button ui-button-primary w-full">
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Award className="w-5 h-5" />}
                {isGenerating ? 'Generating with AI...' : 'Generate Advanced Local Business Schema'}
            </button>
        </div>
    );

    // Advanced Service Schema Form
    const renderAdvancedServiceForm = () => (
        <div className="space-y-6">
            {renderQuickFillSection('advancedService', 'from-purple-500/10 to-violet-500/10', 'border-white/[0.08]')}
            <div className="schema-note">
                <h4 className="schema-note-title">Service Information</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="schema-label">Service Name *</label><input type="text" value={advSvcName} onChange={(e) => setAdvSvcName(e.target.value)} placeholder="Heating Services" className="schema-input" /></div>
                    <div><label className="schema-label">Service Type</label><input type="text" value={advSvcType} onChange={(e) => setAdvSvcType(e.target.value)} placeholder="Residential Heating" className="schema-input" /></div>
                </div>
                <div className="mt-3"><label className="schema-label">Description</label><textarea value={advSvcDescription} onChange={(e) => setAdvSvcDescription(e.target.value)} className="schema-input h-20" /></div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                    <div><label className="schema-label">Service URL</label><input type="url" value={advSvcUrl} onChange={(e) => setAdvSvcUrl(e.target.value)} className="schema-input" /></div>
                    <div><label className="schema-label">Target Audience</label><input type="text" value={advSvcAudience} onChange={(e) => setAdvSvcAudience(e.target.value)} placeholder="Homeowners" className="schema-input" /></div>
                </div>
            </div>
            <div className="schema-note">
                <h4 className="schema-note-title">References</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="schema-label">Provider @id</label><input type="text" value={advSvcProvider} onChange={(e) => setAdvSvcProvider(e.target.value)} placeholder="https://example.com/#organization" className="schema-input" /></div>
                    <div><label className="schema-label">Brand @id</label><input type="text" value={advSvcBrand} onChange={(e) => setAdvSvcBrand(e.target.value)} placeholder="https://example.com/#organization" className="schema-input" /></div>
                </div>
                <div className="mt-3"><label className="schema-label">Area Served @id</label><input type="text" value={advSvcAreaServedRef} onChange={(e) => setAdvSvcAreaServedRef(e.target.value)} placeholder="#servedareaidentifier" className="schema-input" /></div>
            </div>
            <div className="schema-note">
                <h4 className="schema-note-title">Sub-Services (Offer Catalog)</h4>
                {advSvcSubServices.map((svc, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                        <input type="text" value={svc.name} onChange={(e) => { const n = [...advSvcSubServices]; n[i].name = e.target.value; setAdvSvcSubServices(n); }} placeholder="Sub-service name" className="schema-input" />
                        <input type="url" value={svc.url} onChange={(e) => { const n = [...advSvcSubServices]; n[i].url = e.target.value; setAdvSvcSubServices(n); }} placeholder="URL" className="schema-input" />
                        <input type="text" value={svc.audience} onChange={(e) => { const n = [...advSvcSubServices]; n[i].audience = e.target.value; setAdvSvcSubServices(n); }} placeholder="Audience" className="schema-input" />
                        <button onClick={() => setAdvSvcSubServices(advSvcSubServices.filter((_, idx) => idx !== i))} className="ui-button schema-remove"><Trash2 className="w-4 h-4" /></button>
                    </div>
                ))}
                <button onClick={() => setAdvSvcSubServices([...advSvcSubServices, { name: '', url: '', description: '', audience: '' }])} className="schema-note-link"><Plus className="w-4 h-4" /> Add Sub-Service</button>
            </div>
            <button onClick={generateAdvancedServiceSchema} disabled={!advSvcName.trim() || isGenerating} className="ui-button ui-button-primary w-full">
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Briefcase className="w-5 h-5" />}
                {isGenerating ? 'Generating with AI...' : 'Generate Advanced Service Schema'}
            </button>
        </div>
    );

    // Advanced WebPage Schema Form
    const renderAdvancedWebPageForm = () => (
        <div className="space-y-6">
            {renderQuickFillSection('advancedWebPage', 'from-brand-500/[0.04] to-transparent', 'border-white/[0.08]')}
            <div className="p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                <h4 className="schema-note-title">Page Information</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="schema-label">Page URL (@id) *</label><input type="url" value={advWpUrl} onChange={(e) => setAdvWpUrl(e.target.value)} placeholder="https://example.com/page" className="schema-input" /></div>
                    <div><label className="schema-label">Page Name</label><input type="text" value={advWpName} onChange={(e) => setAdvWpName(e.target.value)} className="schema-input" /></div>
                </div>
                <div className="mt-3"><label className="schema-label">Description</label><textarea value={advWpDescription} onChange={(e) => setAdvWpDescription(e.target.value)} className="schema-input h-20" /></div>
                <div className="mt-3"><label className="schema-label">Publisher @id</label><input type="text" value={advWpPublisher} onChange={(e) => setAdvWpPublisher(e.target.value)} placeholder="https://maps.google.com/?cid=..." className="schema-input" /></div>
            </div>
            <div className="schema-note">
                <h4 className="schema-note-title">About Entities</h4>
                <p className="schema-note-text mb-2">AI will generate Wikipedia and Knowledge Graph URLs for each entity</p>
                {advWpAboutEntities.map((entity, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                        <input type="text" value={entity.name} onChange={(e) => { const n = [...advWpAboutEntities]; n[i].name = e.target.value; setAdvWpAboutEntities(n); }} placeholder="Entity name (e.g., HVAC)" className="schema-input" />
                        <input type="url" value={entity.wikiUrl} onChange={(e) => { const n = [...advWpAboutEntities]; n[i].wikiUrl = e.target.value; setAdvWpAboutEntities(n); }} placeholder="Wikipedia URL (optional)" className="schema-input" />
                        <input type="url" value={entity.kgUrl} onChange={(e) => { const n = [...advWpAboutEntities]; n[i].kgUrl = e.target.value; setAdvWpAboutEntities(n); }} placeholder="Knowledge Graph URL (optional)" className="schema-input" />
                        <button onClick={() => setAdvWpAboutEntities(advWpAboutEntities.filter((_, idx) => idx !== i))} className="ui-button schema-remove"><Trash2 className="w-4 h-4" /></button>
                    </div>
                ))}
                <button onClick={() => setAdvWpAboutEntities([...advWpAboutEntities, { name: '', wikiUrl: '', kgUrl: '' }])} className="schema-addlink"><Plus className="w-4 h-4" /> Add About Entity</button>
            </div>
            <div className="schema-note">
                <h4 className="schema-note-title">Mentions Entities</h4>
                <p className="text-xs text-brand-300 mb-2">Entities mentioned but not the main topic of the page</p>
                {advWpMentionsEntities.map((entity, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                        <input type="text" value={entity.name} onChange={(e) => { const n = [...advWpMentionsEntities]; n[i].name = e.target.value; setAdvWpMentionsEntities(n); }} placeholder="Entity name" className="schema-input" />
                        <input type="url" value={entity.wikiUrl} onChange={(e) => { const n = [...advWpMentionsEntities]; n[i].wikiUrl = e.target.value; setAdvWpMentionsEntities(n); }} placeholder="Wikipedia URL (optional)" className="schema-input" />
                        <input type="url" value={entity.kgUrl} onChange={(e) => { const n = [...advWpMentionsEntities]; n[i].kgUrl = e.target.value; setAdvWpMentionsEntities(n); }} placeholder="Knowledge Graph URL (optional)" className="schema-input" />
                        <button onClick={() => setAdvWpMentionsEntities(advWpMentionsEntities.filter((_, idx) => idx !== i))} className="ui-button schema-remove"><Trash2 className="w-4 h-4" /></button>
                    </div>
                ))}
                <button onClick={() => setAdvWpMentionsEntities([...advWpMentionsEntities, { name: '', wikiUrl: '', kgUrl: '' }])} className="schema-addlink"><Plus className="w-4 h-4" /> Add Mentions Entity</button>
            </div>
            <button onClick={generateAdvancedWebPageSchema} disabled={!advWpUrl.trim() || isGenerating} className="ui-button ui-button-primary w-full">
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileCode className="w-5 h-5" />}
                {isGenerating ? 'Generating with AI...' : 'Generate Advanced WebPage Schema'}
            </button>
        </div>
    );

    // SoftwareApplication Form
    const renderSoftwareApplicationForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('softwareApplication', 'from-emerald-500/10 to-green-500/10', 'border-white/[0.08]')}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Software Name *</label>
                    <input type="text" value={softwareName} onChange={(e) => setSoftwareName(e.target.value)} placeholder="ProEdit Photo Editor" className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Application Type</label>
                    <select value={softwareType} onChange={(e) => setSoftwareType(e.target.value)} className="schema-input">
                        <option value="SoftwareApplication">Software Application</option>
                        <option value="WebApplication">Web Application</option>
                        <option value="DesktopApplication">Desktop Application</option>
                    </select>
                </div>
            </div>
            <div>
                <label className="schema-label">Description *</label>
                <textarea value={softwareDescription} onChange={(e) => setSoftwareDescription(e.target.value)} placeholder="Professional photo editing software..." rows={3} className="schema-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">Software URL</label>
                    <input type="url" value={softwareUrl} onChange={(e) => setSoftwareUrl(e.target.value)} placeholder="https://example.com" className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Download URL</label>
                    <input type="url" value={softwareDownloadUrl} onChange={(e) => setSoftwareDownloadUrl(e.target.value)} placeholder="https://example.com/download" className="schema-input" />
                </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="schema-label">Version</label>
                    <input type="text" value={softwareVersion} onChange={(e) => setSoftwareVersion(e.target.value)} placeholder="5.2.0" className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Operating System</label>
                    <input type="text" value={softwareOS} onChange={(e) => setSoftwareOS(e.target.value)} placeholder="Windows, macOS, Linux" className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Category</label>
                    <select value={softwareCategory} onChange={(e) => setSoftwareCategory(e.target.value)} className="schema-input">
                        <option value="">Select category</option>
                        <option value="BusinessApplication">Business</option>
                        <option value="DesignApplication">Design</option>
                        <option value="DeveloperApplication">Developer Tools</option>
                        <option value="EducationApplication">Education</option>
                        <option value="EntertainmentApplication">Entertainment</option>
                        <option value="FinanceApplication">Finance</option>
                        <option value="HealthApplication">Health</option>
                        <option value="LifestyleApplication">Lifestyle</option>
                        <option value="MultimediaApplication">Multimedia</option>
                        <option value="ProductivityApplication">Productivity</option>
                        <option value="SecurityApplication">Security</option>
                        <option value="UtilitiesApplication">Utilities</option>
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
                <div>
                    <label className="schema-label">Price</label>
                    <input type="text" value={softwarePrice} onChange={(e) => setSoftwarePrice(e.target.value)} placeholder="99.99" className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Currency</label>
                    <select value={softwareCurrency} onChange={(e) => setSoftwareCurrency(e.target.value)} className="schema-input">
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                    </select>
                </div>
                <div>
                    <label className="schema-label">Rating (1-5)</label>
                    <input type="text" value={softwareRating} onChange={(e) => setSoftwareRating(e.target.value)} placeholder="4.8" className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Rating Count</label>
                    <input type="text" value={softwareRatingCount} onChange={(e) => setSoftwareRatingCount(e.target.value)} placeholder="15420" className="schema-input" />
                </div>
            </div>
            <div>
                <label className="schema-label">Image URL</label>
                <input type="url" value={softwareImage} onChange={(e) => setSoftwareImage(e.target.value)} placeholder="https://example.com/screenshot.png" className="schema-input" />
            </div>
            <div>
                <label className="schema-label">Author/Publisher</label>
                <input type="text" value={softwareAuthor} onChange={(e) => setSoftwareAuthor(e.target.value)} placeholder="Company Name" className="schema-input" />
            </div>
            <button onClick={generateSoftwareApplicationSchema} disabled={!softwareName.trim()} className="ui-button ui-button-primary w-full">
                <Code className="w-5 h-5" />
                Generate Software Schema
            </button>
        </div>
    );

    // MobileApplication Form
    const renderMobileApplicationForm = () => (
        <div className="space-y-4">
            {renderQuickFillSection('mobileApplication', 'from-brand-500/[0.04] to-transparent', 'border-white/[0.08]')}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">App Name *</label>
                    <input type="text" value={mobileAppName} onChange={(e) => setMobileAppName(e.target.value)} placeholder="FitTrack Pro" className="schema-input focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent" />
                </div>
                <div>
                    <label className="schema-label">Operating System</label>
                    <input type="text" value={mobileAppOS} onChange={(e) => setMobileAppOS(e.target.value)} placeholder="iOS, Android" className="schema-input" />
                </div>
            </div>
            <div>
                <label className="schema-label">Description *</label>
                <textarea value={mobileAppDescription} onChange={(e) => setMobileAppDescription(e.target.value)} placeholder="Comprehensive fitness tracking app..." rows={3} className="schema-input focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">App Store URL (iOS)</label>
                    <input type="url" value={mobileAppStoreUrl} onChange={(e) => setMobileAppStoreUrl(e.target.value)} placeholder="https://apps.apple.com/app/..." className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Play Store URL (Android)</label>
                    <input type="url" value={mobilePlayStoreUrl} onChange={(e) => setMobilePlayStoreUrl(e.target.value)} placeholder="https://play.google.com/store/apps/..." className="schema-input" />
                </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="schema-label">Version</label>
                    <input type="text" value={mobileAppVersion} onChange={(e) => setMobileAppVersion(e.target.value)} placeholder="3.1.0" className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Website URL</label>
                    <input type="url" value={mobileAppUrl} onChange={(e) => setMobileAppUrl(e.target.value)} placeholder="https://example.com" className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Category</label>
                    <select value={mobileAppCategory} onChange={(e) => setMobileAppCategory(e.target.value)} className="schema-input">
                        <option value="">Select category</option>
                        <option value="BusinessApplication">Business</option>
                        <option value="EducationApplication">Education</option>
                        <option value="EntertainmentApplication">Entertainment</option>
                        <option value="FinanceApplication">Finance</option>
                        <option value="FoodApplication">Food & Drink</option>
                        <option value="GameApplication">Games</option>
                        <option value="HealthApplication">Health & Fitness</option>
                        <option value="LifestyleApplication">Lifestyle</option>
                        <option value="MusicApplication">Music</option>
                        <option value="NavigationApplication">Navigation</option>
                        <option value="NewsApplication">News</option>
                        <option value="PhotoApplication">Photo & Video</option>
                        <option value="ProductivityApplication">Productivity</option>
                        <option value="ShoppingApplication">Shopping</option>
                        <option value="SocialNetworkingApplication">Social</option>
                        <option value="SportsApplication">Sports</option>
                        <option value="TravelApplication">Travel</option>
                        <option value="UtilitiesApplication">Utilities</option>
                        <option value="WeatherApplication">Weather</option>
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
                <div>
                    <label className="schema-label">Price (0 for free)</label>
                    <input type="text" value={mobileAppPrice} onChange={(e) => setMobileAppPrice(e.target.value)} placeholder="0" className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Currency</label>
                    <select value={mobileAppCurrency} onChange={(e) => setMobileAppCurrency(e.target.value)} className="schema-input">
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                    </select>
                </div>
                <div>
                    <label className="schema-label">Rating (1-5)</label>
                    <input type="text" value={mobileAppRating} onChange={(e) => setMobileAppRating(e.target.value)} placeholder="4.7" className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Rating Count</label>
                    <input type="text" value={mobileAppRatingCount} onChange={(e) => setMobileAppRatingCount(e.target.value)} placeholder="89000" className="schema-input" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="schema-label">App Icon URL</label>
                    <input type="url" value={mobileAppImage} onChange={(e) => setMobileAppImage(e.target.value)} placeholder="https://example.com/icon.png" className="schema-input" />
                </div>
                <div>
                    <label className="schema-label">Developer/Publisher</label>
                    <input type="text" value={mobileAppAuthor} onChange={(e) => setMobileAppAuthor(e.target.value)} placeholder="Company Name" className="schema-input" />
                </div>
            </div>
            <button onClick={generateMobileApplicationSchema} disabled={!mobileAppName.trim()} className="ui-button ui-button-primary w-full">
                <Globe className="w-5 h-5" />
                Generate Mobile App Schema
            </button>
        </div>
    );

    const renderForm = () => {
        switch (activeSchema) {
            case 'entity': return renderEntityForm();
            case 'localBusiness': return renderLocalBusinessForm();
            case 'breadcrumb': return renderBreadcrumbForm();
            case 'navigation': return renderNavigationForm();
            case 'faq': return renderFAQForm();
            case 'article': return renderArticleForm();
            case 'product': return renderProductForm();
            case 'organization': return renderOrganizationForm();
            case 'person': return renderPersonForm();
            case 'itemList': return renderItemListForm();
            case 'aboutPage': return renderAboutPageForm();
            case 'contactPage': return renderContactPageForm();
            case 'authorPage': return renderAuthorPageForm();
            // New Advanced Schema Types
            case 'event': return renderEventForm();
            case 'advancedOrg': return renderAdvancedOrganizationForm();
            case 'advancedLocalBusiness': return renderAdvancedLocalBusinessForm();
            case 'advancedService': return renderAdvancedServiceForm();
            case 'advancedWebPage': return renderAdvancedWebPageForm();
            case 'softwareApplication': return renderSoftwareApplicationForm();
            case 'mobileApplication': return renderMobileApplicationForm();
            default: return null;
        }
    };

    // Schema type selection grid
    if (!activeSchema) {
        return (
            <div className="schema-page">
                <div className="">
                    {/* Header */}
                    <div className="ctool-hero mb-8">
                        <div className="ctool-hero-row">
                            <span className="ctool-hero-icon">
                                <Code className="w-5 h-5" />
                            </span>
                            <div className="min-w-0">
                                <h1 className="ctool-title font-display">Schema SEO</h1>
                                <p className="ctool-subtitle">Generate structured data markup for better SEO and rich results</p>
                            </div>
                        </div>
                    </div>

                    {/* Schema Types Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {SCHEMA_TYPES.map((type) => {
                            const Icon = type.icon;
                            return (
                                <div
                                    key={type.id}
                                    onClick={() => navigate(`/schema-seo/${type.id}`)}
                                    className="schema-type group"
                                >
                                    <div className="schema-type-icon">
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <h3 className="schema-type-name">{type.name}</h3>
                                    <p className="schema-type-desc">{type.description}</p>
                                    {['entity', 'localBusiness', 'advancedOrg', 'advancedLocalBusiness', 'advancedService', 'advancedWebPage'].includes(type.id) && (
                                        <span className="schema-badge">
                                            <Sparkles className="w-3 h-3" /> AI-Powered
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {/* Bottom spacing */}
                    <div className="pb-16"></div>
                </div>
            </div>
        );
    }

    const currentType = SCHEMA_TYPES.find(t => t.id === activeSchema);
    const Icon = currentType?.icon || Code;

    return (
        <div className="schema-page">
            <div className="">
                {/* Back Button */}
                <button
                    onClick={() => { navigate('/schema-seo'); setGeneratedSchema(null); }}
                    className="ui-button ctool-tool-btn mb-6"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back to Schema Types
                </button>

                {/* Header */}
                <div className="ctool-hero mb-6">
                    <div className="ctool-hero-row">
                        <span className="ctool-hero-icon">
                            <Icon className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                            <h2 className="ctool-title font-display">{currentType?.name}</h2>
                            <p className="ctool-subtitle">{currentType?.description}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Input Form */}
                    <div className="schema-card">
                        <h3 className="schema-card-title mb-4">Input Details</h3>
                        {renderForm()}
                    </div>

                    {/* Generated Schema Output */}
                    <div className="schema-card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="schema-card-title">Generated JSON-LD</h3>
                            {generatedSchema && (
                                <button
                                    onClick={copyToClipboard}
                                    className="ui-button ctool-tool-btn"
                                >
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            )}
                        </div>

                        {generatedSchema ? (
                            <div className="schema-code">
                                <pre>
                                    <code>{`<script type="application/ld+json">\n${JSON.stringify(generatedSchema, null, 2)}\n</script>`}</code>
                                </pre>
                            </div>
                        ) : (
                            <div className="schema-output-empty">
                                <Code className="w-12 h-12 mx-auto mb-3" />
                                <p>Fill in the form and generate your schema markup</p>
                            </div>
                        )}

                        {generatedSchema && (
                            <div className="schema-note mt-4">
                                <h4 className="schema-note-title flex items-center gap-2">
                                    <ExternalLink className="w-4 h-4" />
                                    Validate Your Schema
                                </h4>
                                <div className="flex flex-col gap-2">
                                    <a
                                        href="https://validator.schema.org/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="schema-note-link"
                                    >
                                        ✓ Schema.org Validator (Official) →
                                    </a>
                                    <a
                                        href="https://search.google.com/test/rich-results"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="schema-note-link"
                                    >
                                        ✓ Google Rich Results Test →
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Bottom spacing */}
                    <div className="pb-16"></div>
                </div>
            </div>
        </div>
    );
};

export default SchemaGenerator;
